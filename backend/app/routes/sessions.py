"""
Sessions routes:
  POST /sessions/generate  — generate a new training session
  POST /sessions/{id}/submit — submit a response and get evaluation
"""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update as sa_update
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth_utils import get_current_user
from app.database import get_db
from app.models import Session, SessionResult, UserTrackState
from app.schemas.session import (
    GenerateSessionRequest, GenerateSessionResponse,
    SubmitSessionRequest, SubmitSessionResponse,
)
from app.services.prompt_engine import generate_session
from app.services.evaluator import evaluate
from app.store import in_memory_store, USE_FALLBACK

router = APIRouter(prefix="/sessions", tags=["sessions"])


# ── Generate ──────────────────────────────────────────────────────────────────

@router.post("/generate", response_model=GenerateSessionResponse)
async def generate(
    body: GenerateSessionRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = current_user["user_id"]

    # Build session payload via prompt engine
    result = generate_session(body, user_id)
    session_id = str(uuid.uuid4())
    result.session_id = session_id

    session_record = {
        "id": session_id,
        "user_id": user_id,
        "track": body.track,
        "level": body.level,
        "session_type": body.session_type,
        "status": "ACTIVE",
        "context": body.context,
        "payload": {
            "session_brief": result.session_brief,
            "prompt": result.prompt,
            "constraints": result.constraints.model_dump(),
            "discomfort_variables": result.discomfort_variables.model_dump(),
            "roleplay_config": result.roleplay_config.model_dump() if result.roleplay_config else None,
            "evaluation_rubric": result.evaluation_rubric.model_dump(),
            "feedback_template": result.feedback_template.model_dump(),
            "perspective_switch": result.perspective_switch.model_dump() if result.perspective_switch else None,
            # Store track/session_type for evaluator lookup
            "track": body.track,
            "session_type": body.session_type,
        },
        "started_at": datetime.now(timezone.utc).isoformat(),
    }

    if USE_FALLBACK:
        in_memory_store["sessions"][session_id] = session_record
    else:
        db_session = Session(
            id=uuid.UUID(session_id),
            user_id=uuid.UUID(user_id),
            track=body.track,
            level=body.level,
            session_type=body.session_type,
            status="ACTIVE",
            context=body.context,
            payload=session_record["payload"],
        )
        db.add(db_session)
        await db.flush()

    return result


# ── Submit ────────────────────────────────────────────────────────────────────

@router.post("/{session_id}/submit", response_model=SubmitSessionResponse)
async def submit(
    session_id: str,
    body: SubmitSessionRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = current_user["user_id"]

    # Fetch session
    if USE_FALLBACK:
        session_record = in_memory_store["sessions"].get(session_id)
        if not session_record or session_record["user_id"] != user_id:
            raise HTTPException(status_code=404, detail="Session not found.")
        current_level = session_record["level"]
        track = session_record["track"]
    else:
        result = await db.execute(
            select(Session).where(
                Session.id == uuid.UUID(session_id),
                Session.user_id == uuid.UUID(user_id),
            )
        )
        db_session = result.scalar_one_or_none()
        if not db_session:
            raise HTTPException(status_code=404, detail="Session not found.")
        session_record = {
            "id": str(db_session.id),
            "user_id": str(db_session.user_id),
            "track": db_session.track,
            "level": db_session.level,
            "session_type": db_session.session_type,
            "payload": db_session.payload,
        }
        current_level = db_session.level
        track = db_session.track

    if session_record.get("status") == "COMPLETE":
        raise HTTPException(status_code=409, detail="Session already submitted.")

    # Evaluate
    metrics, score, feedback, next_level = evaluate(body, session_record, current_level)

    next_attempt = session_record.get("payload", {}).get(
        "feedback_template", {}
    ).get("next_attempt_instruction", "Focus on precision in your next attempt.")

    result_record = {
        "id": str(uuid.uuid4()),
        "session_id": session_id,
        "user_id": user_id,
        "raw_response": body.raw_user_response,
        "score": score,
        "clarity_score": metrics.clarity_score,
        "structure_score": metrics.structure_score,
        "recovery_score": metrics.recovery_score,
        "composure_score": metrics.composure_score,
        "audio_duration_seconds": body.audio_metadata.duration_seconds if body.audio_metadata else None,
        "filler_rate": metrics.filler_rate,
        "pause_rate": metrics.pause_rate,
        "word_count": metrics.word_count,
        "feedback": [f.model_dump() for f in feedback],
        "next_level_recommendation": next_level,
        "evaluated_at": datetime.now(timezone.utc).isoformat(),
    }

    if USE_FALLBACK:
        in_memory_store["results"][session_id] = result_record
        in_memory_store["sessions"][session_id]["status"] = "COMPLETE"

        # Update track state
        key = f"{user_id}:{track}"
        existing = in_memory_store["track_state"].get(key)
        if existing:
            n = existing["sessions_completed"]
            existing["avg_score"] = round((existing["avg_score"] * n + score) / (n + 1), 2)
            existing["sessions_completed"] += 1
            existing["current_level"] = next_level
            existing["last_session_at"] = datetime.now(timezone.utc).isoformat()
        else:
            in_memory_store["track_state"][key] = {
                "user_id": user_id, "track": track,
                "current_level": next_level,
                "sessions_completed": 1,
                "avg_score": float(score),
                "last_session_at": datetime.now(timezone.utc).isoformat(),
            }
    else:
        # Store result
        db_result = SessionResult(
            id=uuid.UUID(result_record["id"]),
            session_id=uuid.UUID(session_id),
            user_id=uuid.UUID(user_id),
            raw_response=body.raw_user_response,
            score=score,
            clarity_score=metrics.clarity_score,
            structure_score=metrics.structure_score,
            recovery_score=metrics.recovery_score,
            composure_score=metrics.composure_score,
            audio_duration_seconds=body.audio_metadata.duration_seconds if body.audio_metadata else None,
            filler_rate=metrics.filler_rate,
            pause_rate=metrics.pause_rate,
            word_count=metrics.word_count,
            feedback=result_record["feedback"],
            next_level_recommendation=next_level,
        )
        db.add(db_result)

        # Mark session complete
        await db.execute(
            sa_update(Session)
            .where(Session.id == uuid.UUID(session_id))
            .values(status="COMPLETE", ended_at=datetime.now(timezone.utc))
        )

        # Upsert track state
        ts_result = await db.execute(
            select(UserTrackState).where(
                UserTrackState.user_id == uuid.UUID(user_id),
                UserTrackState.track == track,
            )
        )
        track_state = ts_result.scalar_one_or_none()
        if track_state:
            n = track_state.sessions_completed
            track_state.avg_score = round((track_state.avg_score * n + score) / (n + 1), 2)
            track_state.sessions_completed += 1
            track_state.current_level = next_level
            track_state.last_session_at = datetime.now(timezone.utc)
        else:
            db.add(UserTrackState(
                user_id=uuid.UUID(user_id),
                track=track,
                current_level=next_level,
                sessions_completed=1,
                avg_score=float(score),
                last_session_at=datetime.now(timezone.utc),
            ))

        await db.flush()

    return SubmitSessionResponse(
        session_id=session_id,
        computed_metrics=metrics,
        score=score,
        feedback=feedback,
        next_attempt_instruction=next_attempt,
        next_level_recommendation=next_level,
    )
