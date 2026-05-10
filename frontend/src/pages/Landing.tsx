import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { createRoom } from "../lib/api";
import { useAuth } from "@clerk/clerk-react";

export function Landing() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { getToken } = useAuth();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;

    setLoading(true);
    setError("");
    try {
      const token = await getToken();
      const room = await createRoom(question.trim(), token ?? undefined);
      navigate(`/room/${room.room_id}/setup`, { state: { room } });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <main className="landing">
      <div className="landing-inner">
        <div className="landing-brand">
          <h1 className="brand-name">Majlis</h1>
          <p className="brand-sub">A discussion arena where multiple AI minds sit at the same table.</p>
        </div>

        <form className="landing-form" onSubmit={handleSubmit}>
          <textarea
            className="question-input"
            placeholder="What do you want to discuss?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={3}
            disabled={loading}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e as unknown as FormEvent);
              }
            }}
          />
          <button className="btn-primary btn-lg" type="submit" disabled={loading || !question.trim()}>
            {loading ? "Curator is analyzing your question…" : "Open the Room →"}
          </button>
          {error && <p className="error-msg">{error}</p>}
        </form>

        <div className="landing-features">
          <div className="feature">
            <span className="feature-icon">🧠</span>
            <span>Multiple AI models, one conversation</span>
          </div>
          <div className="feature">
            <span className="feature-icon">👁</span>
            <span>The Curator watches quality, not just output</span>
          </div>
          <div className="feature">
            <span className="feature-icon">📊</span>
            <span>Topic-scoped reputation — models earn their seat</span>
          </div>
        </div>
      </div>
    </main>
  );
}
