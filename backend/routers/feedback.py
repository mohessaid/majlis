"""
Feedback router — currently room end and score endpoints are in rooms.py.
This router handles additional feedback signals.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session

from auth import get_current_user
from database import get_session
from models import Room
from scores import get_or_create_score, update_score
from config import MODEL_IDS

router = APIRouter()

AVAILABLE_MODELS = [m for m in MODEL_IDS.keys() if m != "curator"]


class CuratorFlagRequest(BaseModel):
    room_id: str
    participant_id: str
    confirmed: bool  # user confirmed the Curator's shallow flag


@router.post("/feedback/curator-flag")
async def confirm_curator_flag(
    body: CuratorFlagRequest,
    session: Session = Depends(get_session),
    user_id: str = Depends(get_current_user),
):
    """User confirms or dismisses a Curator shallow flag. Confirmed = -0.5 score."""
    from models import Participant

    if not body.confirmed:
        return {"status": "dismissed"}

    room = session.get(Room, body.room_id)
    if not room:
        return {"status": "room_not_found"}

    participant = session.get(Participant, body.participant_id)
    if not participant:
        return {"status": "participant_not_found"}

    score_obj = update_score(session, participant.model_id, room.category, "curator_flagged")

    return {
        "status": "flagged",
        "new_score": round(score_obj.score, 3),
        "score_delta": -0.5,
    }


@router.get("/feedback/scores")
async def get_all_scores(
    session: Session = Depends(get_session),
    user_id: str = Depends(get_current_user),
):
    """Return all reputation scores for all models/categories (debug/admin view)."""
    scores = []
    categories = ["recent_events", "philosophy", "coding", "science", "mathematics", "politics", "culture", "general"]
    for model_id in AVAILABLE_MODELS:
        for category in categories:
            score_obj = get_or_create_score(session, model_id, category)
            if score_obj.total_sessions > 0:
                scores.append({
                    "model_id": model_id,
                    "category": category,
                    "score": round(score_obj.score, 3),
                    "total_sessions": score_obj.total_sessions,
                    "total_dismissals": score_obj.total_dismissals,
                })
    return {"scores": scores}
