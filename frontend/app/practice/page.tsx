"use client";
import { useEffect, useReducer, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
    Briefcase, MessageSquare, Users, Mic, Phone,
    Play, Send, RefreshCw, ChevronRight, Clock,
    AlertTriangle, CheckCircle2, TrendingUp, Video,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { CameraPanel } from "@/components/CameraPanel";
import { useTimer } from "@/hooks/useTimer";
import { getMode, getToken, setToken, addSession, updateSession } from "@/lib/store";
import { generateSession as apiGenerate, submitSession as apiSubmit, devLogin } from "@/lib/api";
import { mockGenerateSession, mockSubmitSession, MOCK_TOKEN } from "@/lib/mock";
import { cn, formatTime, toneColor, trackLabel, sessionTypeLabel, scoreColor, scoreRingColor } from "@/lib/utils";
import type {
    Track, Level, SessionType, SessionConfig,
    GeneratedSession, SessionResult, SessionPhase, AppMode,
} from "@/lib/types";

// ── State machine ─────────────────────────────────────────────────────────────

interface State {
    phase: SessionPhase;
    config: SessionConfig;
    session: GeneratedSession | null;
    result: SessionResult | null;
    response: string;
    showCamera: boolean;
    error: string | null;
}

type Action =
    | { type: "SET_CONFIG"; payload: Partial<SessionConfig> }
    | { type: "GENERATE_START" }
    | { type: "GENERATE_OK"; payload: GeneratedSession }
    | { type: "GENERATE_ERR"; payload: string }
    | { type: "START" }
    | { type: "SET_RESPONSE"; payload: string }
    | { type: "SUBMIT_START" }
    | { type: "SUBMIT_OK"; payload: SessionResult }
    | { type: "SUBMIT_ERR"; payload: string }
    | { type: "RETRY" }
    | { type: "CONTINUE"; payload: number }
    | { type: "TOGGLE_CAMERA" }
    | { type: "RESET" };

const DEFAULT_CONFIG: SessionConfig = {
    track: "INTERVIEW",
    level: 1,
    session_type: "OPEN",
    context: "",
    perspective_switch_enabled: false,
    language: "en",
};

function reducer(state: State, action: Action): State {
    switch (action.type) {
        case "SET_CONFIG":
            return { ...state, config: { ...state.config, ...action.payload } };
        case "GENERATE_START":
            return { ...state, phase: "GENERATING", error: null, session: null, result: null, response: "" };
        case "GENERATE_OK":
            return { ...state, phase: "GENERATED", session: action.payload };
        case "GENERATE_ERR":
            return { ...state, phase: "IDLE", error: action.payload };
        case "START":
            return { ...state, phase: "RUNNING" };
        case "SET_RESPONSE":
            return { ...state, response: action.payload };
        case "SUBMIT_START":
            return { ...state, phase: "SUBMITTING" };
        case "SUBMIT_OK":
            return { ...state, phase: "FEEDBACK", result: action.payload };
        case "SUBMIT_ERR":
            return { ...state, phase: "RUNNING", error: action.payload };
        case "RETRY":
            return { ...state, phase: "GENERATING", session: null, result: null, response: "", error: null };
        case "CONTINUE":
            return {
                ...state,
                phase: "GENERATING",
                config: { ...state.config, level: action.payload as Level },
                session: null, result: null, response: "", error: null,
            };
        case "TOGGLE_CAMERA":
            return { ...state, showCamera: !state.showCamera };
        case "RESET":
            return { ...state, phase: "IDLE", session: null, result: null, response: "", error: null };
        default:
            return state;
    }
}

// ── Track metadata ────────────────────────────────────────────────────────────

const TRACK_META: Record<Track, { icon: React.ElementType; color: string }> = {
    INTERVIEW: { icon: Briefcase, color: "text-sky-400" },
    PUBLIC_SPEAKING: { icon: Mic, color: "text-violet-400" },
    NEGOTIATION: { icon: MessageSquare, color: "text-amber-400" },
    DEBATE: { icon: Users, color: "text-rose-400" },
    COLD_CALL: { icon: Phone, color: "text-emerald-400" },
};

const TRACKS: Track[] = ["INTERVIEW", "PUBLIC_SPEAKING", "NEGOTIATION", "DEBATE", "COLD_CALL"];
const SESSION_TYPES: SessionType[] = ["OPEN", "STRUCTURED", "STRESS", "AMBIGUOUS"];

// ── Score ring ────────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
    const r = 54;
    const circ = 2 * Math.PI * r;
    const offset = circ - (score / 100) * circ;
    const color = scoreRingColor(score);

    return (
        <div className="relative flex items-center justify-center w-36 h-36">
            <svg width="144" height="144" className="-rotate-90">
                <circle cx="72" cy="72" r={r} fill="none" stroke="hsl(217 28% 20%)" strokeWidth="8" />
                <circle
                    cx="72" cy="72" r={r} fill="none" stroke={color} strokeWidth="8"
                    strokeDasharray={circ} strokeDashoffset={offset}
                    strokeLinecap="round"
                    style={{ transition: "stroke-dashoffset 1s ease-out" }}
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={cn("text-4xl font-extrabold tabular-nums", scoreColor(score))}>{score}</span>
                <span className="text-xs text-muted-foreground font-medium">/100</span>
            </div>
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

function PracticePageInner() {
    const searchParams = useSearchParams();
    const initTrack = (searchParams.get("track") as Track) || "INTERVIEW";

    const [state, dispatch] = useReducer(reducer, {
        phase: "IDLE",
        config: { ...DEFAULT_CONFIG, track: initTrack },
        session: null,
        result: null,
        response: "",
        showCamera: false,
        error: null,
    });

    const { phase, config, session, result, response, showCamera } = state;
    const isLocked = phase === "RUNNING" || phase === "SUBMITTING" || phase === "FEEDBACK";

    // Timer — seeded from session time limit
    const timeLimit = session?.constraints.time_limit_seconds ?? 90;
    const timer = useTimer(timeLimit);

    // Reset timer when session changes
    useEffect(() => {
        if (session) timer.reset(session.constraints.time_limit_seconds);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [session?.session_id]);

    // Auto-start timer when phase becomes RUNNING
    useEffect(() => {
        if (phase === "RUNNING") timer.start();
        if (phase !== "RUNNING") timer.pause();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase]);

    // Auto-submit when time expires
    useEffect(() => {
        if (timer.expired && phase === "RUNNING") {
            toast.warning("Time's up — submitting your current response.");
            handleSubmit();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [timer.expired]);

    // ── API calls ───────────────────────────────────────────────────────────────

    const getAppMode = (): AppMode => getMode();

    async function ensureToken(): Promise<string> {
        const existing = getToken();
        if (existing) return existing;
        try {
            const token = await devLogin();
            setToken(token);
            return token;
        } catch {
            return "fallback-token";
        }
    }

    const handleGenerate = useCallback(async () => {
        dispatch({ type: "GENERATE_START" });
        const mode = getAppMode();

        // Persist session start
        const tempId = `tmp-${Date.now()}`;
        addSession({
            session_id: tempId,
            track: config.track,
            level: config.level,
            session_type: config.session_type,
            score: null,
            started_at: new Date().toISOString(),
            status: "ACTIVE",
        });

        try {
            let gen: GeneratedSession;
            if (mode === "demo") {
                await new Promise((r) => setTimeout(r, 600)); // simulate latency
                gen = mockGenerateSession(config);
            } else {
                const token = await ensureToken();
                gen = await apiGenerate(config, token);
            }
            dispatch({ type: "GENERATE_OK", payload: gen });
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Generation failed";
            toast.error(msg + " — falling back to Demo Mode.");
            dispatch({ type: "GENERATE_OK", payload: mockGenerateSession(config) });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [config]);

    // Trigger generate on RETRY / CONTINUE (phase becomes GENERATING)
    useEffect(() => {
        if (phase === "GENERATING") handleGenerate();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase]);

    async function handleSubmit() {
        if (!session) return;
        dispatch({ type: "SUBMIT_START" });
        const mode = getAppMode();
        try {
            let res: SessionResult;
            if (mode === "demo") {
                await new Promise((r) => setTimeout(r, 700));
                res = mockSubmitSession(response, session);
            } else {
                const token = await ensureToken();
                res = await apiSubmit(session.session_id, response, token);
            }
            dispatch({ type: "SUBMIT_OK", payload: res });
            // Persist result to localStorage
            updateSession(session.session_id, {
                score: res.score,
                status: "COMPLETE",
                metrics: res.computed_metrics,
            });
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Submission failed";
            toast.error(msg + " — falling back to Demo Mode.");
            const res = mockSubmitSession(response, session);
            dispatch({ type: "SUBMIT_OK", payload: res });
            updateSession(session.session_id, { score: res.score, status: "COMPLETE", metrics: res.computed_metrics });
        }
    }

    // ── UI ──────────────────────────────────────────────────────────────────────

    const wordCount = response.trim().split(/\s+/).filter(Boolean).length;
    const wordLimit = session?.constraints.word_limit;
    const wordLimitExceeded = wordLimit ? wordCount > wordLimit : false;

    const timerPct = Math.round(((timeLimit - timer.secondsLeft) / timeLimit) * 100);
    const timerColor = timer.secondsLeft <= 15
        ? "indicatorClassName text-rose-400"
        : timer.secondsLeft <= 30
            ? "bg-yellow-400"
            : "bg-primary";

    return (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6">
            <div className="flex gap-5 min-h-[calc(100vh-5rem)]">
                {/* ── Left sidebar: config ─────────────────────────────────────────── */}
                <aside className={cn("w-72 shrink-0 space-y-4", isLocked && "pointer-events-none opacity-60")}>
                    {isLocked && (
                        <div className="flex items-center gap-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30 px-3 py-2 text-xs text-yellow-300">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                            Locked during session
                        </div>
                    )}

                    {/* Track */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Track</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0 space-y-1">
                            {TRACKS.map((t) => {
                                const { icon: Icon, color } = TRACK_META[t];
                                return (
                                    <button
                                        key={t}
                                        onClick={() => dispatch({ type: "SET_CONFIG", payload: { track: t } })}
                                        className={cn(
                                            "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left",
                                            config.track === t
                                                ? "bg-primary/15 text-foreground border border-primary/30"
                                                : "hover:bg-secondary text-muted-foreground"
                                        )}
                                    >
                                        <Icon className={cn("h-4 w-4 shrink-0", config.track === t ? color : "text-muted-foreground")} />
                                        {trackLabel(t)}
                                    </button>
                                );
                            })}
                        </CardContent>
                    </Card>

                    {/* Level */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center justify-between">
                                Difficulty Level
                                <span className={cn(
                                    "text-lg font-extrabold",
                                    config.level >= 5 ? "text-rose-400" : config.level >= 4 ? "text-orange-400"
                                        : config.level >= 3 ? "text-yellow-400" : "text-emerald-400"
                                )}>
                                    L{config.level}
                                </span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                            <div className="flex gap-1.5">
                                {([1, 2, 3, 4, 5] as Level[]).map((l) => (
                                    <button
                                        key={l}
                                        onClick={() => dispatch({ type: "SET_CONFIG", payload: { level: l } })}
                                        className={cn(
                                            "flex-1 h-8 rounded-md text-sm font-bold transition-all border",
                                            config.level === l
                                                ? "bg-primary/20 border-primary/50 text-primary"
                                                : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                                        )}
                                    >
                                        {l}
                                    </button>
                                ))}
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                                {config.level === 1 && "Low pressure · No interruptions"}
                                {config.level === 2 && "Moderate pressure · MEDIUM tone"}
                                {config.level === 3 && "High pressure · Redirections start"}
                                {config.level === 4 && "Challenge interruptions · 60s limit"}
                                {config.level === 5 && "HOSTILE · 45s · Short word limit"}
                            </p>
                        </CardContent>
                    </Card>

                    {/* Session type */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Session Type</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0 grid grid-cols-2 gap-1.5">
                            {SESSION_TYPES.map((t) => (
                                <button
                                    key={t}
                                    onClick={() => dispatch({ type: "SET_CONFIG", payload: { session_type: t } })}
                                    className={cn(
                                        "px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors",
                                        config.session_type === t
                                            ? "bg-primary/15 border-primary/40 text-primary"
                                            : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                                    )}
                                >
                                    {sessionTypeLabel(t)}
                                </button>
                            ))}
                        </CardContent>
                    </Card>

                    {/* Options */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Options</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0 space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium">Perspective Switch</p>
                                    <p className="text-xs text-muted-foreground">Requires L3+</p>
                                </div>
                                <Switch
                                    checked={config.perspective_switch_enabled}
                                    onCheckedChange={(c) =>
                                        dispatch({ type: "SET_CONFIG", payload: { perspective_switch_enabled: c } })
                                    }
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium">Camera</p>
                                    <p className="text-xs text-muted-foreground">Optional visual</p>
                                </div>
                                <Switch checked={showCamera} onCheckedChange={() => dispatch({ type: "TOGGLE_CAMERA" })} />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Camera panel */}
                    {showCamera && <CameraPanel active={phase === "RUNNING"} />}

                    {/* Generate button */}
                    {!isLocked && phase !== "GENERATING" && (
                        <Button
                            size="lg"
                            className="w-full"
                            onClick={() => dispatch({ type: "GENERATE_START" })}
                        >
                            Generate Session
                        </Button>
                    )}
                    {phase === "FEEDBACK" && (
                        <Button variant="outline" size="sm" className="w-full" onClick={() => dispatch({ type: "RESET" })}>
                            New Session
                        </Button>
                    )}
                </aside>

                {/* ── Main content area ─────────────────────────────────────────────── */}
                <div className="flex-1 min-w-0 space-y-4">

                    {/* IDLE state */}
                    {phase === "IDLE" && (
                        <div className="h-full flex flex-col items-center justify-center gap-4 py-24 animate-fade-in">
                            <div className="h-16 w-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                                <TrendingUp className="h-8 w-8 text-primary" />
                            </div>
                            <h2 className="text-xl font-semibold text-foreground">Select a track and generate a session</h2>
                            <p className="text-muted-foreground text-sm text-center max-w-xs">
                                Configure your training on the left, then click <strong>Generate Session</strong>.
                            </p>
                        </div>
                    )}

                    {/* GENERATING skeleton */}
                    {phase === "GENERATING" && (
                        <div className="space-y-4 animate-fade-in">
                            <Skeleton className="h-6 w-32" />
                            <Skeleton className="h-28 w-full" />
                            <Skeleton className="h-20 w-full" />
                            <Skeleton className="h-16 w-full" />
                            <Skeleton className="h-10 w-36" />
                        </div>
                    )}

                    {/* GENERATED / RUNNING / SUBMITTING / FEEDBACK */}
                    {session && (phase === "GENERATED" || phase === "RUNNING" || phase === "SUBMITTING" || phase === "FEEDBACK") && (
                        <div className="space-y-4 animate-fade-in">
                            {/* Header row */}
                            <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="secondary">{trackLabel(config.track)}</Badge>
                                <Badge variant="outline">L{config.level}</Badge>
                                <Badge variant="secondary">{sessionTypeLabel(config.session_type)}</Badge>
                                <Badge className={cn(toneColor(session.discomfort_variables.authority_tone))}>
                                    {session.discomfort_variables.authority_tone} tone
                                </Badge>
                                {phase === "RUNNING" && (
                                    <Badge variant={timer.secondsLeft <= 15 ? "destructive" : "default"} className="ml-auto flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        {formatTime(timer.secondsLeft)}
                                    </Badge>
                                )}
                            </div>

                            {/* Timer bar */}
                            {phase === "RUNNING" && (
                                <Progress
                                    value={timerPct}
                                    className="h-1"
                                    indicatorClassName={
                                        timer.secondsLeft <= 15 ? "bg-rose-400" : timer.secondsLeft <= 30 ? "bg-yellow-400" : "bg-primary"
                                    }
                                />
                            )}

                            {/* Session brief */}
                            <Card className="border-border/60">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm text-muted-foreground uppercase tracking-widest">Scenario</CardTitle>
                                </CardHeader>
                                <CardContent className="pt-0">
                                    <p className="text-sm leading-relaxed text-foreground/90">{session.session_brief}</p>
                                </CardContent>
                            </Card>

                            {/* Persona */}
                            {session.roleplay_config && (
                                <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-card px-4 py-3">
                                    <div className="h-8 w-8 shrink-0 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center text-xs font-bold text-accent">
                                        {session.roleplay_config.display_name[0]}
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold">{session.roleplay_config.display_name}</p>
                                        <p className="text-xs text-muted-foreground">{session.roleplay_config.style_description}</p>
                                    </div>
                                </div>
                            )}

                            {/* The prompt */}
                            <div className="rounded-xl border border-primary/30 bg-primary/5 px-5 py-4 glow-primary">
                                <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-2">Prompt</p>
                                <p className="text-base font-medium leading-relaxed text-foreground">{session.prompt}</p>
                            </div>

                            {/* Constraints */}
                            <div className="flex flex-wrap gap-2">
                                <span className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted rounded-md px-2.5 py-1">
                                    <Clock className="h-3 w-3" />
                                    {session.constraints.time_limit_seconds}s limit
                                </span>
                                {session.constraints.word_limit && (
                                    <span className="text-xs text-muted-foreground bg-muted rounded-md px-2.5 py-1">
                                        Max {session.constraints.word_limit} words
                                    </span>
                                )}
                                {session.discomfort_variables.interruption_plan.enabled && (
                                    <span className="flex items-center gap-1.5 text-xs text-yellow-300 bg-yellow-500/10 border border-yellow-500/20 rounded-md px-2.5 py-1">
                                        <AlertTriangle className="h-3 w-3" />
                                        Interruption at ~{session.discomfort_variables.interruption_plan.trigger_after_words} words
                                    </span>
                                )}
                            </div>

                            {/* Start button */}
                            {phase === "GENERATED" && (
                                <Button size="lg" onClick={() => dispatch({ type: "START" })} className="gap-2">
                                    <Play className="h-4 w-4" /> Start Practice
                                </Button>
                            )}

                            {/* Response area */}
                            {(phase === "RUNNING" || phase === "SUBMITTING") && (
                                <div className="space-y-3">
                                    {session.discomfort_variables.interruption_plan.enabled &&
                                        session.discomfort_variables.interruption_plan.interrupt_text && (
                                            <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3">
                                                <p className="text-xs font-semibold uppercase text-yellow-300 mb-1">Interruption</p>
                                                <p className="text-sm text-yellow-200">{session.discomfort_variables.interruption_plan.interrupt_text}</p>
                                            </div>
                                        )}
                                    <Textarea
                                        placeholder="Deliver your response here…"
                                        value={response}
                                        onChange={(e) => dispatch({ type: "SET_RESPONSE", payload: e.target.value })}
                                        className="min-h-[180px] text-sm resize-none"
                                        disabled={phase === "SUBMITTING"}
                                        autoFocus
                                    />
                                    <div className="flex items-center justify-between">
                                        <span className={cn("text-xs", wordLimitExceeded ? "text-rose-400" : "text-muted-foreground")}>
                                            {wordCount} words{wordLimit ? ` / ${wordLimit} max` : ""}
                                        </span>
                                        <Button
                                            onClick={handleSubmit}
                                            disabled={phase === "SUBMITTING" || response.trim().length < 3}
                                            size="default"
                                            className="gap-2"
                                        >
                                            {phase === "SUBMITTING" ? (
                                                <><span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> Evaluating…</>
                                            ) : (
                                                <><Send className="h-4 w-4" /> Submit Attempt</>
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* FEEDBACK */}
                    {phase === "FEEDBACK" && result && (
                        <div className="space-y-4 animate-fade-in">
                            {/* Score card */}
                            <Card className="border-border/60">
                                <CardContent className="pt-5">
                                    <div className="flex items-center gap-6 flex-wrap">
                                        <ScoreRing score={result.score} />
                                        <div className="flex-1 min-w-[200px] space-y-3">
                                            <div>
                                                <p className={cn("text-4xl font-extrabold", scoreColor(result.score))}>
                                                    {result.score >= 80 ? "Strong attempt." : result.score >= 60 ? "Developing." : "Needs work."}
                                                </p>
                                                <p className="text-sm text-muted-foreground mt-1">
                                                    Recommended next level: <span className="text-foreground font-semibold">L{result.next_level_recommendation}</span>
                                                </p>
                                            </div>
                                            <div className="space-y-2">
                                                {(["clarity", "structure", "recovery", "composure"] as const).map((dim) => {
                                                    const val = result.computed_metrics[`${dim}_score`];
                                                    const pct = Math.round(val * 100);
                                                    return (
                                                        <div key={dim} className="space-y-1">
                                                            <div className="flex justify-between text-xs">
                                                                <span className="capitalize text-muted-foreground">{dim}</span>
                                                                <span className={cn(pct >= 75 ? "text-emerald-400" : pct >= 50 ? "text-yellow-400" : "text-rose-400")}>
                                                                    {pct}%
                                                                </span>
                                                            </div>
                                                            <Progress
                                                                value={pct}
                                                                className="h-1.5"
                                                                indicatorClassName={pct >= 75 ? "bg-emerald-400" : pct >= 50 ? "bg-yellow-400" : "bg-rose-400"}
                                                            />
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Feedback bullets */}
                            {result.feedback.length > 0 && (
                                <Card className="border-border/60">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm">Feedback</CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-0 space-y-2.5">
                                        {result.feedback.map((f, i) => (
                                            <div key={i} className="flex gap-3">
                                                <div className="h-5 w-5 shrink-0 rounded-full bg-rose-500/20 border border-rose-500/30 flex items-center justify-center mt-0.5">
                                                    <span className="text-[10px] font-bold text-rose-400">{i + 1}</span>
                                                </div>
                                                <div>
                                                    <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{f.dimension} · </span>
                                                    <span className="text-sm text-foreground/90">{f.observation}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </CardContent>
                                </Card>
                            )}

                            {/* Next attempt instruction */}
                            <div className="rounded-xl border border-accent/30 bg-accent/5 px-5 py-4">
                                <p className="text-xs font-semibold uppercase tracking-widest text-accent mb-2">Next Attempt</p>
                                <p className="text-sm text-foreground/90">{result.next_attempt_instruction}</p>
                            </div>

                            {/* Stats */}
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    ["Words", result.computed_metrics.word_count, ""],
                                    ["Filler Rate", `${(result.computed_metrics.filler_rate * 100).toFixed(1)}%`, ""],
                                    ["Clarity", `${(result.computed_metrics.clarity_score * 100).toFixed(0)}%`, ""],
                                ].map(([label, val]) => (
                                    <div key={label} className="rounded-lg border border-border bg-card px-3 py-2.5 text-center">
                                        <p className="text-lg font-bold text-foreground">{val}</p>
                                        <p className="text-xs text-muted-foreground">{label}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3">
                                <Button
                                    variant="outline"
                                    className="flex-1 gap-2"
                                    onClick={() => dispatch({ type: "RETRY" })}
                                >
                                    <RefreshCw className="h-4 w-4" /> Retry (L{config.level})
                                </Button>
                                <Button
                                    className="flex-1 gap-2"
                                    onClick={() => dispatch({ type: "CONTINUE", payload: result.next_level_recommendation })}
                                >
                                    Continue → L{result.next_level_recommendation} <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function PracticePage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center h-96">
                <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
        }>
            <PracticePageInner />
        </Suspense>
    );
}
