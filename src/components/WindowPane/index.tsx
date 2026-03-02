"use client";

import { useEffect, useId, useRef } from "react";
import type { MouseEvent } from "react";
import { observer } from "mobx-react";
import { motion } from "framer-motion";

import config from "state/config";
import { windowManager } from "state";
import WindowPaneInstance from "state/window-manager/instance";

import Browser from "../Browser";
import Terminal from "../Terminal";
import TitleBar from "./TitleBar";



type WindowPaneProps = {
    instance: WindowPaneInstance;
    onStartDrag?: (id: string, event: MouseEvent<HTMLDivElement>) => void;
    activeDragId?: string | null;
    isModKeyDown?: boolean;
    dragOffset?: { x: number; y: number };
};

const WindowPane = observer(
    ({
        instance,
        onStartDrag,
        activeDragId,
        isModKeyDown: isCtrlDown,
        dragOffset,
    }: WindowPaneProps) => {
        const containerRef = useRef<HTMLDivElement | null>(null);
        const id = useId();
        const isDragging = activeDragId === instance.id;

        const status = instance.status.toLowerCase();
        const hasSocketError =
            status.includes("socket error") ||
            status.includes("connection failed") ||
            status.includes("disconnected");
        const indicatorClass = hasSocketError
            ? "bg-rose-400"
            : "bg-emerald-400";
        const isActive = windowManager.activeId === instance.id;
        const gap = config.gap;
        const borderWidth = config.borderWidth;
        const borderColor = isActive
            ? config.activeBorderColor
            : config.borderColor;

        useEffect(() => {
            const container = containerRef.current;
            if (!container) return;

            instance.setContainer(container);

            return () => {
                instance.setContainer(null);
            };
        }, []);

        useEffect(() => {
            if (!instance.container) return;

            if (instance.kind === "terminal" && !instance.terminal) {
                instance.startTerminal();
            }

            if (instance.kind === "browser" && !instance.browser) {
                instance.startBrowser(instance.url);
            }
        }, [instance.container, instance.kind]);

        const dragX = isDragging && dragOffset ? dragOffset.x : 0;
        const dragY = isDragging && dragOffset ? dragOffset.y : 0;

        return (
            <motion.div
                className={`absolute flex flex-col overflow-hidden bg-black text-white ${
                    isDragging
                        ? "cursor-grabbing"
                        : isCtrlDown
                            ? "cursor-grab"
                            : ""
                }`}
                onMouseEnter={() => {
                    windowManager.setActive(instance.id);
                }}
                onMouseDown={(event) => {
                    if (!event.ctrlKey || event.button !== 0) {
                        return;
                    }

                    onStartDrag?.(instance.id, event);
                }}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{
                    opacity:
                        instance.kind === "terminal"
                            ? (isDragging ? 0.7 : 1) * config.terminalOpacity
                            : isDragging
                                ? 0.7
                                : 1,
                    scale: 1,
                    x: dragX,
                    y: dragY,
                }}
                style={{
                    left: instance.x + gap / 2,
                    top: instance.y + gap / 2,
                    width: Math.max(0, instance.width - gap),
                    height: Math.max(0, instance.height - gap),
                    border: `${borderWidth} solid ${borderColor}`,
                    borderRadius: `${config.borderRadius}px`,
                    boxShadow: config.shadowStyle,
                    zIndex: isDragging ? 60 : undefined,
                    background:
                        instance.kind === "browser"
                            ? "#18181b"
                            : config.terminalColor,
                    backdropFilter:
                        instance.kind === "terminal"
                            ? `blur(${config.terminalBlur}px)`
                            : undefined,
                    WebkitBackdropFilter:
                        instance.kind === "terminal"
                            ? `blur(${config.terminalBlur}px)`
                            : undefined,
                    transition: isDragging
                        ? 'none'
                        : 'all 100ms ease-out',
                }}
            >
                {config.showTitleBar ? (
                    <TitleBar
                        instance={instance}
                        indicatorClass={indicatorClass}
                        showStatus={instance.kind !== "browser"}
                        onDragStart={(event) =>
                            onStartDrag?.(instance.id, event)
                        }
                        isDragging={isDragging}
                    />
                ) : null}
                {instance.kind === "browser" ? (
                    <Browser
                        instance={instance}
                        isCtrlDown={isCtrlDown}
                    />
                ) : (
                    <Terminal
                        instance={instance}
                        containerId={id}
                        containerRef={containerRef as any}
                    />
                )}
            </motion.div>
        );
    },
);

export default WindowPane;
