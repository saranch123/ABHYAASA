"use client";
import Link from "next/link";
import { ArrowRight, Briefcase, MessageSquare, Users, Mic, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const TRACKS = [
    { id: "INTERVIEW", label: "Interview", icon: Briefcase, color: "from-sky-500/20 to-sky-600/10 border-sky-500/30", text: "text-sky-400", description: "High-pressure panel & behavioral rounds" },
    { id: "PUBLIC_SPEAKING", label: "Public Speaking", icon: Mic, color: "from-violet-500/20 to-violet-600/10 border-violet-500/30", text: "text-violet-400", description: "Executive presentations & pitches" },
    { id: "NEGOTIATION", label: "Negotiation", icon: MessageSquare, color: "from-amber-500/20 to-amber-600/10 border-amber-500/30", text: "text-amber-400", description: "Contract, salary & vendor talks" },
    { id: "DEBATE", label: "Debate", icon: Users, color: "from-rose-500/20 to-rose-600/10 border-rose-500/30", text: "text-rose-400", description: "Structured argument & rebuttal" },
    { id: "COLD_CALL", label: "Cold Call", icon: Phone, color: "from-emerald-500/20 to-emerald-600/10 border-emerald-500/30", text: "text-emerald-400", description: "Prospecting & pitch calls" },
];

const PRINCIPLES = [
    { label: "Exposure-based", desc: "Graduated pressure — difficulty scales with your performance, not a preset schedule." },
    { label: "Instant feedback", desc: "Score, breakdown, and next-step instruction delivered immediately after each attempt." },
    { label: "No fluff", desc: "No affirmations, no journaling, no mood check-ins. Training language only." },
];

export default function LandingPage() {
    return (
        <div className="relative min-h-screen overflow-hidden">
            {/* Background */}
            <div className="absolute inset-0 bg-grid opacity-30 pointer-events-none" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[400px] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />

            {/* Hero */}
            <section className="relative mx-auto max-w-7xl px-4 sm:px-6 pt-20 pb-16 text-center">
                <Badge variant="secondary" className="mb-6 inline-flex gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                    MVP · Demo Ready
                </Badge>

                <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-none mb-3">
                    <span className="gradient-text">ABHYAASA</span>
                </h1>
                <p className="text-2xl sm:text-3xl text-muted-foreground font-light mb-2 tracking-wider">
                    अभ्यास
                </p>
                <p className="mt-6 max-w-xl mx-auto text-lg text-muted-foreground leading-relaxed">
                    AI-guided confidence training through deliberate exposure.
                    Practice high-stakes scenarios. Get scored. Level up.
                </p>

                <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                    <Button size="xl" asChild className="w-full sm:w-auto">
                        <Link href="/practice">
                            Start Practice <ArrowRight className="h-5 w-5" />
                        </Link>
                    </Button>
                    <Button size="xl" variant="outline" asChild className="w-full sm:w-auto">
                        <Link href="/progress">View Progress</Link>
                    </Button>
                </div>

                {/* Stat strip */}
                <div className="mt-14 grid grid-cols-3 gap-4 max-w-sm mx-auto">
                    {[["5", "Training Tracks"], ["5", "Difficulty Levels"], ["4", "Scored Dimensions"]].map(([n, l]) => (
                        <div key={l} className="flex flex-col items-center gap-1">
                            <span className="text-3xl font-bold gradient-text">{n}</span>
                            <span className="text-xs text-muted-foreground text-center">{l}</span>
                        </div>
                    ))}
                </div>
            </section>

            {/* Tracks */}
            <section className="relative mx-auto max-w-7xl px-4 sm:px-6 pb-16">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-6">
                    Training Tracks
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                    {TRACKS.map((t) => (
                        <Link key={t.id} href={`/practice?track=${t.id}`}>
                            <div
                                className={`group relative rounded-xl border bg-gradient-to-b ${t.color} p-4 cursor-pointer hover:scale-[1.02] transition-transform duration-200`}
                            >
                                <t.icon className={`h-6 w-6 ${t.text} mb-3`} />
                                <p className="font-semibold text-sm text-foreground mb-1">{t.label}</p>
                                <p className="text-xs text-muted-foreground leading-snug">{t.description}</p>
                            </div>
                        </Link>
                    ))}
                </div>
            </section>

            {/* Principles */}
            <section className="relative mx-auto max-w-7xl px-4 sm:px-6 pb-24">
                <div className="grid sm:grid-cols-3 gap-4">
                    {PRINCIPLES.map((p) => (
                        <div key={p.label} className="glass rounded-xl p-5">
                            <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-2">
                                {p.label}
                            </p>
                            <p className="text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
                        </div>
                    ))}
                </div>

                {/* Bottom CTA */}
                <div className="mt-12 text-center">
                    <p className="text-muted-foreground text-sm mb-4">
                        Toggle <span className="text-foreground font-medium">Demo Mode</span> in the navbar — no backend needed.
                    </p>
                    <Button asChild size="lg">
                        <Link href="/practice">
                            Go to Practice <ArrowRight className="h-4 w-4" />
                        </Link>
                    </Button>
                </div>
            </section>
        </div>
    );
}
