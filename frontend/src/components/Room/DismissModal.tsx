import { useState } from "react";

const REASONS = [
  { id: "recent_events", label: "Didn't know recent events" },
  { id: "too_shallow", label: "Too shallow / repetitive" },
  { id: "wrong_domain", label: "Wrong domain" },
  { id: "hallucinating", label: "Hallucinating" },
  { id: "other", label: "Other" },
];

interface Props {
  participantName: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

export function DismissModal({ participantName, onConfirm, onCancel }: Props) {
  const [selected, setSelected] = useState("");

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">Dismiss {participantName}</h3>
        <p className="modal-subtitle">Why are you removing them from the room?</p>
        <div className="reason-list">
          {REASONS.map((r) => (
            <button
              key={r.id}
              className={`reason-btn ${selected === r.id ? "reason-btn--selected" : ""}`}
              onClick={() => setSelected(r.id)}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="modal-actions">
          <button className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="btn-danger"
            disabled={!selected}
            onClick={() => selected && onConfirm(selected)}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
