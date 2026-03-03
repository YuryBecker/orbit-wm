"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties, MouseEvent } from "react";
import { observer } from "mobx-react";
import { motion } from "framer-motion";

import config from "state/config";
import { ui, windowManager } from "state";
import type { ResizeContext, ResizeEdge } from "state/window-manager";
import WindowPaneInstance from "state/window-manager/instance";
import Browser from "../Browser";
import Terminal from "../Terminal";
import { cn } from "@/lib/cn";
import TitleBar from "./TitleBar";
import WindowBorder from "./WindowBorder";



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
        const resizeRef = useRef<ResizeContext | null>(null);
        const isDragging = activeDragId === instance.id;

        const isActive = windowManager.activeId === instance.id;

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

        useEffect(() => {
            if (!isActive) {
                return;
            }

            instance.focus();
        }, [instance, instance.terminal, isActive]);

        const dragX = isDragging && dragOffset ? dragOffset.x : 0;
        const dragY = isDragging && dragOffset ? dragOffset.y : 0;

        const handleStartResize = (
            instanceId: string,
            edge: ResizeEdge,
            event: MouseEvent<HTMLDivElement>,
        ) => {
            const isModKeyDown = event.ctrlKey || event.metaKey;

            if (event.button !== 0 && !(event.button === 2 && isModKeyDown)) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();

            const context = windowManager.beginResize(
                instanceId,
                edge,
                event.clientX,
                event.clientY,
            );
            if (!context) {
                return;
            }

            resizeRef.current = context;

            const handleMouseUp = () => {
                resizeRef.current = null;
                window.removeEventListener("mouseup", handleMouseUp);
                window.removeEventListener("mousemove", handleMouseMove);
                windowManager.endResize();
            };

            const handleMouseMove = (moveEvent: globalThis.MouseEvent) => {
                if (!resizeRef.current) {
                    return;
                }

                windowManager.updateResize(
                    resizeRef.current,
                    moveEvent.clientX,
                    moveEvent.clientY,
                );
            };

            window.addEventListener("mouseup", handleMouseUp);
            window.addEventListener("mousemove", handleMouseMove);
        };

        const handleModRightClickResize = (
            event: MouseEvent<HTMLDivElement>,
        ) => {
            const isModKeyDown = event.ctrlKey || event.metaKey;
            if (!isModKeyDown || event.button !== 2) {
                return;
            }

            const rect = event.currentTarget.getBoundingClientRect();
            const localX = event.clientX - rect.left;
            const localY = event.clientY - rect.top;

            const distanceToLeft = localX;
            const distanceToRight = rect.width - localX;
            const distanceToTop = localY;
            const distanceToBottom = rect.height - localY;

            let edge: ResizeEdge = "right";
            let best = distanceToRight;

            if (distanceToLeft < best) {
                best = distanceToLeft;
                edge = "left";
            }
            if (distanceToTop < best) {
                best = distanceToTop;
                edge = "top";
            }
            if (distanceToBottom < best) {
                edge = "bottom";
            }

            handleStartResize(instance.id, edge, event);
        };

        const status = instance.status.toLowerCase();
        const hasSocketError =
            status.includes("socket error") ||
            status.includes("connection failed") ||
            status.includes("disconnected");
        const indicatorClass = hasSocketError
            ? "bg-rose-400"
            : "bg-emerald-400";
        const gap = config.gap;
        const borderWidth = config.borderWidth;
        const borderColor = isActive
            ? config.activeBorderColor
            : config.borderColor;
        const baseOpacity = instance.kind === "terminal"
            ? config.terminalOpacity
            : 1;
        const paneOpacity = (isDragging ? 0.7 : 1) * baseOpacity;

        const maximizedWidth = Math.max(
            0,
            Math.round(
                ui.visualViewportWidth || ui.innerWidth || windowManager.size.width,
            ),
        );
        const maximizedHeight = Math.max(
            0,
            Math.round(ui.visibleHeight || ui.innerHeight || windowManager.size.height),
        );
        const maximizedLeft = Math.round(ui.visualViewportOffsetLeft || 0);
        const maximizedTop = Math.round(ui.visualViewportOffsetTop || 0);

        const paneStyle: CSSProperties = {
            left: instance.isMaximized
                ? maximizedLeft
                : instance.x + gap / 2,
            top: instance.isMaximized
                ? maximizedTop
                : instance.y + gap / 2,
            width: instance.isMaximized
                ? maximizedWidth
                : Math.max(0, instance.width - gap),
            height: instance.isMaximized
                ? maximizedHeight
                : Math.max(0, instance.height - gap),
            border: `${borderWidth} solid ${borderColor}`,
            borderRadius: `${config.borderRadius}px`,
            boxShadow: config.shadowStyle,
            background:
                instance.kind === "terminal"
                    ? config.terminalColor
                    : undefined,
            backdropFilter:
                instance.kind === "terminal"
                    ? `blur(${config.terminalBlur}px)`
                    : undefined,
            WebkitBackdropFilter:
                instance.kind === "terminal"
                    ? `blur(${config.terminalBlur}px)`
                    : undefined,
        };

        useEffect(() => {
            if (instance.kind !== "terminal" || !instance.terminal) {
                return;
            }

            // Allow time for any animations to finish:
            setTimeout(instance.terminal.syncSize, 100);
        }, [
            instance.kind,
            instance.terminal,
            instance.isMaximized,
            maximizedWidth,
            maximizedHeight,
            maximizedTop,
            maximizedLeft,
            config.showTitleBar,
        ]);

        return (
            <motion.div
                className={cn(
                    "flex flex-col",
                    "text-high",
                    "overflow-hidden",
                    {
                        absolute: !instance.isMaximized,
                        fixed: instance.isMaximized,
                        "z-[1000]": instance.isMaximized,
                        "z-[60]": !instance.isMaximized && isDragging,
                        "bg-zinc-900": instance.kind === "browser",
                        "cursor-grabbing": isDragging,
                        "cursor-grab": !isDragging && Boolean(isCtrlDown),
                    },
                )}
                onMouseEnter={() => {
                    windowManager.setActive(instance.id);
                }}
                onPointerDown={() => {
                    windowManager.setActive(instance.id);
                    instance.focus();
                }}
                onMouseDown={(event) => {
                    handleModRightClickResize(event);

                    if (!event.ctrlKey || event.button !== 0) {
                        return;
                    }

                    onStartDrag?.(instance.id, event);
                }}
                onContextMenu={(event) => {
                    if (event.ctrlKey || event.metaKey) {
                        event.preventDefault();
                    }
                }}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{
                    opacity: paneOpacity,
                    scale: 1,
                    x: dragX,
                    y: dragY,
                }}
                style={paneStyle}
            >
                <WindowBorder
                    instance={instance}
                    onStartResize={handleStartResize}
                />

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
                        containerRef={containerRef as any}
                    />
                )}
            </motion.div>
        );
    },
);

export default WindowPane;
