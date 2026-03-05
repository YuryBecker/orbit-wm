"use client";

import { useEffect } from "react";
import { Plus } from "lucide-react";
import { observer } from "mobx-react";
import { toast } from "sonner";
import { useAutoAnimate } from '@formkit/auto-animate/react';

import { windowManager } from "state";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";


const LayoutPagination = observer(() => {
    const [ parent ] = useAutoAnimate();

    const canCreateLayout = windowManager.layouts.length < 9;

    useEffect(() => {
        void windowManager.fetchLayouts();
    }, []);

    const openLayout = async (layoutSlot: number) => {
        const opened = await windowManager.openLayoutByIndex(layoutSlot);
        if (!opened) {
            toast.error(`Layout ${layoutSlot} is not available.`);
        }
    };

    const createLayout = async () => {
        if (!canCreateLayout) {
            toast.error("You can only have up to 9 layouts.");
            return;
        }

        const created = await windowManager.createLayout();
        if (!created) {
            toast.error("Failed to create layout.");
        }
    };

    return (
        <div className="pointer-events-none fixed bottom-4 left-1/2 z-[85] -translate-x-1/2">
            <div className="pointer-events-auto rounded-md border border-border/60 bg-background/90 px-0 py-0 shadow-lg backdrop-blur">
                <div
                    className="flex max-w-[90vw] items-center gap-1 overflow-x-hidden"
                    ref={ parent }
                >
                    {windowManager.layouts.map((layout) => (
                        <button
                            key={layout.id}
                            type="button"
                            className={cn(
                                buttonVariants({
                                    variant: layout.id === windowManager.layoutId ? "outline" : "ghost",
                                    size: "icon-sm",
                                }),
                                "shrink-0",
                            )}
                            onClick={() => {
                                void openLayout(layout.slot);
                            }}
                        >
                            {layout.slot}
                        </button>
                    ))}

                    <button
                        type="button"
                        disabled={!canCreateLayout}
                        aria-label="Create new layout"
                        className={cn(
                            buttonVariants({
                                variant: "ghost",
                                size: "icon-sm",
                            }),
                            "shrink-0",
                        )}
                        onClick={() => {
                            void createLayout();
                        }}
                    >
                        <Plus size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
});

export default LayoutPagination;
