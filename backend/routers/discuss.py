import asyncio
import json
import uuid
from typing import AsyncGenerator, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlmodel import Session, select

from auth import get_current_user
from database import get_session
from llm import call_model_streaming, check_shallow_response
from models import Message, Participant, Room
from search import format_search_context, tavily_search

router = APIRouter()

SURFACE_SYSTEM = (
    "You are {display_name} in a group discussion. Give your position on the topic "
    "in 2-3 sentences. Be direct. Lead with your actual view, not acknowledgment that "
    "it's a complex topic."
)

DEPTH_SYSTEM = (
    "You are {display_name}. The user wants you to elaborate on what you said. "
    "Go deeper — add specifics, examples, or reasoning you didn't include before. "
    "Do not repeat your previous response."
)



DISCUSS_SYSTEM = (
    "You are {display_name} in a group discussion. The other models have shared their views. "
    "Respond directly to what they said — agree with specifics, challenge a point, or add something they missed. "
    "2-3 sentences max. No preamble."
)

class DiscussRequest(BaseModel):
    room_id: str
    message: str
    target_participant_id: Optional[str] = None
    depth_surface_message_id: Optional[str] = None
    mode: Optional[str] = None  # "discuss" for inter-model discussion


async def _stream_participant(
    participant: Participant,
    message: str,
    layer: str,
    search_results: list,
    session: Session,
) -> AsyncGenerator[bytes, None]:
    caps = json.loads(participant.capabilities or "{}")
    display_name = participant.display_name

    system_template = DEPTH_SYSTEM if layer == "depth" else (DISCUSS_SYSTEM if layer == "discuss" else SURFACE_SYSTEM)
    system_prompt = system_template.format(display_name=display_name)

    # Build user message, optionally prepending search context
    user_content = message
    if search_results:
        user_content = format_search_context(search_results) + "\n\n" + message

    max_tokens = 150 if layer == "discuss" else (200 if caps.get("fast_mode") else (600 if layer == "depth" else 300))

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_content},
    ]

    full_content = ""

    # Stream token chunks
    async for chunk in call_model_streaming(
        participant.model_id,
        messages,
        max_tokens=max_tokens,
        temperature=0.7 if not caps.get("fast_mode") else 0.5,
    ):
        full_content += chunk
        event = json.dumps({
            "participant_id": participant.id,
            "model_id": participant.model_id,
            "layer": layer,
            "chunk": chunk,
            "done": False,
        })
        yield f"data: {event}\n\n".encode()

    # Done event
    done_event = json.dumps({
        "participant_id": participant.id,
        "model_id": participant.model_id,
        "layer": layer,
        "done": True,
        "searched": bool(search_results),
        "thinking_available": False,
        "message_id": str(uuid.uuid4()),
    })
    yield f"data: {done_event}\n\n".encode()

    # Persist to DB
    msg = Message(
        id=str(uuid.uuid4()),
        room_id=participant.room_id,
        participant_id=participant.id,
        layer=layer,
        content=full_content,
        searched=bool(search_results),
    )
    session.add(msg)
    session.commit()


async def _generate_all_streams(
    participants: list[Participant],
    message: str,
    layer: str,
    session: Session,
) -> AsyncGenerator[bytes, None]:
    """Concurrently stream all participants, merging their outputs."""
    queues: list[asyncio.Queue] = [asyncio.Queue() for _ in participants]

    async def fill_queue(participant: Participant, q: asyncio.Queue, idx: int):
        caps = json.loads(participant.capabilities or "{}")
        search_results = []
        if caps.get("web_search"):
            search_results = await tavily_search(message)

        async for chunk in _stream_participant(participant, message, layer, search_results, session):
            await q.put(chunk)
        await q.put(None)  # sentinel

    tasks = [
        asyncio.create_task(fill_queue(p, queues[i], i))
        for i, p in enumerate(participants)
    ]

    done_count = 0
    while done_count < len(participants):
        for q in queues:
            try:
                item = q.get_nowait()
                if item is None:
                    done_count += 1
                else:
                    yield item
            except asyncio.QueueEmpty:
                pass
        if done_count < len(participants):
            await asyncio.sleep(0.01)

    await asyncio.gather(*tasks, return_exceptions=True)


@router.post("/discuss")
async def discuss(
    body: DiscussRequest,
    session: Session = Depends(get_session),
    user_id: str = Depends(get_current_user),
):
    room = session.get(Room, body.room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    # Save user message
    user_msg = Message(
        id=str(uuid.uuid4()),
        room_id=body.room_id,
        participant_id=None,
        layer="user",
        content=body.message,
    )
    session.add(user_msg)
    session.commit()

    # Determine which participants respond
    if body.target_participant_id:
        stmt = select(Participant).where(
            Participant.id == body.target_participant_id,
            Participant.room_id == body.room_id,
            Participant.dismissed_at.is_(None),
        )
        participants = list(session.exec(stmt).all())
        layer = "depth"
    else:
        stmt = select(Participant).where(
            Participant.room_id == body.room_id,
            Participant.dismissed_at.is_(None),
        )
        participants = list(session.exec(stmt).all())
        layer = "discuss" if body.mode == "discuss" else "surface"

    if not participants:
        raise HTTPException(status_code=400, detail="No active participants in room")

    async def event_stream():
        async for chunk in _generate_all_streams(participants, body.message, layer, session):
            yield chunk

        # After depth expansion, run Curator shallow check
        if layer == "depth" and participants:
            p = participants[0]
            stmt_surface = select(Message).where(
                Message.room_id == body.room_id,
                Message.participant_id == p.id,
                Message.layer == "surface",
            ).order_by(Message.created_at.desc())
            surface_msg = session.exec(stmt_surface).first()

            stmt_depth = select(Message).where(
                Message.room_id == body.room_id,
                Message.participant_id == p.id,
                Message.layer == "depth",
            ).order_by(Message.created_at.desc())
            depth_msg = session.exec(stmt_depth).first()

            if surface_msg and depth_msg:
                result = await check_shallow_response(surface_msg.content, depth_msg.content)
                if result.get("is_shallow") and result.get("confidence", 0) > 0.75:
                    curator_event = json.dumps({
                        "participant_id": "curator",
                        "model_id": "curator",
                        "layer": "curator",
                        "chunk": (
                            f"That sounded like the same answer with different words. "
                            f"@{p.display_name} — what specifically changes if we go deeper on this?"
                        ),
                        "done": True,
                        "is_curator": True,
                    })
                    yield f"data: {curator_event}\n\n".encode()

                    # Save curator message
                    curator_msg = Message(
                        id=str(uuid.uuid4()),
                        room_id=body.room_id,
                        participant_id=None,
                        layer="curator",
                        content=curator_event,
                    )
                    session.add(curator_msg)
                    session.commit()

        # ── Curator synthesis after surface/discuss rounds ──────────────────
        if layer in ("surface", "discuss") and participants:
            p_map = {p.id: p for p in participants}
            # Read what each model just wrote (most recent messages for this round)
            from sqlmodel import select as sel
            round_msgs = []
            for p in participants:
                stmt_m = sel(Message).where(
                    Message.room_id == body.room_id,
                    Message.participant_id == p.id,
                    Message.layer == layer,
                ).order_by(Message.created_at.desc()).limit(1)
                m = session.exec(stmt_m).first()
                if m:
                    round_msgs.append((p.display_name, m.content))

            if round_msgs:
                context = "\n\n".join(f"{name}: {text[:400]}" for name, text in round_msgs)
                question_short = body.message[:300]
                # For discuss round, strip the preamble
                if "[Discussion Round]" in question_short:
                    question_short = "Follow-up discussion"
                curator_messages = [
                    {"role": "system", "content": (
                        "You are a sharp debate moderator. In 1-2 short sentences: "
                        "note what the models agree on or where they split. "
                        "Then give the user a direct recommendation or next question to push further. "
                        "Never repeat what they said — synthesize."
                    )},
                    {"role": "user", "content": f"Topic: {question_short}\n\nResponses:\n{context}"},
                ]
                curator_full = ""
                async for chunk in call_model_streaming("curator", curator_messages, max_tokens=80, temperature=0.3):
                    curator_full += chunk
                    event = json.dumps({
                        "participant_id": "curator",
                        "model_id": "curator",
                        "layer": "curator",
                        "chunk": chunk,
                        "done": False,
                        "is_curator": True,
                    })
                    yield f"data: {event}\n\n".encode()

                if curator_full:
                    yield (
                        "data: " + json.dumps({
                            "participant_id": "curator",
                            "model_id": "curator",
                            "layer": "curator",
                            "done": True,
                            "is_curator": True,
                        }) + "\n\n"
                    ).encode()
                    curator_msg = Message(
                        id=str(uuid.uuid4()),
                        room_id=body.room_id,
                        participant_id=None,
                        layer="curator",
                        content=curator_full,
                    )
                    session.add(curator_msg)
                    session.commit()

        yield b"data: {\"type\": \"stream_end\"}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/room/{room_id}/messages")
async def get_messages(
    room_id: str,
    session: Session = Depends(get_session),
    user_id: str = Depends(get_current_user),
):
    room = session.get(Room, room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    stmt = select(Message).where(Message.room_id == room_id).order_by(Message.created_at)
    messages = session.exec(stmt).all()

    # Build participant map for model_id/display_name lookup
    participants_stmt = select(Participant).where(Participant.room_id == room_id)
    p_map = {p.id: p for p in session.exec(participants_stmt).all()}

    result = []
    for m in messages:
        p = p_map.get(m.participant_id) if m.participant_id else None
        if m.layer == "curator":
            model_id = "curator"
            display_name = "Curator"
        elif p:
            model_id = p.model_id
            display_name = p.display_name
        else:
            model_id = None
            display_name = "You"
        result.append({
            "id": m.id,
            "participant_id": m.participant_id or "user",
            "model_id": model_id,
            "display_name": display_name,
            "layer": m.layer,
            "content": m.content,
            "searched": m.searched or False,
            "created_at": m.created_at.isoformat(),
        })
    return result
