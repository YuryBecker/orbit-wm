process.env.ORBIT_RUNTIME = process.env.ORBIT_RUNTIME || "docker";
process.env.ORBIT_DOCKER_IMAGE =
    process.env.ORBIT_DOCKER_IMAGE || "orbit-sandbox-shell:latest";
process.env.ORBIT_DOCKER_NETWORK = process.env.ORBIT_DOCKER_NETWORK || "none";
process.env.ORBIT_DOCKER_AUTO_BUILD = process.env.ORBIT_DOCKER_AUTO_BUILD || "1";
process.env.ORBIT_SANDBOX_IDLE_TIMEOUT_MS =
    process.env.ORBIT_SANDBOX_IDLE_TIMEOUT_MS || "900000";
process.env.ORBIT_SANDBOX_TTL_MS =
    process.env.ORBIT_SANDBOX_TTL_MS || "3600000";
process.env.ORBIT_SANDBOX_CLEANUP_INTERVAL_MS =
    process.env.ORBIT_SANDBOX_CLEANUP_INTERVAL_MS || "30000";
process.env.ORBIT_SANDBOX_ACTIVITY_DEBOUNCE_MS =
    process.env.ORBIT_SANDBOX_ACTIVITY_DEBOUNCE_MS || "5000";

import "./orbit-start";
