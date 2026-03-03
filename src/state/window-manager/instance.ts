import { makeAutoObservable } from "mobx";

import { browsers, terminals } from "../index";
import mirrorTerminal from "state/mirror-terminal";
import { WindowManager } from ".";


class WindowPaneInstance {
    constructor(
        title = "Window",
        kind: WindowPaneInstance['kind'] = "terminal",
        private root: WindowManager,
    ) {
        this.id = `window_${globalThis.crypto?.randomUUID?.() || Date.now()}` as Instance.WindowPaneId;
        this.title = title;
        this.kind = kind;

        makeAutoObservable(this);
    }

    /* ---- Observables ---- */
    /** Unique identifier for the window. */
    public id: Instance.WindowPaneId;

    /** User-facing title for the window. */
    public title: string;

    /** Window type. */
    public kind: "terminal" | "browser";

    /** URL for browser windows. */
    public url = "";

    /** Terminal instance attached to this window. */
    public terminal: Instance.Terminal | null = null;

    /** Browser instance attached to this window. */
    public browser: Instance.Browser | null = null;

    /** Session id for reconnecting to the middle layer. */
    public sessionId: string | null = null;

    /** DOM container for the terminal. */
    public container: HTMLDivElement | null = null;

    /** X position within the workspace. */
    public x = 0;

    /** Y position within the workspace. */
    public y = 0;

    /** Width of the window. */
    public width = 0;

    /** Height of the window. */
    public height = 0;


    /* ---- Computed ---- */
    /** Status for the attached terminal. */
    public get status(): string {
        if (this.kind === "browser") {
            return "Browser";
        }

        return this.terminal?.status || "No terminal";
    }


    /* ---- Actions ---- */
    /** Update the layout box for this window. */
    public setBox = (
        box: {
            x: number;
            y: number;
            width: number;
            height: number;
        },
    ) => {
        this.x = box.x;
        this.y = box.y;
        this.width = box.width;
        this.height = box.height;
    };

    /** Attach a DOM container to this window. */
    public setContainer = (container: HTMLDivElement | null) => {
        this.container = container;
    };

    /** Close this window. */
    public close = () => {
        this.root.remove(this.id);
    };

    /** Start a terminal session for this window. */
    public startTerminal = (sessionId?: string) => {
        if (this.kind !== "terminal") {
            return;
        }

        if (this.terminal) {
            return;
        }

        this.terminal = terminals.create();
        this.terminal.mount(this, sessionId ?? this.sessionId ?? undefined);
    };

    /** Focus the terminal if available. */
    public focus = () => {
        if (this.terminal) this.terminal.focus();
    };

    /** Start a browser session for this window. */
    public startBrowser = (url?: string) => {
        if (this.kind !== "browser") {
            return;
        }

        if (this.browser) {
            return;
        }

        this.browser = browsers.create(url ?? this.url);
    };

    /** Update browser URL and keep it in sync for persistence. */
    public setUrl = (url: string) => {
        this.url = url;
        this.browser?.setUrl(url);
    };


    /* ---- Clean-up ---- */
    /** Reset the window to its default box. */
    public reset = () => {
        this.x = 0;
        this.y = 0;
        this.width = 0;
        this.height = 0;
    };

    /** Dispose any attached resources. */
    public dispose = () => {
        if (this.terminal) {
            mirrorTerminal.clearFrom(this.terminal);
            terminals.remove(this.terminal.id);
        }

        if (this.browser) {
            browsers.remove(this.browser.id);
        }
    };
}


declare global {
    namespace Instance {
        type WindowPaneId = string & { __brand: 'window' };

        type WindowPane = WindowPaneInstance;
    }
}


export default WindowPaneInstance;


