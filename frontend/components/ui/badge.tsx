import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
    "inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
    {
        variants: {
            variant: {
                default: "bg-primary/20 text-primary border border-primary/30",
                secondary: "bg-secondary text-secondary-foreground",
                destructive: "bg-destructive/20 text-destructive border border-destructive/30",
                outline: "border border-border text-foreground",
                accent: "bg-accent/20 text-accent border border-accent/30",
                success: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
                warning: "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30",
                muted: "bg-muted text-muted-foreground",
            },
        },
        defaultVariants: { variant: "default" },
    }
);

export interface BadgeProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> { }

function Badge({ className, variant, ...props }: BadgeProps) {
    return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
