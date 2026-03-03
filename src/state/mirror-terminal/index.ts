import { makeAutoObservable, reaction } from "mobx";
import { FitAddon, init, Terminal as GhosttyTerminal } from "ghostty-web";
import { io, Socket } from "socket.io-client";

import clients from "state/clients";
import config from "state/config";
import { getMiddleBaseUrl } from "state/baseUrl";


class MirrorTerminalStore {
    constructor() {
        makeAutoObservable(this);

        if (typeof window !== "undefined") {
            this.disposeConfigReaction = reaction(
                () => ({
                    terminalColor: config.terminalColor,
                    terminalFontFamily: config.terminalFontFamily,
                    terminalFontSize: config.terminalFontSize,
                }),
                () => {
                    this.recreateMirrorTerminal();
                },
            );
        }
    }

    /* ---- Observables ---- */
    /** Terminal instance currently projected into the mirror overlay. */
    public mirrorFrom: Instance.Terminal | null = DEFAULTS.mirrorFrom;

    /** Whether mirror mode is currently enabled. */
    public isEnabled = false;

    /** Top offset for the mirror overlay in pixels. */
    public top = DEFAULTS.top;

    /** Height for the mirror overlay in pixels. */
    public height = DEFAULTS.height;

    /** Container element where mirror terminal is mounted. */
    private mirrorContainer: HTMLDivElement | null = null;

    /** Ghostty mirror terminal instance. */
    private mirrorTerm: GhosttyTerminal | null = null;

    /** Fit addon for mirror terminal sizing. */
    private mirrorFitAddon: FitAddon | null = null;

    /** Resize observer for mirror container changes. */
    private mirrorResizeObserver: ResizeObserver | null = null;

    /** Disposer for mirror terminal data subscription. */
    private disposeMirrorDataListener: { dispose: () => void } | null = null;

    /** Disposer for mirror terminal resize subscription. */
    private disposeMirrorResizeListener: { dispose: () => void } | null = null;

    /** Dedicated socket used while mirror mode is active. */
    private mirrorSocket: Socket | null = null;

    /** Session id bound to the mirror socket. */
    private mirrorSocketSessionId: string | null = null;

    /** Whether mirror activation should transfer focus into the mirror terminal. */
    private pendingFocusTransfer = false;

    /** Disposer for config reaction updates. */
    public disposeConfigReaction: (() => void) | null = null;


    /* ---- Actions ---- */
    /** Activate mirror mode for a terminal instance and viewport bounds. */
    public activate = (
        terminal: Instance.Terminal,
        top: number,
        height: number,
    ) => {
        const sourceChanged = this.mirrorFrom !== terminal;
        const previousSource = this.mirrorFrom;

        if (sourceChanged) {
            previousSource?.resumeSocketAfterMirror();
            this.disposeMirrorTerminal();
            this.disposeMirrorSocket();
            this.mirrorFrom = terminal;
            terminal.suspendSocketForMirror();
        } else if (!this.isEnabled) {
            terminal.suspendSocketForMirror();
        }

        this.mirrorFrom = terminal;
        this.isEnabled = true;
        this.top = Math.max(0, Math.round(top));
        this.height = Math.max(1, Math.round(height));
        this.pendingFocusTransfer = true;

        this.ensureMirrorTerminal();
        this.ensureMirrorSocket();
    };

    /** Disable mirror mode and clear viewport bounds. */
    public deactivate = () => {
        const source = this.mirrorFrom;
        this.isEnabled = false;
        this.top = DEFAULTS.top;
        this.height = DEFAULTS.height;

        this.disposeMirrorTerminal();
        this.disposeMirrorSocket();

        source?.resumeSocketAfterMirror();
        this.pendingFocusTransfer = false;
    };

    private ghosttyInit = (() => {
        let initPromise: Promise<void> | null = null;

        return () => {
            if (!initPromise) {
                initPromise = init();
            }

            return initPromise;
        };
    })();

    /** Clear mirror mode only when the provided terminal is active source. */
    public clearFrom = (terminal: Instance.Terminal | null) => {
        if (!terminal || this.mirrorFrom !== terminal) {
            return;
        }

        this.deactivate();
        this.mirrorFrom = null;
    };

    /** Set or clear the mirror mount container. */
    public setContainer = (container: HTMLDivElement | null) => {
        this.mirrorContainer = container;

        if (!container) {
            this.disposeMirrorTerminal();
            this.disposeMirrorSocket();
            return;
        }

        this.ensureMirrorTerminal();
        this.ensureMirrorSocket();
    };

    /** Focus the mirror terminal when active. */
    public focus = () => {
        if (this.isActive) {
            this.mirrorTerm?.focus();
            return console.warn('Cannot focus. Mirror terminal is not currently active.');
        }

        this.mirrorFrom?.focus();
    };

    /** Forward source-terminal input while source socket is suspended in mirror mode. */
    public sendInputFromSource = (data: string) => {
        const sessionId = this.mirrorSocketSessionId;
        if (!sessionId || !this.mirrorSocket) {
            return;
        }

        this.mirrorSocket.emit("input", { sessionId, data });
    };

    /** Forward source-terminal resize while source socket is suspended in mirror mode. */
    public sendResizeFromSource = (cols: number, rows: number) => {
        this.emitMirrorResize(cols, rows);
    };


    /* ---- Computed ---- */
    /** Whether the mirror overlay should currently render. */
    public get isActive() {
        return this.isEnabled && Boolean(this.mirrorFrom);
    }

    private get terminalOptions() {
        return {
            cursorBlink: true,
            fontSize: config.terminalFontSize,
            fontFamily: config.terminalFontFamily,
            theme: {
                foreground: "#c5c8c6",
                background: config.terminalColor,
                selectionForeground: "#93a1a1",
                selectionBackground: "#073642",
                black: "#282a2e",
                red: "#a54242",
                green: "#8c9440",
                yellow: "#de935f",
                blue: "#5f819d",
                magenta: "#85678f",
                cyan: "#5e8d87",
                white: "#707880",
                brightBlack: "#373b41",
                brightRed: "#cc6666",
                brightGreen: "#b5bd68",
                brightYellow: "#f0c674",
                brightBlue: "#81a2be",
                brightMagenta: "#b294bb",
                brightCyan: "#8abeb7",
                brightWhite: "#c5c8c6",
            },
        };
    }

    private ensureMirrorTerminal = async () => {
        if (
            !this.isActive ||
            !this.mirrorFrom ||
            !this.mirrorContainer ||
            this.mirrorTerm
        ) {
            return;
        }

        await this.ghosttyInit();
        if (
            !this.isActive ||
            !this.mirrorFrom ||
            !this.mirrorContainer ||
            this.mirrorTerm
        ) {
            return;
        }

        this.mirrorTerm = new GhosttyTerminal(this.terminalOptions);
        this.mirrorFitAddon = new FitAddon();
        this.mirrorTerm.loadAddon(this.mirrorFitAddon);
        this.mirrorTerm.open(this.mirrorContainer);
        this.mirrorFitAddon.fit();

        this.disposeMirrorDataListener?.dispose();
        this.disposeMirrorDataListener = this.mirrorTerm.onData((data) => {
            const sessionId = this.mirrorSocketSessionId;
            if (!sessionId || !this.mirrorSocket) {
                return;
            }

            this.mirrorSocket.emit("input", { sessionId, data });
        });

        this.disposeMirrorResizeListener?.dispose();
        this.disposeMirrorResizeListener = this.mirrorTerm.onResize(({ cols, rows }) => {
            if (cols <= 0 || rows <= 0) {
                return;
            }

            this.emitMirrorResize(cols, rows);
        });

        this.mirrorResizeObserver?.disconnect();
        this.mirrorResizeObserver = new ResizeObserver(() => {
            this.mirrorFitAddon?.fit();
            this.emitCurrentMirrorSize();
        });
        this.mirrorResizeObserver.observe(this.mirrorContainer);

        this.emitCurrentMirrorSize();
        this.transferFocusIfPending();
    };

    private recreateMirrorTerminal = async () => {
        if (!this.isActive || !this.mirrorContainer) {
            return;
        }

        this.disposeMirrorTerminal();
        await this.ensureMirrorTerminal();
    };

    private disposeMirrorTerminal = () => {
        this.disposeMirrorDataListener?.dispose();
        this.disposeMirrorDataListener = null;
        this.disposeMirrorResizeListener?.dispose();
        this.disposeMirrorResizeListener = null;
        this.mirrorResizeObserver?.disconnect();
        this.mirrorResizeObserver = null;
        this.mirrorTerm?.dispose();
        this.mirrorTerm = null;
        this.mirrorFitAddon = null;
    };

    private ensureMirrorSocket = () => {
        if (!this.isActive || !this.mirrorFrom) {
            return;
        }

        const sessionId = this.mirrorFrom.sessionId;
        if (!sessionId) {
            return;
        }

        if (this.mirrorSocket && this.mirrorSocketSessionId === sessionId) {
            return;
        }

        this.disposeMirrorSocket();
        this.mirrorSocketSessionId = sessionId;

        const baseUrl = getMiddleBaseUrl();
        const initialSize = this.getCurrentMirrorTerminalSize();

        this.mirrorSocket = io(`${baseUrl}/terminal`, {
            auth: {
                sessionId,
                token: clients.getSocketToken(),
                cols: initialSize?.cols,
                rows: initialSize?.rows,
            },
            autoConnect: false,
            transports: ["websocket"],
        });

        this.mirrorSocket.on("connect", () => {
            this.emitCurrentMirrorSize();
        });

        this.mirrorSocket.on("output", (payload) => {
            if (payload?.sessionId !== sessionId) {
                return;
            }

            this.mirrorTerm?.write(payload.data ?? "");
        });

        this.mirrorSocket.on("exit", (payload) => {
            if (payload?.sessionId !== sessionId) {
                return;
            }

            this.mirrorTerm?.write("\r\nSession closed.\r\n");
            this.clearFrom(this.mirrorFrom);
        });

        this.mirrorSocket.connect();
    };

    private emitMirrorResize = (cols: number, rows: number) => {
        if (cols <= 0 || rows <= 0) {
            return;
        }

        const sessionId = this.mirrorSocketSessionId;
        if (!sessionId || !this.mirrorSocket) {
            return;
        }

        this.mirrorSocket.emit("resize", { sessionId, cols, rows });
    };

    private getCurrentMirrorTerminalSize = () => {
        if (!this.mirrorTerm) {
            return null;
        }

        const cols = Number(this.mirrorTerm.cols);
        const rows = Number(this.mirrorTerm.rows);
        if (!Number.isFinite(cols) || !Number.isFinite(rows) || cols <= 0 || rows <= 0) {
            return null;
        }

        return { cols, rows };
    };

    private emitCurrentMirrorSize = () => {
        const current = this.getCurrentMirrorTerminalSize();
        if (!current) {
            return;
        }

        this.emitMirrorResize(current.cols, current.rows);
    };

    private disposeMirrorSocket = () => {
        this.mirrorSocket?.disconnect();
        this.mirrorSocket = null;
        this.mirrorSocketSessionId = null;
    };

    private transferFocusIfPending = () => {
        if (!this.pendingFocusTransfer || !this.mirrorTerm) {
            return;
        }

        this.pendingFocusTransfer = false;
        requestAnimationFrame(() => {
            if (!this.isActive || !this.mirrorTerm) {
                return;
            }

            this.mirrorTerm.focus();
        });
    };


    /* ---- Clean-up ---- */
    /** Reset mirror state back to defaults. */
    public reset = () => {
        this.mirrorFrom?.resumeSocketAfterMirror();
        this.disposeMirrorTerminal();
        this.disposeMirrorSocket();
        this.mirrorContainer = null;
        this.isEnabled = false;
        this.mirrorFrom = DEFAULTS.mirrorFrom;
        this.top = DEFAULTS.top;
        this.height = DEFAULTS.height;
        this.pendingFocusTransfer = false;
    };
}


const DEFAULTS = {
    mirrorFrom: null as Instance.Terminal | null,
    top: 0,
    height: 1,
};


export default new MirrorTerminalStore();
