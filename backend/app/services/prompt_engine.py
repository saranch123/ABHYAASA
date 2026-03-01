"""
Prompt Engine — deterministic level-based session generation.
No LLM calls in MVP. All output is template-driven and seeded by inputs.
"""
import random
import uuid
from datetime import datetime, timezone

from app.schemas.session import (
    GenerateSessionRequest,
    GenerateSessionResponse,
    InterruptionPlan,
    PerspectiveSwitch,
    EvaluationRubric,
    Constraints,
    DiscomfortVariables,
    RoleplayConfig,
    FeedbackTemplate,
    UserMetrics,
)
from app.services.guardrails import assert_clean

# ── Static data stores (replace with DB tables in v2) ────────────────────────

PERSONAS: dict[str, dict] = {
    "INTERVIEW": {
        "persona_key": "SKEPTICAL_HIRING_MANAGER",
        "display_name": "Hiring Manager — Priya Mehta",
        "style_description": (
            "Direct, time-pressured, challenges unsupported claims. "
            "Does not acknowledge effort. Expects precision."
        ),
        "challenges_facts": True,
        "uses_silence": True,
        "reframes_questions": True,
        "dismisses_first_answer": False,
    },
    "NEGOTIATION": {
        "persona_key": "RESISTANT_COUNTERPART",
        "display_name": "Counterpart — Rajan Iyer",
        "style_description": (
            "Holds firm on position. Uses anchoring tactics. "
            "Disputes concessions without reciprocation."
        ),
        "challenges_facts": True,
        "uses_silence": True,
        "reframes_questions": False,
        "dismisses_first_answer": True,
    },
    "PUBLIC_SPEAKING": {
        "persona_key": "DISENGAGED_AUDIENCE",
        "display_name": "Audience Member — Anonymous",
        "style_description": (
            "Low engagement. Will ask blunt, off-topic questions if bored."
        ),
        "challenges_facts": False,
        "uses_silence": False,
        "reframes_questions": True,
        "dismisses_first_answer": False,
    },
    "DEBATE": {
        "persona_key": "AGGRESSIVE_OPPONENT",
        "display_name": "Opponent — Dev Sharma",
        "style_description": (
            "Interrupts with counter-facts. Attacks logical gaps. "
            "Will not yield points without evidence."
        ),
        "challenges_facts": True,
        "uses_silence": False,
        "reframes_questions": True,
        "dismisses_first_answer": True,
    },
    "COLD_CALL": {
        "persona_key": "BUSY_PROSPECT",
        "display_name": "Prospect — Anonymous Executive",
        "style_description": (
            "Impatient. Will hang up if value is not clear in 20 seconds. "
            "No pleasantries."
        ),
        "challenges_facts": False,
        "uses_silence": True,
        "reframes_questions": False,
        "dismisses_first_answer": True,
    },
}

SESSION_BRIEFS: dict[str, list[str]] = {
    "INTERVIEW": [
        "You are interviewing for a Senior Product Manager role at a Series B fintech. "
        "The panel has 12 minutes. The role requires cross-functional leadership.",
        "You are interviewing for a Backend Engineering Lead at a logistics startup. "
        "They have already spoken to 5 candidates today.",
    ],
    "NEGOTIATION": [
        "You are renegotiating a vendor contract that expires in 10 days. "
        "The supplier has indicated a 15% price increase.",
        "You are negotiating a salary offer. The initial offer is 18% below your ask.",
    ],
    "PUBLIC_SPEAKING": [
        "You have 5 minutes to present the Q3 business review to the executive team. "
        "Two members have conflicting agendas.",
        "You are pitching a new product initiative to an audience of 30 engineers. "
        "Your time slot was cut from 20 to 8 minutes.",
    ],
    "DEBATE": [
        "Motion: Remote work permanently reduces team cohesion. You are opposing.",
        "Motion: AI will eliminate more jobs than it creates in 10 years. You are proposing.",
    ],
    "COLD_CALL": [
        "You have 90 seconds to pitch your SaaS product to a VP of Operations. "
        "They did not request this call.",
        "You are following up on an unsolicited prospecting email. "
        "The prospect replied with 'Make it quick.'",
    ],
}

PROMPTS: dict[str, dict[str, list[str]]] = {
    "INTERVIEW": {
        "OPEN": [
            "Walk me through your most impactful project in the last 12 months. "
            "Specifics only — no generalities.",
        ],
        "STRUCTURED": [
            "Give me a situation where you had to deliver results with an under-resourced team. "
            "Use numbers.",
        ],
        "STRESS": [
            "Your last 3 product launches all missed the deadline. "
            "Why should we believe this will be different?",
        ],
        "AMBIGUOUS": [
            "Tell me about a time you made the right call. "
            "(No further detail will be given.)",
        ],
    },
    "NEGOTIATION": {
        "OPEN": ["State your position and your walk-away limit without preamble."],
        "STRUCTURED": ["List your three non-negotiables and rank them."],
        "STRESS": ["We are currently at no-deal. What changes right now?"],
        "AMBIGUOUS": ["Make me an offer. I am listening."],
    },
    "PUBLIC_SPEAKING": {
        "OPEN": ["Begin your presentation. You have the floor."],
        "STRUCTURED": ["State your core argument and three supporting data points in 90 seconds."],
        "STRESS": ["The CFO just asked: 'What is the ROI and when does it break even?' Answer now."],
        "AMBIGUOUS": ["Summarise your key message in one sentence. Go."],
    },
    "DEBATE": {
        "OPEN": ["Deliver your opening statement. 90 seconds."],
        "STRUCTURED": ["State your claim, your strongest evidence, and pre-empt one objection."],
        "STRESS": ["My data contradicts your last claim. Defend it or retract it."],
        "AMBIGUOUS": ["Respond to the motion as you understand it."],
    },
    "COLD_CALL": {
        "OPEN": ["You have 30 seconds. Start your pitch."],
        "STRUCTURED": ["Lead with the problem you solve, not your product name."],
        "STRESS": ["I get 40 calls like this a week. You have 10 seconds to differentiate."],
        "AMBIGUOUS": ["Why are you calling me?"],
    },
}

FOLLOW_UPS: dict[str, list[str]] = {
    "INTERVIEW": [
        "What metric proves that worked?",
        "Who pushed back and how did you handle it?",
        "What would you do differently?",
    ],
    "NEGOTIATION": [
        "What is the minimum you will accept on item 2?",
        "What is your basis for that number?",
        "If we agree on price, what do you need on timeline?",
    ],
    "PUBLIC_SPEAKING": [
        "What is the one number the executive team should remember?",
        "How does this compare to last quarter?",
        "What is the risk if we do not act?",
    ],
    "DEBATE": [
        "Can you cite a specific counter-example?",
        "Your premise assumes X. What if X is false?",
        "Concede one point from the opposing side.",
    ],
    "COLD_CALL": [
        "What problem are you solving that we do not already solve internally?",
        "What is the cost of doing nothing?",
        "Give me one reference customer in my industry.",
    ],
}

INTERRUPTIONS: dict[str, list[str]] = {
    "CHALLENGE": [
        "Stop. That claim needs a number. Give it.",
        "Pause. You said '{X}' — define that term precisely.",
        "Hold on. What evidence supports that assertion?",
    ],
    "REDIRECT": [
        "That is background. Get to the decision.",
        "Skip the context. What is your conclusion?",
        "You are off-track. Return to the central point.",
    ],
    "SILENCE": ["..."],
    "REFRAME": [
        "Forget what you just said. Address this instead: {follow_up}",
        "From the other side of the table — how does that sound?",
    ],
}

PERSPECTIVE_SWITCH_TEMPLATES: dict[str, str] = {
    "INTERVIEW": (
        "Now argue from the hiring manager's perspective. "
        "You have 45 seconds to state why this candidate should NOT be hired."
    ),
    "NEGOTIATION": (
        "Switch sides. Argue the supplier's position. "
        "Why is the 15% increase justified?"
    ),
    "PUBLIC_SPEAKING": (
        "You are now a skeptical board member. "
        "In 30 seconds, raise the sharpest objection to what was just presented."
    ),
    "DEBATE": (
        "Switch to the opposing side. "
        "Deliver a 60-second rebuttal of your own argument."
    ),
    "COLD_CALL": (
        "You are now the prospect. "
        "In 20 seconds, give the sharpest reason to end this call."
    ),
}

NEXT_ATTEMPT_INSTRUCTIONS: dict[str, str] = {
    "INTERVIEW": (
        "In the next attempt: lead with the metric, then the action, then the outcome. "
        "Do not open with context."
    ),
    "NEGOTIATION": (
        "In the next attempt: anchor first, justify second. "
        "State your number before you explain it."
    ),
    "PUBLIC_SPEAKING": (
        "In the next attempt: one claim per slide equivalent. "
        "Drop all filler transitions."
    ),
    "DEBATE": (
        "In the next attempt: state your strongest evidence first. "
        "Concede minor points early to hold your core claim."
    ),
    "COLD_CALL": (
        "In the next attempt: name the problem in the first sentence. "
        "Your product name comes last."
    ),
}


# ── Core generation function ──────────────────────────────────────────────────

def build_interruption_plan(level: int, track: str) -> InterruptionPlan:
    if level <= 2:
        return InterruptionPlan(
            enabled=False,
            trigger_after_words=0,
            interrupt_type="NONE",
            interrupt_text=None,
        )
    elif level == 3:
        trigger = random.randint(80, 120)
        itype = "REDIRECT"
    elif level == 4:
        trigger = random.randint(40, 70)
        itype = random.choice(["CHALLENGE", "REDIRECT"])
    else:  # level 5
        trigger = random.randint(15, 35)
        itype = random.choice(["CHALLENGE", "SILENCE", "REFRAME"])

    if track == "COLD_CALL" and level >= 3:
        trigger = min(trigger, 30)

    templates = INTERRUPTIONS.get(itype, ["Pause and restate your position."])
    interrupt_text = random.choice(templates)

    return InterruptionPlan(
        enabled=True,
        trigger_after_words=trigger,
        interrupt_type=itype,
        interrupt_text=interrupt_text,
    )


def build_rubric(level: int, track: str, user_metrics: UserMetrics | None) -> EvaluationRubric:
    weights = {
        "clarity": 0.30,
        "structure": 0.25,
        "recovery": 0.25,
        "composure": 0.20,
    }

    # Track overlays
    if track == "NEGOTIATION":
        weights["recovery"] += 0.10
    if track == "PUBLIC_SPEAKING":
        weights["clarity"] += 0.15

    # Prior weak area boost
    if user_metrics and user_metrics.weak_areas:
        key_map = {
            "clarity": "clarity", "structure": "structure",
            "recovery": "recovery", "composure": "composure",
        }
        boost = 0.05
        for area in user_metrics.weak_areas:
            k = key_map.get(area.lower())
            if k:
                weights[k] = weights[k] + boost

    # Normalize
    total = sum(weights.values())
    weights = {k: round(v / total, 4) for k, v in weights.items()}

    # Ensure exact sum = 1.0 (fix float rounding on last key)
    diff = round(1.0 - sum(weights.values()), 4)
    weights["composure"] = round(weights["composure"] + diff, 4)

    return EvaluationRubric(
        clarity_weight=weights["clarity"],
        structure_weight=weights["structure"],
        recovery_weight=weights["recovery"],
        composure_weight=weights["composure"],
    )


def get_authority_tone(level: int, track: str) -> str:
    tone_map = {1: "LOW", 2: "MEDIUM", 3: "MEDIUM", 4: "HIGH", 5: "HOSTILE"}
    tone = tone_map[level]
    if track == "NEGOTIATION":
        upgrade = {"LOW": "MEDIUM", "MEDIUM": "HIGH", "HIGH": "HOSTILE", "HOSTILE": "HOSTILE"}
        tone = upgrade[tone]
    return tone


def get_ambiguity_level(level: int) -> str:
    return {1: "NONE", 2: "LOW", 3: "MEDIUM", 4: "HIGH", 5: "HIGH"}[level]


def generate_session(req: GenerateSessionRequest, user_id: str) -> GenerateSessionResponse:
    track = req.track
    level = req.level
    session_type = req.session_type

    brief_options = SESSION_BRIEFS.get(track, ["Scenario not configured."])
    brief = random.choice(brief_options)
    if req.context:
        brief = f"{brief} Additional context: {req.context}"

    prompt_options = PROMPTS.get(track, {}).get(session_type, ["Begin."])
    prompt = random.choice(prompt_options)

    interrupt_plan = build_interruption_plan(level, track)
    rubric = build_rubric(level, track, req.user_metrics)
    authority_tone = get_authority_tone(level, track)
    ambiguity = get_ambiguity_level(level)

    persona_data = PERSONAS.get(track)
    roleplay_config = RoleplayConfig(**persona_data) if persona_data else None

    follow_ups = FOLLOW_UPS.get(track, ["Elaborate.", "What is your evidence?", "Be more concise."])

    # Perspective switch
    ps = None
    if req.perspective_switch_enabled and level >= 3 and session_type in ("AMBIGUOUS", "STRESS"):
        ps_text = PERSPECTIVE_SWITCH_TEMPLATES.get(track)
        ps = PerspectiveSwitch(
            enabled=True,
            prompt_text=ps_text,
            expected_intent=(
                f"Candidate demonstrates ability to argue the opposing position "
                f"coherently without abandoning their core stance."
            ),
            known_misinterpretation=(
                "Candidate may flip position entirely rather than steelmanning. "
                "Flag as structural failure."
            ),
        ) if ps_text else PerspectiveSwitch(enabled=False, prompt_text=None, expected_intent=None, known_misinterpretation=None)
    else:
        ps = PerspectiveSwitch(enabled=False, prompt_text=None, expected_intent=None, known_misinterpretation=None)

    constraints = Constraints(
        time_limit_seconds={1: 120, 2: 90, 3: 90, 4: 60, 5: 45}[level],
        word_limit={1: None, 2: None, 3: 200, 4: 150, 5: 100}[level],
        must_reference=follow_ups[:1],
        forbidden_phrases=["um", "like", "you know", "sort of", "basically"],
    )

    discomfort = DiscomfortVariables(
        authority_tone=authority_tone,
        ambiguity_level=ambiguity,
        interruption_plan=interrupt_plan,
    )

    feedback_template = FeedbackTemplate(
        max_bullets=3,
        rubric_keys=["clarity", "structure", "recovery", "composure"],
        next_attempt_instruction=NEXT_ATTEMPT_INSTRUCTIONS.get(track, "Focus on precision."),
    )

    # Guardrails check on generated text fields
    for field_name, val in [("session_brief", brief), ("prompt", prompt)]:
        assert_clean(val, field_name)

    return GenerateSessionResponse(
        session_id=str(uuid.uuid4()),   # will be overwritten by DB-generated id
        session_brief=brief,
        prompt=prompt,
        constraints=constraints,
        discomfort_variables=discomfort,
        roleplay_config=roleplay_config,
        evaluation_rubric=rubric,
        feedback_template=feedback_template,
        perspective_switch=ps,
    )
