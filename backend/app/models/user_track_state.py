import uuid
from datetime import datetime
from sqlalchemy import Integer, Float, DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class UserTrackState(Base):
    __tablename__ = "user_track_state"
    __table_args__ = (
        UniqueConstraint("user_id", "track", name="uq_user_track"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    track: Mapped[str] = mapped_column(String(50), nullable=False)
    current_level: Mapped[int] = mapped_column(Integer, default=1)
    sessions_completed: Mapped[int] = mapped_column(Integer, default=0)
    avg_score: Mapped[float] = mapped_column(Float, default=0.0)
    last_session_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
