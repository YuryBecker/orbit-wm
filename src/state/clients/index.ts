import { makeAutoObservable } from "mobx";
import { toast } from "sonner";

import { getMiddleBaseUrl } from "../baseUrl";
import ClientInstance from "./instance";

type MePayload = {
    kind: "host" | "user";
    userId: string | null;
    label: string;
    scope: "readonly" | "control";
    isReadonly: boolean;
};


const STORAGE_TOKEN_KEY = "orbitAuthToken";
const STORAGE_REQUEST_ID_KEY = "orbitAccessRequestId";
const STORAGE_REQUEST_CLAIM_KEY = "orbitAccessClaim";

const DEFAULTS = {
    instances: {} as Record<string, ClientInstance>,
    token: null as string | null,
    me: null as MePayload | null,
    ready: false,
    needsApproval: false,
    pendingRequestId: null as string | null,
    pendingRequestClaim: null as string | null,
    approvalDialogOpen: false,
    pairing: null as {
        pairingCode: string;
        pairingUrl: string | null;
        scope: "readonly" | "control";
        expiresAt: string;
    } | null,
    pairingDialogOpen: false,
};

class ClientsStore {
    constructor() {
        makeAutoObservable(this);
    }

    /* ---- Observables ---- */
    /** All device/users keyed by id. */
    public instances: Record<string, ClientInstance> = DEFAULTS.instances;

    /** Auth token for non-loopback clients. */
    public token: string | null = DEFAULTS.token;

    /** Current authenticated principal details. */
    public me: MePayload | null = DEFAULTS.me;

    /** Whether bootstrap finished. */
    public ready = DEFAULTS.ready;

    /** Whether this client is waiting for host approval. */
    public needsApproval = DEFAULTS.needsApproval;

    /** Pending access request id for claim polling. */
    public pendingRequestId: string | null = DEFAULTS.pendingRequestId;

    /** One-time claim secret for pending access request. */
    public pendingRequestClaim: string | null = DEFAULTS.pendingRequestClaim;

    /** Whether the host approval dialog is open. */
    public approvalDialogOpen = DEFAULTS.approvalDialogOpen;

    /** Latest pairing payload shown to host. */
    public pairing = DEFAULTS.pairing;

    /** Whether the pairing QR dialog is open. */
    public pairingDialogOpen = DEFAULTS.pairingDialogOpen;

    /** Last ids we've already shown a join toast for. */
    private seenJoinRequestIds = new Set<string>();

    /** Poll timer for pending access claim. */
    private claimPollTimer: ReturnType<typeof setInterval> | null = null;

    /** Poll timer for host request notifications. */
    private requestPollTimer: ReturnType<typeof setInterval> | null = null;


    /* ---- Computed ---- */
    /** Base URL for middle APIs. */
    public get baseUrl() {
        return getMiddleBaseUrl();
    }

    /** Whether this browser currently has API access. */
    public get hasAccess() {
        return !!this.me;
    }

    /** True for local host principal. */
    public get isHost() {
        return this.me?.kind === "host";
    }

    /** All pending join requests. */
    public get pendingRequests() {
        return Object.values(this.instances)
            .filter((instance) => instance.kind === "request")
            .filter((instance) => instance.status === "pending")
            .sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
    }

    /** All known users. */
    public get users() {
        return Object.values(this.instances)
            .filter((instance) => instance.kind === "user")
            .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    }

    /** All historical requests (non-pending included). */
    public get requestHistory() {
        return Object.values(this.instances)
            .filter((instance) => instance.kind === "request")
            .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    }


    /* ---- Actions ---- */
    /** Build auth headers for API calls. */
    public getAuthHeaders = () => {
        if (!this.token) {
            return {};
        }

        return {
            Authorization: `Bearer ${this.token}`,
        };
    };

    /** Perform fetch with token attached when available. */
    public authFetch = async (url: string, options: RequestInit = {}) => {
        const headers = new Headers(options.headers || undefined);
        const authHeaders = this.getAuthHeaders();
        if (authHeaders.Authorization) {
            headers.set("Authorization", authHeaders.Authorization);
        }

        return fetch(url, {
            ...options,
            headers,
        });
    };

    /** Token passed to Socket.IO auth payloads. */
    public getSocketToken = () => this.token;

    /** Open/close approval dialog. */
    public setApprovalDialogOpen = (open: boolean) => {
        this.approvalDialogOpen = open;
    };

    /** Open/close pairing dialog. */
    public setPairingDialogOpen = (open: boolean) => {
        this.pairingDialogOpen = open;
    };

    /** Load saved token/request state and resolve access mode. */
    public bootstrap = async () => {
        if (typeof window !== "undefined") {
            this.token = globalThis.localStorage.getItem(STORAGE_TOKEN_KEY);
            this.pendingRequestId = globalThis.localStorage.getItem(STORAGE_REQUEST_ID_KEY);
            this.pendingRequestClaim = globalThis.localStorage.getItem(STORAGE_REQUEST_CLAIM_KEY);
        }

        const meResponse = await this.authFetch(`${this.baseUrl}/api/me`);
        if (meResponse.ok) {
            this.me = await meResponse.json();
            this.needsApproval = false;
            this.ready = true;
            this.startHostPolling();
            return;
        }

        this.me = null;

        if (this.pendingRequestId && this.pendingRequestClaim) {
            this.needsApproval = true;
            this.startClaimPolling();
            this.ready = true;
            return;
        }

        const requestResponse = await this.authFetch(`${this.baseUrl}/api/device-requests`, {
            method: "POST",
        });

        if (!requestResponse.ok) {
            this.ready = true;
            return;
        }

        const payload = await requestResponse.json();
        this.pendingRequestId = payload?.id ?? null;
        this.pendingRequestClaim = payload?.claimCode ?? null;
        this.persistPendingClaim();
        this.needsApproval = true;
        this.startClaimPolling();
        this.ready = true;
    };

    /** Approve pending request and sync lists. */
    public allowRequest = async (
        requestId: string,
        scope: "readonly" | "control" = "control",
    ) => {
        const response = await this.authFetch(
            `${this.baseUrl}/api/device-requests/${requestId}/approve`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    scope,
                }),
            },
        );

        if (!response.ok) {
            return null;
        }

        await this.refreshHostData();
        return response.json();
    };

    /** Deny pending request and sync lists. */
    public denyRequest = async (requestId: string) => {
        const response = await this.authFetch(
            `${this.baseUrl}/api/device-requests/${requestId}/deny`,
            {
                method: "POST",
            },
        );

        if (!response.ok) {
            return false;
        }

        await this.refreshHostData();
        return true;
    };

    /** Update user readonly flag. */
    public setUserReadonly = async (userId: string, value: boolean) => {
        const response = await this.authFetch(`${this.baseUrl}/api/users/${userId}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                isReadonly: value,
            }),
        });

        if (!response.ok) {
            return null;
        }

        const payload = await response.json();
        this.upsertInstance(payload.id, {
            kind: "user",
            isReadonly: payload.isReadonly,
            isApproved: payload.isApproved,
        });
        return payload;
    };

    /** Revoke all tokens belonging to a user. */
    public revokeUserTokens = async (userId: string) => {
        const response = await this.authFetch(
            `${this.baseUrl}/api/users/${userId}/revoke-tokens`,
            {
                method: "POST",
            },
        );

        if (!response.ok) {
            return null;
        }

        return response.json();
    };

    /** Refresh users + request history for host management UI. */
    public refreshHostData = async () => {
        if (!this.hasAccess || !this.isHost) {
            return;
        }

        const [pendingResponse, historyResponse, usersResponse] = await Promise.all([
            this.authFetch(`${this.baseUrl}/api/device-requests`),
            this.authFetch(`${this.baseUrl}/api/device-history`),
            this.authFetch(`${this.baseUrl}/api/users`),
        ]);

        if (pendingResponse.ok) {
            const payload = await pendingResponse.json();
            (payload?.requests || []).forEach((request: any) => {
                this.upsertInstance(request.id, {
                    kind: "request",
                    label: request.ip ? `Device ${request.ip}` : "Device",
                    ip: request.ip ?? null,
                    userAgent: request.userAgent ?? null,
                    status: request.status ?? "pending",
                    createdAt: request.createdAt ?? null,
                    resolvedAt: request.resolvedAt ?? null,
                });
            });
        }

        if (historyResponse.ok) {
            const payload = await historyResponse.json();
            (payload?.requests || []).forEach((request: any) => {
                this.upsertInstance(request.id, {
                    kind: "request",
                    label: request.ip ? `Device ${request.ip}` : "Device",
                    ip: request.ip ?? null,
                    userAgent: request.userAgent ?? null,
                    status: request.status ?? "pending",
                    createdAt: request.createdAt ?? null,
                    resolvedAt: request.resolvedAt ?? null,
                });
            });
        }

        if (usersResponse.ok) {
            const payload = await usersResponse.json();
            (payload?.users || []).forEach((user: any) => {
                this.upsertInstance(user.id, {
                    kind: "user",
                    label: user.label ?? "User",
                    ip: user.lastIp ?? null,
                    userAgent: user.lastUserAgent ?? null,
                    status: user.isApproved ? "approved" : "denied",
                    isReadonly: !!user.isReadonly,
                    isApproved: !!user.isApproved,
                    createdAt: user.createdAt ?? null,
                    resolvedAt: user.updatedAt ?? null,
                });
            });
        }

        this.notifyNewPendingRequests();
    };

    /** Generate pairing code/link from host UI. */
    public createPairing = async (scope: "readonly" | "control" = "control") => {
        const response = await this.authFetch(`${this.baseUrl}/api/pairing/start`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                scope,
            }),
        });

        if (!response.ok) {
            return null;
        }
        const payload = await response.json();
        this.pairing = payload;
        return payload;
    };

    /** Complete pairing with a one-time code and persist issued token. */
    public completePairing = async (code: string, label?: string) => {
        const response = await fetch(`${this.baseUrl}/api/pairing/complete`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                code,
                label: label || undefined,
            }),
        });

        if (!response.ok) {
            return null;
        }

        const payload = await response.json();
        const token = payload?.token as string | undefined;
        if (!token) {
            return null;
        }

        this.token = token;
        this.persistToken();
        this.pendingRequestId = null;
        this.pendingRequestClaim = null;
        this.persistPendingClaim();
        this.needsApproval = false;
        this.stopClaimPolling();

        const meResponse = await this.authFetch(`${this.baseUrl}/api/me`);
        if (meResponse.ok) {
            this.me = await meResponse.json();
        }

        return payload;
    };

    /** Create a control pairing link and copy it to clipboard when possible. */
    public createPairingAndCopy = async (
        scope: "readonly" | "control" = "control",
    ) => {
        const payload = await this.createPairing(scope);
        await this.copyPairingUrl(payload?.pairingUrl || null);
        return payload;
    };

    /** Open pairing dialog and create a fresh link for the requested scope. */
    public openPairingDialog = async (
        scope: "readonly" | "control" = "control",
    ) => {
        this.pairingDialogOpen = true;
        return this.createPairing(scope);
    };

    /** Copy provided pairing URL (or latest pairing URL) to clipboard. */
    public copyPairingUrl = async (url?: string | null) => {
        const link = url ?? this.pairing?.pairingUrl ?? null;
        if (!link) {
            return false;
        }

        if (typeof window === "undefined" || !navigator?.clipboard?.writeText) {
            return false;
        }

        await navigator.clipboard.writeText(link);
        return true;
    };

    /** Clear current client token and pending state. */
    public clearAuthState = () => {
        this.token = null;
        this.me = null;
        this.needsApproval = false;
        this.pendingRequestId = null;
        this.pendingRequestClaim = null;
        this.stopClaimPolling();
        this.persistToken();
        this.persistPendingClaim();
    };

    private upsertInstance = (
        id: string,
        payload: {
            kind?: "request" | "user";
            label?: string;
            ip?: string | null;
            userAgent?: string | null;
            status?: "pending" | "approved" | "denied";
            isReadonly?: boolean;
            isApproved?: boolean;
            createdAt?: string | null;
            resolvedAt?: string | null;
        },
    ) => {
        const existing = this.instances[id];
        if (existing) {
            existing.hydrate(payload);
            return existing;
        }

        const instance = new ClientInstance(this, id);
        instance.hydrate(payload);
        this.instances = {
            ...this.instances,
            [id]: instance,
        };
        return instance;
    };

    private notifyNewPendingRequests = () => {
        this.pendingRequests.forEach((request) => {
            if (this.seenJoinRequestIds.has(request.id)) {
                return;
            }

            this.seenJoinRequestIds.add(request.id);
            const label = request.ip || request.label;
            toast(`Device waiting: ${label}`, {
                action: {
                    label: "Review",
                    onClick: () => this.setApprovalDialogOpen(true),
                },
            });
        });
    };

    private startHostPolling = () => {
        if (!this.isHost) {
            return;
        }

        if (this.requestPollTimer) {
            return;
        }

        void this.refreshHostData();
        this.requestPollTimer = setInterval(() => {
            void this.refreshHostData();
        }, 2500);
    };

    private stopClaimPolling = () => {
        if (!this.claimPollTimer) {
            return;
        }
        clearInterval(this.claimPollTimer);
        this.claimPollTimer = null;
    };

    private startClaimPolling = () => {
        if (!this.pendingRequestId || !this.pendingRequestClaim) {
            return;
        }

        this.stopClaimPolling();
        this.claimPollTimer = setInterval(() => {
            void this.pollRequestClaim();
        }, 1500);
        void this.pollRequestClaim();
    };

    private pollRequestClaim = async () => {
        if (!this.pendingRequestId || !this.pendingRequestClaim) {
            return;
        }

        const response = await fetch(
            `${this.baseUrl}/api/device-requests/${this.pendingRequestId}?claim=${encodeURIComponent(this.pendingRequestClaim)}`
        );

        if (!response.ok) {
            return;
        }

        const payload = await response.json();
        if (typeof payload?.token !== "string" || !payload.token) {
            return;
        }

        this.token = payload.token;
        this.persistToken();
        this.pendingRequestId = null;
        this.pendingRequestClaim = null;
        this.persistPendingClaim();
        this.needsApproval = false;
        this.stopClaimPolling();

        const meResponse = await this.authFetch(`${this.baseUrl}/api/me`);
        if (meResponse.ok) {
            this.me = await meResponse.json();
        }
    };

    private persistToken = () => {
        if (typeof window === "undefined") {
            return;
        }

        if (this.token) {
            globalThis.localStorage.setItem(STORAGE_TOKEN_KEY, this.token);
            return;
        }

        globalThis.localStorage.removeItem(STORAGE_TOKEN_KEY);
    };

    private persistPendingClaim = () => {
        if (typeof window === "undefined") {
            return;
        }

        if (this.pendingRequestId) {
            globalThis.localStorage.setItem(STORAGE_REQUEST_ID_KEY, this.pendingRequestId);
        } else {
            globalThis.localStorage.removeItem(STORAGE_REQUEST_ID_KEY);
        }

        if (this.pendingRequestClaim) {
            globalThis.localStorage.setItem(STORAGE_REQUEST_CLAIM_KEY, this.pendingRequestClaim);
        } else {
            globalThis.localStorage.removeItem(STORAGE_REQUEST_CLAIM_KEY);
        }
    };
}

export default new ClientsStore();
