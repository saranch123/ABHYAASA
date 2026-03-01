"use client";
import { useState, useEffect, useRef, useCallback } from "react";

export function useTimer(initialSeconds: number, autoStart = false) {
    const [secondsLeft, setSecondsLeft] = useState(initialSeconds);
    const [running, setRunning] = useState(autoStart);
    const ref = useRef<ReturnType<typeof setInterval> | null>(null);

    const start = useCallback(() => setRunning(true), []);
    const pause = useCallback(() => setRunning(false), []);
    const reset = useCallback((s?: number) => {
        setRunning(false);
        setSecondsLeft(s ?? initialSeconds);
    }, [initialSeconds]);

    useEffect(() => {
        if (!running) {
            if (ref.current) clearInterval(ref.current);
            return;
        }
        ref.current = setInterval(() => {
            setSecondsLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(ref.current!);
                    setRunning(false);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => { if (ref.current) clearInterval(ref.current); };
    }, [running]);

    const pct = Math.round(((initialSeconds - secondsLeft) / initialSeconds) * 100);
    const expired = secondsLeft === 0;

    return { secondsLeft, running, start, pause, reset, pct, expired };
}
