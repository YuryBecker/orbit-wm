import type { Application } from "express";



type TerminalDependencies = {
    app: Application;
};

/* ---- Routes ---- */
const registerTerminalRoutes = (_dependencies: TerminalDependencies) => {
    return;
};

export type { TerminalDependencies };
export { registerTerminalRoutes };
