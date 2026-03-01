"""
ABHYAASA Backend — FastAPI entry point
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.database import engine, Base
from app.routes import auth_router, sessions_router, progress_router
from app.services.guardrails import GuardrailsMiddleware
from app.models import User, Session, SessionResult, UserTrackState  # ensure models registered

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create tables on startup if using in-memory-safe mode; skip if DB unavailable."""
    if not settings.use_in_memory_fallback:
        try:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
        except Exception as e:
            print(f"[WARN] DB connection failed during startup: {e}")
            print("[WARN] Set USE_IN_MEMORY_FALLBACK=true to run without a database.")
    yield
    if not settings.use_in_memory_fallback:
        await engine.dispose()


app = FastAPI(
    title="ABHYAASA API",
    description="Confidence training platform — AI-powered practice sessions.",
    version="1.0.0-mvp",
    lifespan=lifespan,
)

# ── Middleware ─────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],       # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(GuardrailsMiddleware)

# ── Routers ────────────────────────────────────────────────────────────────────

app.include_router(auth_router)
app.include_router(sessions_router)
app.include_router(progress_router)


# ── Health ─────────────────────────────────────────────────────────────────────

@app.get("/health", tags=["infra"])
async def health():
    return JSONResponse({"status": "ok", "version": "1.0.0-mvp"})
