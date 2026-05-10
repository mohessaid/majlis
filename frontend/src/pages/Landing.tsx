import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { createRoom, addParticipant, type CreateRoomResponse, type Recommendation } from "../lib/api";
import { Button, Card, Textarea, Spinner, Toggle, ScoreBar, ModelDot, modelColor, cn } from "../components/ui";

interface SelectedModel {
  model_id: string;
  display_name: string;
  capabilities: { web_search: boolean; thinking: boolean; fast_mode: boolean };
  reputation_score: number;
  reason: string;
}

const MODEL_SHORT: Record<string, string> = {
  "llama-3.1-8b": "Llama",
  "qwen2.5-7b": "Qwen",
  "mistral-7b": "Mistral",
  "deepseek-r1-8b": "DeepSeek",
};

function recToSelected(r: Recommendation): SelectedModel {
  return {
    model_id: r.model_id,
    display_name: r.display_name,
    capabilities: r.suggested_capabilities,
    reputation_score: r.reputation_score,
    reason: r.reason,
  };
}

export function Landing() {
  const [question, setQuestion] = useState("");
  const [step, setStep] = useState<"input" | "setup" | "entering">("input");
  const [room, setRoom] = useState<CreateRoomResponse | null>(null);
  const [selected, setSelected] = useState<SelectedModel[]>([]);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { getToken } = useAuth();

  async function handleAnalyze(e: FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    setStep("setup");
    setError("");
    try {
      const token = await getToken();
      const data = await createRoom(question.trim(), token ?? undefined);
      setRoom(data);
      setSelected(data.curator_recommendations.map(recToSelected));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze question");
      setStep("input");
    }
  }

  async function handleStart() {
    if (!room || selected.length === 0) return;
    setStep("entering");
    try {
      const token = await getToken();
      await Promise.all(
        selected.map((m) => addParticipant(room.room_id, m.model_id, m.capabilities, token ?? undefined))
      );
      navigate(`/room/${room.room_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start discussion");
      setStep("setup");
    }
  }

  function toggleModel(r: Recommendation) {
    setSelected((prev) => {
      const exists = prev.find((m) => m.model_id === r.model_id);
      if (exists) return prev.filter((m) => m.model_id !== r.model_id);
      return [...prev, recToSelected(r)];
    });
  }

  function updateCap(modelId: string, cap: keyof SelectedModel["capabilities"], val: boolean) {
    setSelected((prev) =>
      prev.map((m) => m.model_id === modelId ? { ...m, capabilities: { ...m.capabilities, [cap]: val } } : m)
    );
  }

  const allModels = room?.all_models ?? [];
  const unselectedModels = allModels.filter(
    (m) => !selected.find((s) => s.model_id === m.model_id) &&
      !room?.curator_recommendations.find((r) => r.model_id === m.model_id)
  );

  if (step === "input") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-2xl space-y-8">
          {/* Brand */}
          <div className="space-y-2 text-center">
            <div className="flex items-center justify-center gap-3 mb-1">
              <span className="h-2 w-2 rounded-full bg-indigo-400" />
              <span className="text-xs font-medium tracking-widest text-[#52525b] uppercase">Majlis</span>
              <span className="h-2 w-2 rounded-full bg-indigo-400" />
            </div>
            <h1 className="text-3xl font-semibold text-[#fafafa] tracking-tight">
              Multiple AI minds.<br />One table.
            </h1>
            <p className="text-sm text-[#52525b] max-w-md mx-auto">
              Ask a question. The Curator selects the best models. They respond, debate, and earn their seat.
            </p>
          </div>

          {/* Input */}
          <form onSubmit={handleAnalyze} className="space-y-3">
            <Textarea
              placeholder="What do you want to discuss? E.g. 'Best approach to build a production-grade RAG system'"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={4}
              disabled={false}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAnalyze(e as unknown as FormEvent); }
              }}
            />
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={!question.trim()}
            >
              Analyze & Select Models →
            </Button>
            {error && <p className="text-xs text-red-400 text-center">{error}</p>}
          </form>

          {/* Features */}
          <div className="flex items-center justify-center gap-8 text-xs text-[#52525b]">
            <span>5 specialized models</span>
            <span className="h-3 w-px bg-[#262626]" />
            <span>Reputation-weighted</span>
            <span className="h-3 w-px bg-[#262626]" />
            <span>Real-time streaming</span>
          </div>
        </div>
      </div>
    );
  }

  // Setup step — shown while loading or after room is created
  return (
    <div className="min-h-screen flex flex-col items-center justify-start px-4 py-12">
      <div className="w-full max-w-2xl space-y-6">

        {/* Question header */}
        <div>
          <button
            onClick={() => { setStep("input"); setRoom(null); setSelected([]); }}
            className="text-xs text-[#52525b] hover:text-[#a1a1aa] mb-3 flex items-center gap-1 transition-colors"
          >
            ← Back
          </button>
          <p className="text-xs text-[#52525b] uppercase tracking-widest mb-1">Your Question</p>
          <p className="text-[#fafafa] font-medium">"{question}"</p>
        </div>

        {!room ? (
          // Loading state
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-sm text-[#a1a1aa]">
              <Spinner className="h-4 w-4 text-indigo-400" />
              <span>Curator is analyzing your question…</span>
            </div>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 rounded-xl bg-[#111] border border-[#1c1c1c] animate-pulse" />
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Curator note */}
            {room.curator_notes && (
              <div className="flex gap-3 rounded-xl border border-[#2d2060] bg-[#1a1535] p-4">
                <span className="mt-0.5 h-2 w-2 flex-shrink-0 rounded-full bg-[#a78bfa]" />
                <div>
                  <p className="text-xs font-medium text-[#a78bfa] mb-1">Curator</p>
                  <p className="text-sm text-[#c4b5fd]">{room.curator_notes}</p>
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-[#a1a1aa] uppercase tracking-widest">
                  Recommended Models <span className="text-[#52525b]">— click to toggle</span>
                </p>
                <span className="text-xs text-[#52525b]">{selected.length} selected</span>
              </div>

              <div className="space-y-2">
                {room.curator_recommendations.map((rec) => {
                  const isSelected = !!selected.find((s) => s.model_id === rec.model_id);
                  const sel = selected.find((s) => s.model_id === rec.model_id);
                  const color = modelColor(rec.model_id);
                  return (
                    <Card
                      key={rec.model_id}
                      className={cn(
                        "p-4 cursor-pointer transition-all",
                        isSelected ? "border-[#262626] bg-[#111]" : "border-[#1c1c1c] bg-[#0d0d0d] opacity-60"
                      )}
                      onClick={() => toggleModel(rec)}
                    >
                      <div className="flex items-start gap-3">
                        {/* Color indicator + checkbox */}
                        <div className="mt-0.5 flex-shrink-0">
                          <div
                            className={cn(
                              "h-4 w-4 rounded-full border-2 flex items-center justify-center transition-colors",
                              isSelected ? "border-current" : "border-[#262626]"
                            )}
                            style={{ borderColor: isSelected ? color : undefined }}
                          >
                            {isSelected && <div className="h-2 w-2 rounded-full" style={{ background: color }} />}
                          </div>
                        </div>

                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium" style={{ color }}>
                                {MODEL_SHORT[rec.model_id] ?? rec.display_name}
                              </span>
                              <span className="text-xs text-[#52525b]">{rec.display_name}</span>
                            </div>
                            <ScoreBar score={rec.reputation_score} />
                          </div>
                          <p className="text-xs text-[#a1a1aa]">{rec.reason}</p>

                          {/* Capability toggles — only when selected */}
                          {isSelected && sel && (
                            <div
                              className="flex gap-2 pt-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Toggle
                                checked={sel.capabilities.web_search}
                                onChange={(v) => updateCap(rec.model_id, "web_search", v)}
                                label="Search"
                              />
                              <Toggle
                                checked={sel.capabilities.thinking}
                                onChange={(v) => updateCap(rec.model_id, "thinking", v)}
                                label="Thinking"
                              />
                              <Toggle
                                checked={sel.capabilities.fast_mode}
                                onChange={(v) => updateCap(rec.model_id, "fast_mode", v)}
                                label="Fast"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}

                {/* Additional models (not recommended) */}
                {unselectedModels.map((m) => (
                  <Card
                    key={m.model_id}
                    className="p-4 cursor-pointer transition-all border-[#1c1c1c] bg-[#0d0d0d] opacity-50 hover:opacity-70"
                    onClick={() => {
                      const rec: Recommendation = {
                        model_id: m.model_id,
                        display_name: m.display_name,
                        reputation_score: m.score,
                        reason: "Added manually",
                        suggested_capabilities: { web_search: false, thinking: false, fast_mode: false },
                      };
                      toggleModel(rec);
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <ModelDot modelId={m.model_id} size={10} />
                      <span className="text-sm text-[#a1a1aa]">{m.display_name}</span>
                      <span className="ml-auto text-xs text-[#52525b]">+ Add</span>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}

            <Button
              size="lg"
              className="w-full"
              disabled={selected.length === 0 || step === "entering"}
              onClick={handleStart}
            >
              {step === "entering" ? (
                <><Spinner className="h-4 w-4" /> Entering the room…</>
              ) : (
                `Start Discussion with ${selected.length} model${selected.length !== 1 ? "s" : ""} →`
              )}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
