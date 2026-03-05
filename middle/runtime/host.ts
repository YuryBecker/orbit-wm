import { spawn } from "node-pty";

import type { IPty } from "node-pty";

import createTmuxManager from "../utils/tmux";

import type { RuntimeCreateResult, SessionRuntime } from "./types";



const DEFAULT_COLS = 120;
const DEFAULT_ROWS = 30;

const createHostRuntime = (): SessionRuntime => {
    const tmux = createTmuxManager();

    const spawnPty = (sessionId: string): IPty =>
        spawn(tmux.binary, tmux.getAttachArgs(sessionId), {
            name: "xterm-256color",
            cols: DEFAULT_COLS,
            rows: DEFAULT_ROWS,
            cwd: process.cwd(),
            env: process.env as NodeJS.ProcessEnv,
        });

    const createSession = (sessionId: string): RuntimeCreateResult => {
        tmux.ensureSession(sessionId);
        const pty = spawnPty(sessionId);

        return {
            runtimeSessionId: sessionId,
            pty,
        };
    };

    return {
        kind: "host",
        configure: tmux.configure,
        prewarmSession: () => ({
            created: false,
            runtimeSessionId: null,
        }),
        createSession: (sessionId: string) => createSession(sessionId),
        attachSession: (sessionId: string) => spawnPty(sessionId),
        hasSession: (sessionId: string) => tmux.hasSession(sessionId),
        destroySession: (sessionId: string) => {
            tmux.killSession(sessionId);
        },
    };
};

export default createHostRuntime;
