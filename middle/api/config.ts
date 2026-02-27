import type { Application } from "express";

import type Database from "better-sqlite3";


type ConfigDependencies = {
    app: Application;
    db: Database.Database;
};

type ConfigRow = {
    key: string;
    value: string | null;
    updatedAt: string;
};

const parseValue = (value: string | null) => {
    if (!value) {
        return null;
    }

    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
};

const registerConfigRoutes = ({ app, db }: ConfigDependencies) => {
    app.get("/api/config", (_req, res) => {
        const rows = db
            .prepare("SELECT key, value, updatedAt FROM config")
            .all() as ConfigRow[];

        const config = rows.reduce<Record<string, unknown>>((acc, row) => {
            acc[row.key] = parseValue(row.value);
            return acc;
        }, {});

        res.json({ config });
    });

    app.post("/api/config", (req, res) => {
        const key = typeof req.body?.key === "string" ? req.body.key : null;
        if (!key) {
            res.status(400).json({ error: "Missing key." });
            return;
        }

        const value = req.body?.value ?? null;
        const timestamp = new Date().toISOString();
        const statement = db.prepare(
            "INSERT INTO config (key, value, updatedAt) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt"
        );
        statement.run(
            key,
            value === null ? null : JSON.stringify(value),
            timestamp
        );

        res.json({ key, value });
    });
};

export type { ConfigDependencies };
export { registerConfigRoutes };
