"use client";
import { useEffect, useState } from "react";
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, BarChart, Bar, Cell, Legend,
} from "recharts";
import { TrendingUp, Target, Activity, Clock, Award } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { getMode, getToken, setToken, getStoredSessions } from "@/lib/store";
import { getProgress as apiGetProgress, devLogin } from "@/lib/api";
import { mockProgress } from "@/lib/mock";
import { cn, trackLabel, scoreColor } from "@/lib/utils";
import type { ProgressSummary } from "@/lib/types";

// ── Custom tooltip ─────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
    if (!active || !payload?.length) return null;
    return (
        <div className="glass rounded-lg px-3 py-2 text-sm shadow-xl">
            <p className="text-muted-foreground text-xs mb-1">{label}</p>
            <p className="font-bold text-foreground">{payload[0].value}/100</p>
        </div>
    );
}

// ── Level badge ────────────────────────────────────────────────────────────────

function LevelBadge({ level }: { level: number }) {
    const colors = ["", "bg-emerald-500/20 text-emerald-300", "bg-sky-500/20 text-sky-300", "bg-yellow-500/20 text-yellow-300", "bg-orange-500/20 text-orange-300", "bg-rose-500/20 text-rose-300"];
    return (
        <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold", colors[level] || colors[1])}>
            L{level}
        </span>
    );
}

// ── Progress page ──────────────────────────────────────────────────────────────

export default function ProgressPage() {
    const [data, setData] = useState<ProgressSummary | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            setLoading(true);
            const mode = getMode();
            const sessions = getStoredSessions();
            try {
                if (mode === "live") {
                    let token = getToken();
                    if (!token) {
                        token = await devLogin();
                        setToken(token);
                    }
                    try {
                        const d = await apiGetProgress(token);
                        setData(d);
                    } catch {
                        toast.info("Backend unavailable — showing local data.");
                        setData(mockProgress(sessions));
                    }
                } else {
                    await new Promise((r) => setTimeout(r, 400));
                    setData(mockProgress(sessions));
                }
            } catch {
                setData(mockProgress(sessions));
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    if (loading) return (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 space-y-6">
            <Skeleton className="h-8 w-48" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
            </div>
            <Skeleton className="h-72 rounded-xl" />
        </div>
    );

    if (!data) return null;

    // Chart data
    const scoreData = data.recent_scores.map((s, i) => ({
        name: `#${i + 1}`,
        score: s.score,
        track: trackLabel(s.track),
    }));

    const dimData = [
        { dim: "Clarity", value: Math.round(data.key_metrics_trend.avg_clarity_score * 100) },
        { dim: "Filler Rate", value: Math.round((1 - data.key_metrics_trend.avg_filler_rate) * 100) },
        { dim: "Composure", value: 100 - Math.round(data.key_metrics_trend.avg_pause_rate * 100) },
        { dim: "Sessions", value: Math.min(100, data.key_metrics_trend.sessions_evaluated * 5) },
    ];

    const DIM_COLORS = ["#38bdf8", "#a855f7", "#34d399", "#fbbf24"];

    const avgScore = data.recent_scores.length > 0
        ? Math.round(data.recent_scores.reduce((a, s) => a + s.score, 0) / data.recent_scores.length)
        : 0;

    const topTrack = data.current_track_levels.reduce(
        (a, b) => (a.sessions_completed > b.sessions_completed ? a : b),
        data.current_track_levels[0] ?? { track: "—", current_level: 1 }
    );

    return (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 space-y-6">
            {/* Page header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Progress</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        {data.key_metrics_trend.sessions_evaluated} sessions evaluated
                    </p>
                </div>
                <Badge variant="secondary" className="hidden sm:flex">
                    Demo data includes seeded history
                </Badge>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { icon: TrendingUp, label: "Avg Score", value: `${avgScore}/100`, color: "text-primary" },
                    { icon: Award, label: "Primary Track", value: trackLabel(topTrack?.track ?? "—"), color: "text-violet-400" },
                    { icon: Target, label: "Current Level", value: `L${topTrack?.current_level ?? 1}`, color: "text-amber-400" },
                    { icon: Activity, label: "Sessions", value: String(data.key_metrics_trend.sessions_evaluated), color: "text-emerald-400" },
                ].map(({ icon: Icon, label, value, color }) => (
                    <Card key={label} className="border-border/60">
                        <CardContent className="pt-4 pb-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Icon className={cn("h-4 w-4", color)} />
                                <span className="text-xs text-muted-foreground font-medium">{label}</span>
                            </div>
                            <p className={cn("text-2xl font-extrabold", color)}>{value}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Tabs */}
            <Tabs defaultValue="overview">
                <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="sessions">Sessions</TabsTrigger>
                    <TabsTrigger value="tracks">Tracks</TabsTrigger>
                </TabsList>

                {/* Overview tab */}
                <TabsContent value="overview" className="space-y-4">
                    <div className="grid lg:grid-cols-2 gap-4">
                        {/* Score trend */}
                        <Card className="border-border/60">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm">Score Trend</CardTitle>
                                <CardDescription>Last {scoreData.length} sessions</CardDescription>
                            </CardHeader>
                            <CardContent className="pt-0">
                                {scoreData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={240}>
                                        <LineChart data={scoreData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 28% 20%)" />
                                            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(215 16% 55%)" }} axisLine={false} tickLine={false} />
                                            <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "hsl(215 16% 55%)" }} axisLine={false} tickLine={false} />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Line
                                                type="monotone" dataKey="score"
                                                stroke="hsl(199 89% 52%)" strokeWidth={2.5}
                                                dot={{ fill: "hsl(199 89% 52%)", r: 4, strokeWidth: 0 }}
                                                activeDot={{ r: 6, strokeWidth: 0 }}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-60 flex items-center justify-center text-muted-foreground text-sm">
                                        Complete a session to see score trend.
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Dimension bars */}
                        <Card className="border-border/60">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm">Performance Dimensions</CardTitle>
                                <CardDescription>Averaged across all sessions</CardDescription>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <ResponsiveContainer width="100%" height={240}>
                                    <BarChart data={dimData} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 28% 20%)" horizontal={false} />
                                        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: "hsl(215 16% 55%)" }} axisLine={false} tickLine={false} />
                                        <YAxis dataKey="dim" type="category" tick={{ fontSize: 11, fill: "hsl(215 16% 55%)" }} axisLine={false} tickLine={false} width={80} />
                                        <Tooltip formatter={(v) => [`${v}%`]} contentStyle={{ background: "hsl(222 40% 11%)", border: "1px solid hsl(217 28% 20%)", borderRadius: "8px", fontSize: "12px" }} />
                                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                            {dimData.map((_, i) => <Cell key={i} fill={DIM_COLORS[i]} fillOpacity={0.85} />)}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Metrics summary */}
                    <div className="grid grid-cols-3 gap-3">
                        {[
                            { label: "Avg Filler Rate", value: `${(data.key_metrics_trend.avg_filler_rate * 100).toFixed(1)}%`, good: data.key_metrics_trend.avg_filler_rate < 0.08 },
                            { label: "Avg Clarity", value: `${(data.key_metrics_trend.avg_clarity_score * 100).toFixed(0)}%`, good: data.key_metrics_trend.avg_clarity_score > 0.65 },
                            { label: "Pause Rate", value: `${(data.key_metrics_trend.avg_pause_rate * 100).toFixed(1)}%`, good: data.key_metrics_trend.avg_pause_rate < 0.15 },
                        ].map(({ label, value, good }) => (
                            <Card key={label} className="border-border/60">
                                <CardContent className="pt-4 pb-3 text-center">
                                    <p className={cn("text-xl font-extrabold", good ? "text-emerald-400" : "text-yellow-400")}>{value}</p>
                                    <p className="text-xs text-muted-foreground mt-1">{label}</p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>

                {/* Sessions tab */}
                <TabsContent value="sessions">
                    <Card className="border-border/60">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm">Session History</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                            {data.session_history.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-8 text-center">No sessions yet. Start practicing!</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-border text-xs text-muted-foreground">
                                                <th className="text-left pb-2 pr-4 font-medium">Track</th>
                                                <th className="text-left pb-2 pr-4 font-medium">Level</th>
                                                <th className="text-left pb-2 pr-4 font-medium">Score</th>
                                                <th className="text-left pb-2 pr-4 font-medium">Status</th>
                                                <th className="text-right pb-2 font-medium">Date</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.session_history.map((s) => (
                                                <tr key={s.session_id} className="border-b border-border/40 hover:bg-secondary/30 transition-colors">
                                                    <td className="py-2.5 pr-4">
                                                        <span className="font-medium text-foreground">{trackLabel(s.track)}</span>
                                                    </td>
                                                    <td className="py-2.5 pr-4">
                                                        <LevelBadge level={s.level} />
                                                    </td>
                                                    <td className="py-2.5 pr-4">
                                                        {s.score != null ? (
                                                            <span className={cn("font-bold", scoreColor(s.score))}>{s.score}</span>
                                                        ) : (
                                                            <span className="text-muted-foreground">—</span>
                                                        )}
                                                    </td>
                                                    <td className="py-2.5 pr-4">
                                                        <Badge variant={s.status === "COMPLETE" ? "success" : "secondary"} className="text-[11px]">
                                                            {s.status}
                                                        </Badge>
                                                    </td>
                                                    <td className="py-2.5 text-right text-muted-foreground text-xs">
                                                        {new Date(s.started_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tracks tab */}
                <TabsContent value="tracks">
                    <div className="grid sm:grid-cols-2 gap-4">
                        {data.current_track_levels.map((t) => (
                            <Card key={t.track} className="border-border/60">
                                <CardContent className="pt-4 pb-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <p className="font-semibold text-sm">{trackLabel(t.track)}</p>
                                        <LevelBadge level={t.current_level} />
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 text-center">
                                        {[
                                            ["Sessions", t.sessions_completed],
                                            ["Avg Score", t.avg_score],
                                            ["Level", `L${t.current_level}`],
                                        ].map(([l, v]) => (
                                            <div key={l}>
                                                <p className="text-base font-bold text-foreground">{v}</p>
                                                <p className="text-xs text-muted-foreground">{l}</p>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                        {data.current_track_levels.length === 0 && (
                            <div className="col-span-2 text-center py-12 text-muted-foreground text-sm">
                                No track data yet. Complete a session to see your track progress.
                            </div>
                        )}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
