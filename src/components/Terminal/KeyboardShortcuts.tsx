"use client";

import { observer } from "mobx-react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from "lucide-react";

import { ui } from "state";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";



type KeyboardShortcutsProps = {
    instance: Instance.WindowPane
};

const KeyboardShortcuts = observer(({ instance }: KeyboardShortcutsProps) => {
    const isShortcutsOpen = ui.isMobile && instance.isMaximized;

    if (!isShortcutsOpen) return null;

    return (
        <div
            className={cn(
                "flex w-full items-center justify-between gap-3",
                "p-1",
                "bg-zinc-900",
            )}
            style={{
                bottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
            }}
        >
            <div className="flex items-center gap-2">
                <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    aria-label="Send Escape"
                    title="Send Escape"
                    onClick={() => {
                        instance.terminal?.sendInput("\u001b");
                        instance.focus();
                    }}
                >
                    Esc
                </Button>

                <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    aria-label="Send Ctrl+C"
                    title="Send Ctrl+C"
                    onClick={() => {
                        instance.terminal?.sendInput("\u0003");
                        instance.focus();
                    }}
                >
                    Ctrl+C
                </Button>

                <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    aria-label="Send Ctrl+D"
                    title="Send Ctrl+D"
                    onClick={() => {
                        instance.terminal?.sendInput("\u0004");
                        instance.focus();
                    }}
                >
                    Ctrl+D
                </Button>
            </div>

            <div className="flex items-center gap-2">
                <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    aria-label="Send Arrow Left"
                    title="Send Arrow Left"
                    onClick={() => {
                        instance.terminal?.sendInput("\u001b[D");
                        instance.focus();
                    }}
                >
                    <ArrowLeft size={16} />
                </Button>

                <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    aria-label="Send Arrow Up"
                    title="Send Arrow Up"
                    onClick={() => {
                        instance.terminal?.sendInput("\u001b[A");
                        instance.focus();
                    }}
                >
                    <ArrowUp size={16} />
                </Button>

                <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    aria-label="Send Arrow Down"
                    title="Send Arrow Down"
                    onClick={() => {
                        instance.terminal?.sendInput("\u001b[B");
                        instance.focus();
                    }}
                >
                    <ArrowDown size={16} />
                </Button>

                <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    aria-label="Send Arrow Right"
                    title="Send Arrow Right"
                    onClick={() => {
                        instance.terminal?.sendInput("\u001b[C");
                        instance.focus();
                    }}
                >
                    <ArrowRight size={16} />
                </Button>
            </div>
        </div>
    );
});

export default KeyboardShortcuts;
