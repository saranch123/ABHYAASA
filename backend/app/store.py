"""
In-memory fallback store for demo/testing without a real DB.
Activated via USE_IN_MEMORY_FALLBACK=true in .env
"""
from app.config import get_settings

settings = get_settings()
USE_FALLBACK: bool = settings.use_in_memory_fallback

in_memory_store: dict = {
    "users": {},          # user_id -> {id, dev_alias, language_preference}
    "sessions": {},       # session_id -> session row dict
    "results": {},        # session_id -> result dict
    "track_state": {},    # "{user_id}:{track}" -> state dict
}
