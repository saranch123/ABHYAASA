// ── Core enums ────────────────────────────────────────────────────────────────

export type Track =
    | "INTERVIEW"
    | "PUBLIC_SPEAKING"
    | "NEGOTIATION"
    | "DEBATE"
    | "COLD_CALL";

export type Level = 1 | 2 | 3 | 4 | 5;
export type SessionType = "OPEN" | "STRUCTURED" | "STRESS" | "AMBIGUOUS";
export type AppMode = "live" | "demo";
export type SessionPhase =
    | "IDLE"
    | "GENERATING"
    | "GENERATED"
    | "RUNNING"
    | "SUBMITTING"
    | "FEEDBACK";

// ── Config ────────────────────────────────────────────────────────────────────

export interface SessionConfig {
    track: Track;
    level: Level;
    session_type: SessionType;
    context: string;
    perspective_switch_enabled: boolean;
    language: string;
}

// ── Generated session ─────────────────────────────────────────────────────────

export interface InterruptionPlan {
    enabled: boolean;
    trigger_after_words: number;
    interrupt_type: string;
    interrupt_text: string | null;
}

export interface DiscomfortVariables {
    authority_tone: "LOW" | "MEDIUM" | "HIGH" | "HOSTILE";
    ambiguity_level: "NONE" | "LOW" | "MEDIUM" | "HIGH";
    interruption_plan: InterruptionPlan;
}

export interface EvaluationRubric {
    clarity_weight: number;
    structure_weight: number;
    recovery_weight: number;
    composure_weight: number;
}

export interface RoleplayConfig {
    persona_key: string;
    display_name: string;
    style_description: string;
    challenges_facts: boolean;
    uses_silence: boolean;
    reframes_questions: boolean;
    dismisses_first_answer: boolean;
}

export interface GeneratedSession {
    session_id: string;
    session_brief: string;
    prompt: string;
    constraints: {
        time_limit_seconds: number;
        word_limit: number | null;
        must_reference: string[];
        forbidden_phrases: string[];
    };
    discomfort_variables: DiscomfortVariables;
    roleplay_config: RoleplayConfig | null;
    evaluation_rubric: EvaluationRubric;
    feedback_template: {
        max_bullets: number;
        rubric_keys: string[];
        next_attempt_instruction: string;
    };
    perspective_switch: {
        enabled: boolean;
        prompt_text: string | null;
        expected_intent: string | null;
        known_misinterpretation: string | null;
    } | null;
}

// ── Results ───────────────────────────────────────────────────────────────────

export interface FeedbackItem {
    dimension: string;
    observation: string;
}

export interface ComputedMetrics {
    word_count: number;
    filler_rate: number;
    pause_rate: number;
    words_per_minute: number;
    clarity_score: number;
    structure_score: number;
    recovery_score: number;
    composure_score: number;
}

export interface SessionResult {
    session_id: string;
    computed_metrics: ComputedMetrics;
    score: number;
    feedback: FeedbackItem[];
    next_attempt_instruction: string;
    next_level_recommendation: number;
}

// ── Progress / History ────────────────────────────────────────────────────────

export interface StoredSession {
    session_id: string;
    track: Track;
    level: number;
    session_type: SessionType;
    score: number | null;
    started_at: string;
    status: "ACTIVE" | "COMPLETE";
    metrics?: ComputedMetrics;
}

export interface ProgressSummary {
    user_id: string;
    current_track_levels: Array<{
        track: string;
        current_level: number;
        sessions_completed: number;
        avg_score: number;
    }>;
    recent_scores: Array<{
        session_id: string;
        track: string;
        level: number;
        score: number;
        evaluated_at: string;
    }>;
    key_metrics_trend: {
        avg_filler_rate: number;
        avg_pause_rate: number;
        avg_clarity_score: number;
        sessions_evaluated: number;
    };
    session_history: Array<{
        session_id: string;
        track: string;
        level: number;
        score: number | null;
        status: string;
        started_at: string;
    }>;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface TokenResponse {
    access_token: string;
    token_type: string;
    user_id: string;
    alias: string;
}
