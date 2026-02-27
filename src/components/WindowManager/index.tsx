"use client";

import { comparer, reaction } from "mobx";
import { observer } from "mobx-react";
import { useEffect, useRef, useState } from "react";

import { windowManager } from "state";
import config from "state/config";
import useHotkeys from "@/hooks/useHotkeys";

import MainMenu from "@/components/MainMenu";
import WindowPane from "@/components/WindowPane";
import { useWindowManagerKeys } from "./keys";


const WindowManager = observer(() => {
    const workspaceRef = useRef<HTMLDivElement | null>(null);
    const dragIdRef = useRef<string | null>(null);
    const dragStartRef = useRef<{ x: number; y: number } | null>(null);
    const [activeDragId, setActiveDragId] = useState<string | null>(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [isCtrlDown, setIsCtrlDown] = useState(false);

    const findDropTarget = (clientX: number, clientY: number) => {
        const element = workspaceRef.current;
        if (!element) {
            return null;
        }

        const rect = element.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;

        return (
            windowManager.all.find(
                (instance) =>
                    x >= instance.x &&
                    x <= instance.x + instance.width &&
                    y >= instance.y &&
                    y <= instance.y + instance.height,
            ) || null
        );
    };

    const handleStartDrag = (
        id: string,
        event: React.MouseEvent<HTMLDivElement>,
    ) => {
        if (dragIdRef.current) {
            return;
        }

        if (event.button !== 0) {
            return;
        }

        event.preventDefault();
        dragIdRef.current = id;
        setActiveDragId(id);
        dragStartRef.current = { x: event.clientX, y: event.clientY };
        setDragOffset({ x: 0, y: 0 });

        const handleMouseUp = (mouseupEvent: MouseEvent) => {
            const draggingId = dragIdRef.current;
            dragIdRef.current = null;
            setActiveDragId(null);
            dragStartRef.current = null;
            setDragOffset({ x: 0, y: 0 });

            window.removeEventListener("mouseup", handleMouseUp);
            window.removeEventListener("mousemove", handleMouseMove);

            if (!draggingId) {
                return;
            }

            const target = findDropTarget(
                mouseupEvent.clientX,
                mouseupEvent.clientY,
            );

            if (!target || target.id === draggingId) {
                return;
            }

            windowManager.swapWindows(draggingId, target.id);
        };

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const start = dragStartRef.current;
            if (!start) {
                return;
            }

            setDragOffset({
                x: moveEvent.clientX - start.x,
                y: moveEvent.clientY - start.y,
            });
        };

        window.addEventListener("mouseup", handleMouseUp);
        window.addEventListener("mousemove", handleMouseMove);
    };

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Control") {
                setIsCtrlDown(true);
            }
        };

        const handleKeyUp = (event: KeyboardEvent) => {
            if (event.key === "Control") {
                setIsCtrlDown(false);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("keyup", handleKeyUp);
        };
    }, []);
    const createWindow = async () => {
        await windowManager.createWindowWithSession();
    };

    useWindowManagerKeys();

    useEffect(() => {
        windowManager.bootstrap();
    }, []);

    useEffect(() => {
        if (!windowManager.sessionId) {
            return;
        }

        const dispose = reaction(
            () => windowManager.serialized,
            (data) => {
                const isActive = windowManager.all.length > 0;
                if (!windowManager.sessionId) {
                    return;
                }

                windowManager.patchSession(windowManager.sessionId, data, isActive);
            },
            { equals: comparer.structural, fireImmediately: true },
        );

        return () => {
            dispose();
        };
    }, [windowManager.sessionId]);

    const syncWorkspace = () => {
        const element = workspaceRef.current;
        if (!element) {
            return;
        }

        const rect = element.getBoundingClientRect();
        const gap = config.gap;
        const inset = gap / 2;
        windowManager.setWorkspace({
            x: inset,
            y: inset,
            width: Math.max(0, rect.width - gap),
            height: Math.max(0, rect.height - gap),
        });
    };

    useEffect(() => {
        const element = workspaceRef.current;
        if (!element) {
            return;
        }

        const resizeObserver = new ResizeObserver(() => {
            syncWorkspace();
        });

        resizeObserver.observe(element);
        syncWorkspace();

        return () => {
            resizeObserver.disconnect();
        };
    }, []);

    useEffect(() => {
        const dispose = reaction(
            () => windowManager.all.length,
            () => {
                requestAnimationFrame(() => {
                    syncWorkspace();
                });
            },
        );

        return () => {
            dispose();
        };
    }, []);

    useEffect(() => {
        syncWorkspace();
    }, [config.gap]);

    const showEmptyState = windowManager.ready && windowManager.all.length === 0;
    const wallpaperStyle = config.wallpaperStyle;

    const [viewportHeight, setViewportHeight] = useState<number | null>(null);

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        const updateViewport = () => {
            const height = window.visualViewport?.height ?? window.innerHeight;
            setViewportHeight(height);
        };

        updateViewport();
        window.visualViewport?.addEventListener("resize", updateViewport);
        window.addEventListener("resize", updateViewport);

        return () => {
            window.visualViewport?.removeEventListener("resize", updateViewport);
            window.removeEventListener("resize", updateViewport);
        };
    }, []);

    return (
        <div
            ref={workspaceRef}
            className="relative w-screen"
            style={{
                height: viewportHeight ? `${viewportHeight}px` : undefined,
            }}
        >
            <div className="absolute right-5 top-5 z-50">
                <MainMenu />
            </div>

            {showEmptyState && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-black/40 px-6 py-5 text-white">
                        <div className="text-xs uppercase tracking-[0.3em] text-white/50">
                            Orbit
                        </div>

                        <div className="text-xs text-white/60">
                            Use Ctrl + Enter to create a terminal
                        </div>
                    </div>
                </div>
            )}

            {windowManager.all.map((instance) => (
                <WindowPane
                    key={instance.id}
                    instance={instance}
                    onStartDrag={handleStartDrag}
                    activeDragId={activeDragId}
                    isCtrlDown={isCtrlDown}
                    dragOffset={dragOffset}
                />
            ))}

            <img
                className='w-full h-full'
                alt='whatever'
                src='/wallpapers/342544.jpg'
            />


        </div>
    );
});

export default WindowManager;
