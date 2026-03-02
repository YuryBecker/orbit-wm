import { makeAutoObservable } from "mobx";

type ClientsStoreLike = {
    allowRequest: (
        requestId: string,
        scope?: "readonly" | "control",
    ) => Promise<unknown>;
    denyRequest: (requestId: string) => Promise<boolean>;
    setUserReadonly: (userId: string, value: boolean) => Promise<unknown>;
    revokeUserTokens: (userId: string) => Promise<unknown>;
};


class ClientInstance {
    private root: ClientsStoreLike;

    constructor(
        root: ClientsStoreLike,
        public id: string,
    ) {
        this.root = root;

        makeAutoObservable(this);
    }

    /* ---- Observables ---- */
    /** Entity kind for UI rendering. */
    public kind: "request" | "user" = "request";

    /** Human label for this client. */
    public label = "Device";

    /** Last known IP address. */
    public ip: string | null = null;

    /** Last known user-agent. */
    public userAgent: string | null = null;

    /** Request/user status. */
    public status: "pending" | "approved" | "denied" = "pending";

    /** Whether this user is read-only. */
    public isReadonly = true;

    /** Whether this user is approved. */
    public isApproved = false;

    /** Creation timestamp. */
    public createdAt: string | null = null;

    /** Resolution/update timestamp. */
    public resolvedAt: string | null = null;


    /* ---- Actions ---- */
    /** Hydrate fields from API payload. */
    public hydrate = (payload: {
        kind?: "request" | "user";
        label?: string;
        ip?: string | null;
        userAgent?: string | null;
        status?: "pending" | "approved" | "denied";
        isReadonly?: boolean;
        isApproved?: boolean;
        createdAt?: string | null;
        resolvedAt?: string | null;
    }) => {
        if (payload.kind) {
            this.kind = payload.kind;
        }
        if (typeof payload.label === "string") {
            this.label = payload.label;
        }
        if (payload.ip !== undefined) {
            this.ip = payload.ip;
        }
        if (payload.userAgent !== undefined) {
            this.userAgent = payload.userAgent;
        }
        if (payload.status) {
            this.status = payload.status;
        }
        if (typeof payload.isReadonly === "boolean") {
            this.isReadonly = payload.isReadonly;
        }
        if (typeof payload.isApproved === "boolean") {
            this.isApproved = payload.isApproved;
        }
        if (payload.createdAt !== undefined) {
            this.createdAt = payload.createdAt;
        }
        if (payload.resolvedAt !== undefined) {
            this.resolvedAt = payload.resolvedAt;
        }
    };

    /** Approve a pending request. */
    public allow = async (scope: "readonly" | "control" = "control") =>
        this.root.allowRequest(this.id, scope);

    /** Deny a pending request. */
    public disallow = async () =>
        this.root.denyRequest(this.id);

    /** Update read-only mode for an approved user. */
    public setReadonly = async (value: boolean) =>
        this.root.setUserReadonly(this.id, value);

    /** Revoke all tokens for this user. */
    public revokeTokens = async () =>
        this.root.revokeUserTokens(this.id);
}

export default ClientInstance;
