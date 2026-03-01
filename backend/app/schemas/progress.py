from pydantic import BaseModel


class TrackLevel(BaseModel):
    track: str
    current_level: int
    sessions_completed: int
    avg_score: float


class ScoreEntry(BaseModel):
    session_id: str
    track: str
    level: int
    score: int
    evaluated_at: str


class MetricsTrend(BaseModel):
    avg_filler_rate: float
    avg_pause_rate: float
    avg_clarity_score: float
    sessions_evaluated: int


class SessionHistoryItem(BaseModel):
    session_id: str
    track: str
    level: int
    score: int | None
    status: str
    started_at: str


class ProgressSummaryResponse(BaseModel):
    user_id: str
    current_track_levels: list[TrackLevel]
    recent_scores: list[ScoreEntry]
    key_metrics_trend: MetricsTrend
    session_history: list[SessionHistoryItem]
