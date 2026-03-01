import uuid
from datetime import datetime
from sqlalchemy import Integer, Float, DateTime, ForeignKey, Text, String, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy import ARRAY as SA_ARRAY
from app.database import Base


class SessionResult(Base):
    __tablename__ = "session_results"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    raw_response: Mapped[str] = mapped_column(Text, nullable=False)
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    clarity_score: Mapped[float] = mapped_column(Float, nullable=False)
    structure_score: Mapped[float] = mapped_column(Float, nullable=False)
    recovery_score: Mapped[float] = mapped_column(Float, nullable=False)
    composure_score: Mapped[float] = mapped_column(Float, nullable=False)
    # Audio placeholder fields
    audio_duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    filler_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    pause_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    word_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    feedback: Mapped[dict] = mapped_column(JSONB, nullable=False)
    next_level_recommendation: Mapped[int] = mapped_column(Integer, nullable=False)
    evaluated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
