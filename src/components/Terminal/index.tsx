"use client";

import type { RefObject } from "react";
import { observer } from "mobx-react";

import config from "state/config";


type TerminalProps = {
    instance: Instance.WindowPane;
    containerRef: RefObject<HTMLDivElement>;
};

const Terminal = observer(({ containerRef }: TerminalProps) => (
    <>
        <div
            className="flex-1 overflow-hidden"
            style={{
                padding: `${config.terminalPadding}px`,
            }}
        >
            <div
                ref={containerRef}
                className="h-full w-full overflow-hidden"
            />
        </div>
    </>
));

export default Terminal;
