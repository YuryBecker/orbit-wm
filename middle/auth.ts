import crypto from "crypto";

import type Database from "better-sqlite3";
import type { NextFunction, Request, Response } from "express";


type AuthScope = "readonly" | "control";

type AuthPrincipal = {
    kind: "host" | "user";
    scope: AuthScope;
    isReadonly: boolean;
    userId: string | null;
    label: string;
};

type AuthRow = {
    tokenId: string;
    userId: string;
    label: string;
    isApproved: number;
    isReadonly: number;
    scope: AuthScope;
    expiresAt: string | null;
    revokedAt: string | null;
};

type ResolveOptions = {
    token: string | null;
    ip: string | null;
    userAgent: string | null;
};

type ResolvedAuth = {
    principal: AuthPrincipal | null;
    reason: string | null;
};

type AuthedRequest = Request & { authPrincipal?: AuthPrincipal };

const now = () => new Date().toISOString();

const normalizeIp = (value: string | null | undefined) => {
    if (!value) {
        return null;
    }

    if (value === "::1") {
        return "127.0.0.1";
    }

    if (value.startsWith("::ffff:")) {
        return value.slice("::ffff:".length);
    }

    return value;
};

const getRequestIp = (req: Request) => {
    const forwarded = req.headers["x-forwarded-for"];
    if (typeof forwarded === "string" && forwarded.trim()) {
        return normalizeIp(
            forwarded
                .split(",")[0]
                ?.trim(),
        );
    }

    return normalizeIp(req.socket.remoteAddress || null);
};

const isLoopbackIp = (ip: string | null) =>
    ip === "127.0.0.1" || ip === "::1";

const sha256 = (value: string) =>
    crypto
        .createHash("sha256")
        .update(value)
        .digest("hex");

const randomToken = (bytes = 32) =>
    crypto.randomBytes(bytes).toString("base64url");

const getBearerToken = (header: string | undefined | null) => {
    if (!header) {
        return null;
    }

    const [scheme, value] = header.trim().split(/\s+/, 2);
    if (!scheme || !value) {
        return null;
    }

    if (scheme.toLowerCase() !== "bearer") {
        return null;
    }

    return value;
};

const createAuthHelpers = (db: Database.Database) => {
    const resolvePrincipal = (options: ResolveOptions): ResolvedAuth => {
        const normalizedIp = normalizeIp(options.ip);

        if (isLoopbackIp(normalizedIp)) {
            return {
                principal: {
                    kind: "host",
                    scope: "control",
                    isReadonly: false,
                    userId: null,
                    label: "Local Host",
                },
                reason: null,
            };
        }

        if (!options.token) {
            return {
                principal: null,
                reason: "missing_token",
            };
        }

        const tokenHash = sha256(options.token);
        const row = db
            .prepare(
                `
                SELECT
                    tokens.id AS tokenId,
                    users.id AS userId,
                    users.label AS label,
                    users.isApproved AS isApproved,
                    users.isReadonly AS isReadonly,
                    tokens.scope AS scope,
                    tokens.expiresAt AS expiresAt,
                    tokens.revokedAt AS revokedAt
                FROM tokens
                INNER JOIN users ON users.id = tokens.userId
                WHERE tokens.tokenHash = ?
                LIMIT 1
                `
            )
            .get(tokenHash) as AuthRow | undefined;

        if (!row) {
            return {
                principal: null,
                reason: "invalid_token",
            };
        }

        if (row.revokedAt) {
            return {
                principal: null,
                reason: "revoked_token",
            };
        }

        if (row.expiresAt && new Date(row.expiresAt).getTime() <= Date.now()) {
            return {
                principal: null,
                reason: "expired_token",
            };
        }

        if (row.isApproved !== 1) {
            return {
                principal: null,
                reason: "user_not_approved",
            };
        }

        const timestamp = now();
        db.prepare(
            "UPDATE tokens SET lastUsedAt = ? WHERE id = ?"
        ).run(timestamp, row.tokenId);
        db.prepare(
            "UPDATE users SET lastSeenAt = ?, lastIp = ?, lastUserAgent = ?, updatedAt = ? WHERE id = ?"
        ).run(
            timestamp,
            normalizedIp,
            options.userAgent,
            timestamp,
            row.userId,
        );

        const readonlyFromUser = row.isReadonly === 1;
        const readonlyFromScope = row.scope === "readonly";
        const isReadonly = readonlyFromUser || readonlyFromScope;

        return {
            principal: {
                kind: "user",
                scope: isReadonly ? "readonly" : "control",
                isReadonly,
                userId: row.userId,
                label: row.label,
            },
            reason: null,
        };
    };

    const attachPrincipal = (
        req: Request,
        _res: Response,
        next: NextFunction,
    ) => {
        const token = getBearerToken(req.header("authorization"));
        const ip = getRequestIp(req);
        const userAgent = req.header("user-agent") || null;
        const resolved = resolvePrincipal({ token, ip, userAgent });
        (req as AuthedRequest).authPrincipal = resolved.principal || undefined;
        next();
    };

    const requireAuth = (req: Request, res: Response, next: NextFunction) => {
        const principal = (req as AuthedRequest).authPrincipal;
        if (!principal) {
            res.status(401).json({ error: "Unauthorized." });
            return;
        }

        next();
    };

    const requireControl = (
        req: Request,
        res: Response,
        next: NextFunction,
    ) => {
        const principal = (req as AuthedRequest).authPrincipal;
        if (!principal) {
            res.status(401).json({ error: "Unauthorized." });
            return;
        }

        if (principal.isReadonly) {
            res.status(403).json({ error: "Read-only access." });
            return;
        }

        next();
    };

    const getPrincipal = (req: Request) =>
        (req as AuthedRequest).authPrincipal || null;

    const createToken = (options: {
        userId: string;
        scope: AuthScope;
        expiresAt?: string | null;
    }) => {
        const plainToken = randomToken(32);
        const tokenId = `tok_${crypto.randomUUID()}`;
        db.prepare(
            `
            INSERT INTO tokens (id, userId, tokenHash, scope, createdAt, expiresAt, revokedAt, lastUsedAt)
            VALUES (?, ?, ?, ?, ?, ?, NULL, NULL)
            `
        ).run(
            tokenId,
            options.userId,
            sha256(plainToken),
            options.scope,
            now(),
            options.expiresAt ?? null,
        );

        return {
            id: tokenId,
            token: plainToken,
        };
    };

    return {
        now,
        sha256,
        randomToken,
        getRequestIp,
        getBearerToken,
        resolvePrincipal,
        attachPrincipal,
        requireAuth,
        requireControl,
        getPrincipal,
        createToken,
    };
};

export type { AuthPrincipal, AuthScope };
export { createAuthHelpers };
