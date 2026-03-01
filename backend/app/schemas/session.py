from __future__ import annotations
from typing import Any, Literal
from pydantic import BaseModel, Field


# ── Generate ─────────────────────────────────────────────────────────────────

class UserMetrics(BaseModel):
    filler_rate: float | None = None
    pause_rate: float | None = None
    clarity_score: float | None = None
    avg_score_last_3: float | None = None
    weak_areas: list[str] = []


class GenerateSessionRequest(BaseModel):
    track: Literal["INTERVIEW", "PUBLIC_SPEAKING", "NEGOTIATION", "DEBATE", "COLD_CALL"]
    level: int = Field(ge=1, le=5)
    session_type: Literal["OPEN", "STRUCTURED", "STRESS", "AMBIGUOUS"]
    context: str | None = Field(None, max_length=500)
    user_metrics: UserMetrics | None = None
    perspective_switch_enabled: bool = False
    language: str = "en"


class InterruptionPlan(BaseModel):
    enabled: bool
    trigger_after_words: int
    interrupt_type: str
    interrupt_text: str | None


class PerspectiveSwitch(BaseModel):
    enabled: bool
    prompt_text: str | None
    expected_intent: str | None
    known_misinterpretation: str | None


class EvaluationRubric(BaseModel):
    clarity_weight: float
    structure_weight: float
    recovery_weight: float
    composure_weight: float


class Constraints(BaseModel):
    time_limit_seconds: int
    word_limit: int | None
    must_reference: list[str]
    forbidden_phrases: list[str]


class DiscomfortVariables(BaseModel):
    authority_tone: Literal["LOW", "MEDIUM", "HIGH", "HOSTILE"]
    ambiguity_level: Literal["NONE", "LOW", "MEDIUM", "HIGH"]
    interruption_plan: InterruptionPlan


class RoleplayConfig(BaseModel):
    persona_key: str
    display_name: str
    style_description: str
    challenges_facts: bool
    uses_silence: bool
    reframes_questions: bool
    dismisses_first_answer: bool


class FeedbackTemplate(BaseModel):
    max_bullets: int
    rubric_keys: list[str]
    next_attempt_instruction: str


class GenerateSessionResponse(BaseModel):
    session_id: str
    session_brief: str
    prompt: str
    constraints: Constraints
    discomfort_variables: DiscomfortVariables
    roleplay_config: RoleplayConfig | None
    evaluation_rubric: EvaluationRubric
    feedback_template: FeedbackTemplate
    perspective_switch: PerspectiveSwitch | None


# ── Submit ────────────────────────────────────────────────────────────────────

class AudioMetadata(BaseModel):
    duration_seconds: float | None = None
    file_placeholder: str | None = None   # path placeholder, not processed yet


class SubmitSessionRequest(BaseModel):
    raw_user_response: str = Field(..., min_length=1)
    audio_metadata: AudioMetadata | None = None
    response_start_ts: str | None = None   # ISO timestamp
    response_end_ts: str | None = None     # ISO timestamp


class ComputedMetrics(BaseModel):
    word_count: int
    filler_rate: float           # placeholder
    pause_rate: float            # placeholder
    words_per_minute: float      # placeholder
    clarity_score: float
    structure_score: float
    recovery_score: float
    composure_score: float


class FeedbackItem(BaseModel):
    dimension: str
    observation: str


class SubmitSessionResponse(BaseModel):
    session_id: str
    computed_metrics: ComputedMetrics
    score: int                              # 0-100
    feedback: list[FeedbackItem]            # max 3 bullets
    next_attempt_instruction: str
    next_level_recommendation: int
