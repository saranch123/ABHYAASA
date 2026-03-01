"""
Evaluator service — computes scores and generates feedback from a text response.
All audio metrics are placeholders until speech processing is wired in.
"""
import re
from app.schemas.session import (
    SubmitSessionRequest,
    ComputedMetrics,
    FeedbackItem,
)

FILLER_WORDS = {"um", "uh", "like", "you know", "sort of", "basically", "literally",
                "kind of", "right", "so", "well"}


def _count_words(text: str) -> int:
    return len(text.split())


def _compute_filler_rate(text: str) -> float:
    """Ratio of filler words to total words. Placeholder for audio analysis."""
    words = [w.lower().strip(".,!?;:") for w in text.split()]
    if not words:
        return 0.0
    hits = sum(1 for w in words if w in FILLER_WORDS)
    return round(hits / len(words), 3)


def _compute_pause_rate(audio_duration: float | None, word_count: int) -> float:
    """Placeholder: estimated silence ratio based on speech rate deviation."""
    if not audio_duration or word_count == 0:
        return 0.1   # default placeholder
    wpm = (word_count / audio_duration) * 60
    # Expected: 120–160 wpm for confident speech
    if wpm < 80:
        return 0.4
    elif wpm < 100:
        return 0.25
    elif wpm > 180:
        return 0.05
    else:
        return 0.10


def _compute_words_per_minute(word_count: int, audio_duration: float | None) -> float:
    if not audio_duration or word_count == 0:
        return 0.0
    return round((word_count / audio_duration) * 60, 1)


def _compute_clarity(text: str, filler_rate: float) -> float:
    """
    Heuristic clarity score:
    - Penalise high filler rate
    - Reward sentence-level structure (presence of full stops)
    - Penalise very short responses
    """
    word_count = _count_words(text)
    if word_count < 10:
        return 0.30
    sentence_count = max(1, len(re.findall(r"[.!?]", text)))
    avg_sentence_length = word_count / sentence_count
    structure_bonus = 0.15 if 10 <= avg_sentence_length <= 25 else 0.0
    score = max(0.0, 0.75 - (filler_rate * 2) + structure_bonus)
    return round(min(score, 1.0), 3)


def _compute_structure(text: str) -> float:
    """
    Heuristic structure score:
    - Reward numbered lists or transition markers
    - Reward reasonable length (50-200 words)
    - Penalise single run-on paragraphs
    """
    word_count = _count_words(text)
    markers = re.findall(
        r"\b(first|second|third|finally|however|therefore|because|in summary|to conclude)\b",
        text, re.IGNORECASE
    )
    marker_bonus = min(len(markers) * 0.08, 0.25)
    if 50 <= word_count <= 200:
        length_score = 0.65
    elif word_count < 20:
        length_score = 0.25
    elif word_count > 300:
        length_score = 0.50
    else:
        length_score = 0.55
    return round(min(length_score + marker_bonus, 1.0), 3)


def _compute_recovery(text: str, session_type: str) -> float:
    """
    Placeholder for interruption-recovery scoring.
    In STRESS and AMBIGUOUS sessions: slightly penalised base score.
    """
    base = 0.65
    if session_type in ("STRESS", "AMBIGUOUS"):
        base = 0.55
    # Look for pivots / course corrections as positive signal
    pivots = re.findall(
        r"\b(let me clarify|to be precise|what i mean is|correcting myself|"
        r"more specifically|to clarify)\b",
        text, re.IGNORECASE
    )
    pivot_bonus = min(len(pivots) * 0.08, 0.20)
    return round(min(base + pivot_bonus, 1.0), 3)


def _compute_composure(filler_rate: float, word_count: int) -> float:
    """
    Placeholder composure score based on text signals.
    Real version uses audio pitch/pace variance.
    """
    if word_count < 5:
        return 0.20
    penalty = filler_rate * 1.5
    return round(max(0.0, 0.80 - penalty), 3)


def _compute_weighted_score(
    clarity: float, structure: float, recovery: float, composure: float,
    cw: float, sw: float, rw: float, cow: float,
) -> int:
    weighted = clarity * cw + structure * sw + recovery * rw + composure * cow
    return round(weighted * 100)


def _generate_feedback(
    clarity: float, structure: float, recovery: float, composure: float, track: str
) -> list[FeedbackItem]:
    """Returns up to 3 feedback bullets ordered by lowest score first."""
    scores = [
        ("clarity", clarity, "Response lacked specificity. Lead with the metric, not the context."),
        ("structure", structure, "Answer was unstructured. Use a 3-part format: claim → evidence → implication."),
        ("recovery", recovery, "Recovery from the interruption was incomplete. Restate your core point before continuing."),
        ("composure", composure, "Delivery contained fillers. Remove hedging language — state positions directly."),
    ]
    # Sort ascending by score, take worst 3
    sorted_scores = sorted(scores, key=lambda x: x[1])[:3]
    bullets = [
        FeedbackItem(dimension=dim, observation=obs)
        for dim, score_val, obs in sorted_scores
        if score_val < 0.75   # only surfaces below-threshold dimensions
    ]
    return bullets


def _recommend_next_level(score: int, current_level: int) -> int:
    if score >= 80 and current_level < 5:
        return current_level + 1
    elif score < 45 and current_level > 1:
        return current_level - 1
    return current_level


def evaluate(
    req: SubmitSessionRequest,
    session_payload: dict,
    current_level: int,
) -> tuple[ComputedMetrics, int, list[FeedbackItem], int]:
    """
    Returns: (computed_metrics, score, feedback_bullets, next_level_recommendation)
    session_payload is the session row dict (has top-level 'track', 'session_type', and 'payload' sub-dict).
    """
    text = req.raw_user_response
    audio_dur = req.audio_metadata.duration_seconds if req.audio_metadata else None
    # session_type and track may live at top-level OR inside payload (in-memory vs DB)
    session_type = (
        session_payload.get("session_type")
        or session_payload.get("payload", {}).get("session_type", "OPEN")
    )
    track = (
        session_payload.get("track")
        or session_payload.get("payload", {}).get("track", "INTERVIEW")
    )
    rubric = session_payload.get("payload", {}).get("evaluation_rubric", {})

    cw = rubric.get("clarity_weight", 0.30)
    sw = rubric.get("structure_weight", 0.25)
    rw = rubric.get("recovery_weight", 0.25)
    cow = rubric.get("composure_weight", 0.20)

    word_count = _count_words(text)
    filler_rate = _compute_filler_rate(text)
    pause_rate = _compute_pause_rate(audio_dur, word_count)
    wpm = _compute_words_per_minute(word_count, audio_dur)

    clarity = _compute_clarity(text, filler_rate)
    structure = _compute_structure(text)
    recovery = _compute_recovery(text, session_type)
    composure = _compute_composure(filler_rate, word_count)

    score = _compute_weighted_score(clarity, structure, recovery, composure, cw, sw, rw, cow)
    feedback = _generate_feedback(clarity, structure, recovery, composure, track)
    next_level = _recommend_next_level(score, current_level)

    metrics = ComputedMetrics(
        word_count=word_count,
        filler_rate=filler_rate,
        pause_rate=pause_rate,
        words_per_minute=wpm,
        clarity_score=clarity,
        structure_score=structure,
        recovery_score=recovery,
        composure_score=composure,
    )

    return metrics, score, feedback, next_level
