import type { Application } from "express";
import type { Request, RequestHandler } from "express";

import type { AuthPrincipal } from "../auth";
import type { SessionRuntime } from "../runtime";



type TerminalDependencies = {
    app: Application;
    runtime: SessionRuntime;
    requireControl: RequestHandler;
    getPrincipal: (req: Request) => AuthPrincipal | null;
};

const resolveRuntimeGroupId = (principal: AuthPrincipal | null) => {
    if (!principal) {
        return "anonymous";
    }

    if (principal.kind === "host") {
        return `host:${principal.userId || "local"}`;
    }

    return `user:${principal.userId || "unknown"}`;
};

/* ---- Routes ---- */
const registerTerminalRoutes = (dependencies: TerminalDependencies) => {
    const { app, runtime, requireControl, getPrincipal } = dependencies;

    app.post("/api/runtime/prewarm", requireControl, (req, res) => {
        try {
            const principal = getPrincipal(req);
            const runtimeGroupId = resolveRuntimeGroupId(principal);
            const result = runtime.prewarmSession({
                runtimeGroupId,
            });
            res.status(200).json({
                ok: true,
                runtime: runtime.kind,
                created: result.created,
            });
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : "Failed to prewarm runtime.";
            res.status(500).json({ error: message });
        }
    });
};

export type { TerminalDependencies };
export { registerTerminalRoutes };
