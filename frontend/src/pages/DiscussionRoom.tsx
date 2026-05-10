import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { getRoom, dismissParticipant, endRoom, addParticipant, getAvailableModels, type Room, type ModelInfo } from "../lib/api";
import { useDiscussion } from "../hooks/useDiscussion";
import { Button, Card, Textarea, Spinner, ModelDot, modelColor, modelBg, ScoreBar, cn } from "../components/ui";

const MODEL_SHORT: Record<string, string> = {
  "llama-3.1-8b": "Llama",
  "qwen2.5-7b": "Qwen",
  "mistral-7b": "Mistral",
  "deepseek-r1-8b": "DeepSeek",
  curator: "Curator",
};

const LAYER_LABEL: Record<string, string> = {
  depth: "Deep dive",
  thinking: "Thinking",
};

export function DiscussionRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { getToken } = useAuth();

  const [token, setToken] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [input, setInput] = useState("");
  const [showDismiss, setShowDismiss] = useState<{ id: string; name: string } | null>(null);
  const [dismissReason, setDismissReason] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [allModels, setAllModels] = useState<ModelInfo[]>([]);
  const [curatorNote, setCuratorNote] = useState<string | null>(null);
  const [showEndModal, setShowEndModal] = useState(false);
  const [rating, setRating] = useState(0);
  const [ended, setEnded] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  // Resolve token once and keep it fresh
  useEffect(() => {
    getToken().then(setToken);
  }, []);

  const { messages, streaming, send, requestDepth } = useDiscussion(roomId!, token);

  useEffect(() => {
    if (!roomId) return;
    (async () => {
      const t = await getToken();
      setToken(t);
      const data = await getRoom(roomId, t ?? undefined);
      setRoom(data);
    })();
  }, [roomId]);

  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [messages]);

  const displayNames = Object.fromEntries(
    (room?.participants ?? []).map((p) => [p.id, p.display_name])
  );

  function handleSend() {
    if (!input.trim() || streaming) return;
    send(input.trim(), displayNames);
    setInput("");
  }

  async function handleDismiss() {
    if (!showDismiss || !roomId) return;
    const t = await getToken();
    const result = await dismissParticipant(roomId, showDismiss.id, dismissReason, t ?? undefined);
    setRoom((prev) => prev ? {
      ...prev,
      participants: prev.participants.map((p) =>
        p.id === showDismiss.id ? { ...p, dismissed: true, dismissal_reason: dismissReason } : p
      ),
    } : prev);
    if (result.curator_suggestion) {
      setCuratorNote(`Curator suggests: ${result.curator_suggestion.model_id} — ${result.curator_suggestion.reason}`);
      setTimeout(() => setCuratorNote(null), 8000);
    }
    setShowDismiss(null);
    setDismissReason("");
  }

  async function openPicker() {
    if (!roomId) return;
    const t = await getToken();
    const data = await getAvailableModels(roomId, t ?? undefined);
    setAllModels(data.models);
    setShowPicker(true);
  }

  async function handleAddModel(modelId: string) {
    if (!roomId) return;
    setShowPicker(false);
    const t = await getToken();
    const result = await addParticipant(roomId, modelId, { web_search: false, thinking: false, fast_mode: false }, t ?? undefined);
    const model = allModels.find((m) => m.model_id === modelId);
    setRoom((prev) => prev ? {
      ...prev,
      participants: [...prev.participants, {
        id: result.participant_id,
        model_id: modelId,
        display_name: model?.display_name ?? modelId,
        capabilities: { web_search: false, thinking: false, fast_mode: false },
        dismissed: false,
      }],
    } : prev);
  }

  async function handleEndRoom() {
    if (!roomId || rating === 0) return;
    const t = await getToken();
    await endRoom(roomId, rating, t ?? undefined);
    setEnded(true);
    setShowEndModal(false);
  }

  if (!room) {
    return (
      <div className="flex h-screen items-center justify-center gap-3 text-[#868e96] bg-[#f8f9fa]">
        <Spinner className="h-5 w-5 text-[#4c6ef5]" />
        <span className="text-sm">Loading room…</span>
      </div>
    );
  }

  if (ended) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-6 px-4 bg-[#f8f9fa]">
        <div className="space-y-2 text-center">
          <p className="text-xs uppercase tracking-widest text-[#adb5bd] font-medium">Discussion ended</p>
          <p className="text-lg font-semibold text-[#212529]">"{room.question}"</p>
          <p className="text-sm text-[#868e96]">
            {room.participants.filter((p) => !p.dismissed).map((p) => p.display_name).join(", ") || "No participants remained"}
          </p>
        </div>
        <Button onClick={() => navigate("/")}>Start a New Discussion</Button>
      </div>
    );
  }

  const activeParticipants = room.participants.filter((p) => !p.dismissed);

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8f9fa]">

      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 border-r border-[#e9ecef] flex flex-col bg-white">
        <div className="px-4 py-4 border-b border-[#e9ecef]">
          <p className="text-[10px] uppercase tracking-widest text-[#adb5bd] mb-1 font-semibold">{room.category.replace("_", " ")}</p>
          <p className="text-xs text-[#868e96] leading-relaxed line-clamp-3">"{room.question}"</p>
        </div>

        <div className="flex-1 overflow-y-auto py-3 px-2">
          <p className="px-2 text-[10px] uppercase tracking-widest text-[#ced4da] mb-2 font-semibold">Participants</p>
          {activeParticipants.map((p) => {
            const color = modelColor(p.model_id);
            const bg = modelBg(p.model_id);
            return (
              <div key={p.id} className="group flex items-center justify-between rounded-lg px-2 py-2 hover:bg-[#f8f9fa] transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="h-6 w-6 rounded-md flex-shrink-0 flex items-center justify-center text-[10px] font-bold"
                    style={{ background: bg, color }}
                  >
                    {(MODEL_SHORT[p.model_id] ?? p.display_name).charAt(0)}
                  </div>
                  <span className="text-xs text-[#495057] truncate font-medium">
                    {MODEL_SHORT[p.model_id] ?? p.display_name}
                  </span>
                </div>
                <button
                  onClick={() => setShowDismiss({ id: p.id, name: p.display_name })}
                  className="opacity-0 group-hover:opacity-100 text-[#ced4da] hover:text-[#e03131] transition-all text-xs"
                  title="Dismiss"
                >
                  ✕
                </button>
              </div>
            );
          })}
          {room.participants.filter((p) => p.dismissed).map((p) => (
            <div key={p.id} className="flex items-center gap-2 rounded-lg px-2 py-2 opacity-40">
              <ModelDot modelId={p.model_id} size={6} />
              <span className="text-xs text-[#adb5bd] line-through truncate">{MODEL_SHORT[p.model_id] ?? p.display_name}</span>
            </div>
          ))}
        </div>

        <div className="p-3 space-y-1.5 border-t border-[#e9ecef]">
          <Button variant="secondary" size="sm" className="w-full text-xs" onClick={openPicker}>
            + Add Model
          </Button>
          <Button variant="danger" size="sm" className="w-full text-xs" onClick={() => setShowEndModal(true)}>
            End Discussion
          </Button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">

        {/* Curator banner */}
        {curatorNote && (
          <div className="flex items-center gap-3 border-b border-[#e5dbff] bg-[#f3f0ff] px-5 py-3">
            <ModelDot modelId="curator" size={7} />
            <span className="text-xs text-[#5f3dc4]">{curatorNote}</span>
          </div>
        )}

        {/* Thread */}
        <div ref={threadRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
          {messages.length === 0 && (
            <div className="flex h-full min-h-[200px] items-center justify-center">
              <div className="text-center space-y-3">
                <div className="flex items-center justify-center gap-2">
                  {activeParticipants.slice(0, 4).map((p) => (
                    <div
                      key={p.id}
                      className="h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold"
                      style={{ background: modelBg(p.model_id), color: modelColor(p.model_id) }}
                    >
                      {(MODEL_SHORT[p.model_id] ?? p.display_name).charAt(0)}
                    </div>
                  ))}
                </div>
                <p className="text-sm font-medium text-[#495057]">
                  {activeParticipants.map((p) => MODEL_SHORT[p.model_id] ?? p.display_name).join(", ")} {activeParticipants.length === 1 ? "is" : "are"} ready.
                </p>
                <p className="text-xs text-[#adb5bd]">Send your first message to start the discussion.</p>
              </div>
            </div>
          )}

          {messages.map((msg) => {
            if (msg.layer === "user") {
              return (
                <div key={msg.id} className="flex justify-end">
                  <div className="max-w-xl rounded-2xl rounded-tr-sm bg-[#4c6ef5] px-4 py-3">
                    <p className="text-sm text-white whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  </div>
                </div>
              );
            }

            if (msg.layer === "curator") {
              return (
                <div key={msg.id} className="flex gap-3">
                  <div className="h-8 w-8 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-bold bg-[#f3f0ff] text-[#7950f2]">
                    C
                  </div>
                  <div className="flex-1 max-w-xl rounded-2xl rounded-tl-sm border border-[#e5dbff] bg-[#f3f0ff] px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7950f2] mb-1">Curator</p>
                    <p className="text-sm text-[#5f3dc4] italic whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              );
            }

            const color = modelColor(msg.model_id);
            const bg = modelBg(msg.model_id);
            const shortName = MODEL_SHORT[msg.model_id] ?? msg.display_name;
            return (
              <div key={msg.id} className="flex gap-3 group">
                <div
                  className="h-8 w-8 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-bold mt-0.5"
                  style={{ background: bg, color }}
                >
                  {shortName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold" style={{ color }}>{shortName}</span>
                    {msg.layer in LAYER_LABEL && (
                      <span className="text-[10px] text-[#adb5bd] bg-[#f1f3f5] rounded-full px-2 py-0.5 font-medium">
                        {LAYER_LABEL[msg.layer]}
                      </span>
                    )}
                    {msg.searched && (
                      <span className="text-[10px] text-[#adb5bd] bg-[#f1f3f5] rounded-full px-2 py-0.5 font-medium">searched</span>
                    )}
                    {msg.streaming && (
                      <span className="flex gap-0.5 items-center ml-1">
                        {[0, 1, 2].map((i) => (
                          <span key={i} className="h-1 w-1 rounded-full bg-[#4c6ef5] animate-bounce"
                            style={{ animationDelay: `${i * 150}ms` }} />
                        ))}
                      </span>
                    )}
                  </div>
                  <div className="rounded-2xl rounded-tl-sm border border-[#e9ecef] bg-white px-4 py-3 shadow-sm">
                    <p className="text-sm text-[#343a40] whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  </div>
                  {!msg.streaming && msg.layer === "surface" && (
                    <button
                      onClick={() => requestDepth(msg.participant_id, displayNames)}
                      className="mt-1.5 text-[11px] text-[#ced4da] hover:text-[#4c6ef5] opacity-0 group-hover:opacity-100 transition-all font-medium"
                    >
                      Go deeper →
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Input */}
        <div className="border-t border-[#e9ecef] bg-white px-6 py-4">
          <div className="flex gap-3 items-end">
            <Textarea
              placeholder="Ask the room… (Enter to send, Shift+Enter for new line)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={2}
              disabled={streaming}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
              }}
              className="flex-1"
            />
            <Button
              onClick={handleSend}
              disabled={streaming || !input.trim()}
              className="flex-shrink-0"
              style={{ height: "70px", minWidth: "72px" }}
            >
              {streaming ? <Spinner className="h-4 w-4" /> : "Send"}
            </Button>
          </div>
        </div>
      </div>

      {/* Dismiss modal */}
      {showDismiss && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm" onClick={() => setShowDismiss(null)}>
          <Card className="w-full max-w-sm p-6 space-y-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div>
              <p className="text-sm font-semibold text-[#212529]">Dismiss {showDismiss.name}?</p>
              <p className="text-xs text-[#adb5bd] mt-0.5">Tell the Curator why</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {["Too verbose", "Off topic", "Not helpful", "Repetitive"].map((r) => (
                <button
                  key={r}
                  onClick={() => setDismissReason(r)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs border transition-colors font-medium",
                    dismissReason === r
                      ? "border-[#bac8ff] bg-[#edf2ff] text-[#4263eb]"
                      : "border-[#dee2e6] text-[#adb5bd] hover:text-[#868e96] hover:border-[#ced4da]"
                  )}
                >{r}</button>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setShowDismiss(null)}>Cancel</Button>
              <Button variant="danger" size="sm" disabled={!dismissReason} onClick={handleDismiss}>Dismiss</Button>
            </div>
          </Card>
        </div>
      )}

      {/* Model picker */}
      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm" onClick={() => setShowPicker(false)}>
          <Card className="w-full max-w-sm p-6 space-y-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-semibold text-[#212529]">Add a Model</p>
            <div className="space-y-2">
              {allModels
                .filter((m) => !room.participants.find((p) => p.model_id === m.model_id && !p.dismissed))
                .map((m: ModelInfo) => (
                  <div
                    key={m.model_id}
                    className="flex items-center gap-3 rounded-xl border border-[#e9ecef] bg-[#f8f9fa] p-3 cursor-pointer hover:border-[#dee2e6] hover:bg-white transition-all"
                    onClick={() => handleAddModel(m.model_id)}
                  >
                    <div
                      className="h-7 w-7 rounded-md flex items-center justify-center text-xs font-bold"
                      style={{ background: modelBg(m.model_id), color: modelColor(m.model_id) }}
                    >
                      {(MODEL_SHORT[m.model_id] ?? m.display_name).charAt(0)}
                    </div>
                    <span className="text-sm font-medium text-[#495057]">{MODEL_SHORT[m.model_id] ?? m.display_name}</span>
                    <div className="ml-auto w-20">
                      <ScoreBar score={m.score} />
                    </div>
                  </div>
                ))}
            </div>
            <Button variant="ghost" size="sm" className="w-full" onClick={() => setShowPicker(false)}>Cancel</Button>
          </Card>
        </div>
      )}

      {/* End room modal */}
      {showEndModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm" onClick={() => setShowEndModal(false)}>
          <Card className="w-full max-w-sm p-6 space-y-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div>
              <p className="text-sm font-semibold text-[#212529]">End Discussion</p>
              <p className="text-xs text-[#adb5bd] mt-0.5">Rate the quality of this discussion</p>
            </div>
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  onClick={() => setRating(s)}
                  className={cn("text-2xl transition-colors", rating >= s ? "text-[#f59f00]" : "text-[#dee2e6] hover:text-[#ced4da]")}
                >★</button>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setShowEndModal(false)}>Cancel</Button>
              <Button size="sm" disabled={rating === 0} onClick={handleEndRoom}>End & Save</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
