import type Database from "better-sqlite3";
import type { Application, Request, RequestHandler } from "express";
import type { IPty } from "node-pty";
import crypto from "crypto";

import type { AuthPrincipal } from "../auth";
import type { RuntimeKind, SessionRuntime } from "../runtime";



type Session = {
    id: string;
    name: string;
    createdAt: string;
    runtimeType: RuntimeKind;
    runtimeSessionId: string;
    pty: IPty;
};

type SessionRow = {
    id: string;
    name: string;
    data: string | null;
    isActive: number;
    runtimeType: RuntimeKind | null;
    runtimeSessionId: string | null;
    lastActivityAt: string | null;
    createdAt: string;
    updatedAt: string;
};

type SessionDependencies = {
    app: Application;
    db: Database.Database;
    sessions: Map<string, Session>;
    requireAuth: RequestHandler;
    requireControl: RequestHandler;
    getPrincipal: (req: Request) => AuthPrincipal | null;
    attachPty: (sessionId: string, pty: IPty) => void;
    runtime: SessionRuntime;
};

/* ---- Helpers ---- */
const now = () => new Date().toISOString();

const parseData = (value: string | null) => {
    if (!value) {
        return null;
    }

    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
};

const serializeSessionRow = (row: SessionRow) => ({
    id: row.id,
    name: row.name,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    data: parseData(row.data),
    isActive: row.isActive === 1,
    runtimeType: row.runtimeType || "host",
});

const resolveRuntimeGroupId = (principal: AuthPrincipal | null) => {
    if (!principal) {
        return "anonymous";
    }

    if (principal.kind === "host") {
        return `host:${principal.userId || "local"}`;
    }

    return `user:${principal.userId || "unknown"}`;
};

const isRuntimeSessionShared = (
    dependencies: SessionDependencies,
    sessionId: string,
    runtimeSessionId: string,
) => {
    const row = dependencies.db
        .prepare(
            "SELECT COUNT(*) as count FROM sessions WHERE runtimeSessionId = ? AND id != ?",
        )
        .get(runtimeSessionId, sessionId) as { count: number };

    return row.count > 0;
};

/* ---- Session Lifecycle ---- */
const createSession = (
    dependencies: SessionDependencies,
    runtimeGroupId: string,
    name?: string,
    data?: unknown,
    isActive = true,
) => {
    const id = `sess_${crypto.randomUUID()}`;
    const timestamp = now();
    const runtimeCreated = dependencies.runtime.createSession(id, {
        runtimeGroupId,
    });
    const session: Session = {
        id,
        name: name?.trim() || "Terminal Session",
        createdAt: timestamp,
        runtimeType: dependencies.runtime.kind,
        runtimeSessionId: runtimeCreated.runtimeSessionId,
        pty: runtimeCreated.pty,
    };

    const insertStatement = dependencies.db.prepare(
        "INSERT INTO sessions (id, name, data, isActive, runtimeType, runtimeSessionId, lastActivityAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    );
    insertStatement.run(
        id,
        session.name,
        data === undefined ? null : JSON.stringify(data),
        isActive ? 1 : 0,
        session.runtimeType,
        session.runtimeSessionId,
        timestamp,
        timestamp,
        timestamp,
    );

    dependencies.sessions.set(id, session);
    dependencies.attachPty(id, session.pty);
    console.log(`Session created: ${id} (${session.name})`);

    return session;
};

const destroySession = (
    dependencies: SessionDependencies,
    sessionId: string,
) => {
    const session = dependencies.sessions.get(sessionId);
    if (!session) {
        const row = dependencies.db
            .prepare(
                "SELECT runtimeSessionId FROM sessions WHERE id = ?",
            )
            .get(sessionId) as { runtimeSessionId: string | null } | undefined;
        if (row) {
            const runtimeSessionId = row.runtimeSessionId || sessionId;
            if (!isRuntimeSessionShared(dependencies, sessionId, runtimeSessionId)) {
                dependencies.runtime.destroySession(sessionId, runtimeSessionId);
            }
        }

        const deleteStatement = dependencies.db.prepare(
            "DELETE FROM sessions WHERE id = ?",
        );
        const result = deleteStatement.run(sessionId);
        if (result.changes > 0) {
            console.log(`Session deleted from DB after PTY exit: ${sessionId}`);
        } else {
            console.log(`Session already deleted: ${sessionId}`);
        }
        return true;
    }

    session.pty.kill();
    dependencies.sessions.delete(sessionId);
    console.log(`Session deleted: ${sessionId}`);
    if (!isRuntimeSessionShared(dependencies, sessionId, session.runtimeSessionId)) {
        dependencies.runtime.destroySession(sessionId, session.runtimeSessionId);
    }
    const deleteStatement = dependencies.db.prepare(
        "DELETE FROM sessions WHERE id = ?",
    );
    deleteStatement.run(sessionId);
    return true;
};

/* ---- Routes ---- */
const registerSessionRoutes = (dependencies: SessionDependencies) => {
    const {
        app,
        db,
        requireAuth,
        requireControl,
        getPrincipal,
    } = dependencies;

    app.post("/api/session", requireControl, (req, res) => {
        let session: Session;
        try {
            const principal = getPrincipal(req);
            const runtimeGroupId = resolveRuntimeGroupId(principal);
            session = createSession(
                dependencies,
                runtimeGroupId,
                req.body?.name,
                req.body?.data,
            );
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : "Failed to create session.";
            console.error(`Session create failed: ${message}`);
            res.status(500).json({ error: message });
            return;
        }
        const row = db
            .prepare(
                "SELECT id, name, data, isActive, runtimeType, runtimeSessionId, lastActivityAt, createdAt, updatedAt FROM sessions WHERE id = ?",
            )
            .get(session.id) as SessionRow;

        res.status(201).json({
            ...serializeSessionRow(row),
            socket: {
                namespace: "/terminal",
                room: session.id,
            },
        });
    });

    app.get(["/api/sessions", "/api/sessions/"], requireAuth, (_req, res) => {
        const rows = db
            .prepare(
                "SELECT id, name, data, isActive, runtimeType, runtimeSessionId, lastActivityAt, createdAt, updatedAt FROM sessions",
            )
            .all() as SessionRow[];
        res.json({ sessions: rows.map(serializeSessionRow) });
    });

    app.get("/api/session/:id", requireAuth, (req, res) => {
        const row = db
            .prepare(
                "SELECT id, name, data, isActive, runtimeType, runtimeSessionId, lastActivityAt, createdAt, updatedAt FROM sessions WHERE id = ?",
            )
            .get(req.params.id) as SessionRow | undefined;
        if (!row) {
            res.status(404).json({ error: "Session not found." });
            return;
        }

        res.json(serializeSessionRow(row));
    });

    app.patch("/api/session/:id", requireControl, (req, res) => {
        const existing = db
            .prepare(
                "SELECT id, name, data, isActive, runtimeType, runtimeSessionId, lastActivityAt, createdAt, updatedAt FROM sessions WHERE id = ?",
            )
            .get(req.params.id) as SessionRow | undefined;
        if (!existing) {
            console.log(
                `Session rename requested but not found: ${req.params.id}`,
            );
            res.status(404).json({ error: "Session not found." });
            return;
        }

        const session = dependencies.sessions.get(req.params.id);

        const update: {
            name?: string;
            data?: string | null;
            isActive?: number;
        } = {};

        if (typeof req.body?.name === "string" && req.body.name.trim()) {
            const trimmedName = req.body.name.trim();
            update.name = trimmedName;
            if (session) {
                session.name = trimmedName;
            }
            console.log(`Session renamed: ${req.params.id} -> ${update.name}`);
        }

        if (req.body?.data !== undefined) {
            update.data = JSON.stringify(req.body.data ?? null);
        }

        if (req.body?.isActive !== undefined) {
            update.isActive = req.body.isActive ? 1 : 0;
        }

        if (Object.keys(update).length > 0) {
            const statement = db.prepare(
                "UPDATE sessions SET name = COALESCE(?, name), data = COALESCE(?, data), isActive = COALESCE(?, isActive), updatedAt = ? WHERE id = ?",
            );
            statement.run(
                update.name ?? null,
                update.data ?? null,
                update.isActive ?? null,
                now(),
                req.params.id,
            );
        }

        const row = db
            .prepare(
                "SELECT id, name, data, isActive, runtimeType, runtimeSessionId, lastActivityAt, createdAt, updatedAt FROM sessions WHERE id = ?",
            )
            .get(req.params.id) as SessionRow;

        res.json(serializeSessionRow(row));
    });

    app.delete("/api/session/:id", requireControl, (req, res) => {
        destroySession(dependencies, req.params.id);
        res.status(204).end();
    });

    app.get("/api/me", requireAuth, (req, res) => {
        const principal = getPrincipal(req);
        if (!principal) {
            res.status(401).json({ error: "Unauthorized." });
            return;
        }

        res.json({
            kind: principal.kind,
            userId: principal.userId,
            label: principal.label,
            scope: principal.scope,
            isReadonly: principal.isReadonly,
        });
    });
};

export type { Session, SessionDependencies };
export { destroySession, registerSessionRoutes };
