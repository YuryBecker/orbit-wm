"use client";

import { observer } from "mobx-react";
import { useEffect } from "react";

import { ui } from "state";
import { cn } from "@/lib/cn";


const DebugUI = observer(() => {
    useEffect(() => {
        ui.start();

        return () => {
            ui.stop();
        };
    }, []);

    return (
        <div
            className={cn(
                "hidden",
                "fixed bottom-2 left-2 z-[9999]",
                "pointer-events-none",
            )}
        >
            <div
                className={cn(
                    "flex flex-col",
                    "w-fit px-2 py-1.5",
                    "text-[10px] leading-tight text-high",
                    "bg-black/65",
                    "rounded-md border border-white/20 shadow-lg backdrop-blur-sm",
                )}
            >
                <div
                    className={cn(
                        "text-high font-semibold tracking-wide",
                    )}
                >
                    UI
                </div>
                <div>visibleH: {ui.visibleHeight}px</div>
                <div>vvH: {Math.round(ui.visualViewportHeight)}px</div>
                <div>innerH: {Math.round(ui.innerHeight)}px</div>
                <div>kbH: {ui.keyboardHeightEstimate}px ({ui.isKeyboardOpen ? "open" : "closed"})</div>
            </div>
        </div>
    );
});


export default DebugUI;
