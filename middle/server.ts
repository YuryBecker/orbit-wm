import cors from "cors";
import express from "express";
import { Server } from "socket.io";
import http from "http";

import createTerminalNamespace from "./ws";
import createDatabase from "./utils/db";
import createRuntime from "./runtime";
import { createAuthHelpers } from "./auth";
import {
    registerConfigRoutes,
    registerSessionRoutes,
    registerSecurityRoutes,
    registerTerminalRoutes,
    registerWallpaperRoutes,
} from "./api";
import { destroySession } from "./api/session";
import type { Session, SessionDependencies } from "./api/session";


/* ---- Configuration ---- */
const PORT = Number(process.env.MIDDLE_PORT || 4001);
const HOST = process.env.MIDDLE_HOST || "127.0.0.1";
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN;
const allowedOrigins = CLIENT_ORIGIN
    ? CLIENT_ORIGIN.split(",").map((origin) => origin.trim())
    : null;
const SANDBOX_IDLE_TIMEOUT_MS = Number(
    process.env.ORBIT_SANDBOX_IDLE_TIMEOUT_MS || 15 * 60 * 1000,
);
const SANDBOX_TTL_MS = Number(
    process.env.ORBIT_SANDBOX_TTL_MS || 60 * 60 * 1000,
);
const SANDBOX_CLEANUP_INTERVAL_MS = Number(
    process.env.ORBIT_SANDBOX_CLEANUP_INTERVAL_MS || 30_000,
);
const ACTIVITY_DEBOUNCE_MS = Number(
    process.env.ORBIT_SANDBOX_ACTIVITY_DEBOUNCE_MS || 5_000,
);
const ORBIT_ACCESS_MODE = (process.env.ORBIT_ACCESS_MODE || "").toLowerCase();

/* ---- Database ---- */
const db = createDatabase();
const auth = createAuthHelpers(db);

/* ---- HTTP App ---- */
const app = express();
app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin || !allowedOrigins) {
                callback(null, true);
                return;
            }

            if (allowedOrigins.includes(origin)) {
                callback(null, true);
                return;
            }

            callback(new Error("Origin not allowed by CORS"));
        },
        methods: ["GET", "POST", "PATCH", "DELETE"],
    }),
);
app.use(express.json());
app.use(auth.attachPrincipal);

/* ---- WebSockets ---- */
const server = http.createServer(app);
server.keepAliveTimeout = 300000;
server.headersTimeout = 301000;
server.requestTimeout = 0;
const io = new Server(server, {
    cors: {
        origin: (origin, callback) => {
            if (!origin || !allowedOrigins) {
                callback(null, true);
                return;
            }

            if (allowedOrigins.includes(origin)) {
                callback(null, true);
                return;
            }

            callback(new Error("Origin not allowed by CORS"));
        },
        methods: ["GET", "POST", "PATCH", "DELETE"],
    },
});

/* ---- Runtime ---- */
const runtime = createRuntime();
runtime.configure();
const accessMode =
    ORBIT_ACCESS_MODE === "auto" || ORBIT_ACCESS_MODE === "approval"
        ? ORBIT_ACCESS_MODE
        : (runtime.kind === "docker" ? "auto" : "approval");

/* ---- In-memory Session State ---- */
const sessions = new Map<string, Session>();
const markSessionActivityStatement = db.prepare(
    "UPDATE sessions SET lastActivityAt = ?, updatedAt = ? WHERE id = ?",
);

const getSession = (sessionId: string) => sessions.get(sessionId) || restoreSession(sessionId);

const namespace = createTerminalNamespace(io, sessions, getSession, {
    resolvePrincipal: auth.resolvePrincipal,
    getBearerToken: auth.getBearerToken,
    onActivity: (() => {
        const lastWrites = new Map<string, number>();

        return (sessionId: string) => {
            const current = Date.now();
            const last = lastWrites.get(sessionId) || 0;
            if (current - last < ACTIVITY_DEBOUNCE_MS) {
                return;
            }

            lastWrites.set(sessionId, current);
            const timestamp = new Date(current).toISOString();
            markSessionActivityStatement.run(timestamp, timestamp, sessionId);
        };
    })(),
});

const restoreSession = (sessionId: string) => {
    const row = db
        .prepare("SELECT id, name, runtimeType, runtimeSessionId, createdAt FROM sessions WHERE id = ?")
        .get(sessionId) as {
            id: string;
            name: string;
            runtimeType: string | null;
            runtimeSessionId: string | null;
            createdAt: string;
        } | undefined;
    if (!row) {
        return null;
    }
    const expectedRuntimeType = row.runtimeType || "host";
    if (expectedRuntimeType !== runtime.kind) {
        return null;
    }

    const runtimeSessionId = row.runtimeSessionId || row.id;
    if (!runtime.hasSession(sessionId, runtimeSessionId)) {
        return null;
    }

    const pty = runtime.attachSession(sessionId, runtimeSessionId);
    const session: Session = {
        id: row.id,
        name: row.name,
        createdAt: row.createdAt,
        runtimeType: runtime.kind,
        runtimeSessionId,
        pty,
    };
    sessions.set(sessionId, session);
    namespace.attachPty(sessionId, pty);
    return session;
};


/* ---- Route Registration ---- */
const sessionDependencies: SessionDependencies = {
    app,
    db,
    sessions,
    requireAuth: auth.requireAuth,
    requireControl: auth.requireControl,
    getPrincipal: auth.getPrincipal,
    attachPty: namespace.attachPty,
    runtime,
    accessMode,
};

registerSessionRoutes(sessionDependencies);
registerTerminalRoutes({
    app,
    runtime,
    requireControl: auth.requireControl,
    getPrincipal: auth.getPrincipal,
});
registerConfigRoutes({
    app,
    db,
    requireAuth: auth.requireAuth,
    requireControl: auth.requireControl,
});
registerWallpaperRoutes({
    app,
    requireControl: auth.requireControl,
    accessMode,
});
registerSecurityRoutes({
    app,
    db,
    requireControl: auth.requireControl,
    getRequestIp: auth.getRequestIp,
    createToken: auth.createToken,
    sha256: auth.sha256,
    randomToken: auth.randomToken,
    now: auth.now,
    accessMode,
});

/* ---- Sandbox Cleanup ---- */
const parseIsoMs = (value: string | null | undefined) => {
    if (!value) {
        return NaN;
    }

    return Date.parse(value);
};

if (runtime.kind === "docker") {
    const cleanup = () => {
        const rows = db
            .prepare(
                "SELECT id, runtimeSessionId, createdAt, lastActivityAt FROM sessions WHERE runtimeType = 'docker'",
            )
            .all() as {
                id: string;
                runtimeSessionId: string | null;
                createdAt: string;
                lastActivityAt: string | null;
            }[];

        const current = Date.now();
        for (const row of rows) {
            const createdAtMs = parseIsoMs(row.createdAt);
            const lastActivityMs = parseIsoMs(row.lastActivityAt) || createdAtMs;
            const isTtlExpired =
                Number.isFinite(createdAtMs) &&
                SANDBOX_TTL_MS > 0 &&
                current - createdAtMs >= SANDBOX_TTL_MS;
            const isIdleExpired =
                Number.isFinite(lastActivityMs) &&
                SANDBOX_IDLE_TIMEOUT_MS > 0 &&
                current - lastActivityMs >= SANDBOX_IDLE_TIMEOUT_MS;

            if (!isTtlExpired && !isIdleExpired) {
                continue;
            }

            const reason = isTtlExpired ? "ttl-expired" : "idle-expired";
            console.log(`[sandbox-cleanup] Destroying ${row.id} (${reason})`);
            destroySession(sessionDependencies, row.id);
        }
    };

    const timer = setInterval(
        cleanup,
        Math.max(1_000, SANDBOX_CLEANUP_INTERVAL_MS),
    );
    timer.unref();
}

/* ---- Graceful Shutdown ---- */
let isShuttingDown = false;

const destroyDockerSessionsOnShutdown = () => {
    if (runtime.kind !== "docker") {
        return;
    }

    const rows = db
        .prepare(
            "SELECT id FROM sessions WHERE runtimeType = 'docker'",
        )
        .all() as { id: string }[];

    for (const row of rows) {
        try {
            destroySession(sessionDependencies, row.id);
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "Unknown session cleanup error.";
            console.error(`[shutdown] Failed to destroy session ${row.id}: ${message}`);
        }
    }
};

const shutdown = (signal: NodeJS.Signals) => {
    if (isShuttingDown) {
        return;
    }

    isShuttingDown = true;
    console.log(`[middle] Received ${signal}. Shutting down...`);
    destroyDockerSessionsOnShutdown();

    io.close();
    server.close(() => {
        process.exit(0);
    });

    const forceExitTimer = setTimeout(() => {
        process.exit(0);
    }, 5000);
    forceExitTimer.unref();
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

/* ---- Server Start ---- */
server.listen(PORT, HOST, () => {
    console.log(`Middle layer listening on http://${HOST}:${PORT}`);
});
