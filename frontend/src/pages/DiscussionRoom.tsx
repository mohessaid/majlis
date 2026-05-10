import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { getRoom, dismissParticipant, endRoom, addParticipant, getAvailableModels, type Room, type ModelInfo } from "../lib/api";
import { useDiscussion } from "../hooks/useDiscussion";
import { ParticipantPanel } from "../components/Room/ParticipantPanel";
import { MessageBubble } from "../components/Room/MessageBubble";
import { DismissModal } from "../components/Room/DismissModal";
import { ModelPicker } from "../components/ModelPicker";

export function DiscussionRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { getToken } = useAuth();

  const [room, setRoom] = useState<Room | null>(null);
  const [input, setInput] = useState("");
  const [dismissTarget, setDismissTarget] = useState<{ id: string; name: string } | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [allModels, setAllModels] = useState<ModelInfo[]>([]);
  const [curatorSuggestion, setCuratorSuggestion] = useState<string | null>(null);
  const [showEndModal, setShowEndModal] = useState(false);
  const [rating, setRating] = useState(0);
  const [ended, setEnded] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  const { messages, streaming, send, requestDepth } = useDiscussion(roomId!, null);

  // Load room on mount
  useEffect(() => {
    if (!roomId) return;
    (async () => {
      const token = await getToken();
      const data = await getRoom(roomId, token ?? undefined);
      setRoom(data);
    })();
  }, [roomId]);

  // Auto-scroll
  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages]);

  const displayNames = Object.fromEntries(
    (room?.participants ?? []).map((p) => [p.id, p.display_name])
  );

  function handleSend() {
    if (!input.trim() || streaming) return;
    send(input.trim(), displayNames);
    setInput("");
  }

  async function handleDismiss(reason: string) {
    if (!dismissTarget || !roomId) return;
    const token = await getToken();
    const result = await dismissParticipant(roomId, dismissTarget.id, reason, token ?? undefined);
    setRoom((prev) =>
      prev
        ? {
            ...prev,
            participants: prev.participants.map((p) =>
              p.id === dismissTarget.id ? { ...p, dismissed: true, dismissal_reason: reason } : p
            ),
          }
        : prev
    );
    if (result.curator_suggestion) {
      setCuratorSuggestion(
        `👁 Curator suggests: ${result.curator_suggestion.model_id} — ${result.curator_suggestion.reason}`
      );
      setTimeout(() => setCuratorSuggestion(null), 8000);
    }
    setDismissTarget(null);
  }

  async function openPicker() {
    if (!roomId) return;
    const token = await getToken();
    const data = await getAvailableModels(roomId, token ?? undefined);
    setAllModels(data.models);
    setShowPicker(true);
  }

  async function handleAddModel(modelId: string, caps: { web_search: boolean; thinking: boolean; fast_mode: boolean }) {
    if (!roomId) return;
    setShowPicker(false);
    const token = await getToken();
    const result = await addParticipant(roomId, modelId, caps, token ?? undefined);
    const model = allModels.find((m) => m.model_id === modelId);
    setRoom((prev) =>
      prev
        ? {
            ...prev,
            participants: [
              ...prev.participants,
              {
                id: result.participant_id,
                model_id: modelId,
                display_name: model?.display_name ?? modelId,
                capabilities: caps,
                dismissed: false,
              },
            ],
          }
        : prev
    );
  }

  async function handleEndRoom() {
    if (!roomId || rating === 0) return;
    const token = await getToken();
    await endRoom(roomId, rating, token ?? undefined);
    setEnded(true);
    setShowEndModal(false);
  }

  if (!room) {
    return (
      <div className="room-loading">
        <div className="spinner" />
        <p>Loading room…</p>
      </div>
    );
  }

  if (ended) {
    return (
      <main className="ended-screen">
        <div className="ended-inner">
          <h2>Discussion Ended</h2>
          <p className="ended-topic">"{room.question}"</p>
          <p>Participants who stayed: {room.participants.filter((p) => !p.dismissed).map((p) => p.display_name).join(", ") || "none"}</p>
          <button className="btn-primary" onClick={() => navigate("/")}>Start a New Room</button>
        </div>
      </main>
    );
  }

  return (
    <div className="room-layout">
      <ParticipantPanel
        participants={room.participants}
        onDismiss={(id, name) => setDismissTarget({ id, name })}
        disabled={streaming}
      />

      <div className="room-main">
        <div className="room-topbar">
          <div className="room-topic">
            <span className="topic-category">{room.category.replace("_", " ")}</span>
            <span className="topic-text">"{room.question}"</span>
          </div>
          <div className="room-actions">
            <button className="btn-ghost" onClick={openPicker}>+ Add Model</button>
            <button className="btn-ghost btn-ghost--danger" onClick={() => setShowEndModal(true)}>End Discussion</button>
          </div>
        </div>

        {curatorSuggestion && (
          <div className="curator-callout curator-callout--banner">
            <span className="curator-icon">👁</span>
            <span>{curatorSuggestion}</span>
          </div>
        )}

        <div className="discussion-thread" ref={threadRef}>
          {messages.length === 0 && (
            <div className="thread-empty">
              <p>Ask your first question to start the discussion.</p>
            </div>
          )}
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              onGoDeeper={(pid) => requestDepth(pid, displayNames)}
  
            />
          ))}
        </div>

        <div className="message-input-area">
          <textarea
            className="message-input"
            placeholder="Ask the room a question… (Shift+Enter for new line)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={streaming}
            rows={2}
          />
          <button
            className="btn-primary send-btn"
            onClick={handleSend}
            disabled={streaming || !input.trim()}
          >
            {streaming ? "…" : "Send"}
          </button>
        </div>
      </div>

      {dismissTarget && (
        <DismissModal
          participantName={dismissTarget.name}
          onConfirm={handleDismiss}
          onCancel={() => setDismissTarget(null)}
        />
      )}

      {showPicker && (
        <ModelPicker
          models={allModels}
          existingModelIds={room.participants.filter((p) => !p.dismissed).map((p) => p.model_id)}
          onAdd={handleAddModel}
          onClose={() => setShowPicker(false)}
        />
      )}

      {showEndModal && (
        <div className="modal-overlay" onClick={() => setShowEndModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">End Discussion</h3>
            <p className="modal-subtitle">Rate the overall quality of this discussion (1–5)</p>
            <div className="star-row">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  className={`star-btn ${rating >= s ? "star-btn--active" : ""}`}
                  onClick={() => setRating(s)}
                >
                  ★
                </button>
              ))}
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowEndModal(false)}>Cancel</button>
              <button className="btn-primary" disabled={rating === 0} onClick={handleEndRoom}>
                End & Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
