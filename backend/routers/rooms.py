import json
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from auth import get_current_user
from config import MODEL_IDS, MODEL_DISPLAY_NAMES, MODEL_SUPPORTS_THINKING
from database import get_session
from llm import detect_category, get_curator_recommendations, get_curator_warning, get_replacement_suggestion
from models import Participant, Room
from scores import get_or_create_score, get_recommendations, update_score

router = APIRouter()

AVAILABLE_MODELS = list(MODEL_IDS.keys())
AVAILABLE_MODELS = [m for m in AVAILABLE_MODELS if m != "curator"]


class CreateRoomRequest(BaseModel):
    question: str
    user_api_keys: Optional[dict] = None


class AddParticipantRequest(BaseModel):
    model_id: str
    capabilities: dict = {"web_search": False, "thinking": False, "fast_mode": False}
    api_key: Optional[str] = None


class DismissParticipantRequest(BaseModel):
    reason: str
    reason_text: Optional[str] = None


class EndRoomRequest(BaseModel):
    overall_rating: int


@router.post("/room/create")
async def create_room(
    body: CreateRoomRequest,
    session: Session = Depends(get_session),
    user_id: str = Depends(get_current_user),
):
    category = await detect_category(body.question)

    room = Room(
        id=str(uuid.uuid4()),
        question=body.question,
        category=category,
        user_id=user_id,
    )
    session.add(room)
    session.commit()
    session.refresh(room)

    # Build model list with reputation scores for the Curator
    models_with_scores = []
    for model_id in AVAILABLE_MODELS:
        score_obj = get_or_create_score(session, model_id, category)
        models_with_scores.append({
            "model_id": model_id,
            "display_name": MODEL_DISPLAY_NAMES.get(model_id, model_id),
            "score": round(score_obj.score, 3),
            "supports_thinking": MODEL_SUPPORTS_THINKING.get(model_id, False),
        })

    curator_data = await get_curator_recommendations(category, body.question, models_with_scores)

    # Enrich recommendations with display names and full capability info
    enriched = []
    for rec in curator_data.get("recommendations", []):
        mid = rec.get("model_id", "")
        enriched.append({
            "model_id": mid,
            "display_name": MODEL_DISPLAY_NAMES.get(mid, mid),
            "reputation_score": next(
                (m["score"] for m in models_with_scores if m["model_id"] == mid), 0.5
            ),
            "reason": rec.get("reason", ""),
            "suggested_capabilities": rec.get(
                "suggested_capabilities",
                {"web_search": False, "thinking": False, "fast_mode": False},
            ),
        })

    return {
        "room_id": room.id,
        "question": room.question,
        "detected_category": category,
        "curator_recommendations": enriched,
        "curator_notes": curator_data.get("notes"),
        "all_models": models_with_scores,
    }


@router.post("/room/{room_id}/participant/add")
async def add_participant(
    room_id: str,
    body: AddParticipantRequest,
    session: Session = Depends(get_session),
    user_id: str = Depends(get_current_user),
):
    room = session.get(Room, room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    score_obj = get_or_create_score(session, body.model_id, room.category)

    curator_warning = None
    if score_obj.score < 0.40:
        warning_data = await get_curator_warning(
            category=room.category,
            model_id=body.model_id,
            display_name=MODEL_DISPLAY_NAMES.get(body.model_id, body.model_id),
            score=score_obj.score,
            dismissal_count=score_obj.total_dismissals,
            total_sessions=score_obj.total_sessions,
        )
        curator_warning = warning_data.get("warning")

    participant = Participant(
        id=str(uuid.uuid4()),
        room_id=room_id,
        model_id=body.model_id,
        display_name=MODEL_DISPLAY_NAMES.get(body.model_id, body.model_id),
        capabilities=json.dumps(body.capabilities),
    )
    session.add(participant)
    session.commit()
    session.refresh(participant)

    return {
        "participant_id": participant.id,
        "curator_warning": curator_warning,
        "reputation_score": round(score_obj.score, 3),
    }


@router.post("/room/{room_id}/participant/{participant_id}/dismiss")
async def dismiss_participant(
    room_id: str,
    participant_id: str,
    body: DismissParticipantRequest,
    session: Session = Depends(get_session),
    user_id: str = Depends(get_current_user),
):
    room = session.get(Room, room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    participant = session.get(Participant, participant_id)
    if not participant or participant.room_id != room_id:
        raise HTTPException(status_code=404, detail="Participant not found")

    participant.dismissed_at = datetime.utcnow()
    participant.dismissal_reason = body.reason
    session.add(participant)

    score_obj = update_score(session, participant.model_id, room.category, "dismissed")

    # Get remaining models with scores for suggestion
    remaining = []
    stmt = select(Participant).where(
        Participant.room_id == room_id,
        Participant.dismissed_at.is_(None),
        Participant.id != participant_id,
    )
    active_model_ids = {p.model_id for p in session.exec(stmt).all()}
    available_for_suggestion = [
        m for m in AVAILABLE_MODELS if m not in active_model_ids and m != participant.model_id
    ]
    models_with_scores = [
        {"model_id": m, "score": get_or_create_score(session, m, room.category).score}
        for m in available_for_suggestion
    ]
    suggestion = await get_replacement_suggestion(room.category, participant.model_id, models_with_scores)

    return {
        "score_delta": -1.0,
        "new_score": round(score_obj.score, 3),
        "curator_suggestion": suggestion,
    }


@router.post("/room/{room_id}/end")
async def end_room(
    room_id: str,
    body: EndRoomRequest,
    session: Session = Depends(get_session),
    user_id: str = Depends(get_current_user),
):
    room = session.get(Room, room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    room.status = "ended"
    room.overall_rating = body.overall_rating
    session.add(room)

    stmt = select(Participant).where(
        Participant.room_id == room_id,
        Participant.dismissed_at.is_(None),
    )
    active_participants = session.exec(stmt).all()

    for p in active_participants:
        update_score(session, p.model_id, room.category, "session_completed")

    dismissed_stmt = select(Participant).where(
        Participant.room_id == room_id,
        Participant.dismissed_at.isnot(None),
    )
    dismissed = session.exec(dismissed_stmt).all()

    return {
        "status": "ended",
        "active_count": len(active_participants),
        "dismissed_count": len(dismissed),
        "participants_stayed": [p.model_id for p in active_participants],
        "participants_dismissed": [
            {"model_id": p.model_id, "reason": p.dismissal_reason} for p in dismissed
        ],
    }


@router.get("/room/{room_id}")
async def get_room(
    room_id: str,
    session: Session = Depends(get_session),
    user_id: str = Depends(get_current_user),
):
    room = session.get(Room, room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    stmt = select(Participant).where(Participant.room_id == room_id)
    participants = session.exec(stmt).all()

    return {
        "room_id": room.id,
        "question": room.question,
        "category": room.category,
        "status": room.status,
        "participants": [
            {
                "id": p.id,
                "model_id": p.model_id,
                "display_name": p.display_name,
                "capabilities": json.loads(p.capabilities),
                "dismissed": p.dismissed_at is not None,
                "dismissal_reason": p.dismissal_reason,
            }
            for p in participants
        ],
    }
