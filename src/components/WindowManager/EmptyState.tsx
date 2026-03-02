"use client";

import { observer } from "mobx-react";

import windowManager from "state/window-manager";


const EmptyState = observer(() => {
    const showEmptyState = windowManager.ready && windowManager.all.length === 0;

    if (!showEmptyState) return null;

    return (
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

    );
});

export default EmptyState;

