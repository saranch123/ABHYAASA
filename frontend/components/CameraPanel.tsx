"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type CameraState = "idle" | "requesting" | "active" | "denied" | "error";

interface CameraPanelProps {
    active?: boolean;
}

export function CameraPanel({ active = false }: CameraPanelProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [state, setState] = useState<CameraState>("idle");

    async function startCamera() {
        setState("requesting");
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }
            setState("active");
        } catch (err: unknown) {
            const error = err as Error;
            setState(error.name === "NotAllowedError" ? "denied" : "error");
        }
    }

    function stopCamera() {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (videoRef.current) videoRef.current.srcObject = null;
        setState("idle");
    }

    useEffect(() => {
        if (!active) stopCamera();
        return () => stopCamera();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active]);

    return (
        <div className="rounded-xl border border-border overflow-hidden bg-card">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                <div className="flex items-center gap-1.5">
                    <div
                        className={cn(
                            "h-2 w-2 rounded-full",
                            state === "active" ? "bg-emerald-400 animate-pulse" : "bg-muted"
                        )}
                    />
                    <span className="text-xs font-medium text-muted-foreground">Camera</span>
                </div>
                <button
                    onClick={state === "active" ? stopCamera : startCamera}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                    disabled={state === "requesting" || state === "denied"}
                >
                    {state === "active" ? (
                        <><CameraOff className="h-3 w-3" /> Off</>
                    ) : (
                        <><Camera className="h-3 w-3" /> {state === "requesting" ? "Starting…" : "Enable"}</>
                    )}
                </button>
            </div>

            {/* Feed or fallback */}
            <div className="relative aspect-video w-full bg-muted/30 flex items-center justify-center">
                <video
                    ref={videoRef}
                    className={cn("absolute inset-0 w-full h-full object-cover", state !== "active" && "hidden")}
                    muted
                    playsInline
                />

                {state === "idle" && (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Camera className="h-8 w-8 opacity-30" />
                        <p className="text-xs">Camera off</p>
                    </div>
                )}

                {state === "requesting" && (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                        <p className="text-xs">Requesting access…</p>
                    </div>
                )}

                {state === "denied" && (
                    <div className="flex flex-col items-center gap-2 px-4 text-center">
                        <AlertCircle className="h-8 w-8 text-yellow-400 opacity-70" />
                        <p className="text-xs text-muted-foreground">Camera permission denied.</p>
                        <p className="text-xs text-muted-foreground">Practice continues without video.</p>
                    </div>
                )}

                {state === "error" && (
                    <div className="flex flex-col items-center gap-2 px-4 text-center">
                        <AlertCircle className="h-8 w-8 text-rose-400 opacity-70" />
                        <p className="text-xs text-muted-foreground">Camera unavailable.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
