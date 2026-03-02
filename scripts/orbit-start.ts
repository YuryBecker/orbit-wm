import { spawn } from "node:child_process";
import type { ChildProcess, SpawnSyncReturns } from "node:child_process";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";


const ORBIT_HTTPS_PORT = process.env.ORBIT_HTTPS_PORT || "43123";
const ORBIT_MIDDLE_PORT = process.env.ORBIT_MIDDLE_PORT || "43120";
const ORBIT_NEXT_PORT = process.env.ORBIT_NEXT_PORT || "43121";

const cwd = process.cwd();

const bin = (name: string) =>
    path.join(
        cwd,
        "node_modules",
        ".bin",
        process.platform === "win32" ? `${name}.cmd` : name,
    );

const ensureDir = (dirPath: string) => {
    fs.mkdirSync(dirPath, { recursive: true });
};

const getLanIpv4Addresses = () => {
    const interfaces = os.networkInterfaces();
    const ips: string[] = [];

    Object.values(interfaces).forEach((networkInterface) => {
        if (!networkInterface) {
            return;
        }

        networkInterface.forEach((address) => {
            if (
                address.family === "IPv4" &&
                !address.internal &&
                !address.address.startsWith("169.254.")
            ) {
                ips.push(address.address);
            }
        });
    });

    return Array.from(new Set(ips));
};

const spawnChecked = (
    command: string,
    args: string[],
    options: {
        env?: Record<string, string>;
        name: string;
        onFailure?: () => void;
    },
) => {
    const env: NodeJS.ProcessEnv = {
        ...process.env,
        NODE_ENV: process.env.NODE_ENV || "production",
        ...options.env,
    };

    const child: ChildProcess = spawn(command, args, {
        stdio: "inherit",
        cwd,
        env,
    } as any) as ChildProcess;

    child.on("exit", (code: number | null, signal: NodeJS.Signals | null) => {
        if (signal) {
            return;
        }

        if (code && code !== 0) {
            console.error(`[orbit-start] ${options.name} exited with code ${code}`);
            process.exitCode = code;
            options.onFailure?.();
        }
    });

    child.on("error", (error: Error) => {
        console.error(`[orbit-start] Failed to start ${options.name}: ${error.message}`);
        process.exitCode = 1;
        options.onFailure?.();
    });

    return child;
};

const runBuild = () => {
    const nextBin = bin("next");
    console.log("[orbit-start] Building Next.js app...");

    const result: SpawnSyncReturns<Buffer> = spawnSync(nextBin, ["build"], {
        cwd,
        stdio: "inherit",
        env: {
            ...process.env,
            NODE_ENV: process.env.NODE_ENV || "production",
            NEXT_PUBLIC_MIDDLE_PORT: ORBIT_HTTPS_PORT,
        },
    });

    if (result.error) {
        console.error(`[orbit-start] Failed to build app: ${result.error.message}`);
        process.exitCode = 1;
        return;
    }

    if (result.status && result.status !== 0) {
        console.error(`[orbit-start] Build failed with code ${result.status}`);
        process.exitCode = result.status;
        return;
    }
};

const run = async () => {
    const assertPortFree = (
        host: string,
        port: number,
        envVar: string,
    ) =>
        new Promise<void>((resolve) => {
            const tester = net.createServer();
            tester.unref();

            tester.on("error", () => {
                console.error(
                    `[orbit-start] Port ${port} is already in use on ${host}. Set ${envVar} to a free port and retry.`,
                );
                process.exitCode = 1;
                resolve();
            });

            tester.listen(port, host, () => {
                tester.close(() => resolve());
            });
        });

    await assertPortFree("0.0.0.0", Number(ORBIT_HTTPS_PORT), "ORBIT_HTTPS_PORT");
    if (process.exitCode) {
        return;
    }

    await assertPortFree("127.0.0.1", Number(ORBIT_MIDDLE_PORT), "ORBIT_MIDDLE_PORT");
    if (process.exitCode) {
        return;
    }

    await assertPortFree("127.0.0.1", Number(ORBIT_NEXT_PORT), "ORBIT_NEXT_PORT");
    if (process.exitCode) {
        return;
    }

    runBuild();
    if (process.exitCode) {
        return;
    }

    const orbitDir = path.join(cwd, ".orbit");
    const xdgDataHome = path.join(orbitDir, "xdg-data");
    const xdgConfigHome = path.join(orbitDir, "xdg-config");
    ensureDir(xdgDataHome);
    ensureDir(xdgConfigHome);

    const nextBin = bin("next");
    const tsxBin = bin("tsx");
    const caddyfile = path.join(cwd, "caddy", "Caddyfile.dev");

    let shuttingDown = false;
    const children: ChildProcess[] = [];

    const shutdownChildren = (reason: string) => {
        if (shuttingDown) {
            return;
        }
        shuttingDown = true;
        console.log(`[orbit-start] Shutting down (${reason})...`);

        children.forEach((child) => {
            if (child.killed) {
                return;
            }

            try {
                child.kill("SIGTERM");
            } catch {
                // ignore
            }
        });
    };

    children.push(
        spawnChecked(
            nextBin,
            ["start", "-p", ORBIT_NEXT_PORT, "-H", "127.0.0.1"],
            {
                name: "next",
                env: {
                    NEXT_PUBLIC_MIDDLE_PORT: ORBIT_HTTPS_PORT,
                },
                onFailure: () => shutdownChildren("process failure"),
            },
        ),
    );
    children.push(
        spawnChecked(tsxBin, ["middle/server.ts"], {
            name: "middle",
            env: {
                MIDDLE_PORT: ORBIT_MIDDLE_PORT,
                MIDDLE_HOST: "127.0.0.1",
            },
            onFailure: () => shutdownChildren("process failure"),
        }),
    );
    children.push(
        spawnChecked(
            "caddy",
            ["run", "--config", caddyfile, "--adapter", "caddyfile"],
            {
                name: "caddy",
                env: {
                    ORBIT_HTTPS_PORT,
                    ORBIT_MIDDLE_PORT,
                    ORBIT_NEXT_PORT,
                    XDG_DATA_HOME: xdgDataHome,
                    XDG_CONFIG_HOME: xdgConfigHome,
                },
                onFailure: () => shutdownChildren("process failure"),
            },
        ),
    );

    const rootCaPath = path.join(
        xdgDataHome,
        "caddy",
        "pki",
        "authorities",
        "local",
        "root.crt",
    );
    const lanIps = getLanIpv4Addresses();
    const entrypointHost = lanIps[0] || "127.0.0.1";

    console.log("");
    console.log(`[orbit-start] Admin address: https://127.0.0.1:${ORBIT_HTTPS_PORT}`);
    console.log(`[orbit-start] Guest address: https://${entrypointHost}:${ORBIT_HTTPS_PORT}`);
    if (lanIps.length > 1) {
        console.log(`[orbit-start] LAN IPv4 addresses: ${lanIps.join(", ")}`);
    }
    console.log(`[orbit-start] Next (internal): http://127.0.0.1:${ORBIT_NEXT_PORT}`);
    console.log(`[orbit-start] Middle (internal): http://127.0.0.1:${ORBIT_MIDDLE_PORT}`);
    console.log(`[orbit-start] Caddy root CA (for iOS trust): ${rootCaPath}`);
    console.log("");

    process.on("SIGINT", () => shutdownChildren("SIGINT"));
    process.on("SIGTERM", () => shutdownChildren("SIGTERM"));
};

void run();
