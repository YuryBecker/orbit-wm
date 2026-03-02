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
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            label TEXT NOT NULL,
            isApproved INTEGER NOT NULL DEFAULT 0,
            isReadonly INTEGER NOT NULL DEFAULT 1,
            createdAt TEXT NOT NULL,
            updatedAt TEXT NOT NULL,
            lastSeenAt TEXT,
            lastIp TEXT,
            lastUserAgent TEXT
        )
    `);
    db.exec(`
        CREATE TABLE IF NOT EXISTS tokens (
            id TEXT PRIMARY KEY,
            userId TEXT NOT NULL,
            tokenHash TEXT NOT NULL UNIQUE,
            scope TEXT NOT NULL,
            createdAt TEXT NOT NULL,
            expiresAt TEXT,
            revokedAt TEXT,
            lastUsedAt TEXT,
            FOREIGN KEY(userId) REFERENCES users(id)
        )
    `);
    db.exec(`
        CREATE TABLE IF NOT EXISTS pairing_codes (
            id TEXT PRIMARY KEY,
            codeHash TEXT NOT NULL UNIQUE,
            createdByUserId TEXT,
            scope TEXT NOT NULL,
            createdAt TEXT NOT NULL,
            expiresAt TEXT NOT NULL,
            usedAt TEXT,
            requestedIp TEXT,
            requestedUserAgent TEXT
        )
    `);
    db.exec(`
        CREATE TABLE IF NOT EXISTS device_requests (
            id TEXT PRIMARY KEY,
            ip TEXT,
            userAgent TEXT,
            createdAt TEXT NOT NULL,
            status TEXT NOT NULL,
            resolvedAt TEXT,
            claimHash TEXT,
            approvedToken TEXT
        )
    `);
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_tokens_userId
        ON tokens(userId)
    `);
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_tokens_tokenHash
        ON tokens(tokenHash)
    `);
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_pairing_codes_codeHash
        ON pairing_codes(codeHash)
    `);
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_pairing_codes_expiresAt
        ON pairing_codes(expiresAt)
    `);
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_device_requests_status_createdAt
        ON device_requests(status, createdAt)
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

    const userColumns = db
        .prepare("PRAGMA table_info(users)")
        .all() as { name: string }[];
    const userColumnNames = new Set(
        userColumns.map((column) => column.name)
    );
    if (!userColumnNames.has("isApproved")) {
        db.exec(
            "ALTER TABLE users ADD COLUMN isApproved INTEGER NOT NULL DEFAULT 0"
        );
    }
    if (!userColumnNames.has("isReadonly")) {
        db.exec(
            "ALTER TABLE users ADD COLUMN isReadonly INTEGER NOT NULL DEFAULT 1"
        );
    }
    if (!userColumnNames.has("updatedAt")) {
        db.exec(
            "ALTER TABLE users ADD COLUMN updatedAt TEXT NOT NULL DEFAULT ''"
        );
        db.exec(
            "UPDATE users SET updatedAt = createdAt WHERE updatedAt = ''"
        );
    }
    if (!userColumnNames.has("lastSeenAt")) {
        db.exec(
            "ALTER TABLE users ADD COLUMN lastSeenAt TEXT"
        );
    }
    if (!userColumnNames.has("lastIp")) {
        db.exec(
            "ALTER TABLE users ADD COLUMN lastIp TEXT"
        );
    }
    if (!userColumnNames.has("lastUserAgent")) {
        db.exec(
            "ALTER TABLE users ADD COLUMN lastUserAgent TEXT"
        );
    }

    const deviceRequestColumns = db
        .prepare("PRAGMA table_info(device_requests)")
        .all() as { name: string }[];
    const deviceRequestColumnNames = new Set(
        deviceRequestColumns.map((column) => column.name)
    );
    if (!deviceRequestColumnNames.has("claimHash")) {
        db.exec(
            "ALTER TABLE device_requests ADD COLUMN claimHash TEXT"
        );
    }
    if (!deviceRequestColumnNames.has("approvedToken")) {
        db.exec(
            "ALTER TABLE device_requests ADD COLUMN approvedToken TEXT"
        );
    }

    return db;
};

export default createDatabase;
