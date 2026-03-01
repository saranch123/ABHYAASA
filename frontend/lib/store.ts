import type { AppMode, StoredSession } from "./types";

const SESSIONS_KEY = "abhyaasa_sessions";
const MODE_KEY = "abhyaasa_mode";
const TOKEN_KEY = "abhyaasa_token";

// ── Mode ──────────────────────────────────────────────────────────────────────

export function getMode(): AppMode {
    if (typeof window === "undefined") return "demo";
    return (localStorage.getItem(MODE_KEY) as AppMode) ?? "demo";
}

export function setMode(mode: AppMode): void {
    localStorage.setItem(MODE_KEY, mode);
}

// ── Token ─────────────────────────────────────────────────────────────────────

export function getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
    localStorage.removeItem(TOKEN_KEY);
}

// ── Sessions ──────────────────────────────────────────────────────────────────

export function getStoredSessions(): StoredSession[] {
    if (typeof window === "undefined") return [];
    try {
        const raw = localStorage.getItem(SESSIONS_KEY);
        return raw ? (JSON.parse(raw) as StoredSession[]) : [];
    } catch {
        return [];
    }
}

export function addSession(session: StoredSession): void {
    const sessions = getStoredSessions();
    sessions.unshift(session);
    // Keep last 50
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions.slice(0, 50)));
}

export function updateSession(
    session_id: string,
    update: Partial<StoredSession>
): void {
    const sessions = getStoredSessions();
    const idx = sessions.findIndex((s) => s.session_id === session_id);
    if (idx !== -1) {
        sessions[idx] = { ...sessions[idx], ...update };
        localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
    }
}

export function clearSessions(): void {
    localStorage.removeItem(SESSIONS_KEY);
}
