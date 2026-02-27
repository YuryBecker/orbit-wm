"use client";

import type { MouseEvent } from "react";
import { X } from "lucide-react";
import { observer } from "mobx-react";

import { Badge } from "@/components/ui/badge";
import type WindowPaneInstance from "../../state/window-manager/instance";



type TitleBarProps = {
    instance: WindowPaneInstance;
    indicatorClass: string;
    showStatus?: boolean;
    onDragStart?: (event: MouseEvent<HTMLDivElement>) => void;
    isDragging?: boolean;
};

const TitleBar = observer(
    ({
        instance,
        indicatorClass,
        showStatus = true,
        onDragStart,
        isDragging = false,
    }: TitleBarProps) => {
        const status = instance.status.toLowerCase();
        const isError =
            status.includes("socket error") ||
            status.includes("connection failed") ||
            status.includes("disconnected") ||
            status.includes("failed");
        const isWarning =
            status.includes("connecting") ||
            status.includes("initializing") ||
            status.includes("creating") ||
            status.includes("session not found");

        const badgeVariant = isError
            ? "destructive"
            : isWarning
                ? "secondary"
                : "outline";

        return (
            <div
                className={`flex items-center gap-3 bg-zinc-900 border-b border-white/10 px-4 py-2 text-xs uppercase tracking-[0.2em] text-white/60 ${
                    isDragging ? "cursor-grabbing" : "cursor-grab"
                }`}
                onMouseDown={(event) => {
                    if (event.button !== 0) {
                        return;
                    }

                    const target = event.target as HTMLElement | null;
                    if (target?.closest("button")) {
                        return;
                    }

                    onDragStart?.(event);
                }}
            >
                <span className={`h-2 w-2 rounded-full ${indicatorClass}`} />
                <span>{instance.title}</span>
                {showStatus ? (
                    <Badge
                        variant={badgeVariant}
                        className="text-[10px] normal-case tracking-normal"
                    >
                        {instance.status}
                    </Badge>
                ) : null}
                <span className="ml-auto" />
                <button
                    type="button"
                    aria-label="Close window"
                    className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white"
                    onClick={(event) => {
                        event.stopPropagation();
                        instance.close();
                    }}
                >
                    <X size={12} />
                </button>
            </div>
        );
    },
);

export default TitleBar;
