"use client";

import type { RefObject } from "react";
import { observer } from "mobx-react";

import config from "state/config";


type TerminalProps = {
    instance: Instance.WindowPane;
    containerRef: RefObject<HTMLDivElement>;
};

const Terminal = observer(({ instance, containerRef }: TerminalProps) => {
    const terminal = instance.terminal;

    return (
        <>
            <div
                className="flex-1 overflow-hidden"
                style={{
                    padding: `${config.terminalPadding}px`,
                    opacity: terminal?.isMirrored ? 0 : 1,
                    pointerEvents: terminal?.isMirrored ? "none" : "auto",
                }}
            >
                <div
                    ref={containerRef}
                    className="h-full w-full overflow-hidden"
                />
            </div>
        </>
    );
});

export default Terminal;
