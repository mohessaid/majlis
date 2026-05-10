import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import type { CreateRoomResponse, ModelInfo } from "../lib/api";
import { addParticipant, getAvailableModels } from "../lib/api";
import { ModelPicker } from "../components/ModelPicker";

const MODEL_COLORS: Record<string, string> = {
  "llama-3.1-8b": "#4ade80",
  "qwen2.5-7b": "#60a5fa",
  "mistral-7b": "#f472b6",
  "deepseek-r1-8b": "#fb923c",
};

function scoreBar(score: number) {
  const pct = Math.round(score * 100);
  const color = score >= 0.7 ? "#4ade80" : score >= 0.5 ? "#facc15" : "#f87171";
  return (
    <div className="score-bar-wrap">
      <div className="score-bar-track">
        <div className="score-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="score-pct" style={{ color }}>{pct}%</span>
    </div>
  );
}

interface SelectedParticipant {
  model_id: string;
  display_name: string;
  capabilities: { web_search: boolean; thinking: boolean; fast_mode: boolean };
  reputation_score: number;
  curator_warning?: string;
}

export function RoomSetup() {
  const { roomId } = useParams<{ roomId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const room = location.state?.room as CreateRoomResponse | undefined;

  const [participants, setParticipants] = useState<SelectedParticipant[]>(() => {
    if (!room) return [];
    return room.curator_recommendations.map((r) => ({
      model_id: r.model_id,
      display_name: r.display_name,
      capabilities: r.suggested_capabilities,
      reputation_score: r.reputation_score,
    }));
  });

  const [showPicker, setShowPicker] = useState(false);
  const [allModels, setAllModels] = useState<ModelInfo[]>(room?.all_models ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleAddModel(modelId: string, caps: { web_search: boolean; thinking: boolean; fast_mode: boolean }) {
    if (!roomId) return;
    setShowPicker(false);
    setLoading(true);
    try {
      const token = await getToken();
      const result = await addParticipant(roomId, modelId, caps, token ?? undefined);
      const model = allModels.find((m) => m.model_id === modelId);
      setParticipants((prev) => [
        ...prev,
        {
          model_id: modelId,
          display_name: model?.display_name ?? modelId,
          capabilities: caps,
          reputation_score: result.reputation_score,
          curator_warning: result.curator_warning ?? undefined,
        },
      ]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add model");
    }
    setLoading(false);
  }

  async function openPicker() {
    if (!roomId) return;
    const token = await getToken();
    const data = await getAvailableModels(roomId, token ?? undefined);
    setAllModels(data.models);
    setShowPicker(true);
  }

  async function startDiscussion() {
    navigate(`/room/${roomId}`);
  }

  if (!room) {
    return (
      <main className="setup-page">
        <p className="error-msg">Room data missing. <a href="/">Start over</a></p>
      </main>
    );
  }

  return (
    <main className="setup-page">
      <div className="setup-header">
        <p className="setup-category">Category: <strong>{room.detected_category.replace("_", " ")}</strong></p>
        <h2 className="setup-question">"{room.question}"</h2>
        {room.curator_notes && (
          <div className="curator-callout curator-callout--inline">
            <span className="curator-icon">👁</span>
            <span>{room.curator_notes}</span>
          </div>
        )}
      </div>

      <h3 className="setup-section-title">Recommended Participants</h3>

      <div className="participant-cards-grid">
        {participants.map((p) => {
          const color = MODEL_COLORS[p.model_id] || "#94a3b8";
          return (
            <div key={p.model_id} className="setup-card">
              <div className="setup-card-header">
                <span className="participant-dot" style={{ background: color }} />
                <span className="setup-card-name" style={{ color }}>{p.display_name}</span>
              </div>
              {scoreBar(p.reputation_score)}
              {p.curator_warning && (
                <p className="curator-warning">⚠ {p.curator_warning}</p>
              )}
              {room.curator_recommendations.find((r) => r.model_id === p.model_id)?.reason && (
                <p className="setup-card-reason">
                  {room.curator_recommendations.find((r) => r.model_id === p.model_id)?.reason}
                </p>
              )}
              <div className="caps-toggles caps-toggles--compact">
                {(["web_search", "thinking", "fast_mode"] as const).map((cap) => (
                  <label key={cap} className="cap-toggle">
                    <input
                      type="checkbox"
                      checked={p.capabilities[cap]}
                      onChange={(e) =>
                        setParticipants((prev) =>
                          prev.map((x) =>
                            x.model_id === p.model_id
                              ? { ...x, capabilities: { ...x.capabilities, [cap]: e.target.checked } }
                              : x
                          )
                        )
                      }
                    />
                    <span>
                      {cap === "web_search" ? "🔍" : cap === "thinking" ? "🧠" : "⚡"}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}

        <button className="setup-card setup-card--add" onClick={openPicker} disabled={loading}>
          <span className="add-icon">+</span>
          <span>Add another model</span>
        </button>
      </div>

      {error && <p className="error-msg">{error}</p>}

      <div className="setup-actions">
        <button
          className="btn-primary btn-lg"
          onClick={startDiscussion}
          disabled={participants.length === 0 || loading}
        >
          Start Discussion →
        </button>
      </div>

      {showPicker && (
        <ModelPicker
          models={allModels}
          existingModelIds={participants.map((p) => p.model_id)}
          onAdd={handleAddModel}
          onClose={() => setShowPicker(false)}
        />
      )}
    </main>
  );
}
