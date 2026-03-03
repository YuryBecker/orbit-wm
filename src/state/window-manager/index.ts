import { makeAutoObservable } from "mobx";

import clients from "state/clients";
import config from "state/config";
import { getMiddleBaseUrl } from "../baseUrl";
import WindowPaneInstance from "./instance";
import WindowNode, { Rect } from "./node";


export class WindowManager {
    constructor() {
        makeAutoObservable(this, {
            root: false,
        });
    }

    /* ---- Observables ---- */
    /** Workspace bounds used for layout calculations. */
    public workspace: Rect = DEFAULTS.workspace;

    /** Default split ratio for new nodes. */
    public splitRatio = DEFAULTS.splitRatio;

    /** Width multiplier used to decide split orientation. */
    public splitWidthMultiplier = DEFAULTS.splitWidthMultiplier;

    /** All window instances keyed by id. */
    public instances: Record<string, WindowPaneInstance> = DEFAULTS.instances;

    /** Currently active window id. */
    public activeId: string | null = DEFAULTS.activeId;

    /** Active layout session id. */
    public layoutId: string | null = null;

    /** Active layout slot number. */
    public layoutSlot: number | null = null;

    /** All known layouts keyed by explicit layout slot numbers. */
    public layouts: LayoutSessionRecord[] = [];

    /** Whether the workspace finished loading. */
    public isReady = false;

    /** Root node for the dwindle tree. */
    public root: WindowNode | null = null;

    public size = { width: 1024, height: 1024 };

    /** Prevent persistence writes during hydration. */
    private suppressSave = false;

    /** Debounce timer for layout persistence requests. */
    private saveLayoutTimer: ReturnType<typeof setTimeout> | null = null;

    /** Most-recently-focused window ids (latest at the end). */
    private focusHistory: string[] = [];


    /* ---- Computed ---- */
    /** Base URL for the middle layer. */
    public get baseUrl() {
        return getMiddleBaseUrl();
    }

    /** Whether the workspace has finished bootstrapping. */
    public get ready() {
        return this.isReady;
    }
    /** Active window instance. */
    public get active(): WindowPaneInstance | null {
        if (!this.activeId) {
            return null;
        }

        return this.instances[this.activeId] || null;
    }

    /** All window instances in insertion order. */
    public get all() {
        return Object.values(this.instances);
    }

    public get needsNewSession(): boolean {
        return this.all.length > 0;
    }

    /** Active layout slot number. */
    public get activeLayoutIndex() {
        if (typeof this.layoutSlot === "number" && this.layoutSlot > 0) {
            return this.layoutSlot;
        }

        if (!this.layoutId) {
            return null;
        }

        const activeLayout = this.layouts.find((layout) => layout.id === this.layoutId);
        if (!activeLayout) {
            return null;
        }

        return activeLayout.slot;
    }

    /** Serialized state for persistence. */
    public get serialized() {
        const windows = this.all.map((instance) => ({
            title: instance.title,
            sessionId: instance.sessionId,
            kind: instance.kind,
            url: instance.url,
            x: instance.x,
            y: instance.y,
            width: instance.width,
            height: instance.height,
        }));

        const indexById = new Map<string, number>();
        this.all.forEach((instance, index) => {
            indexById.set(instance.id, index);
        });

        const activeIndex = this.activeId
            ? this.all.findIndex((instance) => instance.id === this.activeId)
            : -1;

        return {
            windows,
            activeIndex: activeIndex >= 0 ? activeIndex : undefined,
            layout: this.serializeLayoutNode(this.root, indexById) ?? undefined,
        };
    }


    /* ---- Actions ---- */
    /** Load and hydrate a layout by id. */
    public loadLayout = async (layoutId: string | null) => {
        if (!layoutId) {
            return null;
        }

        await this.deletePreviousLayoutIfEmpty(layoutId);

        const payload = await this.fetchLayout(layoutId);
        if (!payload) {
            return null;
        }

        this.layoutId = layoutId;
        this.layoutSlot = this.resolveLayoutSlot(layoutId, payload?.data ?? null);
        this.setLastLayoutId(layoutId);
        this.hydrateFromLayout(payload?.data, layoutId);
        this.computeLayout();
        return payload;
    };

    public setSize = (size: WindowManager['size']) => {
        this.size = size;

        this.computeLayout();
    };

    public computeLayout = () => {
        const gap = config.gap;
        const inset = gap / 2;

        this.setWorkspace({
            x: inset,
            y: inset,
            width: Math.max(0, this.size.width - config.gap),
            height: Math.max(0, this.size.height - config.gap),
        });
    };

    /** Ensure a layout exists and hydrate state. */
    public ensureActiveLayout = async () => {
        await this.fetchLayouts();

        const localLayoutId = this.getLastLayoutId();
        if (localLayoutId) {
            const payload = await this.loadLayout(localLayoutId);
            if (payload?.id) {
                return payload.id;
            }
        }

        const latestLayout = [...this.layouts]
            .sort((a, b) => Date.parse(b.updatedAt || "") - Date.parse(a.updatedAt || ""))[0];
        if (latestLayout?.id) {
            const payload = await this.loadLayout(latestLayout.id);
            if (payload?.id) {
                return payload.id;
            }
        }

        const created = await this.createLayout();
        if (created?.id) {
            return created.id;
        }

        return null;
    };

    /** Create a window and attach a new terminal session. */
    public createTerminalWindow = async () => {
        const activeLayoutId = this.layoutId || (await this.ensureActiveLayout());
        if (!activeLayoutId) {
            return null;
        }

        const sessionId = await this.addWindowPane();
        if (!sessionId) {
            return null;
        }

        return this.add({
            title: "Terminal",
            sessionId,
            openingId: this.activeId,
            kind: "terminal",
        });
    };

    /** Create a browser window. */
    public createBrowserWindow = async (url = "") => {
        const activeLayoutId = this.layoutId || (await this.ensureActiveLayout());
        if (!activeLayoutId) {
            return null;
        }

        return this.add({
            title: "Browser",
            openingId: this.activeId,
            kind: "browser",
            url,
        });
    };

    /** Bootstrap the workspace state. */
    public bootstrap = async () => {
        const id = await this.ensureActiveLayout();
        await config.fetchConfig();
        if (!id && this.all.length === 0) {
            this.layoutId = null;
            this.layoutSlot = null;
        }
        this.isReady = true;
        return id;
    };

    /** Open layout by explicit slot number. */
    public openLayoutByIndex = async (layoutNumber: number) => {
        if (layoutNumber <= 0 || layoutNumber > MAX_LAYOUTS) {
            return null;
        }

        await this.fetchLayouts();
        const target = this.layouts.find((layout) => layout.slot === layoutNumber);
        if (target?.id) {
            const payload = await this.loadLayout(target.id);
            if (!payload?.id) {
                return null;
            }

            await this.fetchLayouts();
            return payload.id;
        }

        const created = await this.createLayout(layoutNumber);
        if (!created?.id) {
            return null;
        }

        await this.fetchLayouts();
        return created.id;
    };

    /** Create a new empty layout session and switch to it. */
    public createLayout = async (requestedSlot?: number) => {
        if (this.layouts.length >= MAX_LAYOUTS) {
            return null;
        }

        if (typeof requestedSlot === "number" && requestedSlot > MAX_LAYOUTS) {
            return null;
        }

        const layoutSlot = Number.isInteger(requestedSlot) && (requestedSlot as number) > 0
            ? (requestedSlot as number)
            : this.getNextAvailableLayoutSlot();

        try {
            const response = await clients.authFetch(`${this.baseUrl}/api/session`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    name: `Layout ${layoutSlot}`,
                    data: {
                        orbitType: "layout",
                        orbitLayoutSlot: layoutSlot,
                    },
                }),
            });
            if (!response.ok) {
                return null;
            }

            const payload = (await response.json()) as LayoutSessionPayload;
            this.layoutId = payload.id;
            this.layoutSlot = layoutSlot;
            this.setLastLayoutId(payload.id);
            this.hydrateFromLayout(payload?.data, payload.id);
            this.computeLayout();
            await this.fetchLayouts();
            return payload;
        } catch {
            return null;
        }
    };

    /** Delete a layout and move to another available layout if needed. */
    public deleteLayout = async (layoutId: string) => {
        const response = await clients.authFetch(`${this.baseUrl}/api/session/${layoutId}`, {
            method: "DELETE",
        });

        if (!response.ok && response.status !== 404) {
            return false;
        }

        const wasActive = this.layoutId === layoutId;
        await this.fetchLayouts();

        if (!wasActive) {
            return true;
        }

        const next = [...this.layouts]
            .sort((a, b) => Date.parse(b.updatedAt || "") - Date.parse(a.updatedAt || ""))[0];
        if (next?.id) {
            const payload = await this.loadLayout(next.id);
            if (payload?.id) {
                return true;
            }
        }

        const created = await this.createLayout();
        if (created?.id) {
            return true;
        }

        this.layoutId = null;
        this.layoutSlot = null;
        this.clearLastLayoutId();
        this.suppressSave = true;
        this.reset();
        this.suppressSave = false;
        return true;
    };

    /** Update the workspace bounds and recompute layout. */
    public setWorkspace = (workspace: Rect) => {
        this.workspace = workspace;
        this.recalculate();
    };

    /** Create a new window instance and insert it into the layout. */
    public add = (options: {
        title?: string;
        sessionId?: string | null;
        openingId?: string | null;
        kind?: "terminal" | "browser";
        url?: string;
        shouldSave?: boolean;
    }) => {
        const instance = new WindowPaneInstance(
            options.title,
            options.kind ?? "terminal",
            this,
        );

        if (options.sessionId) {
            instance.sessionId = options.sessionId;
        }
        if (options.url) {
            instance.url = options.url;
        }

        this.instances = {
            ...this.instances,
            [instance.id]: instance,
        };

        this.insertNode(instance, options.openingId ?? this.activeId);
        this.setActive(instance.id);

        // Save layout:
        if (options.shouldSave !== false) {
            void this.saveLayout();
        }

        return instance;
    };

    /** Hydrate windows from persisted layout data. */
    public hydrateFromLayout = (
        data: {
            windows?: {
                title?: string;
                sessionId?: string | null;
                kind?: "terminal" | "browser";
                url?: string;
                x?: number;
                y?: number;
                width?: number;
                height?: number;
            }[];
            activeIndex?: number;
            layout?: SerializedLayoutNode | null;
        } | null,
        fallbackSessionId: string | null,
    ) => {
        this.suppressSave = true;
        this.reset();

        const windows =
            data?.windows?.length && data.windows.length > 0
                ? [...data.windows]
                : [];

        const canHydrateLayout =
            windows.length > 0 &&
            data?.layout !== undefined &&
            data?.layout !== null;

        if (canHydrateLayout) {
            const created = windows.map((window) =>
                this.createInstanceFromSerializedWindow(window, fallbackSessionId),
            );

            const root = this.hydrateLayoutNode(data?.layout ?? null, created);
            if (root) {
                this.root = root;
                this.recalculate();

                let nextActiveId: string | null = created[0]?.id ?? null;
                if (
                    typeof data?.activeIndex === "number" &&
                    data.activeIndex >= 0 &&
                    data.activeIndex < created.length
                ) {
                    nextActiveId = created[data.activeIndex].id;
                }
                this.setActive(nextActiveId);

                this.suppressSave = false;
                return;
            }

            this.reset();
        }

        windows.forEach((window) => {
            const kind = window.kind ?? "terminal";
            this.add({
                title: window.title ?? "Terminal",
                sessionId:
                    kind === "terminal"
                        ? (window.sessionId ?? fallbackSessionId)
                        : null,
                kind,
                url: window.url,
                shouldSave: false,
            });
        });

        let nextActiveId: string | null = this.all[0]?.id ?? null;
        if (
            typeof data?.activeIndex === "number" &&
            data.activeIndex >= 0 &&
            data.activeIndex < this.all.length
        ) {
            nextActiveId = this.all[data.activeIndex].id;
        }
        this.setActive(nextActiveId);

        this.suppressSave = false;

        if (data?.layout === undefined || data?.layout === null) {
            void this.saveLayout();
        }
    };

    /** Remove a window instance and its node from the layout. */
    public remove = (id: string) => {
        const instance = this.instances[id];

        if (!instance) {
            console.error(`Could not remove window with id ${ id }. Window not found.`);
            return;
        }

        const shouldDeleteTerminalSession =
            instance.kind === "terminal" &&
            !!instance.sessionId &&
            !this.all.some(
                (existing) => existing.id !== id && existing.sessionId === instance.sessionId,
            );
        const sessionIdToDelete =
            shouldDeleteTerminalSession && instance.sessionId
                ? instance.sessionId
                : null;

        instance.dispose();
        this.removeNode(instance);

        const update = { ...this.instances };
        delete update[id];
        this.instances = update;
        this.removeFromFocusHistory(id);

        if (this.activeId === id) {
            const fallbackId =
                this.getLastFocusedId(update) ||
                Object.keys(update)[0] ||
                null;
            this.activeId = null;
            this.setActive(fallbackId);
        }

        if (sessionIdToDelete) {
            void this.deleteTerminalSession(sessionIdToDelete);
        }

        // Save layout:
        void this.saveLayout();
    };

    /** Set the active window id if it exists. */
    public setActive = (id: string | null) => {
        if (!id) {
            this.activeId = null;
            return;
        }

        const instance = this.instances[id];
        if (!instance) {
            return;
        }

        this.activeId = id;
        this.trackFocus(id);
        instance.focus();
    };

    /** Find the nearest window id in the given direction, relative to an origin window. */
    private getBestNeighborId = (
        origin: WindowPaneInstance,
        direction: Direction,
    ): string | null => {
        type CandidateScore = { id: string; score: number };
        let best: CandidateScore | null = null;
        let hasAdjacent = false;
        const epsilon = 2;

        const originLeft = origin.x;
        const originRight = origin.x + origin.width;
        const originTop = origin.y;
        const originBottom = origin.y + origin.height;

        for (const candidate of this.all) {
            if (candidate.id === origin.id) {
                continue;
            }

            const candidateLeft = candidate.x;
            const candidateRight = candidate.x + candidate.width;
            const candidateTop = candidate.y;
            const candidateBottom = candidate.y + candidate.height;

            const overlapsVertically =
                Math.max(originTop, candidateTop) <
                Math.min(originBottom, candidateBottom);
            const overlapsHorizontally =
                Math.max(originLeft, candidateLeft) <
                Math.min(originRight, candidateRight);

            let adjacent = false;
            let overlapLength = 0;
            let distance = 0;

            if (direction === "left") {
                adjacent = Math.abs(originLeft - candidateRight) <= epsilon;
                if (overlapsVertically) {
                    overlapLength =
                        Math.min(originBottom, candidateBottom) -
                        Math.max(originTop, candidateTop);
                }
                distance = originLeft - candidateRight;
            } else if (direction === "right") {
                adjacent = Math.abs(originRight - candidateLeft) <= epsilon;
                if (overlapsVertically) {
                    overlapLength =
                        Math.min(originBottom, candidateBottom) -
                        Math.max(originTop, candidateTop);
                }
                distance = candidateLeft - originRight;
            } else if (direction === "up") {
                adjacent = Math.abs(originTop - candidateBottom) <= epsilon;
                if (overlapsHorizontally) {
                    overlapLength =
                        Math.min(originRight, candidateRight) -
                        Math.max(originLeft, candidateLeft);
                }
                distance = originTop - candidateBottom;
            } else {
                adjacent = Math.abs(originBottom - candidateTop) <= epsilon;
                if (overlapsHorizontally) {
                    overlapLength =
                        Math.min(originRight, candidateRight) -
                        Math.max(originLeft, candidateLeft);
                }
                distance = candidateTop - originBottom;
            }

            if (distance < -epsilon) {
                continue;
            }

            if (adjacent && overlapLength > 0) {
                hasAdjacent = true;
                const score = -overlapLength;
                if (!best || score < best.score) {
                    best = { id: candidate.id, score };
                }
                continue;
            }

            if (!hasAdjacent && distance >= 0) {
                const score = distance;
                if (!best || score < best.score) {
                    best = { id: candidate.id, score };
                }
            }
        }

        return best?.id ?? null;
    };

    /** Focus the nearest window in the given direction. */
    public focusNeighbor = (
        direction: Direction,
    ) => {
        const active = this.active;
        if (!active) {
            this.setActive(this.all[0]?.id ?? null);
            return;
        }

        const neighborId = this.getBestNeighborId(active, direction);
        if (neighborId) {
            this.setActive(neighborId);
        }
    };

    /** Swap the active window with the nearest window in the given direction. */
    public swapNeighbor = (direction: Direction) => {
        const active = this.active;
        if (!active) {
            this.setActive(this.all[0]?.id ?? null);
            return;
        }

        const neighborId = this.getBestNeighborId(active, direction);
        if (!neighborId) {
            return;
        }

        this.swapWindows(active.id, neighborId);
        this.active?.focus();
    };


    /** Swap the split direction for the node that owns a window. */
    public toggleSplit = (id: string) => {
        const node = this.findNodeByWindowId(id);
        if (!node?.parent) {
            return;
        }

        node.parent.splitTop = !node.parent.splitTop;
        this.recalculate();
        void this.saveLayout();
    };

    /** Swap the window with its sibling within the parent split. */
    public swapSplit = (id: string) => {
        const node = this.findNodeByWindowId(id);
        if (!node?.parent) {
            return;
        }

        const parent = node.parent;
        parent.children = [parent.children[1], parent.children[0]];
        this.recalculate();
        void this.saveLayout();
    };

    /** Swap two windows in the layout tree. */
    public swapWindows = (firstId: string, secondId: string) => {
        if (firstId === secondId) {
            return;
        }

        const firstNode = this.findNodeByWindowId(firstId);
        const secondNode = this.findNodeByWindowId(secondId);
        if (!firstNode || !secondNode) {
            return;
        }

        const temp = firstNode.window;
        firstNode.window = secondNode.window;
        secondNode.window = temp;

        this.recalculate();
        void this.saveLayout();
    };

    /** Start resizing a window edge by adjusting the nearest split boundary. */
    public beginResize = (
        windowId: string,
        edge: ResizeEdge,
        clientX: number,
        clientY: number,
    ): ResizeContext | null => {
        const leaf = this.findNodeByWindowId(windowId);
        if (!leaf) {
            return null;
        }

        const target = this.findResizeSplitNode(leaf, edge);
        if (!target) {
            return null;
        }

        return {
            node: target,
            edge,
            startX: clientX,
            startY: clientY,
            startRatio: target.splitRatio,
            box: { ...target.box },
        };
    };

    /** Apply a resize update based on the current pointer position. */
    public updateResize = (
        context: ResizeContext,
        clientX: number,
        clientY: number,
    ) => {
        const node = context.node;
        const minBoxSize = this.getMinBoxSize();

        if (node.splitTop) {
            if (context.box.height <= 0) {
                return;
            }

            const originalFirstSize =
                (context.box.height / 2) * context.startRatio;
            const deltaY = clientY - context.startY;
            const nextFirstSize = this.clampSize(
                originalFirstSize + deltaY,
                minBoxSize,
                context.box.height - minBoxSize,
            );

            node.splitRatio = this.clampSplitRatio(
                (nextFirstSize * 2) / context.box.height,
            );
        } else {
            if (context.box.width <= 0) {
                return;
            }

            const originalFirstSize =
                (context.box.width / 2) * context.startRatio;
            const deltaX = clientX - context.startX;
            const nextFirstSize = this.clampSize(
                originalFirstSize + deltaX,
                minBoxSize,
                context.box.width - minBoxSize,
            );

            node.splitRatio = this.clampSplitRatio(
                (nextFirstSize * 2) / context.box.width,
            );
        }

        this.recalculate();
    };

    /** Finalize resize and persist layout. */
    public endResize = () => {
        void this.saveLayout();
    };

    /** Arrange windows into a fixed grid for temporary layout verification. */
    public arrangeGrid = (rows: number, columns: number) => {
        if (rows <= 0 || columns <= 0) {
            return;
        }

        const windows = this.all;
        if (windows.length === 0) {
            return;
        }

        const cellWidth = this.workspace.width / columns;
        const cellHeight = this.workspace.height / rows;

        windows.forEach((window, index) => {
            const row = Math.floor(index / columns);
            const column = index % columns;

            if (row >= rows) {
                return;
            }

            window.setBox({
                x: this.workspace.x + column * cellWidth,
                y: this.workspace.y + row * cellHeight,
                width: cellWidth,
                height: cellHeight,
            });
        });
    };

    /* ---- API ---- */
    /** Fetch a layout payload by id. */
    public fetchLayout = async (layoutId: string) => {
        const response = await clients.authFetch(`${this.baseUrl}/api/session/${layoutId}`);
        if (!response.ok) {
            return null;
        }

        return response.json() as Promise<LayoutSessionPayload>;
    };

    /** Fetch all session records and keep only layout sessions. */
    public fetchLayouts = async () => {
        const response = await clients.authFetch(`${this.baseUrl}/api/sessions`);
        if (!response.ok) {
            return [];
        }

        const payload = (await response.json()) as {
            sessions?: LayoutSessionPayload[];
        };
        const sessions = Array.isArray(payload.sessions) ? payload.sessions : [];
        const layoutSessions = sessions.filter((session) => this.isLayoutSession(session));

        const usedSlots = new Set<number>();
        const withExplicitSlots = layoutSessions
            .filter((session) => Number.isInteger(session.data?.orbitLayoutSlot))
            .map((session) => {
                const slot = Number(session.data?.orbitLayoutSlot);
                return { session, slot };
            })
            .filter(({ slot }) => slot > 0 && !usedSlots.has(slot))
            .sort((a, b) => a.slot - b.slot);

        withExplicitSlots.forEach(({ slot }) => usedSlots.add(slot));

        const withAssignedSlots = layoutSessions
            .filter((session) => !Number.isInteger(session.data?.orbitLayoutSlot))
            .sort((a, b) => Date.parse(a.createdAt || "") - Date.parse(b.createdAt || ""))
            .map((session) => {
                const slot = this.findFirstFreeSlot(usedSlots);
                usedSlots.add(slot);
                return { session, slot };
            });

        const layouts = [...withExplicitSlots, ...withAssignedSlots]
            .map(({ session, slot }) => ({
                id: session.id,
                name: session.name || `Layout ${slot}`,
                createdAt: session.createdAt,
                updatedAt: session.updatedAt,
                slot,
            }))
            .sort((a, b) => a.slot - b.slot);

        this.layouts = layouts;
        return layouts;
    };

    /** Persist current window graph into the active layout session. */
    public saveLayout = async () => {
        if (!this.layoutId || this.suppressSave) {
            return;
        }

        if (this.saveLayoutTimer) {
            clearTimeout(this.saveLayoutTimer);
        }

        const layoutId = this.layoutId;
        const serialized = this.serialized;
        const layoutSlot = this.layoutSlot;

        this.saveLayoutTimer = setTimeout(() => {
            this.saveLayoutTimer = null;
            void clients.authFetch(`${this.baseUrl}/api/session/${layoutId}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    data: {
                        ...serialized,
                        orbitType: "layout",
                        orbitLayoutSlot: layoutSlot ?? undefined,
                    },
                    isActive: true,
                }),
            });
        }, 160);
    };

    /** Create a new terminal session. */
    public addWindowPane = async () => {
        try {
            const response = await clients.authFetch(`${this.baseUrl}/api/session`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) {
                return null;
            }

            const payload = await response.json();
            return payload.id as string;
        } catch {
            return null;
        }
    };

    /** Delete a terminal backend session and release server resources. */
    private deleteTerminalSession = async (sessionId: string) => {
        try {
            const response = await clients.authFetch(`${this.baseUrl}/api/session/${sessionId}`, {
                method: "DELETE",
            });

            if (!response.ok && response.status !== 404) {
                console.error(`Failed to delete session ${sessionId}.`);
            }
        } catch (error) {
            console.error(`Error deleting session ${sessionId}:`, error);
        }
    };

    /* ---- Clean-up ---- */
    /** Reset the window manager to its defaults. */
    public reset = () => {
        if (this.saveLayoutTimer) {
            clearTimeout(this.saveLayoutTimer);
            this.saveLayoutTimer = null;
        }

        for (const instance of Object.values(this.instances)) {
            instance.dispose();
        }
        this.workspace = DEFAULTS.workspace;
        this.splitRatio = DEFAULTS.splitRatio;
        this.splitWidthMultiplier = DEFAULTS.splitWidthMultiplier;
        this.instances = DEFAULTS.instances;
        this.activeId = DEFAULTS.activeId;
        this.focusHistory = [];
        this.root = null;
    };

    private resolveLayoutSlot = (
        layoutId: string,
        data: LayoutSessionPayload["data"],
    ) => {
        if (Number.isInteger(data?.orbitLayoutSlot) && (data?.orbitLayoutSlot as number) > 0) {
            return Number(data?.orbitLayoutSlot);
        }

        const fromList = this.layouts.find((layout) => layout.id === layoutId);
        if (fromList) {
            return fromList.slot;
        }

        return null;
    };

    /** Resolve whether a persisted record represents a layout session. */
    private isLayoutSession = (session: LayoutSessionPayload) => {
        const data = session?.data;
        if (!data || typeof data !== "object") {
            return false;
        }

        if (data.orbitType === "layout") {
            return true;
        }

        return Array.isArray(data.windows) || data.layout !== undefined;
    };

    private getNextAvailableLayoutSlot = () => {
        const usedSlots = new Set(this.layouts.map((layout) => layout.slot));
        return this.findFirstFreeSlot(usedSlots);
    };

    private findFirstFreeSlot = (usedSlots: Set<number>) => {
        let slot = 1;
        while (usedSlots.has(slot)) {
            slot += 1;
        }

        return slot;
    };

    private getLastLayoutId = () => {
        if (typeof window === "undefined") {
            return null;
        }

        return (
            globalThis.localStorage?.getItem(LAST_LAYOUT_STORAGE_KEY) ||
            globalThis.localStorage?.getItem(LEGACY_LAYOUT_STORAGE_KEY)
        );
    };

    private setLastLayoutId = (layoutId: string) => {
        if (typeof window === "undefined") {
            return;
        }

        globalThis.localStorage?.setItem(LAST_LAYOUT_STORAGE_KEY, layoutId);
        globalThis.localStorage?.setItem(LEGACY_LAYOUT_STORAGE_KEY, layoutId);
    };

    private clearLastLayoutId = () => {
        if (typeof window === "undefined") {
            return;
        }

        globalThis.localStorage?.removeItem(LAST_LAYOUT_STORAGE_KEY);
        globalThis.localStorage?.removeItem(LEGACY_LAYOUT_STORAGE_KEY);
    };

    private deletePreviousLayoutIfEmpty = async (nextLayoutId: string) => {
        const previousLayoutId = this.layoutId;
        if (!previousLayoutId || previousLayoutId === nextLayoutId) {
            return;
        }

        if (this.all.length > 0) {
            return;
        }

        const response = await clients.authFetch(`${this.baseUrl}/api/session/${previousLayoutId}`, {
            method: "DELETE",
        });
        if (!response.ok && response.status !== 404) {
            return;
        }

        this.layouts = this.layouts.filter((layout) => layout.id !== previousLayoutId);
    };

    /** Create and register an instance from persisted window data. */
    private createInstanceFromSerializedWindow = (
        window: {
            title?: string;
            sessionId?: string | null;
            kind?: "terminal" | "browser";
            url?: string;
        },
        fallbackSessionId: string | null,
    ) => {
        const kind = window.kind ?? "terminal";
        const instance = new WindowPaneInstance(
            window.title ?? "Terminal",
            kind,
            this,
        );

        instance.sessionId =
            kind === "terminal"
                ? (window.sessionId ?? fallbackSessionId)
                : null;
        instance.url = window.url ?? "";

        this.instances = {
            ...this.instances,
            [instance.id]: instance,
        };

        return instance;
    };

    /** Serialize the current layout tree for persistence. */
    private serializeLayoutNode = (
        node: WindowNode | null,
        indexById: Map<string, number>,
    ): SerializedLayoutNode | null => {
        if (!node) {
            return null;
        }

        if (node.window) {
            const index = indexById.get(node.window.id);
            if (typeof index !== "number") {
                return null;
            }

            return { windowIndex: index };
        }

        const first = this.serializeLayoutNode(node.children[0], indexById);
        const second = this.serializeLayoutNode(node.children[1], indexById);
        if (!first || !second) {
            return null;
        }

        return {
            splitTop: node.splitTop,
            splitRatio: node.splitRatio,
            children: [first, second],
        };
    };

    /** Hydrate a layout tree from persisted data. */
    private hydrateLayoutNode = (
        node: SerializedLayoutNode | null,
        windows: WindowPaneInstance[],
    ): WindowNode | null => {
        if (!node) {
            return null;
        }

        if ("windowIndex" in node) {
            const window = windows[node.windowIndex];
            if (!window) {
                return null;
            }

            return new WindowNode(window);
        }

        const childA = this.hydrateLayoutNode(node.children[0], windows);
        const childB = this.hydrateLayoutNode(node.children[1], windows);
        if (!childA || !childB) {
            return null;
        }

        const internal = new WindowNode();
        internal.isNode = true;
        internal.splitTop = node.splitTop;
        internal.splitRatio = node.splitRatio;
        internal.children = [childA, childB];
        childA.parent = internal;
        childB.parent = internal;

        return internal;
    };

    /** Find the closest split node whose boundary corresponds to the requested edge. */
    private findResizeSplitNode = (
        leaf: WindowNode,
        edge: ResizeEdge,
    ): WindowNode | null => {
        let current: WindowNode | null = leaf;

        while (current && current.parent) {
            const parentNode: WindowNode = current.parent as WindowNode;
            const isFirst = parentNode.children[0] === current;
            const isSecond = parentNode.children[1] === current;

            if (edge === "right" && !parentNode.splitTop && isFirst) {
                return parentNode;
            }
            if (edge === "left" && !parentNode.splitTop && isSecond) {
                return parentNode;
            }
            if (edge === "bottom" && parentNode.splitTop && isFirst) {
                return parentNode;
            }
            if (edge === "top" && parentNode.splitTop && isSecond) {
                return parentNode;
            }

            current = parentNode;
        }

        return null;
    };

    /** Minimum pane size in layout coordinates (accounts for the configured gap). */
    private getMinBoxSize = () => MIN_WINDOW_INNER_SIZE_PX + config.gap;

    private clampSize = (value: number, min: number, max: number) =>
        Math.min(max, Math.max(min, value));

    /** Insert a new window node using the Hyprland dwindle split rules. */
    private insertNode = (
        instance: WindowPaneInstance,
        openingId: string | null,
    ) => {
        if (!this.root) {
            const node = new WindowNode(instance);
            node.box = { ...this.workspace };
            this.root = node;
            instance.setBox(node.box);
            return;
        }

        const openingOn =
            this.findNodeByWindowId(openingId) || this.findFirstLeaf();
        if (!openingOn) {
            return;
        }

        const previousParent = openingOn.parent;
        const newNode = new WindowNode(instance);
        const newParent = new WindowNode();
        newParent.isNode = true;
        newParent.box = { ...openingOn.box };
        newParent.splitRatio = this.clampSplitRatio(this.splitRatio);

        const sideBySide =
            newParent.box.width >
            newParent.box.height * this.splitWidthMultiplier;
        newParent.splitTop = !sideBySide;

        newParent.children = [openingOn, newNode];
        openingOn.parent = newParent;
        newNode.parent = newParent;

        if (previousParent) {
            const parent = previousParent;
            if (parent.children[0] === openingOn) {
                parent.children[0] = newParent;
            } else {
                parent.children[1] = newParent;
            }
            newParent.parent = parent;
        } else {
            this.root = newParent;
        }

        this.recalculate();
    };

    /** Remove a node and collapse its parent when possible. */
    private removeNode = (instance: WindowPaneInstance) => {
        const node = this.findNodeByWindowId(instance.id);
        if (!node) {
            return;
        }

        const parent = node.parent;
        if (!parent) {
            this.root = null;
            return;
        }

        const sibling =
            parent.children[0] === node
                ? parent.children[1]
                : parent.children[0];

        if (!sibling) {
            this.root = null;
            return;
        }

        sibling.parent = parent.parent;

        if (!parent.parent) {
            this.root = sibling;
        } else if (parent.parent.children[0] === parent) {
            parent.parent.children[0] = sibling;
        } else {
            parent.parent.children[1] = sibling;
        }

        this.recalculate();
    };

    /** Recalculate all node boxes starting from the root. */
    private recalculate = () => {
        if (!this.root) {
            return;
        }

        this.root.box = { ...this.workspace };
        this.recalculateNode(this.root);
    };

    /** Recursively compute boxes for each node. */
    private recalculateNode = (node: WindowNode) => {
        if (!node.children[0] || !node.children[1]) {
            if (node.window) {
                node.window.setBox(node.box);
            }
            return;
        }

        node.splitRatio = this.clampSplitRatio(node.splitRatio);

        if (node.splitTop) {
            const firstSize = (node.box.height / 2) * node.splitRatio;
            node.children[0].box = {
                x: node.box.x,
                y: node.box.y,
                width: node.box.width,
                height: Math.max(0, firstSize),
            };
            node.children[1].box = {
                x: node.box.x,
                y: node.box.y + firstSize,
                width: node.box.width,
                height: Math.max(0, node.box.height - firstSize),
            };
        } else {
            const firstSize = (node.box.width / 2) * node.splitRatio;
            node.children[0].box = {
                x: node.box.x,
                y: node.box.y,
                width: Math.max(0, firstSize),
                height: node.box.height,
            };
            node.children[1].box = {
                x: node.box.x + firstSize,
                y: node.box.y,
                width: Math.max(0, node.box.width - firstSize),
                height: node.box.height,
            };
        }

        this.recalculateNode(node.children[0]);
        this.recalculateNode(node.children[1]);
    };

    /** Clamp split ratio to Hyprland's allowed range. */
    private clampSplitRatio = (ratio: number) =>
        Math.min(1.9, Math.max(0.1, ratio));

    /** Track focus recency for fallback selection after close. */
    private trackFocus = (id: string) => {
        this.focusHistory = [
            ...this.focusHistory.filter((focusedId) => focusedId !== id),
            id,
        ];
    };

    /** Remove a window id from focus history. */
    private removeFromFocusHistory = (id: string) => {
        this.focusHistory = this.focusHistory.filter(
            (focusedId) => focusedId !== id,
        );
    };

    /** Return the most recently focused window id still present. */
    private getLastFocusedId = (
        instances: Record<string, WindowPaneInstance> = this.instances,
    ) => {
        for (let index = this.focusHistory.length - 1; index >= 0; index -= 1) {
            const focusedId = this.focusHistory[index];
            if (instances[focusedId]) {
                return focusedId;
            }
        }

        return null;
    };

    /** Find the node that owns the given window id. */
    private findNodeByWindowId = (id: string | null) => {
        if (!id || !this.root) {
            return null;
        }

        return this.findNodeRecursive(this.root, id);
    };

    /** Find the first leaf node in the tree. */
    private findFirstLeaf = () => {
        if (!this.root) {
            return null;
        }

        return this.findFirstLeafRecursive(this.root);
    };

    /** Recursively find a window node by id. */
    private findNodeRecursive = (
        node: WindowNode,
        id: string,
    ): WindowNode | null => {
        if (node.window?.id === id) {
            return node;
        }

        for (const child of node.children) {
            if (!child) {
                continue;
            }

            const match = this.findNodeRecursive(child, id);
            if (match) {
                return match;
            }
        }

        return null;
    };

    /** Recursively find the first leaf in a subtree. */
    private findFirstLeafRecursive = (node: WindowNode): WindowNode | null => {
        if (node.window) {
            return node;
        }

        for (const child of node.children) {
            if (!child) {
                continue;
            }

            const leaf = this.findFirstLeafRecursive(child);
            if (leaf) {
                return leaf;
            }
        }

        return null;
    };
}


const DEFAULTS = {
    workspace: { x: 0, y: 0, width: 1280, height: 720 },
    splitRatio: 1,
    splitWidthMultiplier: 1,
    instances: {} as Record<string, WindowPaneInstance>,
    activeId: null as string | null,
};

type Direction = "left" | "right" | "up" | "down";

type SerializedLayoutNode =
    | { windowIndex: number }
    | {
        splitTop: boolean;
        splitRatio: number;
        children: [SerializedLayoutNode, SerializedLayoutNode];
    };

type LayoutSessionPayload = {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    data: {
        orbitType?: string;
        orbitLayoutSlot?: number;
        windows?: {
            title?: string;
            sessionId?: string | null;
            kind?: "terminal" | "browser";
            url?: string;
            x?: number;
            y?: number;
            width?: number;
            height?: number;
        }[];
        activeIndex?: number;
        layout?: SerializedLayoutNode | null;
    } | null;
};

type LayoutSessionRecord = {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    slot: number;
};

type ResizeEdge = "left" | "right" | "top" | "bottom";

type ResizeContext = {
    node: WindowNode;
    edge: ResizeEdge;
    startX: number;
    startY: number;
    startRatio: number;
    box: Rect;
};

const MIN_WINDOW_INNER_SIZE_PX = 160;
const MAX_LAYOUTS = 9;
const LAST_LAYOUT_STORAGE_KEY = "orbitLayoutId";
const LEGACY_LAYOUT_STORAGE_KEY = "orbitSessionId";

export type { ResizeContext, ResizeEdge };


export default new WindowManager();
