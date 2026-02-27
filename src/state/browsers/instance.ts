import { makeAutoObservable } from "mobx";


class BrowserInstance {
    constructor(url = DEFAULTS.url) {
        this.id = `browser_${globalThis.crypto?.randomUUID?.() || Date.now()}`;
        this.url = url;

        makeAutoObservable(this);
    }

    /* ---- Observables ---- */
    /** Client-side identifier for this browser instance. */
    public id: string;

    /** Current URL loaded in the iframe. */
    public url = DEFAULTS.url;

    /* ---- Actions ---- */
    /** Update the current URL. */
    public setUrl = (url: string) => {
        this.url = url;
    };
}

const DEFAULTS = {
    url: "",
};

declare global {
    namespace Instance {
        type BrowserId = string & { __brand: 'browser' };

        type Browser = BrowserInstance;
    }
}

export default BrowserInstance;
