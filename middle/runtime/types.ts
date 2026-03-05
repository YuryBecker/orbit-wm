import type { IPty } from "node-pty";



type RuntimeKind = "host" | "docker";

type RuntimeCreateResult = {
    runtimeSessionId: string;
    pty: IPty;
};

type RuntimeSessionOptions = {
    runtimeGroupId?: string | null;
};

type RuntimePrewarmResult = {
    created: boolean;
    runtimeSessionId: string | null;
};

interface SessionRuntime {
    kind: RuntimeKind;
    configure: () => void;
    prewarmSession: (options?: RuntimeSessionOptions) => RuntimePrewarmResult;
    createSession: (
        sessionId: string,
        options?: RuntimeSessionOptions,
    ) => RuntimeCreateResult;
    attachSession: (sessionId: string, runtimeSessionId: string) => IPty;
    hasSession: (sessionId: string, runtimeSessionId: string) => boolean;
    destroySession: (sessionId: string, runtimeSessionId: string) => void;
}

export type {
    RuntimeKind,
    RuntimeCreateResult,
    RuntimePrewarmResult,
    RuntimeSessionOptions,
    SessionRuntime,
};
