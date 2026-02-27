import { toJS } from "mobx";
import config from "./config";
import { browsers } from "./browsers";
import { terminals } from "./terminals";
import { windowManager } from "./window-manager";


// For debugging:
if (typeof window !== 'undefined') {
    (window as any).toJS = toJS;
    (window as any).config = config;
    (window as any).browsers = browsers;
    (window as any).terminals = terminals;
    (window as any).windowManager = windowManager;
}


export { browsers, config, terminals, windowManager };
