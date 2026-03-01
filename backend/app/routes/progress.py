"""
Progress routes:
  GET /progress/summary — full progress summary for the authenticated user
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth_utils import get_current_user
from app.database import get_db
from app.models import Session, SessionResult, UserTrackState
from app.schemas.progress import (
    ProgressSummaryResponse,
    TrackLevel,
    ScoreEntry,
    MetricsTrend,
    SessionHistoryItem,
)
from app.store import in_memory_store, USE_FALLBACK

router = APIRouter(prefix="/progress", tags=["progress"])


@router.get("/summary", response_model=ProgressSummaryResponse)
async def progress_summary(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = current_user["user_id"]

    if USE_FALLBACK:
        # ── In-memory path ────────────────────────────────────────────────────
        track_levels = [
            TrackLevel(
                track=v["track"],
                current_level=v["current_level"],
                sessions_completed=v["sessions_completed"],
                avg_score=v["avg_score"],
            )
            for k, v in in_memory_store["track_state"].items()
            if v["user_id"] == user_id
        ]

        user_sessions = [
            s for s in in_memory_store["sessions"].values()
            if s["user_id"] == user_id
        ]
        user_results = [
            r for r in in_memory_store["results"].values()
            if r["user_id"] == user_id
        ]

        recent_scores = [
            ScoreEntry(
                session_id=r["session_id"],
                track=in_memory_store["sessions"].get(r["session_id"], {}).get("track", ""),
                level=in_memory_store["sessions"].get(r["session_id"], {}).get("level", 1),
                score=r["score"],
                evaluated_at=r["evaluated_at"],
            )
            for r in sorted(user_results, key=lambda x: x["evaluated_at"], reverse=True)[:10]
        ]

        # Metrics trend
        if user_results:
            avg_filler = round(sum(r["filler_rate"] or 0 for r in user_results) / len(user_results), 3)
            avg_pause = round(sum(r["pause_rate"] or 0 for r in user_results) / len(user_results), 3)
            avg_clarity = round(sum(r["clarity_score"] for r in user_results) / len(user_results), 3)
        else:
            avg_filler = avg_pause = avg_clarity = 0.0

        trend = MetricsTrend(
            avg_filler_rate=avg_filler,
            avg_pause_rate=avg_pause,
            avg_clarity_score=avg_clarity,
            sessions_evaluated=len(user_results),
        )

        session_history = [
            SessionHistoryItem(
                session_id=s["id"],
                track=s["track"],
                level=s["level"],
                score=in_memory_store["results"].get(s["id"], {}).get("score"),
                status=s["status"],
                started_at=s.get("started_at", ""),
            )
            for s in sorted(user_sessions, key=lambda x: x.get("started_at", ""), reverse=True)[:20]
        ]

    else:
        # ── PostgreSQL path ───────────────────────────────────────────────────
        import uuid as _uuid

        uid = _uuid.UUID(user_id)

        # Track levels
        ts_rows = (await db.execute(
            select(UserTrackState).where(UserTrackState.user_id == uid)
        )).scalars().all()
        track_levels = [
            TrackLevel(
                track=ts.track,
                current_level=ts.current_level,
                sessions_completed=ts.sessions_completed,
                avg_score=ts.avg_score,
            )
            for ts in ts_rows
        ]

        # Recent results (last 10)
        result_rows = (await db.execute(
            select(SessionResult, Session.track, Session.level)
            .join(Session, SessionResult.session_id == Session.id)
            .where(SessionResult.user_id == uid)
            .order_by(desc(SessionResult.evaluated_at))
            .limit(10)
        )).all()
        recent_scores = [
            ScoreEntry(
                session_id=str(row.SessionResult.session_id),
                track=row.track,
                level=row.level,
                score=row.SessionResult.score,
                evaluated_at=row.SessionResult.evaluated_at.isoformat(),
            )
            for row in result_rows
        ]

        # Metrics trend (all results)
        all_results = (await db.execute(
            select(SessionResult).where(SessionResult.user_id == uid)
        )).scalars().all()
        if all_results:
            avg_filler = round(sum(r.filler_rate or 0 for r in all_results) / len(all_results), 3)
            avg_pause = round(sum(r.pause_rate or 0 for r in all_results) / len(all_results), 3)
            avg_clarity = round(sum(r.clarity_score for r in all_results) / len(all_results), 3)
        else:
            avg_filler = avg_pause = avg_clarity = 0.0

        trend = MetricsTrend(
            avg_filler_rate=avg_filler,
            avg_pause_rate=avg_pause,
            avg_clarity_score=avg_clarity,
            sessions_evaluated=len(all_results),
        )

        # Session history (last 20)
        session_rows = (await db.execute(
            select(Session).where(Session.user_id == uid)
            .order_by(desc(Session.started_at))
            .limit(20)
        )).scalars().all()

        # Build a score lookup for done sessions
        done_ids = {str(s.id) for s in session_rows if s.status == "COMPLETE"}
        score_map: dict[str, int] = {}
        if done_ids:
            rs = (await db.execute(
                select(SessionResult.session_id, SessionResult.score)
                .where(SessionResult.session_id.in_([_uuid.UUID(i) for i in done_ids]))
            )).all()
            score_map = {str(r.session_id): r.score for r in rs}

        session_history = [
            SessionHistoryItem(
                session_id=str(s.id),
                track=s.track,
                level=s.level,
                score=score_map.get(str(s.id)),
                status=s.status,
                started_at=s.started_at.isoformat(),
            )
            for s in session_rows
        ]

    return ProgressSummaryResponse(
        user_id=user_id,
        current_track_levels=track_levels,
        recent_scores=recent_scores,
        key_metrics_trend=trend,
        session_history=session_history,
    )
