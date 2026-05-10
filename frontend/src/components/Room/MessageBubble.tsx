import { useState } from "react";
import type { MessageBubble as MsgType } from "../../hooks/useDiscussion";

const MODEL_COLORS: Record<string, string> = {
  "llama-3.1-8b": "#4ade80",
  "qwen2.5-7b": "#60a5fa",
  "mistral-7b": "#f472b6",
  "deepseek-r1-8b": "#fb923c",
  curator: "#a78bfa",
  user: "#e2e8f0",
};

interface Props {
  msg: MsgType;
  onGoDeeper?: (participantId: string) => void;
}

export function MessageBubble({ msg, onGoDeeper }: Props) {
  const [showThinking, setShowThinking] = useState(false);
  const color = MODEL_COLORS[msg.model_id] || "#94a3b8";

  if (msg.layer === "user") {
    return (
      <div className="msg-row msg-user">
        <div className="msg-bubble msg-bubble--user">
          <p>{msg.content}</p>
        </div>
      </div>
    );
  }

  if (msg.isCurator || msg.layer === "curator") {
    return (
      <div className="msg-row msg-curator">
        <div className="curator-callout">
          <span className="curator-icon">👁</span>
          <span className="curator-label">Curator</span>
          <p className="curator-text">{msg.content}</p>
        </div>
      </div>
    );
  }

  if (msg.layer === "thinking") {
    return (
      <div className="msg-row">
        <div className="thinking-block">
          <button
            className="thinking-toggle"
            onClick={() => setShowThinking((s) => !s)}
          >
            {showThinking ? "▾" : "▸"} Reasoning trace
          </button>
          {showThinking && <pre className="thinking-content">{msg.content}</pre>}
        </div>
      </div>
    );
  }

  return (
    <div className="msg-row">
      <div className="msg-bubble" style={{ borderLeftColor: color }}>
        <div className="msg-header">
          <span className="model-dot" style={{ background: color }} />
          <span className="model-name" style={{ color }}>
            {msg.display_name}
          </span>
          {msg.layer === "depth" && <span className="depth-badge">depth</span>}
          {msg.searched && <span className="search-badge">🔍 searched</span>}
          {msg.streaming && <span className="streaming-indicator" />}
        </div>
        <p className="msg-content">
          {msg.content}
          {msg.streaming && <span className="cursor-blink">▋</span>}
        </p>
        {!msg.streaming && msg.layer === "surface" && onGoDeeper && (
          <button
            className="go-deeper-btn"
            onClick={() => onGoDeeper(msg.participant_id)}
          >
            Go deeper →
          </button>
        )}
      </div>
    </div>
  );
}
