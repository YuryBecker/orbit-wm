import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import { spawn } from "node-pty";

import type { IPty } from "node-pty";

import type { RuntimeCreateResult, RuntimeSessionOptions, SessionRuntime } from "./types";



type DockerRuntimeConfig = {
    dockerBin: string;
    image: string;
    shell: string;
    network: string;
    memory: string;
    cpus: string;
    pidsLimit: string;
    user: string;
    readOnly: boolean;
    tmpfs: string[];
    capDropAll: boolean;
    noNewPrivileges: boolean;
    extraRunArgs: string[];
    prewarmPoolSize: number;
    autoBuild: boolean;
    buildContext: string;
    buildDockerfile: string;
};

const DEFAULT_COLS = 120;
const DEFAULT_ROWS = 30;
const DEFAULT_CONFIG_PATH = path.join(
    process.cwd(),
    "middle",
    "runtime",
    "docker.config.json",
);

const DEFAULT_CONFIG: DockerRuntimeConfig = {
    dockerBin: "docker",
    image: "orbit-sandbox-shell:latest",
    shell: "/usr/bin/fish",
    network: "none",
    memory: "512m",
    cpus: "1",
    pidsLimit: "128",
    user: "1000:1000",
    readOnly: true,
    tmpfs: [
        "/tmp:rw,noexec,nosuid,nodev",
        "/home/demo:rw,nosuid,nodev,uid=1000,gid=1000,mode=700",
    ],
    capDropAll: true,
    noNewPrivileges: true,
    extraRunArgs: [],
    prewarmPoolSize: 1,
    autoBuild: false,
    buildContext: path.join(process.cwd(), "docker", "sandbox"),
    buildDockerfile: path.join(process.cwd(), "docker", "sandbox", "Dockerfile"),
};

const parseBoolean = (value: string | undefined, fallback: boolean) => {
    if (value === undefined) {
        return fallback;
    }

    const normalized = value.toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) {
        return true;
    }

    if (["0", "false", "no", "off"].includes(normalized)) {
        return false;
    }

    return fallback;
};

const parseStringArray = (value: string | undefined, fallback: string[]) => {
    if (!value || !value.trim()) {
        return fallback;
    }

    return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
};

const mergeConfig = (
    base: DockerRuntimeConfig,
    override: Partial<DockerRuntimeConfig>,
): DockerRuntimeConfig => ({
    ...base,
    ...override,
    tmpfs: override.tmpfs || base.tmpfs,
    extraRunArgs: override.extraRunArgs || base.extraRunArgs,
});

const resolvePathIfNeeded = (value: string) => {
    if (path.isAbsolute(value)) {
        return value;
    }

    return path.join(process.cwd(), value);
};

const loadConfigFile = (): Partial<DockerRuntimeConfig> => {
    const configPath = process.env.ORBIT_DOCKER_CONFIG_FILE || DEFAULT_CONFIG_PATH;
    if (!fs.existsSync(configPath)) {
        return {};
    }

    const raw = fs.readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<DockerRuntimeConfig>;
    return parsed;
};

const loadConfig = (): DockerRuntimeConfig => {
    const fileConfig = loadConfigFile();
    const merged = mergeConfig(DEFAULT_CONFIG, fileConfig);

    return {
        ...merged,
        dockerBin: process.env.ORBIT_DOCKER_BIN || merged.dockerBin,
        image: process.env.ORBIT_DOCKER_IMAGE || merged.image,
        shell: process.env.ORBIT_DOCKER_SHELL || merged.shell,
        network: process.env.ORBIT_DOCKER_NETWORK || merged.network,
        memory: process.env.ORBIT_DOCKER_MEMORY || merged.memory,
        cpus: process.env.ORBIT_DOCKER_CPUS || merged.cpus,
        pidsLimit: process.env.ORBIT_DOCKER_PIDS_LIMIT || merged.pidsLimit,
        user: process.env.ORBIT_DOCKER_USER || merged.user,
        readOnly: parseBoolean(process.env.ORBIT_DOCKER_READ_ONLY, merged.readOnly),
        capDropAll: parseBoolean(
            process.env.ORBIT_DOCKER_CAP_DROP_ALL,
            merged.capDropAll,
        ),
        noNewPrivileges: parseBoolean(
            process.env.ORBIT_DOCKER_NO_NEW_PRIVILEGES,
            merged.noNewPrivileges,
        ),
        tmpfs: parseStringArray(process.env.ORBIT_DOCKER_TMPFS, merged.tmpfs),
        extraRunArgs: parseStringArray(
            process.env.ORBIT_DOCKER_EXTRA_RUN_ARGS,
            merged.extraRunArgs,
        ),
        prewarmPoolSize: Math.max(
            0,
            Number(
                process.env.ORBIT_DOCKER_PREWARM_POOL_SIZE || merged.prewarmPoolSize,
            ) || 0,
        ),
        autoBuild: parseBoolean(
            process.env.ORBIT_DOCKER_AUTO_BUILD,
            merged.autoBuild,
        ),
        buildContext: resolvePathIfNeeded(
            process.env.ORBIT_DOCKER_BUILD_CONTEXT || merged.buildContext,
        ),
        buildDockerfile: resolvePathIfNeeded(
            process.env.ORBIT_DOCKER_BUILD_FILE || merged.buildDockerfile,
        ),
    };
};

const safeName = (value: string) =>
    `orbit-${value.toLowerCase().replace(/[^a-z0-9_.-]/g, "-")}`;

const createDockerRuntime = (): SessionRuntime => {
    const config = loadConfig();
    const prewarmedSessionIds: string[] = [];
    const groupToContainer = new Map<string, string>();
    const sessionToContainer = new Map<string, string>();
    const containerRefs = new Map<string, number>();

    const runDocker = (args: string[]) =>
        execFileSync(config.dockerBin, args, {
            stdio: ["ignore", "pipe", "pipe"],
            encoding: "utf8",
        }).trim();

    const hasContainer = (containerId: string) => {
        try {
            const result = runDocker([
                "inspect",
                "-f",
                "{{.State.Running}}",
                containerId,
            ]);
            return result === "true";
        } catch {
            return false;
        }
    };

    const hasImage = () => {
        try {
            runDocker(["image", "inspect", config.image]);
            return true;
        } catch {
            return false;
        }
    };

    const buildImage = () => {
        execFileSync(
            config.dockerBin,
            [
                "build",
                "-t",
                config.image,
                "-f",
                config.buildDockerfile,
                config.buildContext,
            ],
            {
                stdio: "inherit",
                encoding: "utf8",
            },
        );
    };

    const spawnDockerExecPty = (containerId: string): IPty =>
        spawn(config.dockerBin, ["exec", "-it", containerId, config.shell], {
            name: "xterm-256color",
            cols: DEFAULT_COLS,
            rows: DEFAULT_ROWS,
            cwd: process.cwd(),
            env: process.env as NodeJS.ProcessEnv,
        });

    const createContainer = (nameHint: string | null) => {
        const runArgs: string[] = [
            "run",
            "-d",
            "--rm",
            "--init",
        ];

        if (config.readOnly) {
            runArgs.push("--read-only");
        }

        for (const tmpfsMount of config.tmpfs) {
            runArgs.push("--tmpfs", tmpfsMount);
        }

        if (config.capDropAll) {
            runArgs.push("--cap-drop=ALL");
        }

        if (config.noNewPrivileges) {
            runArgs.push("--security-opt", "no-new-privileges");
        }

        runArgs.push(
            "--pids-limit",
            config.pidsLimit,
            "--memory",
            config.memory,
            "--cpus",
            config.cpus,
            "--network",
            config.network,
            "--user",
            config.user,
            "--name",
            nameHint ? safeName(nameHint) : `orbit-prewarm-${crypto.randomUUID()}`,
        );

        if (config.extraRunArgs.length > 0) {
            runArgs.push(...config.extraRunArgs);
        }

        runArgs.push(config.image);

        return runDocker(runArgs);
    };

    const resolveGroupId = (options?: RuntimeSessionOptions) => {
        const value = options?.runtimeGroupId;
        if (!value || !value.trim()) {
            return "default";
        }

        return value.trim();
    };

    const removeGroupMappings = (containerId: string) => {
        for (const [groupId, mappedContainerId] of groupToContainer.entries()) {
            if (mappedContainerId === containerId) {
                groupToContainer.delete(groupId);
            }
        }
    };

    const destroyContainer = (containerId: string) => {
        removeGroupMappings(containerId);
        containerRefs.delete(containerId);

        try {
            runDocker(["rm", "-f", containerId]);
        } catch {
            return;
        }
    };

    const createSession = (
        sessionId: string,
        options?: RuntimeSessionOptions,
    ): RuntimeCreateResult => {
        const runtimeGroupId = resolveGroupId(options);
        let containerId: string | null = groupToContainer.get(runtimeGroupId) || null;

        if (containerId && !hasContainer(containerId)) {
            groupToContainer.delete(runtimeGroupId);
            containerId = null;
        }

        if (!containerId) {
            while (prewarmedSessionIds.length > 0 && !containerId) {
                const candidate = prewarmedSessionIds.shift();
                if (!candidate) {
                    continue;
                }

                if (hasContainer(candidate)) {
                    containerId = candidate;
                }
            }
        }

        if (!containerId) {
            containerId = createContainer(sessionId);
        }

        groupToContainer.set(runtimeGroupId, containerId);

        const refs = containerRefs.get(containerId) || 0;
        containerRefs.set(containerId, refs + 1);
        sessionToContainer.set(sessionId, containerId);

        const pty = spawnDockerExecPty(containerId);

        return {
            runtimeSessionId: containerId,
            pty,
        };
    };

    return {
        kind: "docker",
        configure: () => {
            if (!hasImage() && config.autoBuild) {
                console.log(`[runtime] Building missing Docker image: ${config.image}`);
                buildImage();
            }

            if (!hasImage()) {
                throw new Error(
                    [
                        `Docker sandbox image not found: ${config.image}`,
                        "Build it with: npm run orbit-sandbox:image:build",
                        "Or set ORBIT_DOCKER_IMAGE to an existing local image.",
                    ].join(" "),
                );
            }
        },
        prewarmSession: (options?: RuntimeSessionOptions) => {
            const runtimeGroupId = resolveGroupId(options);
            const mappedContainerId = groupToContainer.get(runtimeGroupId);
            if (mappedContainerId && hasContainer(mappedContainerId)) {
                return {
                    created: false,
                    runtimeSessionId: mappedContainerId,
                };
            }

            const validIds = prewarmedSessionIds.filter((id) => hasContainer(id));
            prewarmedSessionIds.length = 0;
            prewarmedSessionIds.push(...validIds);

            if (prewarmedSessionIds.length >= config.prewarmPoolSize) {
                return {
                    created: false,
                    runtimeSessionId: prewarmedSessionIds[0] || null,
                };
            }

            const runtimeSessionId = createContainer(null);
            prewarmedSessionIds.push(runtimeSessionId);
            return {
                created: true,
                runtimeSessionId,
            };
        },
        createSession,
        attachSession: (_sessionId: string, runtimeSessionId: string) =>
            spawnDockerExecPty(runtimeSessionId),
        hasSession: (_sessionId: string, runtimeSessionId: string) =>
            hasContainer(runtimeSessionId),
        destroySession: (sessionId: string, runtimeSessionId: string) => {
            const mappedContainerId = sessionToContainer.get(sessionId);
            const containerId = mappedContainerId || runtimeSessionId;
            sessionToContainer.delete(sessionId);

            const refs = containerRefs.get(containerId);
            if (refs && refs > 1) {
                containerRefs.set(containerId, refs - 1);
                return;
            }

            destroyContainer(containerId);
        },
    };
};

export default createDockerRuntime;
