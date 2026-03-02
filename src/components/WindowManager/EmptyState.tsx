"use client";

import { Layers, Plus, TerminalSquare } from "lucide-react";
import { observer } from "mobx-react";

import config from "state/config";
import windowManager from "state/window-manager";
import { Button } from "@/components/ui/button";
import {
    EmptyState as EmptyStateCard,
    EmptyStateDescription,
    EmptyStateFooter,
    EmptyStateHeader,
    EmptyStateIcon,
    EmptyStateTitle,
} from "@/components/ui/empty-state";


const EmptyState = observer(() => {
    const showEmptyState = windowManager.ready && windowManager.all.length === 0;
    const layoutSlot = windowManager.activeLayoutIndex;

    if (!showEmptyState) return null;

    return (
        <div className="absolute inset-0 flex items-center justify-center">
            <EmptyStateCard className="mx-4">
                <EmptyStateHeader>
                    <EmptyStateIcon>
                        <Layers size={18} />
                    </EmptyStateIcon>
                    <div>
                        <EmptyStateTitle>
                            {layoutSlot
                                ? `Layout ${layoutSlot} is empty`
                                : "This layout is empty"}
                        </EmptyStateTitle>
                        <EmptyStateDescription>
                            Add a window to start working. If you switch away while this layout is empty, it is removed automatically.
                        </EmptyStateDescription>
                    </div>
                </EmptyStateHeader>
                <EmptyStateFooter>
                    <Button
                        onClick={() => {
                            void windowManager.createTerminalWindow();
                        }}
                    >
                        <TerminalSquare size={14} />
                        New Terminal
                    </Button>
                    <Button
                        variant="secondary"
                        onClick={() => {
                            void windowManager.createBrowserWindow();
                        }}
                    >
                        <Plus size={14} />
                        New Browser
                    </Button>
                    <div className="ml-auto text-xs text-muted-foreground">
                        {config.modKeyLabel}+Enter
                    </div>
                </EmptyStateFooter>
            </EmptyStateCard>
        </div>

    );
});

export default EmptyState;
