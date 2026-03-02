import { useEffect, useRef, useState } from "react";

import config from "state/config";


type Hotkey = {
    key: string;
    mod?: boolean;
    shift?: boolean;
    allowRepeat?: boolean;
    onTrigger: (event: KeyboardEvent) => void;
};

const isModPressed = (event: KeyboardEvent) => {
    switch (config.modKey) {

    case "ctrlKey":
        return event.ctrlKey;
    case "metaKey":
        return event.metaKey;
    case "altKey":
        return event.altKey;
    case "shiftKey":
        return event.shiftKey;
    }
};

export const useModKey = () => {
    const [isModKeyDown, setIsModKeyDown] = useState(false);

    useEffect(() => {
        const abortController = new AbortController();

        window.addEventListener("keydown", e => {
            if (e.ctrlKey) setIsModKeyDown(true);
        }, { signal: abortController.signal });

        window.addEventListener("keyup", e => {
            if (e.ctrlKey) setIsModKeyDown(false);
        }, { signal: abortController.signal });

        return () => {
            abortController.abort();
        };
    }, []);

    return isModKeyDown;
};

const useHotkeys = (hotkeys: Hotkey[]) => {
    const hotkeysRef = useRef(hotkeys);

    useEffect(() => {
        hotkeysRef.current = hotkeys;
    }, [hotkeys]);

    useEffect(() => {
        const handler = (event: KeyboardEvent) => {
            let bestSpecificity = -1;
            const matches: Hotkey[] = [];

            for (const hotkey of hotkeysRef.current) {
                if (!hotkey.allowRepeat && event.repeat) {
                    continue;
                }

                if (hotkey.mod && !isModPressed(event)) {
                    continue;
                }

                if (
                    typeof hotkey.shift === "boolean" &&
                    event.shiftKey !== hotkey.shift
                ) {
                    continue;
                }

                const matchesKey =
                    event.key === hotkey.key ||
                    event.code === hotkey.key ||
                    (hotkey.key === "Enter" &&
                        event.code === "NumpadEnter");
                if (!matchesKey) {
                    continue;
                }

                const specificity =
                    (typeof hotkey.mod === "boolean" ? 1 : 0) +
                    (typeof hotkey.shift === "boolean" ? 1 : 0);

                if (specificity > bestSpecificity) {
                    bestSpecificity = specificity;
                    matches.length = 0;
                    matches.push(hotkey);
                } else if (specificity === bestSpecificity) {
                    matches.push(hotkey);
                }
            }

            for (const hotkey of matches) {
                hotkey.onTrigger(event);
            }
        };

        window.addEventListener("keydown", handler, { capture: true });

        return () => {
            window.removeEventListener("keydown", handler, { capture: true });
        };
    }, []);
};

export type { Hotkey };
export default useHotkeys;
