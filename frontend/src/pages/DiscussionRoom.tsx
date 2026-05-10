import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { getRoom, dismissParticipant, endRoom, addParticipant, getAvailableModels, type Room, type ModelInfo } from "../lib/api";
import { useDiscussion } from "../hooks/useDiscussion";
import { Button, Card, Textarea, Spinner, ScoreBar, ModelAvatar, ModelTag, modelTheme, cn } from "../components/ui";

const DISMISS_REASONS = ["Too verbose", "Off topic", "Not helpful", "Repetitive"];

export function DiscussionRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { getToken } = useAuth();

  const [token, setToken] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [input, setInput] = useState("");
  const [dismissTarget, setDismissTarget] = useState<{ id: string; name: string; modelId: string } | null>(null);
  const [dismissReason, setDismissReason] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const [curatorBanner, setCuratorBanner] = useState<string | null>(null);
  const [showEndModal, setShowEndModal] = useState(false);
  const [rating, setRating] = useState(0);
  const [ended, setEnded] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  // Get token and keep fresh
  useEffect(() => { getToken().then(setToken); }, []);

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

  const displayNames = Object.fromEntries((room?.participants ?? []).map((p) => [p.id, p.display_name]));

  function handleSend() {
    if (!input.trim() || streaming) return;
    send(input.trim(), displayNames);
    setInput("");
  }

  async function confirmDismiss() {
    if (!dismissTarget || !roomId || !dismissReason) return;
    const t = await getToken();
    const result = await dismissParticipant(roomId, dismissTarget.id, dismissReason, t ?? undefined);
    setRoom((prev) => prev ? {
      ...prev,
      participants: prev.participants.map((p) =>
        p.id === dismissTarget.id ? { ...p, dismissed: true, dismissal_reason: dismissReason } : p),
    } : prev);
    if (result.curator_suggestion) {
      setCuratorBanner(`Curator suggests: ${result.curator_suggestion.model_id} — ${result.curator_suggestion.reason}`);
      setTimeout(() => setCuratorBanner(null), 8000);
    }
    setDismissTarget(null);
    setDismissReason("");
  }

  async function openPicker() {
    if (!roomId) return;
    const t = await getToken();
    const data = await getAvailableModels(roomId, t ?? undefined);
    setAvailableModels(data.models);
    setShowPicker(true);
  }

  async function addModel(modelId: string) {
    if (!roomId) return;
    setShowPicker(false);
    const t = await getToken();
    const result = await addParticipant(roomId, modelId, { web_search: false, thinking: false, fast_mode: false }, t ?? undefined);
    const m = availableModels.find((x) => x.model_id === modelId);
    setRoom((prev) => prev ? {
      ...prev,
      participants: [...prev.participants, { id: result.participant_id, model_id: modelId, display_name: m?.display_name ?? modelId, capabilities: { web_search: false, thinking: false, fast_mode: false }, dismissed: false }],
    } : prev);
  }

  async function finishRoom() {
    if (!roomId || rating === 0) return;
    const t = await getToken();
    await endRoom(roomId, rating, t ?? undefined);
    setEnded(true);
    setShowEndModal(false);
  }

  if (!room) return (
    <div className="flex h-screen items-center justify-center gap-2 text-gray-400 bg-gray-50">
      <Spinner className="h-4 w-4" /><span className="text-sm">Loading…</span>
    </div>
  );

  if (ended) return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-gray-50 px-4">
      <div className="text-center space-y-1.5">
        <p className="text-xs font-medium uppercase tracking-widest text-gray-400">Discussion ended</p>
        <p className="text-lg font-semibold text-gray-900">"{room.question}"</p>
        <p className="text-sm text-gray-500">{room.participants.filter((p) => !p.dismissed).map((p) => modelTheme(p.model_id).label).join(", ") || "No participants remained"}</p>
      </div>
      <Button onClick={() => navigate("/")}>New Discussion</Button>
    </div>
  );

  const active = room.participants.filter((p) => !p.dismissed);
  const dismissed = room.participants.filter((p) => p.dismissed);

  return (
    <div className="flex h-screen overflow-hidden bg-white">

      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      <aside className="w-56 flex-shrink-0 flex flex-col border-r border-gray-100 bg-gray-50">

        {/* Topic */}
        <div className="px-4 py-4 border-b border-gray-100">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5">
            {room.category.replace("_", " ")}
          </p>
          <p className="text-xs text-gray-700 leading-relaxed line-clamp-5 font-medium">"{room.question}"</p>
        </div>

        {/* Participants */}
        <div className="flex-1 overflow-y-auto px-2 py-3">
          <p className="px-2 mb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Models</p>

          {active.map((p) => {
            const t = modelTheme(p.model_id);
            return (
              <div key={p.id} className="group flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-white transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-green-500" />
                  <span className="text-xs font-medium truncate" style={{ color: t.text }}>{t.label}</span>
                </div>
                <button
                  className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all text-xs"
                  onClick={() => setDismissTarget({ id: p.id, name: p.display_name, modelId: p.model_id })}
                >✕</button>
              </div>
            );
          })}

          {dismissed.length > 0 && (
            <>
              <p className="px-2 mt-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-300">Dismissed</p>
              {dismissed.map((p) => (
                <div key={p.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 opacity-40">
                  <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-gray-300" />
                  <span className="text-xs text-gray-400 line-through truncate">{modelTheme(p.model_id).label}</span>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Actions */}
        <div className="border-t border-gray-100 p-3 space-y-1.5">
          <Button variant="secondary" size="sm" className="w-full" onClick={openPicker}>+ Add Model</Button>
          <Button variant="danger" size="sm" className="w-full" onClick={() => setShowEndModal(true)}>End Discussion</Button>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────────────── */}
      <main className="flex flex-1 flex-col overflow-hidden">

        {/* Curator banner */}
        {curatorBanner && (
          <div className="flex items-center gap-2.5 border-b border-gray-100 bg-gray-50 px-5 py-2.5">
            <ModelAvatar modelId="curator" size="xs" />
            <span className="text-xs text-gray-600">{curatorBanner}</span>
          </div>
        )}

        {/* Thread */}
        <div ref={threadRef} className="flex-1 overflow-y-auto px-6 py-6">
          {messages.length === 0 && (
            <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-3 text-center">
              <div className="flex items-center gap-1.5">
                {active.slice(0, 4).map((p) => <ModelAvatar key={p.id} modelId={p.model_id} size="sm" />)}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">
                  {active.map((p) => modelTheme(p.model_id).label).join(", ")} ready.
                </p>
                <p className="text-xs text-gray-400 mt-0.5">Send a message to start the discussion.</p>
              </div>
            </div>
          )}

          <div className="space-y-4 max-w-3xl mx-auto">
            {messages.map((msg) => {

              /* User message */
              if (msg.layer === "user") return (
                <div key={msg.id} className="flex justify-end">
                  <div className="max-w-lg rounded-2xl rounded-tr-sm bg-gray-900 px-4 py-2.5">
                    <p className="text-sm text-white whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  </div>
                </div>
              );

              /* Curator message */
              if (msg.layer === "curator") return (
                <div key={msg.id} className="flex gap-3 py-1">
                  <ModelAvatar modelId="curator" size="sm" />
                  <div className="flex-1 max-w-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <ModelTag modelId="curator" />
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                      <p className="text-sm text-gray-700 italic whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    </div>
                  </div>
                </div>
              );

              /* AI message */
              const t = modelTheme(msg.model_id);
              return (
                <div key={msg.id} className="group flex gap-3 py-1">
                  <ModelAvatar modelId={msg.model_id} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <ModelTag modelId={msg.model_id} />
                      {msg.layer !== "surface" && (
                        <span className="text-[11px] text-gray-400 font-medium">
                          {msg.layer === "depth" ? "Deep dive" : msg.layer}
                        </span>
                      )}
                      {msg.searched && <span className="text-[11px] text-gray-400">· searched web</span>}
                      {msg.streaming && (
                        <span className="flex gap-0.5 ml-0.5">
                          {[0,1,2].map((i) => (
                            <span key={i} className="h-1 w-1 rounded-full bg-gray-400 animate-bounce"
                              style={{ animationDelay: `${i*120}ms` }} />
                          ))}
                        </span>
                      )}
                    </div>
                    <div className="rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-xs">
                      <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    </div>
                    {!msg.streaming && msg.layer === "surface" && (
                      <button
                        onClick={() => requestDepth(msg.participant_id, displayNames)}
                        className="mt-1.5 text-[11px] font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ color: t.text }}
                      >Go deeper →</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Input */}
        <div className="border-t border-gray-100 px-6 py-4">
          <div className="mx-auto max-w-3xl flex gap-3 items-end">
            <Textarea
              rows={2}
              className="flex-1"
              placeholder="Ask the room… (Enter to send, Shift+Enter for new line)"
              value={input}
              disabled={streaming}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            />
            <Button onClick={handleSend} disabled={streaming || !input.trim()}
              className="flex-shrink-0" style={{ height: 72, minWidth: 72 }}>
              {streaming ? <Spinner className="h-4 w-4" /> : "Send"}
            </Button>
          </div>
        </div>
      </main>

      {/* ── Dismiss modal ───────────────────────────────────────────────────── */}
      {dismissTarget && (
        <Modal onClose={() => setDismissTarget(null)}>
          <p className="text-sm font-semibold text-gray-900">Dismiss {modelTheme(dismissTarget.modelId).label}?</p>
          <p className="mt-0.5 text-xs text-gray-400">The Curator will record this feedback.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {DISMISS_REASONS.map((r) => (
              <button key={r} onClick={() => setDismissReason(r)}
                className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  dismissReason === r ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 text-gray-500 hover:border-gray-400"
                )}>{r}</button>
            ))}
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDismissTarget(null)}>Cancel</Button>
            <Button variant="danger" size="sm" disabled={!dismissReason} onClick={confirmDismiss}>Dismiss</Button>
          </div>
        </Modal>
      )}

      {/* ── Add model modal ─────────────────────────────────────────────────── */}
      {showPicker && (
        <Modal onClose={() => setShowPicker(false)}>
          <p className="text-sm font-semibold text-gray-900">Add a Model</p>
          <div className="mt-4 space-y-2">
            {availableModels
              .filter((m) => !room.participants.find((p) => p.model_id === m.model_id && !p.dismissed))
              .map((m: ModelInfo) => (
                <div key={m.model_id}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-100 p-3 hover:border-gray-200 hover:bg-gray-50 transition-all"
                  onClick={() => addModel(m.model_id)}>
                  <ModelAvatar modelId={m.model_id} size="sm" />
                  <span className="flex-1 text-sm font-medium text-gray-700">{modelTheme(m.model_id).label}</span>
                  <div className="w-20"><ScoreBar score={m.score} /></div>
                </div>
              ))}
          </div>
          <div className="mt-4">
            <Button variant="ghost" size="sm" className="w-full" onClick={() => setShowPicker(false)}>Cancel</Button>
          </div>
        </Modal>
      )}

      {/* ── End discussion modal ────────────────────────────────────────────── */}
      {showEndModal && (
        <Modal onClose={() => setShowEndModal(false)}>
          <p className="text-sm font-semibold text-gray-900">End Discussion</p>
          <p className="mt-0.5 text-xs text-gray-400">How useful was this discussion?</p>
          <div className="mt-4 flex justify-center gap-1.5">
            {[1,2,3,4,5].map((s) => (
              <button key={s} onClick={() => setRating(s)}
                className={cn("text-2xl transition-colors", rating >= s ? "text-amber-400" : "text-gray-200 hover:text-gray-300")}>
                ★
              </button>
            ))}
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowEndModal(false)}>Cancel</Button>
            <Button size="sm" disabled={rating === 0} onClick={finishRoom}>Save & End</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// Shared modal wrapper
function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-[2px]" onClick={onClose}>
      <Card className="w-full max-w-sm p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        {children}
      </Card>
    </div>
  );
}
