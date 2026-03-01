"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Zap, ActivitySquare, Sun, Moon, Radio } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getMode, setMode } from "@/lib/store";
import type { AppMode } from "@/lib/types";

interface NavbarProps {
    onModeChange?: (mode: AppMode) => void;
}

export function Navbar({ onModeChange }: NavbarProps) {
    const pathname = usePathname();
    const [mode, setModeState] = useState<AppMode>("demo");
    const [dark, setDark] = useState(true);

    useEffect(() => {
        setModeState(getMode());
        document.documentElement.classList.add("dark");
    }, []);

    function toggleTheme() {
        const next = !dark;
        setDark(next);
        document.documentElement.classList.toggle("dark", next);
        document.documentElement.classList.toggle("light", !next);
    }

    function handleModeToggle(checked: boolean) {
        const next: AppMode = checked ? "live" : "demo";
        setMode(next);
        setModeState(next);
        onModeChange?.(next);
    }

    const isLive = mode === "live";

    const navLinks = [
        { href: "/", label: "Home" },
        { href: "/practice", label: "Practice" },
        { href: "/progress", label: "Progress" },
    ];

    return (
        <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-md">
            <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-2.5 group">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 border border-primary/30 group-hover:bg-primary/30 transition-colors">
                        <Zap className="h-4 w-4 text-primary" />
                    </div>
                    <span className="font-bold text-base tracking-tight">
                        ABHY<span className="gradient-text">AASA</span>
                    </span>
                    <span className="hidden sm:block text-xs text-muted-foreground font-devanagari">
                        अभ्यास
                    </span>
                </Link>

                {/* Nav links */}
                <nav className="hidden md:flex items-center gap-1">
                    {navLinks.map((l) => (
                        <Link
                            key={l.href}
                            href={l.href}
                            className={cn(
                                "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                                pathname === l.href
                                    ? "text-foreground bg-secondary"
                                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                            )}
                        >
                            {l.label}
                        </Link>
                    ))}
                </nav>

                {/* Right controls */}
                <div className="flex items-center gap-3">
                    {/* Live / Demo toggle */}
                    <div className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5">
                        <span className="text-xs font-medium text-muted-foreground">Demo</span>
                        <Switch checked={isLive} onCheckedChange={handleModeToggle} />
                        <span className="flex items-center gap-1 text-xs font-medium">
                            {isLive ? (
                                <>
                                    <Radio className="h-3 w-3 text-emerald-400 animate-pulse" />
                                    <span className="text-emerald-400">Live</span>
                                </>
                            ) : (
                                <span className="text-muted-foreground">Live</span>
                            )}
                        </span>
                    </div>

                    {/* Mode badge */}
                    <Badge variant={isLive ? "success" : "secondary"} className="hidden sm:flex">
                        {isLive ? "Backend Connected" : "Demo Mode"}
                    </Badge>

                    {/* Theme toggle */}
                    <button
                        onClick={toggleTheme}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-border hover:bg-secondary transition-colors"
                        title="Toggle theme"
                    >
                        {dark ? (
                            <Sun className="h-4 w-4 text-muted-foreground" />
                        ) : (
                            <Moon className="h-4 w-4 text-muted-foreground" />
                        )}
                    </button>

                    {/* Mobile nav */}
                    <div className="flex md:hidden items-center gap-1">
                        {navLinks.slice(1).map((l) => (
                            <Link
                                key={l.href}
                                href={l.href}
                                className={cn(
                                    "px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
                                    pathname === l.href ? "text-foreground bg-secondary" : "text-muted-foreground"
                                )}
                            >
                                {l.label}
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </header>
    );
}
