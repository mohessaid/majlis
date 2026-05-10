import { useState, useEffect, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { createRoom, addParticipant, listRooms, type CreateRoomResponse, type Recommendation, type RoomSummary } from "../lib/api";
import { Button, Textarea, Spinner, CapToggle, ScoreBar, ModelAvatar, ModelTag, modelTheme, cn } from "../components/ui";

interface SelectedCaps { web_search: boolean; thinking: boolean; fast_mode: boolean; }
interface Selection { model_id: string; display_name: string; caps: SelectedCaps; score: number; reason: string; }

function fromRec(r: Recommendation): Selection {
  return { model_id: r.model_id, display_name: r.display_name, caps: r.suggested_capabilities, score: r.reputation_score, reason: r.reason };
}

const CAT_LABEL: Record<string, string> = {
  technology: "Technology", science: "Science", philosophy: "Philosophy",
  politics: "Politics", economics: "Economics", general: "General",
};

export function Landing() {
  const [q, setQ] = useState("");
  const [step, setStep] = useState<"idle" | "loading" | "selecting" | "starting">("idle");
  const [room, setRoom] = useState<CreateRoomResponse | null>(null);
  const [selections, setSelections] = useState<Selection[]>([]);
  const [error, setError] = useState("");
  const [prevRooms, setPrevRooms] = useState<RoomSummary[]>([]);
  const navigate = useNavigate();
  const { getToken } = useAuth();

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const rooms = await listRooms(token ?? undefined);
        setPrevRooms(rooms);
      } catch {
        // silently ignore — user just won't see history
      }
    })();
  }, []);

  async function analyze(e: FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setStep("loading");
    setError("");
    try {
      const token = await getToken();
      const data = await createRoom(q.trim(), token ?? undefined);
      setRoom(data);
      setSelections(data.curator_recommendations.map(fromRec));
      setStep("selecting");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed — please try again");
      setStep("idle");
    }
  }

  async function start() {
    if (!room || selections.length === 0) return;
    setStep("starting");
    try {
      const token = await getToken();
      await Promise.all(selections.map((s) => addParticipant(room.room_id, s.model_id, s.caps, token ?? undefined)));
      navigate(`/room/${room.room_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start");
      setStep("selecting");
    }
  }

  function toggle(r: Recommendation) {
    setSelections((prev) => {
      const has = prev.find((s) => s.model_id === r.model_id);
      return has ? prev.filter((s) => s.model_id !== r.model_id) : [...prev, fromRec(r)];
    });
  }

  function setCap(id: string, cap: keyof SelectedCaps, val: boolean) {
    setSelections((prev) => prev.map((s) => s.model_id === id ? { ...s, caps: { ...s.caps, [cap]: val } } : s));
  }

  /* ── STEP 1: Idle or loading ── */
  if (step === "idle" || (step === "loading" && !room)) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Mini nav */}
        <div className="flex items-center justify-between border-b border-gray-100 bg-white px-6 py-3">
          <button onClick={() => navigate("/")} className="text-sm font-semibold text-gray-900 hover:text-gray-600 transition-colors">
            ← Majlis
          </button>
          <span className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> 4 models online
          </span>
        </div>

        <div className="flex flex-1 items-center justify-center px-4 py-12">
          <div className="w-full max-w-xl">
            <div className="mb-8 space-y-1">
              <h2 className="text-2xl font-bold text-gray-900">What do you want to discuss?</h2>
              <p className="text-sm text-gray-500">The Curator will analyze your question and pick the right models.</p>
            </div>

            <form onSubmit={analyze} className="space-y-3">
              <Textarea
                rows={4}
                placeholder="e.g. What's the best architecture for a multi-tenant SaaS app?"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                disabled={step === "loading"}
                className="text-base"
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); analyze(e as unknown as FormEvent); } }}
              />
              <Button type="submit" size="lg" className="w-full h-12 text-base" disabled={!q.trim() || step === "loading"}>
                {step === "loading"
                  ? <><Spinner className="h-4 w-4" /> Curator is analyzing…</>
                  : "Analyze & Select Models →"}
              </Button>
              {error && <p className="text-sm text-red-500">{error}</p>}
            </form>

            <div className="mt-6 flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-400">Available:</span>
              {["llama-3.1-8b","qwen2.5-7b","mistral-7b","deepseek-r1-8b"].map((id) => (
                <ModelTag key={id} modelId={id} />
              ))}
            </div>
          </div>
        </div>

        {/* Previous rooms */}
        {prevRooms.length > 0 && (
          <div className="border-t border-gray-100 bg-gray-50 px-4 py-6 sm:px-8">
            <div className="mx-auto max-w-xl">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">Recent Discussions</p>
              <div className="space-y-2">
                {prevRooms.slice(0, 6).map((r) => (
                  <button
                    key={r.room_id}
                    onClick={() => navigate(`/room/${r.room_id}`)}
                    className="w-full flex items-start justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-left hover:border-gray-300 hover:shadow-sm transition-all"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">"{r.question}"</p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-[11px] text-gray-400">{CAT_LABEL[r.category] ?? r.category}</span>
                        <span className="text-gray-200">·</span>
                        <div className="flex items-center gap-1">
                          {r.models.slice(0, 3).map((id) => (
                            <ModelAvatar key={id} modelId={id} size="xs" />
                          ))}
                          {r.models.length > 3 && (
                            <span className="text-[11px] text-gray-400">+{r.models.length - 3}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex-shrink-0 flex flex-col items-end gap-1">
                      <span className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        r.status === "ended" ? "bg-gray-100 text-gray-400" : "bg-green-50 text-green-700"
                      )}>
                        {r.status === "ended" ? "Ended" : "Active"}
                      </span>
                      <span className="text-[11px] text-gray-400">
                        {new Date(r.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ── STEP 2: Model selection ── */
  const allRecs = room?.curator_recommendations ?? [];
  const extras = (room?.all_models ?? []).filter((m) => !allRecs.find((r) => r.model_id === m.model_id));

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Mini nav */}
      <div className="flex items-center justify-between border-b border-gray-100 bg-white px-6 py-3">
        <button onClick={() => { setStep("idle"); setRoom(null); setSelections([]); }}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors">
          ← Back
        </button>
        <span className="flex items-center gap-1.5 text-xs text-gray-400">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> 4 models online
        </span>
      </div>

      <div className="flex flex-1 items-start justify-center px-4 py-10">
        <div className="w-full max-w-xl space-y-5">

          {/* Question */}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-gray-400">Your Question</p>
            <p className="text-sm text-gray-800 font-medium leading-relaxed">"{q}"</p>
          </div>

          {/* Curator note */}
          {room?.curator_notes && (
            <div className="flex gap-3 rounded-xl border border-gray-200 bg-white p-4">
              <ModelAvatar modelId="curator" size="md" />
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-gray-400">Curator Analysis</p>
                <p className="text-sm text-gray-700 leading-relaxed">{room.curator_notes}</p>
              </div>
            </div>
          )}

          {/* Models */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-700">Select your models</p>
              <span className="text-xs text-gray-400">{selections.length} selected</span>
            </div>

            <div className="space-y-2">
              {allRecs.map((rec) => {
                const active = !!selections.find((s) => s.model_id === rec.model_id);
                const sel = selections.find((s) => s.model_id === rec.model_id);
                const t = modelTheme(rec.model_id);
                return (
                  <div
                    key={rec.model_id}
                    className={cn(
                      "rounded-xl border bg-white p-4 cursor-pointer select-none transition-all",
                      active ? "border-gray-300 shadow-sm" : "border-gray-100 hover:border-gray-200"
                    )}
                    onClick={() => toggle(rec)}
                  >
                    <div className="flex items-start gap-3">
                      <ModelAvatar modelId={rec.model_id} size="md" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold" style={{ color: t.text }}>{t.label}</span>
                          <div className="flex-1 max-w-[100px]"><ScoreBar score={rec.reputation_score} /></div>
                        </div>
                        <p className="text-xs text-gray-500 leading-relaxed mb-2">{rec.reason}</p>
                        {active && sel && (
                          <div className="flex gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                            <CapToggle checked={sel.caps.web_search} onChange={(v) => setCap(rec.model_id, "web_search", v)} label="Web search" />
                            <CapToggle checked={sel.caps.thinking} onChange={(v) => setCap(rec.model_id, "thinking", v)} label="Thinking" />
                            <CapToggle checked={sel.caps.fast_mode} onChange={(v) => setCap(rec.model_id, "fast_mode", v)} label="Fast" />
                          </div>
                        )}
                      </div>
                      {/* Checkbox */}
                      <div className={cn(
                        "mt-0.5 h-5 w-5 flex-shrink-0 rounded-full border-2 flex items-center justify-center transition-all",
                        active ? "border-gray-900 bg-gray-900" : "border-gray-300"
                      )}>
                        {active && (
                          <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="2,6 5,9 10,3" />
                          </svg>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {extras.map((m) => (
                <div
                  key={m.model_id}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-gray-200 p-3 hover:border-gray-300 hover:bg-white transition-all"
                  onClick={() => toggle({ model_id: m.model_id, display_name: m.display_name, reputation_score: m.score, reason: "Added manually", suggested_capabilities: { web_search: false, thinking: false, fast_mode: false } })}
                >
                  <ModelAvatar modelId={m.model_id} size="sm" />
                  <span className="text-sm text-gray-500">{modelTheme(m.model_id).label}</span>
                  <span className="ml-auto text-xs text-gray-400 font-medium">+ Add</span>
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <Button
            size="lg"
            className="w-full h-12 text-base"
            disabled={selections.length === 0 || step === "starting"}
            onClick={start}
          >
            {step === "starting"
              ? <><Spinner className="h-4 w-4" /> Starting…</>
              : `Open the Room with ${selections.length} model${selections.length !== 1 ? "s" : ""} →`}
          </Button>
        </div>
      </div>
    </div>
  );
}
