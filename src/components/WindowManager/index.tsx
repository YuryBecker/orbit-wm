"use client";

import { observer } from "mobx-react";
import { useEffect, useRef, useState } from "react";

import { clients, windowManager } from "state";
import config from "state/config";
import ClientsDialog from "@/components/ClientsDialog";
import PairDeviceDialog from "@/components/PairDeviceDialog";
import MainMenu from "@/components/MainMenu";
import WindowPane from "@/components/WindowPane";
import LayoutPagination from "./LayoutPagination";
import { useWindowManagerKeys } from "./keys";
import Wallpaper from "./Wallpaper";
import EmptyState from "./EmptyState";


const WindowManager = observer(() => {
    const ref = useRef<HTMLDivElement | null>(null);
    const bootstrappedRef = useRef(false);
    const dragIdRef = useRef<string | null>(null);
    const dragStartRef = useRef<{ x: number; y: number } | null>(null);
    const [activeDragId, setActiveDragId] = useState<string | null>(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    // Initialize auth/device access state:
    useEffect(() => {
        void clients.bootstrap();
    }, []);

    useEffect(() => {
        if (!clients.ready || !clients.hasAccess || bootstrappedRef.current) {
            return;
        }

        bootstrappedRef.current = true;
        void windowManager.bootstrap();
    }, [clients.ready, clients.hasAccess]);

    // Shortcut keys:
    const isModKeyDown = useWindowManagerKeys();

    // Update layout size:
    useEffect(() => {
        const element = ref.current;

        if (!element) return;

        const resizeObserver = new ResizeObserver(() => {
            windowManager.setSize(element.getBoundingClientRect());
        });

        resizeObserver.observe(element);
        windowManager.setSize(element.getBoundingClientRect());

        return () => {
            resizeObserver.disconnect();
        };
    }, []);

    useEffect(() => {
        windowManager.computeLayout();
    }, [config.gap]);

    const handleStartDrag = (
        id: string,
        event: React.MouseEvent<HTMLDivElement>,
    ) => {
        if (dragIdRef.current || event.button !== 0) return;

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

    const findDropTarget = (clientX: number, clientY: number) => {
        const element = ref.current;
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

    return (
        <div
            ref={ref}
            className="relative w-svw h-svh"
        >
            <Wallpaper/>

            <MainMenu />
            <LayoutPagination />
            <ClientsDialog />
            <PairDeviceDialog />

            <EmptyState/>

            {clients.ready && !clients.hasAccess ? (
                <div className="absolute inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-6 text-zinc-100 max-w-md w-[92%]">
                        <h2 className="text-lg font-semibold">Waiting for approval</h2>
                        <p className="mt-2 text-sm text-zinc-400">
                            This device is not authorized yet. A request was sent to the host machine.
                        </p>
                        {clients.pendingRequestId ? (
                            <p className="mt-3 text-xs text-zinc-500">
                                Request ID: {clients.pendingRequestId}
                            </p>
                        ) : null}
                    </div>
                </div>
            ) : null}

            { windowManager.all.map(instance =>
                <WindowPane
                    instance={instance}
                    onStartDrag={handleStartDrag}
                    activeDragId={activeDragId}
                    isModKeyDown={isModKeyDown}
                    dragOffset={dragOffset}
                    key={instance.id}
                />,
            ) }
        </div>
    );
});

export default WindowManager;
