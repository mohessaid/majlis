from datetime import datetime
from typing import Optional
from sqlmodel import Session, select
from models import ReputationScore


SCORE_DELTAS = {
    "dismissed": -1.0,
    "session_completed": +0.5,
    "curator_flagged": -0.5,
}


def get_or_create_score(session: Session, model_id: str, category: str) -> ReputationScore:
    stmt = select(ReputationScore).where(
        ReputationScore.model_id == model_id,
        ReputationScore.category == category,
    )
    score = session.exec(stmt).first()
    if not score:
        score = ReputationScore(
            model_id=model_id,
            category=category,
            score=0.5,
            total_sessions=0,
            total_dismissals=0,
            last_updated=datetime.utcnow(),
        )
        session.add(score)
        session.commit()
        session.refresh(score)
    return score


def update_score(
    session: Session,
    model_id: str,
    category: str,
    event: str,
) -> ReputationScore:
    score = get_or_create_score(session, model_id, category)
    delta = SCORE_DELTAS.get(event, 0.0)
    score.score = max(0.0, min(1.0, score.score + delta))

    if event == "dismissed":
        score.total_dismissals += 1
        score.total_sessions += 1
    elif event == "session_completed":
        score.total_sessions += 1

    score.last_updated = datetime.utcnow()
    session.add(score)
    session.commit()
    session.refresh(score)
    return score


def get_recommendations(
    session: Session,
    category: str,
    available_model_ids: list[str],
    top_n: int = 3,
) -> list[dict]:
    results = []
    for model_id in available_model_ids:
        score = get_or_create_score(session, model_id, category)
        results.append({"model_id": model_id, "score": score.score, "total_sessions": score.total_sessions})

    # Sort by score descending; neutral (0.5, no history) sits in middle naturally
    results.sort(key=lambda x: x["score"], reverse=True)
    return results[:top_n]
