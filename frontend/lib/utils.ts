import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function formatScore(score: number): string {
    return `${score}/100`;
}

export function scoreColor(score: number): string {
    if (score >= 80) return "text-emerald-400";
    if (score >= 60) return "text-yellow-400";
    return "text-rose-400";
}

export function scoreRingColor(score: number): string {
    if (score >= 80) return "#34d399";
    if (score >= 60) return "#facc15";
    return "#fb7185";
}

export function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60)
        .toString()
        .padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
}

export function trackLabel(track: string): string {
    const map: Record<string, string> = {
        INTERVIEW: "Interview",
        PUBLIC_SPEAKING: "Public Speaking",
        NEGOTIATION: "Negotiation",
        DEBATE: "Debate",
        COLD_CALL: "Cold Call",
    };
    return map[track] ?? track;
}

export function sessionTypeLabel(t: string): string {
    const map: Record<string, string> = {
        OPEN: "Open",
        STRUCTURED: "Structured",
        STRESS: "Stress Test",
        AMBIGUOUS: "Ambiguous",
    };
    return map[t] ?? t;
}

export function toneColor(tone: string): string {
    const map: Record<string, string> = {
        LOW: "bg-emerald-500/20 text-emerald-300",
        MEDIUM: "bg-yellow-500/20 text-yellow-300",
        HIGH: "bg-orange-500/20 text-orange-300",
        HOSTILE: "bg-rose-500/20 text-rose-300",
    };
    return map[tone] ?? "bg-muted text-muted-foreground";
}
