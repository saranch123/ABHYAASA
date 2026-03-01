import type { Metadata } from "next";
import { Toaster } from "sonner";
import { Navbar } from "@/components/Navbar";
import "./globals.css";

export const metadata: Metadata = {
    title: "ABHYAASA — Confidence Training Platform",
    description:
        "AI-guided practice sessions for interviews, negotiations, public speaking, and high-stakes communication.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" className="dark" suppressHydrationWarning>
            <body className="min-h-screen bg-background text-foreground antialiased">
                <Navbar />
                <main className="w-full">{children}</main>
                <Toaster
                    theme="dark"
                    position="bottom-right"
                    toastOptions={{
                        style: {
                            background: "hsl(222 40% 11%)",
                            border: "1px solid hsl(217 28% 20%)",
                            color: "hsl(210 40% 96%)",
                        },
                    }}
                />
            </body>
        </html>
    );
}
