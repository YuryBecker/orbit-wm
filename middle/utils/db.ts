import path from "path";

import Database from "better-sqlite3";



const DB_PATH = path.join(process.cwd(), "middle", "db.sqlite");

/* ---- Database Bootstrap ---- */
const createDatabase = () => {
    const db = new Database(DB_PATH);

    db.pragma("journal_mode = WAL");
    db.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            data TEXT,
            isActive INTEGER NOT NULL DEFAULT 0,
            createdAt TEXT NOT NULL,
            updatedAt TEXT NOT NULL
        )
    `);
    db.exec(`
        CREATE TABLE IF NOT EXISTS config (
            key TEXT PRIMARY KEY,
            value TEXT,
            updatedAt TEXT NOT NULL
        )
    `);

    const sessionColumns = db
        .prepare("PRAGMA table_info(sessions)")
        .all() as { name: string }[];
    const sessionColumnNames = new Set(
        sessionColumns.map((column) => column.name)
    );
    if (!sessionColumnNames.has("isActive")) {
        db.exec(
            "ALTER TABLE sessions ADD COLUMN isActive INTEGER NOT NULL DEFAULT 0"
        );
    }

    return db;
};

export default createDatabase;
