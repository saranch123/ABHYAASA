/**
 * Demo Mode — deterministic mock API.
 * All functions return data that matches the backend schema exactly.
 * Used when AppMode === 'demo' or when the live backend is unreachable.
 */
import type {
    SessionConfig,
    GeneratedSession,
    SessionResult,
    ComputedMetrics,
    ProgressSummary,
    StoredSession,
    Track,
} from "./types";

export const MOCK_TOKEN = "mock-demo-token-abhyaasa-mvp";

// ── Static content ────────────────────────────────────────────────────────────

const BRIEFS: Record<Track, string[]> = {
    INTERVIEW: [
        "You are interviewing for a Senior Product Manager role at a Series B fintech. The panel has 12 minutes. The role requires cross-functional leadership.",
        "You are interviewing for a Backend Engineering Lead at a logistics startup. They have already spoken to 5 candidates today.",
    ],
    NEGOTIATION: [
        "You are renegotiating a vendor contract that expires in 10 days. The supplier has indicated a 15% price increase.",
        "You are negotiating a salary offer. The initial offer is 18% below your ask.",
    ],
    PUBLIC_SPEAKING: [
        "You have 5 minutes to present the Q3 business review to the executive team. Two members have conflicting agendas.",
        "You are pitching a new product initiative to an audience of 30 engineers. Your time slot was cut from 20 to 8 minutes.",
    ],
    DEBATE: [
        "Motion: Remote work permanently reduces team cohesion. You are opposing.",
        "Motion: AI will eliminate more jobs than it creates in 10 years. You are proposing.",
    ],
    COLD_CALL: [
        "You have 90 seconds to pitch your SaaS product to a VP of Operations. They did not request this call.",
        "You are following up on an unsolicited prospecting email. The prospect replied: 'Make it quick.'",
    ],
};

const PROMPTS: Record<Track, Record<string, string>> = {
    INTERVIEW: {
        OPEN: "Walk me through your most impactful project in the last 12 months. Specifics only — no generalities.",
        STRUCTURED: "Give me a situation where you had to deliver results with an under-resourced team. Use numbers.",
        STRESS: "Your last 3 product launches all missed the deadline. Why should we believe this will be different?",
        AMBIGUOUS: "Tell me about a time you made the right call. (No further detail will be given.)",
    },
    NEGOTIATION: {
        OPEN: "State your position and your walk-away limit without preamble.",
        STRUCTURED: "List your three non-negotiables and rank them.",
        STRESS: "We are currently at no-deal. What changes right now?",
        AMBIGUOUS: "Make me an offer. I am listening.",
    },
    PUBLIC_SPEAKING: {
        OPEN: "Begin your presentation. You have the floor.",
        STRUCTURED: "State your core argument and three supporting data points in 90 seconds.",
        STRESS: "The CFO just asked: 'What is the ROI and when does it break even?' Answer now.",
        AMBIGUOUS: "Summarise your key message in one sentence. Go.",
    },
    DEBATE: {
        OPEN: "Deliver your opening statement. 90 seconds.",
        STRUCTURED: "State your claim, your strongest evidence, and pre-empt one objection.",
        STRESS: "My data contradicts your last claim. Defend it or retract it.",
        AMBIGUOUS: "Respond to the motion as you understand it.",
    },
    COLD_CALL: {
        OPEN: "You have 30 seconds. Start your pitch.",
        STRUCTURED: "Lead with the problem you solve, not your product name.",
        STRESS: "I get 40 calls like this a week. You have 10 seconds to differentiate.",
        AMBIGUOUS: "Why are you calling me?",
    },
};

const PERSONAS: Record<Track, { persona_key: string; display_name: string; style_description: string }> = {
    INTERVIEW: { persona_key: "SKEPTICAL_HIRING_MANAGER", display_name: "Hiring Manager — Priya Mehta", style_description: "Direct, time-pressured, challenges unsupported claims. Expects precision." },
    NEGOTIATION: { persona_key: "RESISTANT_COUNTERPART", display_name: "Counterpart — Rajan Iyer", style_description: "Holds firm on position. Uses anchoring tactics." },
    PUBLIC_SPEAKING: { persona_key: "DISENGAGED_AUDIENCE", display_name: "Audience Member — Anonymous", style_description: "Low engagement. Will ask blunt questions if bored." },
    DEBATE: { persona_key: "AGGRESSIVE_OPPONENT", display_name: "Opponent — Dev Sharma", style_description: "Interrupts with counter-facts. Attacks logical gaps." },
    COLD_CALL: { persona_key: "BUSY_PROSPECT", display_name: "Prospect — Executive", style_description: "Impatient. Will disengage if value is not clear in 20 seconds." },
};

const NEXT_INSTRUCTION: Record<Track, string> = {
    INTERVIEW: "Lead with the metric, then the action, then the outcome. Do not open with context.",
    NEGOTIATION: "Anchor first, justify second. State your number before you explain it.",
    PUBLIC_SPEAKING: "One claim per slide equivalent. Drop all filler transitions.",
    DEBATE: "State your strongest evidence first. Concede minor points early to hold your core claim.",
    COLD_CALL: "Name the problem in the first sentence. Your product name comes last.",
};

const FILLER_WORDS = new Set([
    "um", "uh", "like", "basically", "literally", "sort", "you", "know",
    "kind", "right", "so", "well", "actually",
]);

// ── Session generation ────────────────────────────────────────────────────────

export function mockGenerateSession(config: SessionConfig): GeneratedSession {
    const { track, level, session_type } = config;

    const briefArr = BRIEFS[track];
    const brief =
        briefArr[Math.floor(Math.random() * briefArr.length)] +
        (config.context ? ` Additional context: ${config.context}` : "");

    const prompt = PROMPTS[track][session_type] ?? PROMPTS[track]["OPEN"];

    const toneMap: Record<number, "LOW" | "MEDIUM" | "HIGH" | "HOSTILE"> = {
        1: "LOW", 2: "MEDIUM", 3: "MEDIUM", 4: "HIGH", 5: "HOSTILE",
    };
    const ambMap: Record<number, "NONE" | "LOW" | "MEDIUM" | "HIGH"> = {
        1: "NONE", 2: "LOW", 3: "MEDIUM", 4: "HIGH", 5: "HIGH",
    };
    const timeLimitMap: Record<number, number> = {
        1: 120, 2: 90, 3: 90, 4: 60, 5: 45,
    };
    const wordLimitMap: Record<number, number | null> = {
        1: null, 2: null, 3: 200, 4: 150, 5: 100,
    };

    const interruptionEnabled = level >= 3;
    const triggerMap: Record<number, number> = { 3: 100, 4: 55, 5: 25 };

    const persona = PERSONAS[track];

    return {
        session_id: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        session_brief: brief,
        prompt,
        constraints: {
            time_limit_seconds: timeLimitMap[level],
            word_limit: wordLimitMap[level],
            must_reference: ["What metric proves that worked?"],
            forbidden_phrases: ["um", "like", "you know", "sort of", "basically"],
        },
        discomfort_variables: {
            authority_tone: toneMap[level],
            ambiguity_level: ambMap[level],
            interruption_plan: {
                enabled: interruptionEnabled,
                trigger_after_words: interruptionEnabled ? triggerMap[level] ?? 50 : 0,
                interrupt_type: level === 3 ? "REDIRECT" : level === 4 ? "CHALLENGE" : "HOSTILE",
                interrupt_text: interruptionEnabled
                    ? "Stop. That claim needs a number. Give it."
                    : null,
            },
        },
        roleplay_config: {
            ...persona,
            challenges_facts: level >= 3,
            uses_silence: level >= 4,
            reframes_questions: level >= 3,
            dismisses_first_answer: level >= 4,
        },
        evaluation_rubric: {
            clarity_weight: 0.32,
            structure_weight: 0.25,
            recovery_weight: 0.28,
            composure_weight: 0.15,
        },
        feedback_template: {
            max_bullets: 3,
            rubric_keys: ["clarity", "structure", "recovery", "composure"],
            next_attempt_instruction: NEXT_INSTRUCTION[track],
        },
        perspective_switch:
            config.perspective_switch_enabled && level >= 3
                ? {
                    enabled: true,
                    prompt_text: "Now argue from the opposing side. 45 seconds.",
                    expected_intent:
                        "Candidate steelmans the opposition without abandoning their core stance.",
                    known_misinterpretation:
                        "Candidate may flip position entirely — flag as structural failure.",
                }
                : { enabled: false, prompt_text: null, expected_intent: null, known_misinterpretation: null },
    };
}

// ── Scoring ───────────────────────────────────────────────────────────────────

export function mockSubmitSession(
    response: string,
    session: GeneratedSession
): SessionResult {
    const words = response.trim().split(/\s+/).filter(Boolean);
    const wordCount = words.length;

    const fillerCount = words.filter((w) =>
        FILLER_WORDS.has(w.toLowerCase().replace(/[.,!?]/g, ""))
    ).length;
    const fillerRate = Math.round((fillerCount / Math.max(wordCount, 1)) * 1000) / 1000;

    // Clarity: penalise fillers, reward good length
    const clarity = Math.max(
        0.2,
        Math.min(1.0, 0.75 - fillerRate * 2 + (wordCount > 40 && wordCount < 200 ? 0.15 : 0))
    );

    // Structure: reward transition markers + good length
    const markers = (
        response.match(
            /\b(first|second|third|finally|however|therefore|because|specifically|in summary)\b/gi
        ) ?? []
    ).length;
    const structure = Math.min(1.0, (wordCount >= 50 ? 0.65 : 0.35) + markers * 0.07);

    // Recovery: base + pivot language bonus
    const pivots = (
        response.match(
            /\b(let me clarify|to be precise|more specifically|to clarify|correcting)\b/gi
        ) ?? []
    ).length;
    const recovery = Math.min(1.0, 0.55 + pivots * 0.1);

    // Composure: penalise fillers
    const composure = Math.max(0.2, Math.min(1.0, 0.8 - fillerRate * 1.5));

    const rubric = session.evaluation_rubric;
    const weighted =
        clarity * rubric.clarity_weight +
        structure * rubric.structure_weight +
        recovery * rubric.recovery_weight +
        composure * rubric.composure_weight;

    const rawScore = Math.round(weighted * 100);
    // Add small deterministic noise based on word count
    const score = Math.max(20, Math.min(98, rawScore + (wordCount % 7) - 3));

    const metrics: ComputedMetrics = {
        word_count: wordCount,
        filler_rate: fillerRate,
        pause_rate: 0.1,
        words_per_minute: 0,
        clarity_score: Math.round(clarity * 1000) / 1000,
        structure_score: Math.round(structure * 1000) / 1000,
        recovery_score: Math.round(recovery * 1000) / 1000,
        composure_score: Math.round(composure * 1000) / 1000,
    };

    // Feedback: worst 3 dimensions
    const dims = [
        { dimension: "clarity", score: clarity, observation: "Response lacked specificity. Lead with the metric, not the context." },
        { dimension: "structure", score: structure, observation: "Answer was unstructured. Use a 3-part format: claim → evidence → implication." },
        { dimension: "recovery", score: recovery, observation: "Restate your core point after any deviation before continuing." },
        { dimension: "composure", score: composure, observation: "Remove hedging language. State positions directly." },
    ];
    const feedback = dims
        .sort((a, b) => a.score - b.score)
        .slice(0, 3)
        .filter((d) => d.score < 0.75)
        .map(({ dimension, observation }) => ({ dimension, observation }));

    // Level recommendation
    const currentLevel = parseInt(session.session_id.split("-")[2] ?? "1", 10) || 1;
    const nextLevel = score >= 80 ? Math.min(5, currentLevel + 1)
        : score < 45 ? Math.max(1, currentLevel - 1)
            : currentLevel;

    return {
        session_id: session.session_id,
        computed_metrics: metrics,
        score,
        feedback,
        next_attempt_instruction: session.feedback_template.next_attempt_instruction,
        next_level_recommendation: nextLevel,
    };
}

// ── Progress ──────────────────────────────────────────────────────────────────

const SEEDED_SCORES = [52, 58, 61, 55, 63, 67, 72, 69, 74, 78];

export function mockProgress(localSessions: StoredSession[]): ProgressSummary {
    const completed = localSessions.filter((s) => s.status === "COMPLETE" && s.score !== null);

    const trackGroups: Record<string, StoredSession[]> = {};
    for (const s of completed) {
        if (!trackGroups[s.track]) trackGroups[s.track] = [];
        trackGroups[s.track].push(s);
    }

    const current_track_levels =
        Object.keys(trackGroups).length > 0
            ? Object.entries(trackGroups).map(([track, sessions]) => ({
                track,
                current_level: sessions[sessions.length - 1]?.level ?? 1,
                sessions_completed: sessions.length,
                avg_score: Math.round(sessions.reduce((a, s) => a + (s.score ?? 0), 0) / sessions.length),
            }))
            : [
                { track: "INTERVIEW", current_level: 3, sessions_completed: 7, avg_score: 68 },
                { track: "NEGOTIATION", current_level: 2, sessions_completed: 3, avg_score: 55 },
            ];

    const recent_scores =
        completed.length > 0
            ? completed.slice(0, 10).map((s) => ({
                session_id: s.session_id,
                track: s.track,
                level: s.level,
                score: s.score ?? 0,
                evaluated_at: s.started_at,
            }))
            : SEEDED_SCORES.map((score, i) => ({
                session_id: `seeded-${i}`,
                track: i % 2 === 0 ? "INTERVIEW" : "NEGOTIATION",
                level: Math.min(5, Math.ceil((i + 1) / 2)),
                score,
                evaluated_at: new Date(Date.now() - (10 - i) * 86400000).toISOString(),
            }));

    const avgFiller = completed.length > 0
        ? completed.reduce((a, s) => a + (s.metrics?.filler_rate ?? 0.05), 0) / completed.length
        : 0.08;
    const avgClarity = completed.length > 0
        ? completed.reduce((a, s) => a + (s.metrics?.clarity_score ?? 0.6), 0) / completed.length
        : 0.64;

    return {
        user_id: "demo-user",
        current_track_levels,
        recent_scores,
        key_metrics_trend: {
            avg_filler_rate: Math.round(avgFiller * 1000) / 1000,
            avg_pause_rate: 0.12,
            avg_clarity_score: Math.round(avgClarity * 1000) / 1000,
            sessions_evaluated: completed.length || 10,
        },
        session_history:
            localSessions.length > 0
                ? localSessions.slice(0, 20).map((s) => ({
                    session_id: s.session_id,
                    track: s.track,
                    level: s.level,
                    score: s.score,
                    status: s.status,
                    started_at: s.started_at,
                }))
                : recent_scores.map((r) => ({
                    session_id: r.session_id,
                    track: r.track,
                    level: r.level,
                    score: r.score,
                    status: "COMPLETE",
                    started_at: r.evaluated_at,
                })),
    };
}
