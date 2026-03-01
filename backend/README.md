# ABHYAASA Backend — MVP

FastAPI + PostgreSQL training platform backend. No mental health framing. Training-focused only.

---

## Prerequisites

- Python 3.11+
- PostgreSQL 14+ (optional — see in-memory fallback below)

---

## Quick Start (In-Memory, No DB Required)

```bash
cd backend

# 1. Create virtual environment
python3 -m venv venv
source venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Create .env
cp .env.example .env
# Edit .env and set: USE_IN_MEMORY_FALLBACK=true

# 4. Run
uvicorn app.main:app --reload --port 8000
```

API docs available at: http://localhost:8000/docs

---

## Quick Start (PostgreSQL)

```bash
# 1-3: same as above, but set USE_IN_MEMORY_FALLBACK=false in .env
#      and configure DATABASE_URL

# 4. Create database
createdb abhyaasa

# 5. Run schema migration
psql -U postgres -d abhyaasa -f migrations/init.sql

# 6. Run server
uvicorn app.main:app --reload --port 8000
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql+asyncpg://...` | Async PostgreSQL DSN |
| `SECRET_KEY` | (change this) | JWT signing key |
| `ALGORITHM` | `HS256` | JWT algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` | Token TTL (24h) |
| `DEV_MODE` | `true` | Enables /auth/dev-login |
| `USE_IN_MEMORY_FALLBACK` | `false` | Skip DB, use RAM store |

---

## File Tree

```
backend/
├── app/
│   ├── main.py                   # FastAPI app + middleware
│   ├── config.py                 # Settings (pydantic-settings)
│   ├── database.py               # Async SQLAlchemy engine
│   ├── auth_utils.py             # JWT dependency
│   ├── store.py                  # In-memory fallback store
│   ├── models/
│   │   ├── user.py
│   │   ├── session.py
│   │   ├── session_result.py
│   │   └── user_track_state.py
│   ├── schemas/
│   │   ├── auth.py
│   │   ├── session.py
│   │   └── progress.py
│   ├── services/
│   │   ├── guardrails.py         # Banned phrase filter + middleware
│   │   ├── prompt_engine.py      # Level-based session generator
│   │   └── evaluator.py          # Heuristic scoring engine
│   └── routes/
│       ├── auth.py               # POST /auth/dev-login
│       ├── sessions.py           # POST /sessions/generate, POST /sessions/{id}/submit
│       └── progress.py           # GET /progress/summary
├── migrations/
│   └── init.sql                  # PostgreSQL DDL
├── requirements.txt
├── .env.example
└── README.md
```

---

## API Reference + curl Examples

### 1. POST /auth/dev-login

Creates or retrieves a user by alias and returns a JWT.

```bash
curl -s -X POST http://localhost:8000/auth/dev-login \
  -H "Content-Type: application/json" \
  -d '{"alias": "dev_user_1", "language": "en"}' | jq
```

**Response:**
```json
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "user_id": "a1b2c3d4-...",
  "alias": "dev_user_1"
}
```

---

### 2. POST /sessions/generate

Generates a full training session payload.

```bash
TOKEN="eyJ..."   # from dev-login

curl -s -X POST http://localhost:8000/sessions/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "track": "INTERVIEW",
    "level": 4,
    "session_type": "STRESS",
    "context": "Senior PM role at a Series B fintech",
    "user_metrics": {
      "filler_rate": 0.12,
      "pause_rate": 0.20,
      "clarity_score": 0.55,
      "avg_score_last_3": 58.0,
      "weak_areas": ["clarity", "recovery"]
    },
    "perspective_switch_enabled": true,
    "language": "en"
  }' | jq
```

**Response (truncated):**
```json
{
  "session_id": "s9k8j7h6-...",
  "session_brief": "You are interviewing for a Senior Product Manager role at a Series B fintech...",
  "prompt": "Your last 3 product launches all missed the deadline. Why should we believe this will be different?",
  "constraints": {
    "time_limit_seconds": 60,
    "word_limit": 150,
    "must_reference": ["What metric proves that worked?"],
    "forbidden_phrases": ["um", "like", "you know", "sort of", "basically"]
  },
  "discomfort_variables": {
    "authority_tone": "HIGH",
    "ambiguity_level": "HIGH",
    "interruption_plan": {
      "enabled": true,
      "trigger_after_words": 52,
      "interrupt_type": "CHALLENGE",
      "interrupt_text": "Stop. That claim needs a number. Give it."
    }
  },
  "roleplay_config": {
    "persona_key": "SKEPTICAL_HIRING_MANAGER",
    "display_name": "Hiring Manager — Priya Mehta",
    "style_description": "Direct, time-pressured, challenges unsupported claims...",
    "challenges_facts": true,
    "uses_silence": true,
    "reframes_questions": true,
    "dismisses_first_answer": false
  },
  "evaluation_rubric": {
    "clarity_weight": 0.3158,
    "structure_weight": 0.2368,
    "recovery_weight": 0.3158,
    "composure_weight": 0.1316
  },
  "feedback_template": {
    "max_bullets": 3,
    "rubric_keys": ["clarity", "structure", "recovery", "composure"],
    "next_attempt_instruction": "In the next attempt: lead with the metric, then the action, then the outcome. Do not open with context."
  },
  "perspective_switch": {
    "enabled": true,
    "prompt_text": "Now argue from the hiring manager's perspective...",
    "expected_intent": "Candidate demonstrates ability to argue the opposing position...",
    "known_misinterpretation": "Candidate may flip position entirely rather than steelmanning..."
  }
}
```

---

### 3. POST /sessions/:id/submit

```bash
SESSION_ID="s9k8j7h6-..."

curl -s -X POST "http://localhost:8000/sessions/${SESSION_ID}/submit" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "raw_user_response": "In the last three launches, I shipped on time in two cases. The third delayed because we lacked test coverage on payment edge cases. Specifically, we learned this from a post-mortem and I led a 2-week quality sprint. I restructured QA gates — we now require automated coverage on all critical paths before release. Evidence: zero regressions in the last two sprints. My process is now documented and adopted across two other product lines.",
    "audio_metadata": {
      "duration_seconds": 42.5,
      "file_placeholder": "/tmp/session_audio_placeholder.wav"
    },
    "response_start_ts": "2026-03-01T22:15:00+05:30",
    "response_end_ts": "2026-03-01T22:15:42+05:30"
  }' | jq
```

**Response:**
```json
{
  "session_id": "s9k8j7h6-...",
  "computed_metrics": {
    "word_count": 98,
    "filler_rate": 0.0,
    "pause_rate": 0.1,
    "words_per_minute": 138.4,
    "clarity_score": 0.75,
    "structure_score": 0.73,
    "recovery_score": 0.55,
    "composure_score": 0.8
  },
  "score": 67,
  "feedback": [
    {
      "dimension": "recovery",
      "observation": "Recovery from the interruption was incomplete. Restate your core point before continuing."
    },
    {
      "dimension": "structure",
      "observation": "Answer was unstructured. Use a 3-part format: claim → evidence → implication."
    }
  ],
  "next_attempt_instruction": "In the next attempt: lead with the metric, then the action, then the outcome. Do not open with context.",
  "next_level_recommendation": 4
}
```

---

### 4. GET /progress/summary

```bash
curl -s http://localhost:8000/progress/summary \
  -H "Authorization: Bearer $TOKEN" | jq
```

**Response:**
```json
{
  "user_id": "a1b2c3d4-...",
  "current_track_levels": [
    {
      "track": "INTERVIEW",
      "current_level": 4,
      "sessions_completed": 3,
      "avg_score": 64.3
    }
  ],
  "recent_scores": [
    {
      "session_id": "s9k8j7h6-...",
      "track": "INTERVIEW",
      "level": 4,
      "score": 67,
      "evaluated_at": "2026-03-01T22:15:43+05:30"
    }
  ],
  "key_metrics_trend": {
    "avg_filler_rate": 0.04,
    "avg_pause_rate": 0.12,
    "avg_clarity_score": 0.68,
    "sessions_evaluated": 3
  },
  "session_history": [
    {
      "session_id": "s9k8j7h6-...",
      "track": "INTERVIEW",
      "level": 4,
      "score": 67,
      "status": "COMPLETE",
      "started_at": "2026-03-01T22:15:00+05:30"
    }
  ]
}
```

---

## Health Check

```bash
curl http://localhost:8000/health
# {"status": "ok", "version": "1.0.0-mvp"}
```

---

## Guardrails

The `GuardrailsMiddleware` automatically scans all `/sessions/*` JSON responses
and strips banned phrases (therapy language, affirmations, emotional framing) before the response reaches the client. 

Banned phrase hits are logged to stdout: `[WARN] Guardrails violation in '...'`

See `app/services/guardrails.py` for the full banned phrase list.

---

## Design Notes

- All audio metrics (`filler_rate`, `pause_rate`, `words_per_minute` from audio) are **placeholders** computed from text heuristics. Wire in a speech-to-text service to replace them.
- The prompt engine is fully template-driven (no LLM calls required for MVP). LLM generation can replace specific fields in v2.
- `USE_IN_MEMORY_FALLBACK=true` runs the entire app without a database. Data is lost on restart.
