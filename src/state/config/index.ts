import { makeAutoObservable } from "mobx";

import clients from "../clients";
import { getMiddleBaseUrl } from "../baseUrl";



type ModKey = "ctrlKey" | "metaKey" | "altKey" | "shiftKey";
type Wallpaper = {
    type: "builtin" | "custom";
    value: string;
};
type WallpaperOption = {
    id: string;
    label: string;
};

const DEFAULTS = {
    modKey: "ctrlKey" as ModKey,
    modKeyLabel: "Ctrl",
    gap: 48,
    borderWidth: "3px",
    borderColor: "rgba(25, 25, 25, 0.25)",
    activeBorderColor: "#34d399",
    shadowBlur: 24,
    shadowAmount: 0,
    shadowColor: "rgba(21, 21, 21, 0.25)",
    wallpaper: { type: "builtin", value: "orbit" } as Wallpaper,
    terminalPadding: 12,
    terminalColor: "#262626",
    terminalOpacity: 1,
    terminalBlur: 0,
    terminalFontFamily:
        "JetBrainsMonoNerdFont, 'JetBrains Mono', Menlo, monospace",
    terminalFontSize: 14,
    borderRadius: 12,
    showTitleBar: true,
};

class ConfigStore {
    constructor() {
        makeAutoObservable(this);
    }

    /* ---- Observables ---- */
    /** Modifier key for shortcuts. */
    public modKey: ModKey = DEFAULTS.modKey;

    /** Display label for the modifier key. */
    public modKeyLabel = DEFAULTS.modKeyLabel;

    /** Gap between windows in pixels. */
    public gap = DEFAULTS.gap;

    /** Border width used for windows. */
    public borderWidth = DEFAULTS.borderWidth;

    /** Default border color for windows. */
    public borderColor = DEFAULTS.borderColor;

    /** Border color for the active window. */
    public activeBorderColor = DEFAULTS.activeBorderColor;

    /** Shadow blur radius in pixels. */
    public shadowBlur = DEFAULTS.shadowBlur;

    /** Shadow spread amount in pixels. */
    public shadowAmount = DEFAULTS.shadowAmount;

    /** Shadow color for windows. */
    public shadowColor = DEFAULTS.shadowColor;

    /** Border radius for window containers. */
    public borderRadius = DEFAULTS.borderRadius;

    /** Padding inside terminal containers. */
    public terminalPadding = DEFAULTS.terminalPadding;

    /** Background color for terminal containers. */
    public terminalColor = DEFAULTS.terminalColor;

    /** Terminal background opacity (0-1). */
    public terminalOpacity = DEFAULTS.terminalOpacity;

    /** Terminal backdrop blur amount in pixels. */
    public terminalBlur = DEFAULTS.terminalBlur;

    /** Font family used by terminals. */
    public terminalFontFamily = DEFAULTS.terminalFontFamily;

    /** Font size used by terminals. */
    public terminalFontSize = DEFAULTS.terminalFontSize;

    /** Whether terminal title bars are visible. */
    public showTitleBar = DEFAULTS.showTitleBar;

    /** Current wallpaper selection. */
    public wallpaper: Wallpaper = DEFAULTS.wallpaper;

    /** Wallpaper options for the menu. */
    public wallpapers: WallpaperOption[] = [
        { id: "orbit", label: "Orbit" },
        { id: "nebula", label: "Nebula" },
        { id: "grid", label: "Grid" },
        { id: "void", label: "Void" },
    ];

    /** Font options for terminal rendering. */
    public terminalFonts: { id: string; label: string; value: string }[] = [
        {
            id: "jetbrains",
            label: "JetBrains Mono",
            value: "JetBrainsMonoNerdFont, 'JetBrains Mono', Menlo, monospace",
        },
        {
            id: "julia",
            label: "Julia Mono",
            value: "JuliaMono, 'Julia Mono', Menlo, monospace",
        },
    ];

    /** Built-in wallpaper gradients. */
    public wallpaperStyles: Record<string, string> = {
        orbit:
            "radial-gradient(circle at 15% 20%, rgba(59, 130, 246, 0.2), transparent 45%), radial-gradient(circle at 80% 15%, rgba(16, 185, 129, 0.2), transparent 40%), radial-gradient(circle at 50% 80%, rgba(148, 163, 184, 0.18), transparent 55%), #0a0c12",
        nebula:
            "radial-gradient(circle at 20% 25%, rgba(139, 92, 246, 0.25), transparent 50%), radial-gradient(circle at 75% 20%, rgba(236, 72, 153, 0.18), transparent 45%), radial-gradient(circle at 50% 70%, rgba(14, 116, 144, 0.25), transparent 55%), #090a0f",
        grid:
            "linear-gradient(120deg, rgba(15, 23, 42, 0.9), rgba(2, 6, 23, 0.95)), repeating-linear-gradient(90deg, rgba(148, 163, 184, 0.1) 0 1px, transparent 1px 80px), repeating-linear-gradient(180deg, rgba(148, 163, 184, 0.08) 0 1px, transparent 1px 80px)",
        void:
            "radial-gradient(circle at 40% 30%, rgba(71, 85, 105, 0.15), transparent 45%), #050608",
    };

    /* ---- Computed ---- */
    public get baseUrl() {
        return getMiddleBaseUrl();
    }

    public get wallpaperStyle() {
        if (this.wallpaper.type === "custom") {
            return `url(${this.wallpaper.value})`;
        }

        return (
            this.wallpaperStyles[this.wallpaper.value] ||
            this.wallpaperStyles.orbit
        );
    }

    public get shadowStyle() {
        return `0px 0px ${this.shadowBlur}px ${this.shadowAmount}px ${this.shadowColor}`;
    }

    public get serialized() {
        return {
            wallpaper: this.wallpaper,
            showTitleBar: this.showTitleBar,
            terminalPadding: this.terminalPadding,
            terminalColor: this.terminalColor,
            terminalOpacity: this.terminalOpacity,
            terminalBlur: this.terminalBlur,
            terminalFontFamily: this.terminalFontFamily,
            terminalFontSize: this.terminalFontSize,
            gap: this.gap,
            borderWidth: this.borderWidth,
            borderColor: this.borderColor,
            activeBorderColor: this.activeBorderColor,
            shadowBlur: this.shadowBlur,
            shadowAmount: this.shadowAmount,
            shadowColor: this.shadowColor,
            borderRadius: this.borderRadius,
        };
    }

    /* ---- Actions ---- */
    /** Pending debounce timers for config updates. */
    private saveTimers: Record<string, ReturnType<typeof setTimeout>> = {};
    public setWallpaper = (wallpaper: Wallpaper) => {
        this.wallpaper = wallpaper;
        this.saveConfig("wallpaper", wallpaper);
    };

    public setWallpaperById = (id: string) => {
        const wallpaper: Wallpaper = {
            type: "builtin",
            value: id,
        };
        this.wallpaper = wallpaper;
        this.saveConfig("wallpaper", wallpaper);
    };

    public setCustomWallpaper = (dataUrl: string) => {
        const wallpaper: Wallpaper = {
            type: "custom",
            value: dataUrl,
        };
        this.wallpaper = wallpaper;
        this.saveConfig("wallpaper", wallpaper);
    };

    public setTitleBarVisible = (isVisible: boolean) => {
        this.showTitleBar = isVisible;
        this.saveConfig("showTitleBar", isVisible);
    };

    public toggleTitleBar = () => {
        this.setTitleBarVisible(!this.showTitleBar);
    };

    public setGap = (gap: number) => {
        this.gap = gap;
        this.saveConfig("gap", gap);
    };

    public setBorderWidth = (width: number) => {
        this.borderWidth = `${width}px`;
        this.saveConfig("borderWidth", this.borderWidth);
    };

    public setBorderColor = (color: string) => {
        this.borderColor = color;
        this.saveConfig("borderColor", color);
    };

    public setActiveBorderColor = (color: string) => {
        this.activeBorderColor = color;
        this.saveConfig("activeBorderColor", color);
    };

    public setShadowBlur = (blur: number) => {
        this.shadowBlur = blur;
        this.saveConfig("shadowBlur", blur);
    };

    public setShadowAmount = (amount: number) => {
        this.shadowAmount = amount;
        this.saveConfig("shadowAmount", amount);
    };

    public setBorderRadius = (radius: number) => {
        this.borderRadius = radius;
        this.saveConfig("borderRadius", radius);
    };

    public setTerminalPadding = (padding: number) => {
        this.terminalPadding = padding;
        this.saveConfig("terminalPadding", padding);
    };

    public setTerminalColor = (color: string) => {
        this.terminalColor = color;
        this.saveConfig("terminalColor", color);
    };

    public setTerminalOpacity = (opacity: number) => {
        const next = Number.isFinite(opacity)
            ? Math.min(1, Math.max(0, opacity))
            : DEFAULTS.terminalOpacity;
        this.terminalOpacity = next;
        this.saveConfig("terminalOpacity", next);
    };

    public setTerminalBlur = (blur: number) => {
        const next = Number.isFinite(blur)
            ? Math.max(0, blur)
            : DEFAULTS.terminalBlur;
        this.terminalBlur = next;
        this.saveConfig("terminalBlur", next);
    };

    public setTerminalFontFamily = (fontFamily: string) => {
        this.terminalFontFamily = fontFamily;
        this.saveConfig("terminalFontFamily", fontFamily);
    };

    public setTerminalFontSize = (fontSize: number) => {
        this.terminalFontSize = fontSize;
        this.saveConfig("terminalFontSize", fontSize);
    };

    public hydrateFromSession = (
        data: {
            wallpaper?: Wallpaper;
            showTitleBar?: boolean;
            terminalPadding?: number;
            terminalColor?: string;
            terminalPaddingColor?: string;
            terminalOpacity?: number;
            terminalBlur?: number;
            terminalFontFamily?: string;
            terminalFontSize?: number;
            gap?: number;
            borderWidth?: string;
            borderColor?: string;
            activeBorderColor?: string;
            shadowBlur?: number;
            shadowAmount?: number;
            shadowColor?: string;
            borderRadius?: number;
        } | null
    ) => {
        if (data?.wallpaper?.value) {
            this.wallpaper = data.wallpaper;
        }

        if (typeof data?.showTitleBar === "boolean") {
            this.showTitleBar = data.showTitleBar;
        }

        if (typeof data?.terminalPadding === "number") {
            this.terminalPadding = data.terminalPadding;
        }

        if (typeof data?.terminalColor === "string") {
            this.terminalColor = data.terminalColor;
        } else if (typeof data?.terminalPaddingColor === "string") {
            this.terminalColor = data.terminalPaddingColor;
        }

        if (typeof data?.terminalOpacity === "number") {
            this.terminalOpacity = Math.min(1, Math.max(0, data.terminalOpacity));
        }

        if (typeof data?.terminalBlur === "number") {
            this.terminalBlur = Math.max(0, data.terminalBlur);
        }

        if (typeof data?.terminalFontFamily === "string") {
            this.terminalFontFamily = data.terminalFontFamily;
        }

        if (typeof data?.terminalFontSize === "number") {
            this.terminalFontSize = data.terminalFontSize;
        }

        if (typeof data?.gap === "number") {
            this.gap = data.gap;
        }

        if (typeof data?.borderWidth === "string") {
            this.borderWidth = data.borderWidth;
        }

        if (typeof data?.borderColor === "string") {
            this.borderColor = data.borderColor;
        }

        if (typeof data?.activeBorderColor === "string") {
            this.activeBorderColor = data.activeBorderColor;
        }

        if (typeof data?.shadowBlur === "number") {
            this.shadowBlur = data.shadowBlur;
        }

        if (typeof data?.shadowAmount === "number") {
            this.shadowAmount = data.shadowAmount;
        }

        if (typeof data?.shadowColor === "string") {
            this.shadowColor = data.shadowColor;
        }

        if (typeof data?.borderRadius === "number") {
            this.borderRadius = data.borderRadius;
        }
    };

    public fetchConfig = async () => {
        const response = await clients.authFetch(`${this.baseUrl}/api/config`);
        if (!response.ok) {
            return null;
        }

        const payload = await response.json();
        const wallpaper = payload?.config?.wallpaper as Wallpaper | undefined;
        if (wallpaper?.value) {
            this.wallpaper = wallpaper;
        }

        if (typeof payload?.config?.showTitleBar === "boolean") {
            this.showTitleBar = payload.config.showTitleBar;
        }

        if (typeof payload?.config?.terminalPadding === "number") {
            this.terminalPadding = payload.config.terminalPadding;
        }

        if (typeof payload?.config?.terminalColor === "string") {
            this.terminalColor = payload.config.terminalColor;
        } else if (typeof payload?.config?.terminalPaddingColor === "string") {
            this.terminalColor = payload.config.terminalPaddingColor;
        }

        if (typeof payload?.config?.terminalOpacity === "number") {
            this.terminalOpacity = Math.min(
                1,
                Math.max(0, payload.config.terminalOpacity)
            );
        }

        if (typeof payload?.config?.terminalBlur === "number") {
            this.terminalBlur = Math.max(0, payload.config.terminalBlur);
        }

        if (typeof payload?.config?.terminalFontFamily === "string") {
            this.terminalFontFamily = payload.config.terminalFontFamily;
        }

        if (typeof payload?.config?.terminalFontSize === "number") {
            this.terminalFontSize = payload.config.terminalFontSize;
        }

        if (typeof payload?.config?.gap === "number") {
            this.gap = payload.config.gap;
        }

        if (typeof payload?.config?.borderWidth === "string") {
            this.borderWidth = payload.config.borderWidth;
        }

        if (typeof payload?.config?.borderColor === "string") {
            this.borderColor = payload.config.borderColor;
        }

        if (typeof payload?.config?.activeBorderColor === "string") {
            this.activeBorderColor = payload.config.activeBorderColor;
        }

        if (typeof payload?.config?.shadowBlur === "number") {
            this.shadowBlur = payload.config.shadowBlur;
        }

        if (typeof payload?.config?.shadowAmount === "number") {
            this.shadowAmount = payload.config.shadowAmount;
        }

        if (typeof payload?.config?.shadowColor === "string") {
            this.shadowColor = payload.config.shadowColor;
        }

        if (typeof payload?.config?.borderRadius === "number") {
            this.borderRadius = payload.config.borderRadius;
        }

        return payload?.config ?? null;
    };

    public saveConfig = (key: string, value: unknown) => {
        const existingTimer = this.saveTimers[key];
        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        this.saveTimers[key] = setTimeout(() => {
            delete this.saveTimers[key];
            clients.authFetch(`${this.baseUrl}/api/config`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    key,
                    value,
                }),
            });
        }, 500);
    };

    /** Prompt the user to select a wallpaper file. */
    public selectWallpaperFile = () => {
        if (typeof window === "undefined") {
            return;
        }

        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.style.display = "none";

        const handleChange = () => {
            const file = input.files?.[0];
            if (file) {
                this.uploadWallpaper(file);
            }

            input.removeEventListener("change", handleChange);
            input.remove();
        };

        input.addEventListener("change", handleChange);
        document.body.appendChild(input);
        input.click();
    };

    public uploadWallpaper = async (file: File) => {
        const formData = new FormData();
        formData.append("file", file);

        const response = await clients.authFetch(`${this.baseUrl}/api/wallpaper`, {
            method: "POST",
            body: formData,
        });

        if (!response.ok) {
            return null;
        }

        const payload = await response.json();
        const url = payload?.url as string | undefined;
        if (!url) {
            return null;
        }

        const wallpaper: Wallpaper = {
            type: "custom",
            value: url,
        };
        this.wallpaper = wallpaper;
        this.saveConfig("wallpaper", wallpaper);
        return url;
    };
}

export default new ConfigStore();
export type { ModKey, Wallpaper, WallpaperOption };
