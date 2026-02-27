"use client";

import { observer } from "mobx-react";
import { useEffect, useMemo, useState } from "react";



type UrlBarProps = {
    url: string;
    onSubmit: (url: string) => void;
};

const normalizeUrl = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
        return "about:blank";
    }

    if (/^[a-zA-Z]+:\/\//.test(trimmed) || trimmed.startsWith("about:")) {
        return trimmed;
    }

    return `http://${trimmed}`;
};

const isLocalTarget = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
        return true;
    }

    try {
        const normalized = normalizeUrl(trimmed);
        const parsed = new URL(normalized);
        const hostname = parsed.hostname.toLowerCase();

        if (hostname === "localhost" || hostname === "127.0.0.1") {
            return true;
        }

        const ipv4 =
            /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
        return ipv4.test(hostname);
    } catch {
        return false;
    }
};

const UrlBar = observer(({ url, onSubmit }: UrlBarProps) => {
    const [value, setValue] = useState(url);
    const [isWarningDismissed, setIsWarningDismissed] = useState(false);

    useEffect(() => {
        setValue(url);
        setIsWarningDismissed(false);
    }, [url]);

    const showWarning = useMemo(() => {
        if (isWarningDismissed) {
            return false;
        }

        return !isLocalTarget(url);
    }, [isWarningDismissed, url]);

    return (
        <div className="border-b border-white/10 bg-zinc-900/40 px-3 py-2">
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    onSubmit(normalizeUrl(value));
                }}
            >
                <input
                    autoFocus
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                    className="w-full rounded-full border border-white/10 bg-black/60 px-3 py-1 text-xs text-white/80 outline-none focus:border-white/30"
                    placeholder="Enter URL (local dev: localhost or IP)"
                    spellCheck={false}
                />
            </form>
            {showWarning ? (
                <div className="mt-2 flex items-start justify-between gap-3 text-[11px] leading-tight text-white/50">
                    <div>
                        Some sites block being embedded in iframes. This browser
                        is intended for local development, so `localhost` and
                        LAN IPs are the typical targets.
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-white/60 transition hover:border-white/30 hover:text-white"
                            onClick={() => {
                                const target = normalizeUrl(value);
                                window.open(target, "_blank", "noopener,noreferrer");
                            }}
                        >
                            Open
                        </button>
                        <button
                            type="button"
                            className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-white/60 transition hover:border-white/30 hover:text-white"
                            onClick={() => setIsWarningDismissed(true)}
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
            ) : null}
        </div>
    );
});

export default UrlBar;
