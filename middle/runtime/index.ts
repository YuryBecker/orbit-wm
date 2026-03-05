import createDockerRuntime from "./docker";
import createHostRuntime from "./host";

import type { RuntimeKind, SessionRuntime } from "./types";



const ORBIT_RUNTIME =
    (process.env.ORBIT_RUNTIME || "host").toLowerCase() as RuntimeKind;

const createRuntime = (): SessionRuntime => {
    if (ORBIT_RUNTIME === "docker") {
        return createDockerRuntime();
    }

    return createHostRuntime();
};

export default createRuntime;
export type { RuntimeKind, SessionRuntime };
