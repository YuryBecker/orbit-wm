import { useEffect } from "react";

import useHotkeys, { useModKey } from "@/hooks/hot-keys";
import { windowManager } from "@/state";


export const useWindowManagerKeys = () => {
    useHotkeys([
        {
            key: "Enter",
            mod: true,
            onTrigger: (event) => {
                event.preventDefault();
                windowManager.createTerminalWindow();
            },
        },
        {
            key: "ArrowLeft",
            mod: true,
            shift: true,
            onTrigger: (event) => {
                event.preventDefault();
                windowManager.swapNeighbor("left");
            },
        },
        {
            key: "ArrowRight",
            mod: true,
            shift: true,
            onTrigger: (event) => {
                event.preventDefault();
                windowManager.swapNeighbor("right");
            },
        },
        {
            key: "ArrowUp",
            mod: true,
            shift: true,
            onTrigger: (event) => {
                event.preventDefault();
                windowManager.swapNeighbor("up");
            },
        },
        {
            key: "ArrowDown",
            mod: true,
            shift: true,
            onTrigger: (event) => {
                event.preventDefault();
                windowManager.swapNeighbor("down");
            },
        },
        {
            key: "ArrowLeft",
            mod: true,
            onTrigger: (event) => {
                event.preventDefault();
                windowManager.focusNeighbor("left");
            },
        },
        {
            key: "ArrowRight",
            mod: true,
            onTrigger: (event) => {
                event.preventDefault();
                windowManager.focusNeighbor("right");
            },
        },
        {
            key: "ArrowUp",
            mod: true,
            onTrigger: (event) => {
                event.preventDefault();
                windowManager.focusNeighbor("up");
            },
        },
        {
            key: "ArrowDown",
            mod: true,
            onTrigger: (event) => {
                event.preventDefault();
                windowManager.focusNeighbor("down");
            },
        },
        {
            key: "KeyH",
            mod: true,
            shift: true,
            onTrigger: (event) => {
                event.preventDefault();
                windowManager.swapNeighbor("left");
            },
        },
        {
            key: "KeyL",
            mod: true,
            shift: true,
            onTrigger: (event) => {
                event.preventDefault();
                windowManager.swapNeighbor("right");
            },
        },
        {
            key: "KeyK",
            mod: true,
            shift: true,
            onTrigger: (event) => {
                event.preventDefault();
                windowManager.swapNeighbor("up");
            },
        },
        {
            key: "KeyJ",
            mod: true,
            shift: true,
            onTrigger: (event) => {
                event.preventDefault();
                windowManager.swapNeighbor("down");
            },
        },
        {
            key: "h",
            mod: true,
            onTrigger: (event) => {
                event.preventDefault();
                windowManager.focusNeighbor("left");
            },
        },
        {
            key: "l",
            mod: true,
            onTrigger: (event) => {
                event.preventDefault();
                windowManager.focusNeighbor("right");
            },
        },
        {
            key: "k",
            mod: true,
            onTrigger: (event) => {
                event.preventDefault();
                windowManager.focusNeighbor("up");
            },
        },
        {
            key: "j",
            mod: true,
            onTrigger: (event) => {
                event.preventDefault();
                windowManager.focusNeighbor("down");
            },
        },
        {
            key: "q",
            mod: true,
            onTrigger: (event) => {
                event.preventDefault();
                windowManager.active?.close();
            },
        },
    ]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (!event.metaKey && !event.ctrlKey) {
                return;
            }

            if (event.shiftKey || event.altKey) {
                return;
            }

            const match = event.code.match(/^Digit([1-9])$/);
            if (!match?.[1]) {
                return;
            }

            const layoutNumber = Number.parseInt(match[1], 10);
            if (!Number.isFinite(layoutNumber)) {
                return;
            }

            event.preventDefault();
            void windowManager.openLayoutByIndex(layoutNumber);
        };

        window.addEventListener("keydown", onKeyDown, { capture: true });

        return () => {
            window.removeEventListener("keydown", onKeyDown, { capture: true });
        };
    }, []);

    const isModKeyDown = useModKey();

    return isModKeyDown;
};
