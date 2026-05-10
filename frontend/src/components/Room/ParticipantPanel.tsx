import type { Participant } from "../../lib/api";

const MODEL_COLORS: Record<string, string> = {
  "llama-3.1-8b": "#4ade80",
  "qwen2.5-7b": "#60a5fa",
  "mistral-7b": "#f472b6",
  "deepseek-r1-8b": "#fb923c",
};

interface Props {
  participants: Participant[];
  onDismiss: (id: string, name: string) => void;
  disabled?: boolean;
}

export function ParticipantPanel({ participants, onDismiss, disabled }: Props) {
  const active = participants.filter((p) => !p.dismissed);

  return (
    <aside className="participant-panel">
      <h3 className="panel-title">Participants</h3>
      {active.length === 0 && (
        <p className="panel-empty">No active participants</p>
      )}
      {active.map((p) => {
        const color = MODEL_COLORS[p.model_id] || "#94a3b8";
        return (
          <div key={p.id} className="participant-card">
            <div className="participant-header">
              <span className="participant-dot" style={{ background: color }} />
              <span className="participant-name" style={{ color }}>
                {p.display_name}
              </span>
            </div>
            <div className="capability-badges">
              {p.capabilities.web_search && <span className="cap-badge">🔍 Search</span>}
              {p.capabilities.thinking && <span className="cap-badge">🧠 Thinking</span>}
              {p.capabilities.fast_mode && <span className="cap-badge">⚡ Fast</span>}
            </div>
            <button
              className="dismiss-btn"
              onClick={() => onDismiss(p.id, p.display_name)}
              disabled={disabled}
            >
              Dismiss
            </button>
          </div>
        );
      })}

      {participants.filter((p) => p.dismissed).length > 0 && (
        <div className="dismissed-section">
          <p className="dismissed-label">Dismissed</p>
          {participants
            .filter((p) => p.dismissed)
            .map((p) => (
              <div key={p.id} className="participant-card participant-card--dismissed">
                <span className="participant-name">{p.display_name}</span>
                <span className="dismissal-reason">{p.dismissal_reason}</span>
              </div>
            ))}
        </div>
      )}
    </aside>
  );
}
