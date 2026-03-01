"use client";
import { useState, useEffect, useCallback } from "react";
import { getMode, setMode } from "@/lib/store";
import type { AppMode } from "@/lib/types";

export function useMode() {
    const [mode, setModeState] = useState<AppMode>("demo");

    useEffect(() => {
        setModeState(getMode());
    }, []);

    const toggle = useCallback((next: AppMode) => {
        setMode(next);
        setModeState(next);
    }, []);

    return { mode, toggle };
}
