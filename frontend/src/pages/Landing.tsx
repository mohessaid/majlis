import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { createRoom, addParticipant, type CreateRoomResponse, type Recommendation } from "../lib/api";
import { Button, Card, Textarea, Spinner, Toggle, ScoreBar, ModelDot, modelColor, modelBg, cn } from "../components/ui";

interface SelectedModel {
  model_id: string;
  display_name: string;
  capabilities: { web_search: boolean; thinking: boolean; fast_mode: boolean };
  reputation_score: number;
  reason: string;
}

const MODEL_SHORT: Record<string, string> = {
  "llama-3.1-8b": "Llama 3.1",
  "qwen2.5-7b": "Qwen 2.5",
  "mistral-7b": "Mistral 7B",
  "deepseek-r1-8b": "DeepSeek R1",
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
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-[#f8f9fa]">
        <div className="w-full max-w-xl space-y-8">
          {/* Brand */}
          <div className="space-y-3 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#dee2e6] bg-white px-4 py-1.5 text-xs font-medium text-[#868e96]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#4c6ef5]" />
              Majlis · Multi-AI Discussion Arena
            </div>
            <h1 className="text-4xl font-bold text-[#212529] tracking-tight">
              Multiple AI minds.<br />One table.
            </h1>
            <p className="text-[#868e96] max-w-sm mx-auto text-sm leading-relaxed">
              Ask a question. The Curator selects the best models for your topic. They respond, debate, and earn their seat.
            </p>
          </div>

          {/* Input card */}
          <Card className="p-6 shadow-sm">
            <form onSubmit={handleAnalyze} className="space-y-4">
              <Textarea
                placeholder="What do you want to discuss? e.g. &ldquo;Best approach to build a production-grade RAG system&rdquo;"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                rows={4}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAnalyze(e as unknown as FormEvent); }
                }}
              />
              <Button type="submit" size="lg" className="w-full" disabled={!question.trim()}>
                Analyze & Select Models →
              </Button>
              {error && <p className="text-xs text-[#e03131] text-center">{error}</p>}
            </form>
          </Card>

          {/* Feature hints */}
          <div className="flex items-center justify-center gap-6 text-xs text-[#adb5bd]">
            <span>5 specialized models</span>
            <span className="h-3 w-px bg-[#dee2e6]" />
            <span>Curator-weighted selection</span>
            <span className="h-3 w-px bg-[#dee2e6]" />
            <span>Real-time streaming</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-xl space-y-5">

        {/* Back + question */}
        <div>
          <button
            onClick={() => { setStep("input"); setRoom(null); setSelected([]); }}
            className="text-xs text-[#adb5bd] hover:text-[#868e96] mb-3 flex items-center gap-1 transition-colors"
          >
            ← Back
          </button>
          <Card className="p-4">
            <p className="text-[10px] uppercase tracking-widest text-[#adb5bd] mb-1 font-medium">Your Question</p>
            <p className="text-sm font-medium text-[#343a40]">"{question}"</p>
          </Card>
        </div>

        {!room ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-[#868e96] px-1">
              <Spinner className="h-4 w-4 text-[#4c6ef5]" />
              <span>Curator is analyzing your question…</span>
            </div>
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-white border border-[#e9ecef] animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {/* Curator note */}
            {room.curator_notes && (
              <div className="flex gap-3 rounded-xl border border-[#e5dbff] bg-[#f3f0ff] p-4">
                <ModelDot modelId="curator" size={8} />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7950f2] mb-1">Curator Analysis</p>
                  <p className="text-sm text-[#5f3dc4]">{room.curator_notes}</p>
                </div>
              </div>
            )}

            {/* Models */}
            <div>
              <div className="flex items-center justify-between mb-2 px-1">
                <p className="text-xs font-semibold uppercase tracking-widest text-[#adb5bd]">
                  Recommended Models
                </p>
                <span className="text-xs text-[#adb5bd]">{selected.length} selected</span>
              </div>

              <div className="space-y-2">
                {room.curator_recommendations.map((rec) => {
                  const isSelected = !!selected.find((s) => s.model_id === rec.model_id);
                  const sel = selected.find((s) => s.model_id === rec.model_id);
                  const color = modelColor(rec.model_id);
                  const bg = modelBg(rec.model_id);
                  return (
                    <Card
                      key={rec.model_id}
                      className={cn(
                        "p-4 cursor-pointer transition-all select-none",
                        isSelected
                          ? "border-[#dee2e6] shadow-sm"
                          : "border-[#e9ecef] opacity-60 hover:opacity-80"
                      )}
                      onClick={() => toggleModel(rec)}
                    >
                      <div className="flex items-start gap-3">
                        {/* Avatar */}
                        <div
                          className="flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold"
                          style={{ background: bg, color }}
                        >
                          {(MODEL_SHORT[rec.model_id] ?? rec.display_name).charAt(0)}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-0.5">
                            <span className="text-sm font-semibold text-[#343a40]">
                              {MODEL_SHORT[rec.model_id] ?? rec.display_name}
                            </span>
                            <div className="w-24 flex-shrink-0">
                              <ScoreBar score={rec.reputation_score} />
                            </div>
                          </div>
                          <p className="text-xs text-[#868e96] mb-2">{rec.reason}</p>

                          {isSelected && sel && (
                            <div className="flex gap-1.5 flex-wrap" onClick={(e) => e.stopPropagation()}>
                              <Toggle checked={sel.capabilities.web_search} onChange={(v) => updateCap(rec.model_id, "web_search", v)} label="Web Search" />
                              <Toggle checked={sel.capabilities.thinking} onChange={(v) => updateCap(rec.model_id, "thinking", v)} label="Thinking" />
                              <Toggle checked={sel.capabilities.fast_mode} onChange={(v) => updateCap(rec.model_id, "fast_mode", v)} label="Fast" />
                            </div>
                          )}
                        </div>

                        {/* Checkbox */}
                        <div
                          className={cn(
                            "flex-shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all",
                            isSelected ? "border-[#4c6ef5]" : "border-[#dee2e6]"
                          )}
                        >
                          {isSelected && <div className="h-2.5 w-2.5 rounded-full bg-[#4c6ef5]" />}
                        </div>
                      </div>
                    </Card>
                  );
                })}

                {/* Additional models */}
                {unselectedModels.map((m) => {
                  const rec: Recommendation = {
                    model_id: m.model_id,
                    display_name: m.display_name,
                    reputation_score: m.score,
                    reason: "Add manually",
                    suggested_capabilities: { web_search: false, thinking: false, fast_mode: false },
                  };
                  return (
                    <Card
                      key={m.model_id}
                      className="p-3 cursor-pointer border-[#e9ecef] opacity-50 hover:opacity-70 transition-opacity"
                      onClick={() => toggleModel(rec)}
                    >
                      <div className="flex items-center gap-3">
                        <ModelDot modelId={m.model_id} size={8} />
                        <span className="text-sm text-[#868e96]">{m.display_name}</span>
                        <span className="ml-auto text-xs text-[#adb5bd]">+ Add</span>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>

            {error && <p className="text-xs text-[#e03131] px-1">{error}</p>}

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
