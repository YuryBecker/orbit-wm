"use client";

import { observer } from "mobx-react";
import { useEffect, useRef } from "react";

import WindowPaneInstance from "../../state/window-manager/instance";

import UrlBar from "./UrlBar";



type BrowserProps = {
    instance: WindowPaneInstance;
    isCtrlDown?: boolean;
};

const Browser = observer(({ instance, isCtrlDown }: BrowserProps) => {
    const iframeRef = useRef<HTMLIFrameElement | null>(null);

    useEffect(() => {
        if (instance.browser) {
            return;
        }

        instance.startBrowser(instance.url);
    }, [instance]);

    useEffect(() => {
        const iframe = iframeRef.current;
        if (!iframe) {
            return;
        }

        let cleanup: (() => void) | null = null;

        const handleLoad = () => {
            cleanup?.();
            cleanup = null;

            try {
                const contentWindow = iframe.contentWindow;
                if (!contentWindow) {
                    return;
                }

                const handler = (event: KeyboardEvent) => {
                    if ((event.ctrlKey || event.metaKey) && event.key === "q") {
                        event.preventDefault();
                        instance.close();
                    }
                };

                contentWindow.addEventListener("keydown", handler);
                cleanup = () => {
                    contentWindow.removeEventListener("keydown", handler);
                };
            } catch {
                cleanup = null;
            }
        };

        iframe.addEventListener("load", handleLoad);

        return () => {
            iframe.removeEventListener("load", handleLoad);
            cleanup?.();
        };
    }, [instance]);

    if (!instance.browser) return;

    return (
        <div className="flex-1 overflow-hidden bg-zinc-900">
            <UrlBar
                url={instance.browser?.url ?? instance.url}
                onSubmit={(url) => {
                    instance.setUrl(url);
                }}
            />

            { instance.browser.url &&
                <iframe
                    title={instance.title}
                    src={instance.browser?.url ?? instance.url}
                    ref={iframeRef}
                    className={`h-full w-full border-0 ${
                        isCtrlDown ? "pointer-events-none" : ""
                    }`}
                />
            }
        </div>
    );
});

export default Browser;
