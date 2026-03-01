/**
 * Live API client — wraps backend endpoints.
 * Falls back gracefully on error (caller decides what to do).
 */
import type {
    SessionConfig,
    GeneratedSession,
    SessionResult,
    ProgressSummary,
    TokenResponse,
} from "./types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function request<T>(
    path: string,
    options: RequestInit & { token?: string }
): Promise<T> {
    const { token, ...init } = options;
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers as Record<string, string> | undefined),
    };
    const res = await fetch(`${BASE}${path}`, { ...init, headers });
    if (!res.ok) {
        const body = await res.text();
        throw new Error(`${res.status} ${res.statusText}: ${body}`);
    }
    return res.json() as Promise<T>;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function devLogin(alias = "abhyaasa_demo"): Promise<string> {
    const data = await request<TokenResponse>("/auth/dev-login", {
        method: "POST",
        body: JSON.stringify({ alias, language: "en" }),
    });
    return data.access_token;
}

// ── Sessions ──────────────────────────────────────────────────────────────────

export async function generateSession(
    config: SessionConfig,
    token: string
): Promise<GeneratedSession> {
    return request<GeneratedSession>("/sessions/generate", {
        method: "POST",
        token,
        body: JSON.stringify(config),
    });
}

export async function submitSession(
    session_id: string,
    raw_user_response: string,
    token: string,
    audio_duration?: number
): Promise<SessionResult> {
    return request<SessionResult>(`/sessions/${session_id}/submit`, {
        method: "POST",
        token,
        body: JSON.stringify({
            raw_user_response,
            audio_metadata: audio_duration
                ? { duration_seconds: audio_duration, file_placeholder: null }
                : null,
            response_start_ts: null,
            response_end_ts: null,
        }),
    });
}

// ── Progress ──────────────────────────────────────────────────────────────────

export async function getProgress(token: string): Promise<ProgressSummary> {
    return request<ProgressSummary>("/progress/summary", { method: "GET", token });
}
