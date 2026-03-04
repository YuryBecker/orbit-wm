import crypto from "crypto";

import type Database from "better-sqlite3";
import type { Application, Request, RequestHandler } from "express";

import type { AuthScope } from "../auth";


type SecurityDependencies = {
    app: Application;
    db: Database.Database;
    requireControl: RequestHandler;
    getRequestIp: (req: Request) => string | null;
    createToken: (options: {
        userId: string;
        scope: AuthScope;
        expiresAt?: string | null;
    }) => {
        id: string;
        token: string;
    };
    sha256: (value: string) => string;
    randomToken: (bytes?: number) => string;
    now: () => string;
};

type PairingRow = {
    id: string;
    codeHash: string;
    scope: AuthScope;
    createdAt: string;
    expiresAt: string;
    usedAt: string | null;
    requestedIp: string | null;
    requestedUserAgent: string | null;
};

type DeviceRequestRow = {
    id: string;
    ip: string | null;
    userAgent: string | null;
    createdAt: string;
    status: string;
    resolvedAt: string | null;
    claimHash: string | null;
    approvedToken: string | null;
};

type UserRow = {
    id: string;
    label: string;
    isApproved: number;
    isReadonly: number;
    createdAt: string;
    updatedAt: string;
    lastSeenAt: string | null;
    lastIp: string | null;
    lastUserAgent: string | null;
};

type ExistingUserRow = {
    id: string;
};

const clampPairingSeconds = (value: unknown) => {
    const n = Number(value);
    if (!Number.isFinite(n)) {
        return 180;
    }

    return Math.max(30, Math.min(1800, Math.floor(n)));
};

const getScope = (value: unknown): AuthScope =>
    value === "control" ? "control" : "readonly";

const getIsoFromNow = (seconds: number) =>
    new Date(Date.now() + seconds * 1000).toISOString();

const registerSecurityRoutes = (dependencies: SecurityDependencies) => {
    const {
        app,
        db,
        requireControl,
        getRequestIp,
        createToken,
        sha256,
        randomToken,
        now,
    } = dependencies;

    app.post("/api/pairing/start", requireControl, (req, res) => {
        const scope = getScope(req.body?.scope);
        const expiresInSeconds = clampPairingSeconds(req.body?.expiresInSeconds);
        const pairingCode = randomToken(18);
        const id = `pair_${crypto.randomUUID()}`;
        const createdAt = now();
        const expiresAt = getIsoFromNow(expiresInSeconds);
        const host = req.get("host");
        const scheme = req.protocol || "https";

        db.prepare(
            `
            INSERT INTO pairing_codes (
                id,
                codeHash,
                createdByUserId,
                scope,
                createdAt,
                expiresAt,
                usedAt,
                requestedIp,
                requestedUserAgent
            ) VALUES (?, ?, NULL, ?, ?, ?, NULL, NULL, NULL)
            `
        ).run(
            id,
            sha256(pairingCode),
            scope,
            createdAt,
            expiresAt,
        );

        const pairingUrl = host
            ? `${scheme}://${host}/pair?code=${encodeURIComponent(pairingCode)}`
            : null;

        res.json({
            pairingCode,
            pairingUrl,
            scope,
            expiresAt,
        });
    });

    app.post("/api/pairing/complete", (req, res) => {
        const code = typeof req.body?.code === "string"
            ? req.body.code.trim()
            : "";
        if (!code) {
            res.status(400).json({ error: "Missing code." });
            return;
        }

        const row = db
            .prepare(
                `
                SELECT
                    id,
                    codeHash,
                    scope,
                    createdAt,
                    expiresAt,
                    usedAt,
                    requestedIp,
                    requestedUserAgent
                FROM pairing_codes
                WHERE codeHash = ?
                LIMIT 1
                `
            )
            .get(sha256(code)) as PairingRow | undefined;

        if (!row) {
            res.status(404).json({ error: "Invalid pairing code." });
            return;
        }

        if (row.usedAt) {
            res.status(409).json({ error: "Pairing code already used." });
            return;
        }

        if (new Date(row.expiresAt).getTime() <= Date.now()) {
            res.status(410).json({ error: "Pairing code expired." });
            return;
        }

        const ip = getRequestIp(req);
        const userAgent = req.get("user-agent") || null;
        const timestamp = now();
        const userId = `usr_${crypto.randomUUID()}`;
        const label = typeof req.body?.label === "string" && req.body.label.trim()
            ? req.body.label.trim()
            : (ip ? `Device ${ip}` : "Device");
        const isReadonly = row.scope === "readonly" ? 1 : 0;
        const existingUser = ip
            ? db
                .prepare(
                    `
                    SELECT id
                    FROM users
                    WHERE lastIp = ?
                    ORDER BY updatedAt DESC
                    LIMIT 1
                    `
                )
                .get(ip) as ExistingUserRow | undefined
            : undefined;
        const effectiveUserId = existingUser?.id ?? userId;

        if (existingUser) {
            db.prepare(
                `
                UPDATE users
                SET
                    label = ?,
                    isApproved = 1,
                    isReadonly = ?,
                    updatedAt = ?,
                    lastSeenAt = ?,
                    lastIp = ?,
                    lastUserAgent = ?
                WHERE id = ?
                `
            ).run(
                label,
                isReadonly,
                timestamp,
                timestamp,
                ip,
                userAgent,
                existingUser.id,
            );
        } else {
            db.prepare(
                `
                INSERT INTO users (
                    id,
                    label,
                    isApproved,
                    isReadonly,
                    createdAt,
                    updatedAt,
                    lastSeenAt,
                    lastIp,
                    lastUserAgent
                ) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?)
                `
            ).run(
                userId,
                label,
                isReadonly,
                timestamp,
                timestamp,
                timestamp,
                ip,
                userAgent,
            );
        }

        db.prepare(
            `
            UPDATE pairing_codes
            SET usedAt = ?, requestedIp = ?, requestedUserAgent = ?
            WHERE id = ?
            `
        ).run(
            timestamp,
            ip,
            userAgent,
            row.id,
        );

        const created = createToken({
            userId: effectiveUserId,
            scope: row.scope,
        });

        res.json({
            token: created.token,
            user: {
                id: effectiveUserId,
                label,
                scope: row.scope,
                isReadonly: isReadonly === 1,
            },
        });
    });

    app.post("/api/device-requests", (req, res) => {
        const ip = getRequestIp(req);
        const userAgent = req.get("user-agent") || null;
        const claimCode = randomToken(18);
        const claimHash = sha256(claimCode);
        const existing = ip
            ? db
                .prepare(
                    `
                    SELECT id, ip, userAgent, createdAt, status, resolvedAt, claimHash, approvedToken
                    FROM device_requests
                    WHERE ip = ?
                    ORDER BY createdAt DESC
                    LIMIT 1
                    `
                )
                .get(ip) as DeviceRequestRow | undefined
            : db
                .prepare(
                    `
                    SELECT id, ip, userAgent, createdAt, status, resolvedAt, claimHash, approvedToken
                    FROM device_requests
                    WHERE status = 'pending' AND ip IS NULL AND userAgent IS ?
                    ORDER BY createdAt DESC
                    LIMIT 1
                    `
                )
                .get(userAgent) as DeviceRequestRow | undefined;
        const createdAt = now();

        if (existing) {
            db.prepare(
                `
                UPDATE device_requests
                SET
                    ip = ?,
                    userAgent = ?,
                    createdAt = ?,
                    status = 'pending',
                    resolvedAt = NULL,
                    claimHash = ?,
                    approvedToken = NULL
                WHERE id = ?
                `
            ).run(
                ip,
                userAgent,
                createdAt,
                claimHash,
                existing.id,
            );
            res.status(202).json({
                id: existing.id,
                ip,
                userAgent,
                createdAt,
                status: "pending",
                resolvedAt: null,
                claimCode,
            });
            return;
        }

        const id = `req_${crypto.randomUUID()}`;
        db.prepare(
            `
            INSERT INTO device_requests (id, ip, userAgent, createdAt, status, resolvedAt, claimHash, approvedToken)
            VALUES (?, ?, ?, ?, 'pending', NULL, ?, NULL)
            `
        ).run(
            id,
            ip,
            userAgent,
            createdAt,
            claimHash,
        );

        res.status(201).json({
            id,
            ip,
            userAgent,
            createdAt,
            status: "pending",
            resolvedAt: null,
            claimCode,
        });
    });

    app.get("/api/device-requests", requireControl, (_req, res) => {
        const rows = db
            .prepare(
                `
                SELECT id, ip, userAgent, createdAt, status, resolvedAt, claimHash, approvedToken
                FROM device_requests
                WHERE status = 'pending'
                ORDER BY createdAt ASC
                `
            )
            .all() as DeviceRequestRow[];

        res.json({
            requests: rows.map((row) => ({
                id: row.id,
                ip: row.ip,
                userAgent: row.userAgent,
                createdAt: row.createdAt,
                status: row.status,
                resolvedAt: row.resolvedAt,
            })),
        });
    });

    app.get("/api/device-requests/:id", (req, res) => {
        const claim = typeof req.query?.claim === "string"
            ? req.query.claim
            : "";
        const row = db
            .prepare(
                `
                SELECT id, ip, userAgent, createdAt, status, resolvedAt, claimHash, approvedToken
                FROM device_requests
                WHERE id = ?
                LIMIT 1
                `
            )
            .get(req.params.id) as DeviceRequestRow | undefined;

        if (!row) {
            res.status(404).json({ error: "Device request not found." });
            return;
        }

        if (
            row.status === "approved" &&
            row.approvedToken &&
            row.claimHash &&
            claim &&
            sha256(claim) === row.claimHash
        ) {
            const approvedToken = row.approvedToken;
            db.prepare(
                "UPDATE device_requests SET approvedToken = NULL WHERE id = ?"
            ).run(row.id);
            res.json({
                id: row.id,
                status: row.status,
                token: approvedToken,
            });
            return;
        }

        res.json({
            id: row.id,
            ip: row.ip,
            userAgent: row.userAgent,
            createdAt: row.createdAt,
            status: row.status,
            resolvedAt: row.resolvedAt,
        });
    });

    app.post("/api/device-requests/:id/approve", requireControl, (req, res) => {
        const row = db
            .prepare(
                `
                SELECT id, ip, userAgent, createdAt, status, resolvedAt, claimHash, approvedToken
                FROM device_requests
                WHERE id = ?
                LIMIT 1
                `
            )
            .get(req.params.id) as DeviceRequestRow | undefined;

        if (!row) {
            res.status(404).json({ error: "Device request not found." });
            return;
        }

        if (row.status !== "pending") {
            res.status(409).json({ error: `Device request already ${row.status}.` });
            return;
        }

        const scope = getScope(req.body?.scope);
        const timestamp = now();
        const userId = `usr_${crypto.randomUUID()}`;
        const label = typeof req.body?.label === "string" && req.body.label.trim()
            ? req.body.label.trim()
            : (row.ip ? `Device ${row.ip}` : "Device");
        const isReadonly = scope === "readonly" ? 1 : 0;
        const existingUser = row.ip
            ? db
                .prepare(
                    `
                    SELECT id
                    FROM users
                    WHERE lastIp = ?
                    ORDER BY updatedAt DESC
                    LIMIT 1
                    `
                )
                .get(row.ip) as ExistingUserRow | undefined
            : undefined;
        const effectiveUserId = existingUser?.id ?? userId;

        if (existingUser) {
            db.prepare(
                `
                UPDATE users
                SET
                    label = ?,
                    isApproved = 1,
                    isReadonly = ?,
                    updatedAt = ?,
                    lastIp = ?,
                    lastUserAgent = ?
                WHERE id = ?
                `
            ).run(
                label,
                isReadonly,
                timestamp,
                row.ip,
                row.userAgent,
                existingUser.id,
            );
        } else {
            db.prepare(
                `
                INSERT INTO users (
                    id,
                    label,
                    isApproved,
                    isReadonly,
                    createdAt,
                    updatedAt,
                    lastSeenAt,
                    lastIp,
                    lastUserAgent
                ) VALUES (?, ?, 1, ?, ?, ?, NULL, ?, ?)
                `
            ).run(
                userId,
                label,
                isReadonly,
                timestamp,
                timestamp,
                row.ip,
                row.userAgent,
            );
        }

        const created = createToken({
            userId: effectiveUserId,
            scope,
        });

        db.prepare(
            "UPDATE device_requests SET status = 'approved', resolvedAt = ?, approvedToken = ? WHERE id = ?"
        ).run(timestamp, created.token, row.id);

        res.json({
            token: created.token,
            user: {
                id: effectiveUserId,
                label,
                scope,
                isReadonly: isReadonly === 1,
            },
        });
    });

    app.post("/api/device-requests/:id/deny", requireControl, (req, res) => {
        const row = db
            .prepare(
                `
                SELECT id, status
                FROM device_requests
                WHERE id = ?
                LIMIT 1
                `
            )
            .get(req.params.id) as { id: string; status: string } | undefined;

        if (!row) {
            res.status(404).json({ error: "Device request not found." });
            return;
        }

        if (row.status !== "pending") {
            res.status(409).json({ error: `Device request already ${row.status}.` });
            return;
        }

        db.prepare(
            "UPDATE device_requests SET status = 'denied', resolvedAt = ?, approvedToken = NULL WHERE id = ?"
        ).run(now(), row.id);
        res.status(204).end();
    });

    app.get("/api/device-history", requireControl, (_req, res) => {
        const rows = db
            .prepare(
                `
                SELECT id, ip, userAgent, createdAt, status, resolvedAt, claimHash, approvedToken
                FROM device_requests
                ORDER BY createdAt DESC
                LIMIT 1000
                `
            )
            .all() as DeviceRequestRow[];
        const seenIps = new Set<string>();
        const requests: DeviceRequestRow[] = [];

        rows.forEach((row) => {
            const key = row.ip || `__request__${row.id}`;
            if (seenIps.has(key)) {
                return;
            }

            seenIps.add(key);
            requests.push(row);
        });

        res.json({
            requests: requests.map((row) => ({
                id: row.id,
                ip: row.ip,
                userAgent: row.userAgent,
                createdAt: row.createdAt,
                status: row.status,
                resolvedAt: row.resolvedAt,
            })),
        });
    });

    app.get("/api/users", requireControl, (_req, res) => {
        const rows = db
            .prepare(
                `
                SELECT
                    id,
                    label,
                    isApproved,
                    isReadonly,
                    createdAt,
                    updatedAt,
                    lastSeenAt,
                    lastIp,
                    lastUserAgent
                FROM users
                ORDER BY createdAt DESC
                `
            )
            .all() as UserRow[];
        const seenIps = new Set<string>();
        const users: UserRow[] = [];

        rows.forEach((row) => {
            const key = row.lastIp || `__user__${row.id}`;
            if (seenIps.has(key)) {
                return;
            }

            seenIps.add(key);
            users.push(row);
        });

        res.json({
            users: users.map((row) => ({
                id: row.id,
                label: row.label,
                isApproved: row.isApproved === 1,
                isReadonly: row.isReadonly === 1,
                createdAt: row.createdAt,
                updatedAt: row.updatedAt,
                lastSeenAt: row.lastSeenAt,
                lastIp: row.lastIp,
                lastUserAgent: row.lastUserAgent,
            })),
        });
    });

    app.patch("/api/users/:id", requireControl, (req, res) => {
        const row = db
            .prepare(
                `
                SELECT
                    id,
                    label,
                    isApproved,
                    isReadonly,
                    createdAt,
                    updatedAt,
                    lastSeenAt,
                    lastIp,
                    lastUserAgent
                FROM users
                WHERE id = ?
                LIMIT 1
                `
            )
            .get(req.params.id) as UserRow | undefined;

        if (!row) {
            res.status(404).json({ error: "User not found." });
            return;
        }

        const nextLabel = typeof req.body?.label === "string" && req.body.label.trim()
            ? req.body.label.trim()
            : row.label;
        const nextReadonly = typeof req.body?.isReadonly === "boolean"
            ? (req.body.isReadonly ? 1 : 0)
            : row.isReadonly;
        const nextApproved = typeof req.body?.isApproved === "boolean"
            ? (req.body.isApproved ? 1 : 0)
            : row.isApproved;
        const timestamp = now();

        db.prepare(
            `
            UPDATE users
            SET label = ?, isReadonly = ?, isApproved = ?, updatedAt = ?
            WHERE id = ?
            `
        ).run(
            nextLabel,
            nextReadonly,
            nextApproved,
            timestamp,
            row.id,
        );

        res.json({
            id: row.id,
            label: nextLabel,
            isApproved: nextApproved === 1,
            isReadonly: nextReadonly === 1,
            updatedAt: timestamp,
        });
    });

    app.post("/api/users/:id/revoke-tokens", requireControl, (req, res) => {
        const user = db
            .prepare("SELECT id FROM users WHERE id = ? LIMIT 1")
            .get(req.params.id) as { id: string } | undefined;
        if (!user) {
            res.status(404).json({ error: "User not found." });
            return;
        }

        const timestamp = now();
        const result = db.prepare(
            "UPDATE tokens SET revokedAt = COALESCE(revokedAt, ?) WHERE userId = ?"
        ).run(timestamp, user.id);

        res.json({
            userId: user.id,
            revoked: result.changes,
            revokedAt: timestamp,
        });
    });
};

export type { SecurityDependencies };
export { registerSecurityRoutes };
