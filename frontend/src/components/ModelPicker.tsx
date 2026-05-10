import { useState } from "react";
import type { ModelInfo } from "../lib/api";

interface Props {
  models: ModelInfo[];
  existingModelIds: string[];
  onAdd: (modelId: string, capabilities: { web_search: boolean; thinking: boolean; fast_mode: boolean }) => void;
  onClose: () => void;
}

export function ModelPicker({ models, existingModelIds, onAdd, onClose }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [caps, setCaps] = useState({ web_search: false, thinking: false, fast_mode: false });

  const available = models.filter((m) => !existingModelIds.includes(m.model_id));

  function scoreColor(score: number) {
    if (score >= 0.7) return "#4ade80";
    if (score >= 0.5) return "#facc15";
    return "#f87171";
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">Add a Participant</h3>
        <div className="model-grid">
          {available.map((m) => (
            <button
              key={m.model_id}
              className={`model-card ${selected === m.model_id ? "model-card--selected" : ""}`}
              onClick={() => setSelected(m.model_id)}
            >
              <span className="model-card-name">{m.display_name}</span>
              <span className="model-card-score" style={{ color: scoreColor(m.score) }}>
                {m.total_sessions > 0 ? `${Math.round(m.score * 100)}%` : "New"}
              </span>
              {m.supports_thinking && <span className="model-card-tag">🧠</span>}
            </button>
          ))}
          {available.length === 0 && (
            <p className="panel-empty">All models are already in the room</p>
          )}
        </div>

        {selected && (
          <div className="caps-section">
            <p className="caps-label">Capabilities for {models.find((m) => m.model_id === selected)?.display_name}:</p>
            <div className="caps-toggles">
              {(["web_search", "thinking", "fast_mode"] as const).map((cap) => (
                <label key={cap} className="cap-toggle">
                  <input
                    type="checkbox"
                    checked={caps[cap]}
                    onChange={(e) => setCaps((c) => ({ ...c, [cap]: e.target.checked }))}
                    disabled={cap === "thinking" && !models.find((m) => m.model_id === selected)?.supports_thinking}
                  />
                  <span>
                    {cap === "web_search" ? "🔍 Web Search" : cap === "thinking" ? "🧠 Thinking" : "⚡ Fast Mode"}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary"
            disabled={!selected}
            onClick={() => selected && onAdd(selected, caps)}
          >
            Add to Room
          </button>
        </div>
      </div>
    </div>
  );
}
