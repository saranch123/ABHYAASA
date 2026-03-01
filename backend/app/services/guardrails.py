"""
Guardrails service — hard-blocks banned phrases from generated content.
This runs both before storing output and as response middleware.
"""
import re
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
import json

BANNED_PHRASES: list[str] = [
    "i understand how you feel",
    "that's a great point",
    "thats a great point",
    "well done",
    "don't worry",
    "dont worry",
    "it's okay to feel",
    "its okay to feel",
    "you're making progress",
    "youre making progress",
    "i can see this is hard",
    "take your time",
    "breathe",
    "anxiety",
    "trauma",
    "mental health",
    "mindfulness",
    "healing",
    "safe space",
    "you are enough",
    "proud of you",
    "emotional support",
    "self-care",
    "wellbeing",
    "well-being",
    "emotional",
    "therapy",
    "counseling",
    "counselling",
]

# Pre-compiled for performance
_PATTERNS = [re.compile(re.escape(p), re.IGNORECASE) for p in BANNED_PHRASES]


def scan_text(text: str) -> list[str]:
    """Return list of banned phrases found in text. Empty list = clean."""
    return [p for p, pat in zip(BANNED_PHRASES, _PATTERNS) if pat.search(text)]


def sanitize_text(text: str, replacement: str = "[REDACTED]") -> str:
    """Replace all banned phrases in text."""
    for pat in _PATTERNS:
        text = pat.sub(replacement, text)
    return text


def assert_clean(text: str, field_name: str = "output") -> None:
    """Raise ValueError if banned phrases are found in text (use in services)."""
    hits = scan_text(text)
    if hits:
        raise ValueError(
            f"Guardrails violation in '{field_name}': "
            f"banned phrase(s) detected: {hits}"
        )


class GuardrailsMiddleware(BaseHTTPMiddleware):
    """
    Response middleware that scans JSON responses for banned phrases.
    If found, logs and strips them before sending to client.
    Only active on /sessions/* routes where generated content flows.
    """

    PROTECTED_PATHS = {"/sessions/generate", "/sessions/"}

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)

        path = request.url.path
        is_protected = any(path.startswith(p) for p in self.PROTECTED_PATHS)

        if not is_protected or response.headers.get("content-type", "").find("application/json") == -1:
            return response

        # Read body
        body_bytes = b""
        async for chunk in response.body_iterator:
            body_bytes += chunk

        try:
            payload = json.loads(body_bytes)
            payload_str = json.dumps(payload)
            hits = scan_text(payload_str)
            if hits:
                # Sanitize and rebuild
                clean_str = sanitize_text(payload_str)
                body_bytes = clean_str.encode()
        except Exception:
            pass  # Non-JSON or parse error — pass through

        from starlette.responses import Response as StarletteResponse
        return StarletteResponse(
            content=body_bytes,
            status_code=response.status_code,
            headers=dict(response.headers),
            media_type=response.media_type,
        )
