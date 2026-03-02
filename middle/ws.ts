import type { IPty } from "node-pty";

import type { Namespace, Server } from "socket.io";

import type { AuthPrincipal } from "./auth";



type Session = {
    id: string;
    name: string;
    createdAt: string;
    pty: IPty;
};

type TerminalNamespace = {
    namespace: Namespace;
    attachPty: (sessionId: string, pty: IPty) => void;
};

type SessionResolver = (sessionId: string) => Session | null;
type AuthResolver = (options: {
    token: string | null;
    ip: string | null;
    userAgent: string | null;
}) => {
    principal: AuthPrincipal | null;
    reason: string | null;
};

type SocketDependencies = {
    resolvePrincipal: AuthResolver;
    getBearerToken: (header: string | undefined | null) => string | null;
};

type OutputBuffer = {
    chunks: string[];
    start: number;
    size: number;
};

const MAX_REPLAY_BYTES = Number(process.env.ORBIT_TERMINAL_REPLAY_BYTES || 200_000);
const DEBUG_LOG_OUTPUT = process.env.ORBIT_DEBUG_PTY_OUTPUT === "1";

const getOrCreateBuffer = (
    buffers: Map<string, OutputBuffer>,
    sessionId: string,
) => {
    const existing = buffers.get(sessionId);
    if (existing) {
        return existing;
    }

    const created: OutputBuffer = { chunks: [], start: 0, size: 0 };
    buffers.set(sessionId, created);
    return created;
};

const appendToBuffer = (
    buffers: Map<string, OutputBuffer>,
    sessionId: string,
    data: string,
) => {
    if (!data) {
        return;
    }

    const buffer = getOrCreateBuffer(buffers, sessionId);

    buffer.chunks.push(data);
    buffer.size += data.length;

    while (
        buffer.size > MAX_REPLAY_BYTES &&
        buffer.chunks.length - buffer.start > 1
    ) {
        const removed = buffer.chunks[buffer.start] || "";
        buffer.start += 1;
        buffer.size -= removed.length;
    }

    if (
        buffer.size > MAX_REPLAY_BYTES &&
        buffer.chunks.length - buffer.start === 1
    ) {
        const only = buffer.chunks[buffer.start] || "";
        const trimmed = only.slice(Math.max(0, only.length - MAX_REPLAY_BYTES));
        buffer.chunks = [trimmed];
        buffer.start = 0;
        buffer.size = trimmed.length;
    }

    if (buffer.start > 1024 && buffer.start > Math.floor(buffer.chunks.length / 2)) {
        buffer.chunks = buffer.chunks.slice(buffer.start);
        buffer.start = 0;
    }
};

const readBuffer = (
    buffers: Map<string, OutputBuffer>,
    sessionId: string,
) => {
    const buffer = buffers.get(sessionId);
    if (!buffer || buffer.size === 0) {
        return "";
    }

    if (buffer.start === 0) {
        return buffer.chunks.join("");
    }

    return buffer.chunks.slice(buffer.start).join("");
};

const getSocketIp = (
    headers: Record<string, string | string[] | undefined>,
    address: string | undefined,
) => {
    const forwarded = headers["x-forwarded-for"];
    if (typeof forwarded === "string" && forwarded.trim()) {
        return forwarded.split(",")[0]?.trim() || null;
    }

    if (Array.isArray(forwarded) && forwarded.length > 0) {
        return forwarded[0]?.split(",")[0]?.trim() || null;
    }

    return address || null;
};

/* ---- Namespace Factory ---- */
const createTerminalNamespace = (
    io: Server,
    sessions: Map<string, Session>,
    getSession: SessionResolver,
    auth: SocketDependencies,
): TerminalNamespace => {
    const namespace = io.of("/terminal");
    const outputBuffers = new Map<string, OutputBuffer>();

    /* ---- Auth ---- */
    namespace.use((socket, next) => {
        const headerToken = auth.getBearerToken(
            typeof socket.handshake.headers.authorization === "string"
                ? socket.handshake.headers.authorization
                : null,
        );
        const token =
            (typeof socket.handshake.auth?.token === "string"
                ? socket.handshake.auth.token
                : null) ||
            (typeof socket.handshake.query?.token === "string"
                ? socket.handshake.query.token
                : null) ||
            headerToken;
        const userAgent =
            typeof socket.handshake.headers["user-agent"] === "string"
                ? socket.handshake.headers["user-agent"]
                : null;
        const resolved = auth.resolvePrincipal({
            token,
            ip: getSocketIp(socket.handshake.headers, socket.handshake.address),
            userAgent,
        });
        if (!resolved.principal) {
            next(new Error("Unauthorized."));
            return;
        }

        const sessionId =
            socket.handshake.auth?.sessionId ||
            socket.handshake.query?.sessionId;

        if (!sessionId || typeof sessionId !== "string") {
            next(new Error("Missing sessionId."));
            return;
        }

        if (!getSession(sessionId)) {
            console.log(`Socket auth failed (missing session): ${sessionId}`);
            next(new Error("Session not found."));
            return;
        }

        socket.data.sessionId = sessionId;
        socket.data.authPrincipal = resolved.principal;
        next();
    });

    /* ---- Event Wiring ---- */
    namespace.on("connection", (socket) => {
        const sessionId: string = socket.data.sessionId;
        const principal = socket.data.authPrincipal as AuthPrincipal;
        const isReadonly = principal?.isReadonly === true;

        const session = getSession(sessionId);
        if (!session) {
            console.log(`Socket connected with missing session: ${sessionId}`);
            socket.disconnect();
            return;
        }

        socket.join(sessionId);
        console.log(`Socket connected: ${socket.id} -> ${sessionId}`);

        const replay = readBuffer(outputBuffers, sessionId);
        if (replay) {
            socket.emit("output", {
                sessionId,
                data: replay,
            });
        }

        socket.on("input", (payload) => {
            if (isReadonly) {
                return;
            }

            if (!payload || payload.sessionId !== sessionId) {
                return;
            }
            session.pty.write(payload.data ?? "");
        });

        socket.on("resize", (payload) => {
            if (isReadonly) {
                return;
            }

            if (!payload || payload.sessionId !== sessionId) {
                return;
            }
            const cols = Number(payload.cols);
            const rows = Number(payload.rows);
            if (Number.isFinite(cols) && Number.isFinite(rows)) {
                session.pty.resize(cols, rows);
            }
        });

        socket.on("disconnect", (reason) => {
            console.log(
                `Socket disconnected: ${socket.id} -> ${sessionId} (${reason})`,
            );
        });
    });

    /* ---- PTY Bridge ---- */
    const attachPty = (sessionId: string, pty: IPty) => {
        pty.onData(data => {
            appendToBuffer(outputBuffers, sessionId, data);

            if (DEBUG_LOG_OUTPUT) {
                console.log(data);
            }

            namespace.to(sessionId).emit("output", {
                sessionId,
                data,
            });
        });

        pty.onExit(event => {
            console.log(`PTY exit for session ${sessionId}: ${event.exitCode}`);
            namespace.to(sessionId).emit("exit", {
                sessionId,
                code: event.exitCode,
                signal: event.signal ?? null,
            });
            namespace.in(sessionId).socketsLeave(sessionId);
            sessions.delete(sessionId);
            outputBuffers.delete(sessionId);
        });
    };

    return { namespace, attachPty };
};

export type { Session, TerminalNamespace };
export default createTerminalNamespace;
