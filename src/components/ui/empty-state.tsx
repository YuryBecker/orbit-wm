import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";


const emptyStateVariants = cva(
    "w-full max-w-xl rounded-xl border border-border/70 bg-background/85 p-6 text-foreground shadow-xl backdrop-blur-md",
);

function EmptyState({
    className,
    ...props
}: React.ComponentProps<"section"> & VariantProps<typeof emptyStateVariants>) {
    return (
        <section
            data-slot="empty-state"
            className={cn(emptyStateVariants(), className)}
            {...props}
        />
    );
}

function EmptyStateHeader({
    className,
    ...props
}: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="empty-state-header"
            className={cn("flex items-start gap-3", className)}
            {...props}
        />
    );
}

function EmptyStateIcon({
    className,
    ...props
}: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="empty-state-icon"
            className={cn(
                "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/60 text-muted-foreground",
                className,
            )}
            {...props}
        />
    );
}

function EmptyStateTitle({
    className,
    ...props
}: React.ComponentProps<"h3">) {
    return (
        <h3
            data-slot="empty-state-title"
            className={cn("text-base font-semibold tracking-tight", className)}
            {...props}
        />
    );
}

function EmptyStateDescription({
    className,
    ...props
}: React.ComponentProps<"p">) {
    return (
        <p
            data-slot="empty-state-description"
            className={cn("mt-1 text-sm text-muted-foreground", className)}
            {...props}
        />
    );
}

function EmptyStateFooter({
    className,
    ...props
}: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="empty-state-footer"
            className={cn("mt-5 flex flex-wrap items-center gap-2", className)}
            {...props}
        />
    );
}

export {
    EmptyState,
    EmptyStateDescription,
    EmptyStateFooter,
    EmptyStateHeader,
    EmptyStateIcon,
    EmptyStateTitle,
};
