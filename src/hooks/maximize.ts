import { useEffect } from "react";

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

const shouldMaximize = (width: number, height: number) => {
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

/** Maximizes an active window pane if the screen because small enough.
 * This is especially useful for when a mobile keyboard opens and hides the bottom of a terminal. 
 * This should maximize to the space between the top and the top of the keyboard.
 * */
export const useAutoMaximize = () => {
    useEffect(() => {
        const toggle = () => {
            if (!windowManager.activeTerminal) return;

            const metrics = getViewportMetrics();

            if (shouldMaximize(metrics.width, metrics.height)) {
                windowManager.maximizeActive();
                return
            }

            windowManager.unmaximizeAll()
        };

        toggle();

        const viewport = window.visualViewport;
        viewport?.addEventListener("resize", toggle);
        viewport?.addEventListener("scroll", toggle);
        window.addEventListener("resize", toggle);

        return () => {
            viewport?.removeEventListener("resize", toggle);
            viewport?.removeEventListener("scroll", toggle);
            window.removeEventListener("resize", toggle);
        };
    }, [windowManager.activeId]);
};
