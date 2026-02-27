"use client";

import * as React from "react";

import { useIsMobile } from "@/hooks/use-mobile";

export interface DropDrawerContextValue {
    isMobile: boolean;
}

export interface SubmenuContextValue {
    activeSubmenu: string | null;
    setActiveSubmenu: (id: string | null) => void;
    submenuTitle: string | null;
    setSubmenuTitle: (title: string | null) => void;
    navigateToSubmenu?: (id: string, title: string) => void;
}

const DropDrawerContext = React.createContext<DropDrawerContextValue | undefined>(
    undefined,
);

export const SubmenuContext = React.createContext<SubmenuContextValue>({
    activeSubmenu: null,
    setActiveSubmenu: () => undefined,
    submenuTitle: null,
    setSubmenuTitle: () => undefined,
    navigateToSubmenu: undefined,
});

export function DropDrawerProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const isMobile = useIsMobile();

    return (
        <DropDrawerContext.Provider value={{ isMobile }}>
            {children}
        </DropDrawerContext.Provider>
    );
}

export function useDropDrawerContext() {
    const context = React.useContext(DropDrawerContext);

    if (!context) {
        throw new Error(
            "DropDrawer components cannot be rendered outside the DropDrawer Context",
        );
    }

    return context;
}
