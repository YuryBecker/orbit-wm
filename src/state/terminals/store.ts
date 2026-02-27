import { makeAutoObservable } from "mobx";

import TerminalInstance from "./instance";



const DEFAULTS = {
    instances: {} as Record<string, TerminalInstance>,
    activeId: null as string | null,
};

class TerminalsStore {
    constructor() {
        makeAutoObservable(this);
    }

    /* ---- Observables ---- */
    /** All terminal instances keyed by client id. */
    public instances: Record<string, TerminalInstance> = DEFAULTS.instances;

    /** The active terminal id. */
    public activeId: string | null = DEFAULTS.activeId;

    /* ---- Computed ---- */
    /** The active terminal instance. */
    public get active() {
        if (!this.activeId) {
            return null;
        }

        return this.instances[this.activeId] || null;
    }

    /** All terminal instances in insertion order. */
    public get all() {
        return Object.values(this.instances);
    }

    /* ---- Actions ---- */
    /** Create and register a new terminal instance. */
    public create = () => {
        const instance = new TerminalInstance();

        this.instances = {
            ...this.instances,
            [instance.id]: instance,
        };
        this.activeId = instance.id;

        return instance;
    };

    /** Return the active instance or create one if missing. */
    public ensureActive = () => this.active || this.create();

    /** Remove an instance by id. */
    public remove = (id: string) => {
        const update = { ...this.instances };
        delete update[id];

        this.instances = update;

        if (this.activeId === id) {
            this.activeId = Object.keys(update)[0] || null;
        }
    };

    /* ---- Clean-up ---- */
    /** Reset the store to its defaults. */
    public reset = () => {
        this.instances = DEFAULTS.instances;
        this.activeId = DEFAULTS.activeId;
    };
}

export default new TerminalsStore();
