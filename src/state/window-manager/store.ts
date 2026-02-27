import { makeAutoObservable } from "mobx";

import config from "state/config";
import { getMiddleBaseUrl } from "../baseUrl";
import WindowInstance from "./instance";
import WindowNode, { Rect } from "./node";


const DEFAULTS = {
    workspace: { x: 0, y: 0, width: 1280, height: 720 },
    splitRatio: 1,
    splitWidthMultiplier: 1,
    instances: {} as Record<string, WindowInstance>,
    activeId: null as string | null,
};

type Direction = "left" | "right" | "up" | "down";

class WindowManager {
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
    public instances: Record<string, WindowInstance> = DEFAULTS.instances;

    /** Currently active window id. */
    public activeId: string | null = DEFAULTS.activeId;

    /** Session id for the current workspace. */
    public sessionId: string | null = null;

    /** Whether the workspace finished loading. */
    public isReady = false;

    /** Root node for the dwindle tree. */
    public root: WindowNode | null = null;


    /* ---- Actions ---- */

    /** Load and hydrate the workspace session. */
    public loadSession = async (sessionId: string | null) => {
        if (!sessionId) {
            return null;
        }

        const payload = await this.fetchSession(sessionId);
        if (!payload) {
            return null;
        }

        this.hydrateFromSession(payload?.data, sessionId);
        return payload;
    };

    /** Ensure a workspace session exists and hydrate state. */
    public ensureWorkspaceSession = async () => {
        const storedId =
            typeof window !== "undefined"
                ? globalThis.localStorage?.getItem("orbitSessionId")
                : null;

        if (storedId) {
            try {
                const payload = await this.loadSession(storedId);
                if (payload?.id) {
                    this.sessionId = payload.id;
                    config.hydrateFromSession(payload?.data ?? null);
                    return payload.id;
                }
            } catch {
                return null;
            }
        }

        try {
            const response = await fetch(`${this.baseUrl}/api/session`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
            });
            if (!response.ok) {
                return null;
            }

            const payload = await response.json();
            const createdId = payload.id as string;
            if (typeof window !== "undefined") {
                globalThis.localStorage?.setItem("orbitSessionId", createdId);
            }
            this.hydrateFromSession(payload?.data, createdId);
            this.sessionId = createdId;
            return createdId;
        } catch {
            return null;
        }
    };

    /** Create a new terminal session. */
    public createTerminalSession = async () => {
        try {
            const response = await fetch(`${this.baseUrl}/api/session`, {
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

    /** Create a window and attach a new terminal session. */
    public createWindowWithSession = async () => {
        const workspaceId = this.sessionId || (await this.ensureWorkspaceSession());
        if (!workspaceId) {
            return null;
        }

        const sessionId = await this.createTerminalSession();
        if (!sessionId) {
            return null;
        }

        return this.create({
            title: "Terminal",
            sessionId,
            openingId: this.activeId,
            kind: "terminal",
        });
    };

    /** Create a browser window. */
    public createBrowserWindow = async (url = "") => {
        const workspaceId = this.sessionId || (await this.ensureWorkspaceSession());
        if (!workspaceId) {
            return null;
        }

        return this.create({
            title: "Browser",
            openingId: this.activeId,
            kind: "browser",
            url,
        });
    };

    /** Bootstrap the workspace state. */
    public bootstrap = async () => {
        const id = await this.ensureWorkspaceSession();
        await config.fetchConfig();
        if (!id && this.all.length === 0) {
            this.sessionId = null;
        }
        this.isReady = true;
        return id;
    };

    /* ---- API ---- */
    /** Fetch a session payload by id. */
    public fetchSession = async (sessionId: string) => {
        const response = await fetch(`${this.baseUrl}/api/session/${sessionId}`);
        if (!response.ok) {
            return null;
        }

        return response.json();
    };

    /** Update session data on the middle layer. */
    public patchSession = async (
        sessionId: string,
        data: Record<string, unknown>,
        isActive: boolean,
    ) => {
        await fetch(`${this.baseUrl}/api/session/${sessionId}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                data,
                isActive,
            }),
        });
    };

    /** Update the workspace bounds and recompute layout. */
    public setWorkspace = (workspace: Rect) => {
        this.workspace = workspace;
        this.recalculate();
    };

    /** Create a new window instance and insert it into the layout. */
    public create = (options: {
        title?: string;
        sessionId?: string | null;
        openingId?: string | null;
        kind?: "terminal" | "browser";
        url?: string;
    }) => {
        const instance = new WindowInstance(
            options.title,
            options.kind ?? "terminal",
        );
        instance.onClose = () => this.remove(instance.id);
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
        return instance;
    };

    /** Hydrate windows from persisted session data. */
    public hydrateFromSession = (
        data: {
            windows?: {
                title?: string;
                sessionId?: string | null;
                kind?: "terminal" | "browser";
                url?: string;
            }[];
            activeIndex?: number;
        } | null,
        fallbackSessionId: string | null,
    ) => {
        this.reset();

        const hasStoredWindows = Array.isArray(data?.windows);
        const windows =
            data?.windows?.length && data.windows.length > 0
                ? [...data.windows]
                : [];

        if (!hasStoredWindows && windows.length === 0 && fallbackSessionId) {
            windows.push({
                title: "Terminal",
                sessionId: fallbackSessionId,
                kind: "terminal",
            });
        }

        windows.forEach((window) => {
            this.create({
                title: window.title ?? "Terminal",
                sessionId: window.sessionId ?? fallbackSessionId,
                kind: window.kind ?? "terminal",
                url: window.url,
            });
        });

        if (
            typeof data?.activeIndex === "number" &&
            data.activeIndex >= 0 &&
            data.activeIndex < this.all.length
        ) {
            this.activeId = this.all[data.activeIndex].id;
        }
    };

    /** Remove a window instance and its node from the layout. */
    public remove = (id: string) => {
        const instance = this.instances[id];
        if (!instance) {
            return;
        }

        instance.dispose();
        this.removeNode(instance);

        const update = { ...this.instances };
        delete update[id];
        this.instances = update;

        if (this.activeId === id) {
            this.activeId = Object.keys(update)[0] || null;
        }
    };

    /** Set the active window id if it exists. */
    public setActive = (id: string | null) => {
        console.log('Setting active:', id);

        if (!id) {
            this.activeId = null;
            return;
        }

        if (this.instances[id]) {
            this.activeId = id;
        }

        if (this.active) {
            this.active.focus();
        }
    };

    /** Find the nearest window id in the given direction, relative to an origin window. */
    private getBestNeighborId = (
        origin: WindowInstance,
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
            this.activeId = this.all[0]?.id ?? null;
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
            this.activeId = this.all[0]?.id ?? null;
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
    public get active(): WindowInstance | null {
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

    /** Serialized state for persistence. */
    public get serialized() {
        const windows = this.all.map((instance) => ({
            title: instance.title,
            sessionId: instance.sessionId,
            kind: instance.kind,
            url: instance.url,
        }));
        const activeIndex = this.activeId
            ? this.all.findIndex((instance) => instance.id === this.activeId)
            : -1;

        return {
            windows,
            activeIndex: activeIndex >= 0 ? activeIndex : undefined,
        };
    }

    /* ---- Clean-up ---- */
    /** Reset the window manager to its defaults. */
    public reset = () => {
        this.workspace = DEFAULTS.workspace;
        this.splitRatio = DEFAULTS.splitRatio;
        this.splitWidthMultiplier = DEFAULTS.splitWidthMultiplier;
        this.instances = DEFAULTS.instances;
        this.activeId = DEFAULTS.activeId;
        this.root = null;
    };

    /** Insert a new window node using the Hyprland dwindle split rules. */
    private insertNode = (
        instance: WindowInstance,
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
    private removeNode = (instance: WindowInstance) => {
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

export default new WindowManager();
