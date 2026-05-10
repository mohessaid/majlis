import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { createRoom, addParticipant, type CreateRoomResponse, type Recommendation } from "../lib/api";
import { Button, Card, Textarea, Spinner, CapToggle, ScoreBar, ModelAvatar, ModelTag, modelTheme, cn } from "../components/ui";

interface SelectedCaps { web_search: boolean; thinking: boolean; fast_mode: boolean; }
interface Selection { model_id: string; display_name: string; caps: SelectedCaps; score: number; reason: string; }

function fromRec(r: Recommendation): Selection {
  return { model_id: r.model_id, display_name: r.display_name, caps: r.suggested_capabilities, score: r.reputation_score, reason: r.reason };
}

export function Landing() {
  const [q, setQ] = useState("");
  const [step, setStep] = useState<"idle" | "loading" | "selecting" | "starting">("idle");
  const [room, setRoom] = useState<CreateRoomResponse | null>(null);
  const [selections, setSelections] = useState<Selection[]>([]);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { getToken } = useAuth();

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

  if (step === "idle" || (step === "loading" && !room)) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-lg space-y-6">

          {/* Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-500">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> 5 models online
            </div>
            <h1 className="text-4xl font-semibold tracking-tight text-gray-900">Majlis</h1>
            <p className="text-gray-500 text-sm">Multiple AI minds. One discussion. One answer you can trust.</p>
          </div>

          {/* Form */}
          <Card className="p-5 shadow-sm">
            <form onSubmit={analyze} className="space-y-3">
              <Textarea
                rows={3}
                placeholder="What do you want to discuss?"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                disabled={step === "loading"}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); analyze(e as unknown as FormEvent); } }}
              />
              <Button type="submit" size="lg" className="w-full" disabled={!q.trim() || step === "loading"}>
                {step === "loading" ? <><Spinner className="h-4 w-4" /> Analyzing…</> : "Analyze & Select Models"}
              </Button>
            </form>
            {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
          </Card>

          {/* Model preview */}
          <div className="flex items-center justify-center gap-2">
            {["llama-3.1-8b", "qwen2.5-7b", "mistral-7b", "deepseek-r1-8b"].map((id) => (
              <ModelTag key={id} modelId={id} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Selection step
  const allRecs = room?.curator_recommendations ?? [];
  const extraModels = (room?.all_models ?? []).filter(
    (m) => !allRecs.find((r) => r.model_id === m.model_id)
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-lg space-y-4">

        {/* Back + question */}
        <div>
          <button onClick={() => { setStep("idle"); setRoom(null); setSelections([]); }}
            className="mb-3 flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors">
            ← Back
          </button>
          <Card className="p-4">
            <p className="mb-1 text-[11px] font-medium uppercase tracking-widest text-gray-400">Question</p>
            <p className="text-sm font-medium text-gray-800">"{q}"</p>
          </Card>
        </div>

        {/* Curator analysis */}
        {room?.curator_notes && (
          <div className="flex gap-3 rounded-xl border border-gray-200 bg-white p-4">
            <ModelAvatar modelId="curator" size="sm" />
            <div>
              <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400">Curator</p>
              <p className="text-sm text-gray-700">{room.curator_notes}</p>
            </div>
          </div>
        )}

        {/* Model list */}
        <div>
          <div className="mb-2 flex items-center justify-between px-0.5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Recommended</p>
            <span className="text-xs text-gray-400">{selections.length} selected</span>
          </div>

          <div className="space-y-2">
            {allRecs.map((rec) => {
              const active = !!selections.find((s) => s.model_id === rec.model_id);
              const sel = selections.find((s) => s.model_id === rec.model_id);
              const t = modelTheme(rec.model_id);
              return (
                <Card key={rec.model_id}
                  className={cn("p-4 cursor-pointer select-none transition-all", active ? "shadow-sm" : "opacity-60 hover:opacity-80")}
                  onClick={() => toggle(rec)}>
                  <div className="flex items-start gap-3">
                    <ModelAvatar modelId={rec.model_id} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-sm font-semibold" style={{ color: t.text }}>{t.label}</span>
                        <div className="w-24 flex-shrink-0"><ScoreBar score={rec.reputation_score} /></div>
                      </div>
                      <p className="text-xs text-gray-500 mb-2 leading-relaxed">{rec.reason}</p>
                      {active && sel && (
                        <div className="flex gap-1.5 flex-wrap" onClick={(e) => e.stopPropagation()}>
                          <CapToggle checked={sel.caps.web_search} onChange={(v) => setCap(rec.model_id, "web_search", v)} label="Web search" />
                          <CapToggle checked={sel.caps.thinking} onChange={(v) => setCap(rec.model_id, "thinking", v)} label="Thinking" />
                          <CapToggle checked={sel.caps.fast_mode} onChange={(v) => setCap(rec.model_id, "fast_mode", v)} label="Fast" />
                        </div>
                      )}
                    </div>
                    {/* Checkbox */}
                    <div className={cn("mt-0.5 h-4 w-4 flex-shrink-0 rounded-full border-2 flex items-center justify-center transition-all",
                      active ? "border-gray-900" : "border-gray-300")}>
                      {active && <div className="h-2 w-2 rounded-full bg-gray-900" />}
                    </div>
                  </div>
                </Card>
              );
            })}

            {extraModels.map((m) => (
              <Card key={m.model_id}
                className="p-3 cursor-pointer opacity-40 hover:opacity-60 transition-opacity"
                onClick={() => toggle({ model_id: m.model_id, display_name: m.display_name, reputation_score: m.score, reason: "Added manually", suggested_capabilities: { web_search: false, thinking: false, fast_mode: false } })}>
                <div className="flex items-center gap-3">
                  <ModelAvatar modelId={m.model_id} size="sm" />
                  <span className="text-sm text-gray-600">{modelTheme(m.model_id).label}</span>
                  <span className="ml-auto text-xs text-gray-400">+ Add</span>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <Button size="lg" className="w-full" disabled={selections.length === 0 || step === "starting"} onClick={start}>
          {step === "starting"
            ? <><Spinner className="h-4 w-4" /> Starting…</>
            : `Start Discussion with ${selections.length} model${selections.length !== 1 ? "s" : ""} →`}
        </Button>
      </div>
    </div>
  );
}
