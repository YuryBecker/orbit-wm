import { useEffect } from "react";

import mirrorTerminal from "state/mirror-terminal";
import { windowManager } from "state";


const MAX_LONG_EDGE = 980;
const MIN_ASPECT_RATIO = 0.7;
const MAX_ASPECT_RATIO = 1.45;

const getViewportMetrics = () => {
    const viewport = window.visualViewport;

    return {
        width: viewport?.width ?? window.innerWidth,
        height: viewport?.height ?? window.innerHeight,
        top: viewport?.offsetTop ?? 0,
    };
};

const shouldUseMirrorMode = (width: number, height: number) => {
    if (width <= 0 || height <= 0) {
        return false;
    }

    const longEdge = Math.max(width, height);
    const aspectRatio = width / height;

    return (
        longEdge <= MAX_LONG_EDGE &&
        aspectRatio >= MIN_ASPECT_RATIO &&
        aspectRatio <= MAX_ASPECT_RATIO
    );
};

export const useMirrorTerminal = () => {
    useEffect(() => {
        const sync = () => {
            const activeWindow = windowManager.active;
            const activeTerminal =
                activeWindow?.kind === "terminal"
                    ? activeWindow.terminal
                    : null;

            if (!activeTerminal) {
                mirrorTerminal.reset();
                return;
            }

            const metrics = getViewportMetrics();
            if (shouldUseMirrorMode(metrics.width, metrics.height)) {
                mirrorTerminal.activate(
                    activeTerminal,
                    metrics.top,
                    metrics.height,
                );
                return;
            }

            mirrorTerminal.clearFrom(activeTerminal);
        };

        sync();

        const viewport = window.visualViewport;
        viewport?.addEventListener("resize", sync);
        viewport?.addEventListener("scroll", sync);
        window.addEventListener("resize", sync);

        return () => {
            viewport?.removeEventListener("resize", sync);
            viewport?.removeEventListener("scroll", sync);
            window.removeEventListener("resize", sync);
            mirrorTerminal.reset();
        };
    }, [windowManager.activeId]);
};
