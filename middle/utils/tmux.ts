import { execFileSync } from "child_process";



const TMUX_BINARY = process.env.ORBIT_TMUX_BIN || "tmux";
const TMUX_SERVER = process.env.ORBIT_TMUX_SERVER || "orbit";
const SESSION_PREFIX = "orbit-";

/* ---- Helpers ---- */
const resolveSessionName = (sessionId: string) =>
    `${SESSION_PREFIX}${sessionId}`;

const buildArgs = (args: string[]) => ["-L", TMUX_SERVER, ...args];

const runTmux = (args: string[]) => {
    execFileSync(TMUX_BINARY, buildArgs(args), { stdio: "ignore" });
};

const configureTmux = () => {
    try {
        runTmux(["set-option", "-g", "status", "off"]);
        runTmux(["set-option", "-g", "pane-border-status", "off"]);
        runTmux(["set-option", "-g", "pane-border-style", "fg=default"]);
        runTmux(["set-option", "-g", "pane-active-border-style", "fg=default"]);
    } catch {
        return;
    }
};

/* ---- Session Control ---- */
const hasSession = (sessionId: string) => {
    try {
        runTmux(["has-session", "-t", resolveSessionName(sessionId)]);
        return true;
    } catch {
        return false;
    }
};

const ensureSession = (sessionId: string) => {
    if (hasSession(sessionId)) {
        return;
    }

    runTmux(["new-session", "-d", "-s", resolveSessionName(sessionId)]);
};

const killSession = (sessionId: string) => {
    try {
        runTmux(["kill-session", "-t", resolveSessionName(sessionId)]);
    } catch {
        return;
    }
};

const getAttachArgs = (sessionId: string) =>
    buildArgs(["attach-session", "-t", resolveSessionName(sessionId)]);

const createTmuxManager = () => ({
    binary: TMUX_BINARY,
    configure: configureTmux,
    ensureSession,
    hasSession,
    killSession,
    getAttachArgs,
});

export default createTmuxManager;
export { resolveSessionName };
