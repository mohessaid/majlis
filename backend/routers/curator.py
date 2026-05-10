from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from auth import get_current_user
from config import MODEL_DISPLAY_NAMES
from database import get_session
from llm import get_curator_warning
from models import Room
from scores import get_or_create_score, get_recommendations
from config import MODEL_IDS

router = APIRouter()

AVAILABLE_MODELS = [m for m in MODEL_IDS.keys() if m != "curator"]


@router.get("/curator/warn")
async def curator_warn(
    room_id: str = Query(...),
    model_id_to_add: str = Query(...),
    session: Session = Depends(get_session),
    user_id: str = Depends(get_current_user),
):
    room = session.get(Room, room_id)
    if not room:
        return {"should_warn": False, "warning": None, "reputation_score": 0.5, "better_alternatives": []}

    score_obj = get_or_create_score(session, model_id_to_add, room.category)

    warning_data = {"warning": None, "alternatives": []}
    if score_obj.score < 0.40:
        warning_data = await get_curator_warning(
            category=room.category,
            model_id=model_id_to_add,
            display_name=MODEL_DISPLAY_NAMES.get(model_id_to_add, model_id_to_add),
            score=score_obj.score,
            dismissal_count=score_obj.total_dismissals,
            total_sessions=score_obj.total_sessions,
        )

    # Get better alternatives
    alternatives = []
    recs = get_recommendations(session, room.category, AVAILABLE_MODELS, top_n=3)
    for r in recs:
        if r["model_id"] != model_id_to_add:
            alternatives.append({
                "model_id": r["model_id"],
                "display_name": MODEL_DISPLAY_NAMES.get(r["model_id"], r["model_id"]),
                "score": round(r["score"], 3),
            })

    return {
        "should_warn": score_obj.score < 0.40,
        "warning": warning_data.get("warning"),
        "reputation_score": round(score_obj.score, 3),
        "better_alternatives": alternatives[:2],
    }


@router.get("/curator/models")
async def get_available_models(
    room_id: str = Query(None),
    session: Session = Depends(get_session),
    user_id: str = Depends(get_current_user),
):
    """Return all available models with their reputation scores for a given room's category."""
    category = "general"
    if room_id:
        room = session.get(Room, room_id)
        if room:
            category = room.category

    models = []
    for model_id in AVAILABLE_MODELS:
        score_obj = get_or_create_score(session, model_id, category)
        from config import MODEL_SUPPORTS_THINKING
        models.append({
            "model_id": model_id,
            "display_name": MODEL_DISPLAY_NAMES.get(model_id, model_id),
            "score": round(score_obj.score, 3),
            "total_sessions": score_obj.total_sessions,
            "supports_thinking": MODEL_SUPPORTS_THINKING.get(model_id, False),
        })

    models.sort(key=lambda m: m["score"], reverse=True)
    return {"models": models, "category": category}
