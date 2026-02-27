import cors from "cors";
import express from "express";
import { Server } from "socket.io";
import { spawn } from "node-pty";

import type { IPty } from "node-pty";
import http from "http";

import createTerminalNamespace from "./ws";
import createDatabase from "./utils/db";
import createTmuxManager from "./utils/tmux";
import {
    registerConfigRoutes,
    registerSessionRoutes,
    registerTerminalRoutes,
    registerWallpaperRoutes,
} from "./api";
import type { Session, SessionDependencies } from "./api/session";


/* ---- Configuration ---- */
const PORT = Number(process.env.MIDDLE_PORT || 4001);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN;
const allowedOrigins = CLIENT_ORIGIN
    ? CLIENT_ORIGIN.split(",").map((origin) => origin.trim())
    : null;

/* ---- Database ---- */
const db = createDatabase();

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

/* ---- WebSockets ---- */
const server = http.createServer(app);
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

/* ---- TMUX Helpers ---- */
const tmux = createTmuxManager();
tmux.configure();

const spawnPty = (sessionId: string): IPty =>
    spawn(tmux.binary, tmux.getAttachArgs(sessionId), {
        name: "xterm-256color",
        cols: 120,
        rows: 30,
        cwd: process.cwd(),
        env: process.env as NodeJS.ProcessEnv,
    });

/* ---- In-memory Session State ---- */
const sessions = new Map<string, Session>();

const getSession = (sessionId: string) => sessions.get(sessionId) || restoreSession(sessionId);

const namespace = createTerminalNamespace(io, sessions, getSession);

const restoreSession = (sessionId: string) => {
    const row = db
        .prepare("SELECT id, name, createdAt FROM sessions WHERE id = ?")
        .get(sessionId) as { id: string; name: string; createdAt: string } | undefined;
    if (!row) {
        return null;
    }

    if (!tmux.hasSession(sessionId)) {
        return null;
    }

    const pty = spawnPty(sessionId);
    const session: Session = {
        id: row.id,
        name: row.name,
        createdAt: row.createdAt,
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
    attachPty: namespace.attachPty,
    ensureTmuxSession: tmux.ensureSession,
    spawnPty,
    killTmuxSession: tmux.killSession,
};

registerSessionRoutes(sessionDependencies);
registerTerminalRoutes({ app });
registerConfigRoutes({ app, db });
registerWallpaperRoutes({ app });

/* ---- Server Start ---- */
server.listen(PORT, () => {
    console.log(`Middle layer listening on http://localhost:${PORT}`);
});
