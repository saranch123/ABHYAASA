"""
Auth routes — dev-only JWT login for MVP testing.
No passwords. Alias-based user lookup/creation.
"""
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from jose import jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models import User
from app.schemas.auth import DevLoginRequest, TokenResponse
from app.store import in_memory_store, USE_FALLBACK

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


def _create_token(user_id: str, alias: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "alias": alias,
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


@router.post("/dev-login", response_model=TokenResponse)
async def dev_login(
    body: DevLoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Dev-only endpoint. Creates user by alias if not found.
    Returns JWT for use in Authorization: Bearer <token> header.
    """
    if not settings.dev_mode:
        raise HTTPException(status_code=403, detail="Dev login disabled in production.")

    alias = body.alias.strip().lower()
    if not alias:
        raise HTTPException(status_code=422, detail="Alias cannot be empty.")

    if USE_FALLBACK:
        # In-memory path
        existing = next(
            (u for u in in_memory_store["users"].values() if u["dev_alias"] == alias),
            None,
        )
        if existing:
            user_id = existing["id"]
        else:
            user_id = str(uuid.uuid4())
            in_memory_store["users"][user_id] = {
                "id": user_id,
                "dev_alias": alias,
                "language_preference": body.language,
            }
    else:
        result = await db.execute(select(User).where(User.dev_alias == alias))
        user = result.scalar_one_or_none()
        if not user:
            user = User(dev_alias=alias, language_preference=body.language)
            db.add(user)
            await db.flush()
            await db.refresh(user)
        user_id = str(user.id)

    token = _create_token(user_id, alias)
    return TokenResponse(access_token=token, user_id=user_id, alias=alias)
