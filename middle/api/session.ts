import type Database from "better-sqlite3";
import type { Application } from "express";
import type { IPty } from "node-pty";
import crypto from "crypto";



type Session = {
    id: string;
    name: string;
    createdAt: string;
    pty: IPty;
};

type SessionRow = {
    id: string;
    name: string;
    data: string | null;
    isActive: number;
    createdAt: string;
    updatedAt: string;
};

type SessionDependencies = {
    app: Application;
    db: Database.Database;
    sessions: Map<string, Session>;
    attachPty: (sessionId: string, pty: IPty) => void;
    ensureTmuxSession: (sessionId: string) => void;
    spawnPty: (sessionId: string) => IPty;
    killTmuxSession: (sessionId: string) => void;
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
});

/* ---- Session Lifecycle ---- */
const createSession = (
    dependencies: SessionDependencies,
    name?: string,
    data?: unknown,
    isActive = true,
) => {
    const id = `sess_${crypto.randomUUID()}`;
    const timestamp = now();
    dependencies.ensureTmuxSession(id);
    const pty = dependencies.spawnPty(id);
    const session: Session = {
        id,
        name: name?.trim() || "Terminal Session",
        createdAt: timestamp,
        pty,
    };

    const insertStatement = dependencies.db.prepare(
        "INSERT INTO sessions (id, name, data, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)",
    );
    insertStatement.run(
        id,
        session.name,
        data === undefined ? null : JSON.stringify(data),
        isActive ? 1 : 0,
        timestamp,
        timestamp,
    );

    dependencies.sessions.set(id, session);
    dependencies.attachPty(id, pty);
    console.log(`Session created: ${id} (${session.name})`);

    return session;
};

const destroySession = (
    dependencies: SessionDependencies,
    sessionId: string,
) => {
    const session = dependencies.sessions.get(sessionId);
    if (!session) {
        console.log(`Session delete requested but not found: ${sessionId}`);
        const deleteStatement = dependencies.db.prepare(
            "DELETE FROM sessions WHERE id = ?",
        );
        deleteStatement.run(sessionId);
        return false;
    }

    session.pty.kill();
    dependencies.sessions.delete(sessionId);
    console.log(`Session deleted: ${sessionId}`);
    dependencies.killTmuxSession(sessionId);
    const deleteStatement = dependencies.db.prepare(
        "DELETE FROM sessions WHERE id = ?",
    );
    deleteStatement.run(sessionId);
    return true;
};

/* ---- Routes ---- */
const registerSessionRoutes = (dependencies: SessionDependencies) => {
    const { app, db } = dependencies;

    app.post("/api/session", (req, res) => {
        const session = createSession(dependencies, req.body?.name, req.body?.data);
        const row = db
            .prepare(
                "SELECT id, name, data, isActive, createdAt, updatedAt FROM sessions WHERE id = ?",
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

    app.get(["/api/sessions", "/api/sessions/"], (_req, res) => {
        const rows = db
            .prepare(
                "SELECT id, name, data, isActive, createdAt, updatedAt FROM sessions",
            )
            .all() as SessionRow[];
        res.json({ sessions: rows.map(serializeSessionRow) });
    });

    app.get("/api/session/:id", (req, res) => {
        const row = db
            .prepare(
                "SELECT id, name, data, isActive, createdAt, updatedAt FROM sessions WHERE id = ?",
            )
            .get(req.params.id) as SessionRow | undefined;
        if (!row) {
            res.status(404).json({ error: "Session not found." });
            return;
        }

        res.json(serializeSessionRow(row));
    });

    app.patch("/api/session/:id", (req, res) => {
        const existing = db
            .prepare(
                "SELECT id, name, data, isActive, createdAt, updatedAt FROM sessions WHERE id = ?",
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
                "SELECT id, name, data, isActive, createdAt, updatedAt FROM sessions WHERE id = ?",
            )
            .get(req.params.id) as SessionRow;

        res.json(serializeSessionRow(row));
    });

    app.delete("/api/session/:id", (req, res) => {
        if (!destroySession(dependencies, req.params.id)) {
            res.status(404).json({ error: "Session not found." });
            return;
        }

        res.status(204).end();
    });
};

export type { Session, SessionDependencies };
export { registerSessionRoutes };
