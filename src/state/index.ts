import { toJS } from "mobx";

import config from "./config";
import browsers from "./browsers";
import clients from "./clients";
import mirrorTerminal from "./mirror-terminal";
import terminals from "./terminals";
import windowManager from "./window-manager";


// For debugging:
if (typeof window !== 'undefined') {
    (window as any).toJS = toJS;
    (window as any).config = config;
    (window as any).browsers = browsers;
    (window as any).clients = clients;
    (window as any).mirrorTerminal = mirrorTerminal;
    (window as any).terminals = terminals;
    (window as any).windowManager = windowManager;
}


export { browsers, clients, config, mirrorTerminal, terminals, windowManager };
