"use client";

import type { RefObject } from "react";
import { observer } from "mobx-react";

import config from "state/config";
import WindowInstance from "state/window-manager/instance";



type TerminalProps = {
    instance: WindowInstance;
    containerId: string;
    containerRef: RefObject<HTMLDivElement>;
};

const Terminal = observer(({ containerId, containerRef }: TerminalProps) => (
    <div
        className="flex-1 overflow-hidden"
        style={{
            padding: `${config.terminalPadding}px`,
        }}
    >
        <div
            id={containerId}
            ref={containerRef}
            className="h-full w-full overflow-hidden"
        />
    </div>
));

export default Terminal;
