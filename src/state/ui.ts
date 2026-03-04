import { makeAutoObservable } from "mobx";


const DEFAULTS = {
    screenWidth: 0,
    screenHeight: 0,
    availWidth: 0,
    availHeight: 0,
    innerWidth: 0,
    innerHeight: 0,
    outerWidth: 0,
    outerHeight: 0,
    clientWidth: 0,
    clientHeight: 0,
    visualViewportWidth: 0,
    visualViewportHeight: 0,
    visualViewportOffsetTop: 0,
    visualViewportOffsetLeft: 0,
    visualViewportScale: 1,
    maxVisualViewportHeight: 0,
    maxInnerHeight: 0,
    devicePixelRatio: 1,
    orientationType: "unknown",
    orientationAngle: 0,
};

class UiStore {
    constructor() {
        makeAutoObservable(this);
    }

    /* ---- Observables ---- */
    /** Physical screen width in CSS pixels. */
    public screenWidth = DEFAULTS.screenWidth;

    /** Physical screen height in CSS pixels. */
    public screenHeight = DEFAULTS.screenHeight;

    /** Available screen width excluding OS UI. */
    public availWidth = DEFAULTS.availWidth;

    /** Available screen height excluding OS UI. */
    public availHeight = DEFAULTS.availHeight;

    /** Window inner width in CSS pixels. */
    public innerWidth = DEFAULTS.innerWidth;

    /** Window inner height in CSS pixels. */
    public innerHeight = DEFAULTS.innerHeight;

    /** Browser outer width in CSS pixels. */
    public outerWidth = DEFAULTS.outerWidth;

    /** Browser outer height in CSS pixels. */
    public outerHeight = DEFAULTS.outerHeight;

    /** Document element client width. */
    public clientWidth = DEFAULTS.clientWidth;

    /** Document element client height. */
    public clientHeight = DEFAULTS.clientHeight;

    /** Visual viewport width in CSS pixels. */
    public visualViewportWidth = DEFAULTS.visualViewportWidth;

    /** Visual viewport height in CSS pixels. */
    public visualViewportHeight = DEFAULTS.visualViewportHeight;

    /** Visual viewport top offset in CSS pixels. */
    public visualViewportOffsetTop = DEFAULTS.visualViewportOffsetTop;

    /** Visual viewport left offset in CSS pixels. */
    public visualViewportOffsetLeft = DEFAULTS.visualViewportOffsetLeft;

    /** Visual viewport zoom scale. */
    public visualViewportScale = DEFAULTS.visualViewportScale;

    /** Largest observed visual viewport height for keyboard delta estimates. */
    public maxVisualViewportHeight = DEFAULTS.maxVisualViewportHeight;

    /** Largest observed inner height for keyboard delta estimates. */
    public maxInnerHeight = DEFAULTS.maxInnerHeight;

    /** Current device pixel ratio. */
    public devicePixelRatio = DEFAULTS.devicePixelRatio;

    /** Current orientation type if available. */
    public orientationType = DEFAULTS.orientationType;

    /** Current orientation angle if available. */
    public orientationAngle = DEFAULTS.orientationAngle;

    /** Whether listeners are currently attached. */
    public isStarted = false;

    /** Cached teardown callback for all listeners. */
    private cleanup: (() => void) | null = null;

    static readonly MOBILE_BREAKPOINT = 768;


    /* ---- Computed ---- */
    /** Estimated keyboard height based on the best observed viewport height. */
    public get keyboardHeightEstimate() {
        return Math.max(
            0,
            Math.round(this.maxVisualViewportHeight - this.visualViewportHeight),
        );
    }

    /** Whether the software keyboard is likely open. */
    public get isKeyboardOpen() {
        return this.keyboardHeightEstimate > 80;
    }

    /** Current visible height that app content can use. */
    public get visibleHeight() {
        return Math.round(this.visualViewportHeight || this.innerHeight);
    }

    public get isMobile(): boolean {
        const viewportWidth = this.visualViewportWidth || this.innerWidth;

        return viewportWidth > 0 && viewportWidth < UiStore.MOBILE_BREAKPOINT;
    }


    /* ---- Actions ---- */
    /** Start tracking screen and viewport metrics. */
    public start = () => {
        if (this.isStarted || typeof window === "undefined") {
            return;
        }

        this.isStarted = true;

        const update = () => {
            const viewport = window.visualViewport;
            const doc = window.document.documentElement;

            this.screenWidth = window.screen.width;
            this.screenHeight = window.screen.height;
            this.availWidth = window.screen.availWidth;
            this.availHeight = window.screen.availHeight;
            this.innerWidth = window.innerWidth;
            this.innerHeight = window.innerHeight;
            this.outerWidth = window.outerWidth;
            this.outerHeight = window.outerHeight;
            this.clientWidth = doc.clientWidth;
            this.clientHeight = doc.clientHeight;
            this.devicePixelRatio = window.devicePixelRatio || 1;

            if (viewport) {
                this.visualViewportWidth = viewport.width;
                this.visualViewportHeight = viewport.height;
                this.visualViewportOffsetTop = viewport.offsetTop;
                this.visualViewportOffsetLeft = viewport.offsetLeft;
                this.visualViewportScale = viewport.scale;
            } else {
                this.visualViewportWidth = this.innerWidth;
                this.visualViewportHeight = this.innerHeight;
                this.visualViewportOffsetTop = 0;
                this.visualViewportOffsetLeft = 0;
                this.visualViewportScale = 1;
            }

            this.maxVisualViewportHeight = Math.max(
                this.maxVisualViewportHeight,
                this.visualViewportHeight,
            );
            this.maxInnerHeight = Math.max(this.maxInnerHeight, this.innerHeight);

            const orientation = window.screen.orientation;
            if (orientation) {
                this.orientationType = orientation.type;
                this.orientationAngle = orientation.angle;
            } else {
                this.orientationType = this.innerWidth >= this.innerHeight
                    ? "landscape"
                    : "portrait";
                this.orientationAngle = 0;
            }
        };

        const onUpdate = () => {
            update();
        };

        update();

        window.addEventListener("resize", onUpdate);
        window.addEventListener("orientationchange", onUpdate);

        const viewport = window.visualViewport;
        if (viewport) {
            viewport.addEventListener("resize", onUpdate);
            viewport.addEventListener("scroll", onUpdate);
        }

        this.cleanup = () => {
            window.removeEventListener("resize", onUpdate);
            window.removeEventListener("orientationchange", onUpdate);

            if (viewport) {
                viewport.removeEventListener("resize", onUpdate);
                viewport.removeEventListener("scroll", onUpdate);
            }
        };
    };

    /** Stop tracking metrics and detach listeners. */
    public stop = () => {
        if (!this.isStarted) {
            return;
        }

        this.cleanup?.();
        this.cleanup = null;
        this.isStarted = false;
    };

    /** Capture a fresh snapshot immediately. */
    public refresh = () => {
        if (typeof window === "undefined") {
            return;
        }

        if (!this.isStarted) {
            this.start();
            return;
        }

        window.dispatchEvent(new Event("resize"));
    };
    /* ---- Clean-up ---- */
    /** Reset to defaults and detach listeners. */
    public reset = () => {
        this.stop();

        this.screenWidth = DEFAULTS.screenWidth;
        this.screenHeight = DEFAULTS.screenHeight;
        this.availWidth = DEFAULTS.availWidth;
        this.availHeight = DEFAULTS.availHeight;
        this.innerWidth = DEFAULTS.innerWidth;
        this.innerHeight = DEFAULTS.innerHeight;
        this.outerWidth = DEFAULTS.outerWidth;
        this.outerHeight = DEFAULTS.outerHeight;
        this.clientWidth = DEFAULTS.clientWidth;
        this.clientHeight = DEFAULTS.clientHeight;
        this.visualViewportWidth = DEFAULTS.visualViewportWidth;
        this.visualViewportHeight = DEFAULTS.visualViewportHeight;
        this.visualViewportOffsetTop = DEFAULTS.visualViewportOffsetTop;
        this.visualViewportOffsetLeft = DEFAULTS.visualViewportOffsetLeft;
        this.visualViewportScale = DEFAULTS.visualViewportScale;
        this.maxVisualViewportHeight = DEFAULTS.maxVisualViewportHeight;
        this.maxInnerHeight = DEFAULTS.maxInnerHeight;
        this.devicePixelRatio = DEFAULTS.devicePixelRatio;
        this.orientationType = DEFAULTS.orientationType;
        this.orientationAngle = DEFAULTS.orientationAngle;
    };
}


export default new UiStore();
