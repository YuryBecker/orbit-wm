import useHotkeys from "@/hooks/useHotkeys";
import { windowManager } from "@/state";


export const useWindowManagerKeys = () => {
    const createWindow = async () => {
        await windowManager.createWindowWithSession();
    };

    useHotkeys([
        {
            key: "Enter",
            mod: true,
            onTrigger: (event) => {
                event.preventDefault();
                createWindow();
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

};
