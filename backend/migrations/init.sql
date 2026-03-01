-- ABHYAASA PostgreSQL Schema — v1.0.0-mvp
-- Run once against your target database:
--   psql -U postgres -d abhyaasa -f migrations/init.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── users ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dev_alias           VARCHAR(100) NOT NULL UNIQUE,
    language_preference VARCHAR(5)   NOT NULL DEFAULT 'en',
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── sessions ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    track        VARCHAR(50)  NOT NULL,
    level        SMALLINT     NOT NULL CHECK (level BETWEEN 1 AND 5),
    session_type VARCHAR(50)  NOT NULL,
    status       VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    context      TEXT,
    payload      JSONB        NOT NULL,
    started_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    ended_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id  ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_track     ON sessions(track);
CREATE INDEX IF NOT EXISTS idx_sessions_status    ON sessions(status);

-- ── session_results ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS session_results (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id            UUID         NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    user_id               UUID         NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
    raw_response          TEXT         NOT NULL,
    score                 SMALLINT     NOT NULL CHECK (score BETWEEN 0 AND 100),
    clarity_score         NUMERIC(4,3) NOT NULL,
    structure_score       NUMERIC(4,3) NOT NULL,
    recovery_score        NUMERIC(4,3) NOT NULL,
    composure_score       NUMERIC(4,3) NOT NULL,
    audio_duration_seconds NUMERIC(8,2),
    filler_rate           NUMERIC(4,3),
    pause_rate            NUMERIC(4,3),
    word_count            INTEGER,
    feedback              JSONB        NOT NULL,
    next_level_recommendation SMALLINT NOT NULL,
    evaluated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_results_user_id    ON session_results(user_id);
CREATE INDEX IF NOT EXISTS idx_session_results_session_id ON session_results(session_id);
CREATE INDEX IF NOT EXISTS idx_session_results_eval_at    ON session_results(evaluated_at DESC);

-- ── user_track_state ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_track_state (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    track               VARCHAR(50)  NOT NULL,
    current_level       SMALLINT     NOT NULL DEFAULT 1 CHECK (current_level BETWEEN 1 AND 5),
    sessions_completed  INTEGER      NOT NULL DEFAULT 0,
    avg_score           NUMERIC(5,2) NOT NULL DEFAULT 0.0,
    last_session_at     TIMESTAMPTZ,
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_track UNIQUE (user_id, track)
);

CREATE INDEX IF NOT EXISTS idx_user_track_state_user_id ON user_track_state(user_id);
