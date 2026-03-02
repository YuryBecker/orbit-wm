import { makeAutoObservable, reaction } from "mobx";
import { FitAddon, init, Terminal as GhosttyTerminal } from "ghostty-web";
import { toast } from "sonner";
import { io, Socket } from "socket.io-client";

import clients from "state/clients";
import config from "state/config";
import { getMiddleBaseUrl } from "../baseUrl";


class TerminalInstance {
    constructor() {
        this.id = `terminal_${globalThis.crypto?.randomUUID?.() || Date.now()}`;

        makeAutoObservable(this);
    }

    /* ---- Observables ---- */
    /** Client-side identifier for this terminal instance. */
    public id: string;

    /** Current status message for the terminal UI. */
    public status = DEFAULTS.status;

    /** Backend session id assigned after creation. */
    public sessionId: string | null = null;

    /** Whether the socket is connected. */
    public isConnected = false;

    /** Window instance that hosts the terminal. */
    private windowInstance: Instance.WindowPane | null = null;

    /** Ghostty terminal instance. */
    private term: GhosttyTerminal | null = null;

    /** Fit addon for sizing. */
    private fitAddon: FitAddon | null = null;

    /** Socket.IO connection to the backend. */
    private socket: Socket | null = null;

    /** Resize observer for terminal container. */
    private resizeObserver: ResizeObserver | null = null;

    /** Disposer for terminal data subscription. */
    private disposeDataListener: { dispose: () => void } | null = null;

    /** Disposer for terminal resize subscription. */
    private disposeResizeListener: { dispose: () => void } | null = null;

    /** Whether the instance has been disposed. */
    private disposed = false;

    /** Whether we've attempted a session fallback. */
    public attemptedFallback = false;

    /** Disposer for terminal config updates. */
    private disposeConfigReaction: (() => void) | null = null;

    /** Debounce timer for applying terminal config. */
    private configDebounceTimer: ReturnType<typeof setTimeout> | null = null;

    /** Buffered terminal input awaiting flush to the socket. */
    private pendingInput = "";

    /** Timer for batching input to reduce per-keystroke overhead. */
    private inputFlushTimer: number | null = null;

    /** Latest terminal size awaiting a debounced resize emit. */
    private pendingResize: { cols: number; rows: number } | null = null;

    /** Timer for debouncing resize events to the backend. */
    private resizeFlushTimer: number | null = null;

    /* ---- Actions ---- */
    /** Mount and initialize the terminal in the provided window. */
    public mount = async (
        windowInstance: Instance.WindowPane,
        existingSessionId?: string,
    ) => {
        if (this.windowInstance) {
            console.warn("Terminal already mounted.");
            return;
        }
        const container = windowInstance.container;
        if (!container) {
            this.status = "Missing container";
            console.warn("Terminal mount failed: missing container.");
            return;
        }

        this.windowInstance = windowInstance;
        this.disposed = false;
        this.attemptedFallback = false;

        await this.ghosttyInit();
        if (this.disposed) {
            return;
        }

        this.createTerminal(container);

        this.disposeConfigReaction = reaction(
            () => ({
                terminalColor: config.terminalColor,
                terminalFontFamily: config.terminalFontFamily,
                terminalFontSize: config.terminalFontSize,
            }),
            () => {
                if (this.configDebounceTimer) {
                    clearTimeout(this.configDebounceTimer);
                }

                this.configDebounceTimer = setTimeout(() => {
                    this.configDebounceTimer = null;
                    this.applyConfig();
                }, 1200);
            },
        );

        await this.connect(existingSessionId);
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

    /** Write text to the terminal buffer if mounted. */
    public write = (value: string) => {
        this.term?.write(value);
    };

    /** Focus the terminal input if mounted. */
    public focus = () => {
        this.term?.focus();
    };

    /** Close the terminal and its owning window. */
    public close = () => {
        if (this.disposed) {
            return;
        }

        this.windowInstance?.close();
        this.dispose();
    };

    /** Create a backend session and connect to its Socket.IO channel. */
    public connect = async (existingSessionId?: string) => {
        const baseUrl = getMiddleBaseUrl();

        try {
            let sessionId = existingSessionId;
            if (!sessionId) {
                sessionId = await this.createSession(baseUrl);
            }

            this.sessionId = sessionId;
            this.status = "Connecting to socket...";

            this.socket = io(`${baseUrl}/terminal`, {
                auth: {
                    sessionId,
                    token: clients.getSocketToken(),
                },
                autoConnect: false,
                transports: ["websocket"],
            });

            this.socket.on("connect", () => {
                if (!this.disposed) {
                    this.isConnected = true;
                    this.status = "Connected";
                }
            });

            this.socket.on("connect_error", (error) => {
                this.term?.write(
                    `Socket connection error: ${error.message}\r\n`,
                );
                if (!this.disposed) {
                    this.isConnected = false;
                    this.status = "Socket error";
                }

                if (
                    existingSessionId &&
                    error.message.toLowerCase().includes("session not found")
                ) {
                    this.status = "Session not found";
                    toast.warning("Session not found. Closing window.");
                    window.setTimeout(() => {
                        if (!this.disposed) {
                            this.close();
                        }
                    }, 1500);
                }
            });

            this.socket.on("output", (data) => {
                if (data?.sessionId === sessionId) {
                    this.writeFromSocket(data.data ?? "");
                }
            });

            this.socket.on("exit", (data) => {
                if (data?.sessionId === sessionId) {
                    this.term?.write("\r\nSession closed.\r\n");
                    if (!this.disposed) {
                        this.status = "Session closed";
                        this.isConnected = false;
                    }
                    this.close();
                }
            });

            this.socket.on("disconnect", () => {
                if (!this.disposed) {
                    this.isConnected = false;
                    this.status = "Disconnected";
                }
            });

            if (this.term) {
                this.bindTerminalToSocket(sessionId);
            }

            this.socket.connect();
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "Unknown error.";
            this.term?.write(`Unable to connect: ${message}\r\n`);
            if (!this.disposed) {
                this.status = "Connection failed";
            }
        }
    };

    private createSession = async (baseUrl: string) => {
        const response = await clients.authFetch(`${baseUrl}/api/session`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            throw new Error("Failed to create session.");
        }

        const payload = await response.json();
        const sessionId = payload.id as string;
        if (this.windowInstance) {
            this.windowInstance.sessionId = sessionId;
        }
        this.attemptedFallback = false;
        return sessionId;
    };

    /* ---- Computed ---- */
    /** Terminal container element if mounted. */
    public get container() {
        return this.windowInstance?.container || null;
    }

    private flushPendingInput = () => {
        if (this.inputFlushTimer !== null) {
            window.clearTimeout(this.inputFlushTimer);
            this.inputFlushTimer = null;
        }

        const sessionId = this.sessionId;
        const socket = this.socket;
        if (!sessionId || !socket || this.disposed) {
            this.pendingInput = "";
            return;
        }

        if (!this.pendingInput) {
            return;
        }

        const data = this.pendingInput;
        this.pendingInput = "";
        socket.emit("input", { sessionId, data });
    };

    private enqueueInput = (data: string) => {
        if (this.disposed) {
            return;
        }

        this.pendingInput += data;

        if (this.pendingInput.length >= 4096) {
            this.flushPendingInput();
            return;
        }

        if (this.inputFlushTimer !== null) {
            return;
        }

        this.inputFlushTimer = window.setTimeout(() => {
            this.flushPendingInput();
        }, 6);
    };

    private flushPendingResize = () => {
        if (this.resizeFlushTimer !== null) {
            window.clearTimeout(this.resizeFlushTimer);
            this.resizeFlushTimer = null;
        }

        const sessionId = this.sessionId;
        const socket = this.socket;
        if (!sessionId || !socket || this.disposed) {
            this.pendingResize = null;
            return;
        }

        const pending = this.pendingResize;
        if (!pending) {
            return;
        }

        this.pendingResize = null;
        socket.emit("resize", {
            sessionId,
            cols: pending.cols,
            rows: pending.rows,
        });
    };

    private enqueueResize = (cols: number, rows: number) => {
        if (this.disposed) {
            return;
        }

        if (
            this.pendingResize &&
            this.pendingResize.cols === cols &&
            this.pendingResize.rows === rows
        ) {
            return;
        }

        this.pendingResize = { cols, rows };

        if (this.resizeFlushTimer !== null) {
            return;
        }

        this.resizeFlushTimer = window.setTimeout(() => {
            this.flushPendingResize();
        }, 50);
    };

    private pendingOutput = "";
    private outputFlushScheduled = false;

    private flushPendingOutput = () => {
        this.outputFlushScheduled = false;
        const value = this.pendingOutput;
        this.pendingOutput = "";
        if (value) {
            this.term?.write(value);
        }
    };

    private writeFromSocket = (value: string) => {
        if (!value) {
            return;
        }

        this.pendingOutput += value;
        if (this.outputFlushScheduled) {
            return;
        }

        this.outputFlushScheduled = true;
        queueMicrotask(() => {
            if (!this.disposed) {
                this.flushPendingOutput();
            }
        });
    };

    private createTerminal = (container: HTMLElement) => {
        this.term = new GhosttyTerminal({
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
        });

        this.fitAddon = new FitAddon();
        this.term.loadAddon(this.fitAddon);
        this.term.open(container);
        this.fitAddon.fit();
        this.term.write("ghostty-web loaded. Connecting...\r\n");
        this.status = "Creating session...";

        this.resizeObserver = new ResizeObserver(() => {
            this.fitAddon?.fit();
        });
        this.resizeObserver.observe(container);
    };

    private bindTerminalToSocket = (sessionId: string) => {
        this.disposeDataListener?.dispose();
        this.disposeResizeListener?.dispose();

        if (!this.term) {
            return;
        }

        this.disposeDataListener = this.term.onData((data) => {
            if (this.sessionId !== sessionId) {
                return;
            }

            this.enqueueInput(data);
        });

        this.disposeResizeListener = this.term.onResize(({ cols, rows }) => {
            if (this.sessionId !== sessionId) {
                return;
            }

            this.enqueueResize(cols, rows);
        });
    };

    private applyConfig = () => {
        if (this.disposed) {
            return;
        }

        const container = this.container;
        if (!container) {
            return;
        }

        this.disposeDataListener?.dispose();
        this.disposeResizeListener?.dispose();
        this.resizeObserver?.disconnect();
        this.term?.dispose();
        this.term = null;
        this.fitAddon = null;
        this.pendingOutput = "";
        this.outputFlushScheduled = false;

        this.createTerminal(container);

        if (this.socket && this.sessionId) {
            this.bindTerminalToSocket(this.sessionId);
        }
    };

    /* ---- Clean-up ---- */
    /** Dispose terminal resources and close sockets. */
    public dispose = () => {
        if (this.disposed) {
            return;
        }

        this.disposed = true;
        this.disposeDataListener?.dispose();
        this.disposeResizeListener?.dispose();
        if (this.disposeConfigReaction) {
            this.disposeConfigReaction();
            this.disposeConfigReaction = null;
        }
        if (this.configDebounceTimer) {
            clearTimeout(this.configDebounceTimer);
            this.configDebounceTimer = null;
        }
        if (this.inputFlushTimer !== null) {
            window.clearTimeout(this.inputFlushTimer);
            this.inputFlushTimer = null;
        }
        if (this.resizeFlushTimer !== null) {
            window.clearTimeout(this.resizeFlushTimer);
            this.resizeFlushTimer = null;
        }
        this.pendingInput = "";
        this.pendingResize = null;
        this.pendingOutput = "";
        this.outputFlushScheduled = false;
        this.resizeObserver?.disconnect();
        this.socket?.disconnect();
        this.term?.dispose();
        this.windowInstance = null;
    };

    /** Reset instance state back to defaults. */
    public reset = () => {
        this.status = DEFAULTS.status;
        this.sessionId = null;
        this.isConnected = false;
    };
}


const DEFAULTS = {
    status: "Initializing terminal...",
};


declare global {
    namespace Instance {
        type TerminalId = string & { __brand: 'terminal' };

        type Terminal = TerminalInstance;
    }
}

export default TerminalInstance;
