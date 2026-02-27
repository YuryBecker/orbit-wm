"use client";

import * as React from "react";

import { Drawer, DrawerTrigger } from "@/components/ui/drawer";
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

import { DropDrawerProvider, useDropDrawerContext } from "./shared";

type DropDrawerRootProps =
    | React.ComponentProps<typeof Drawer>
    | React.ComponentProps<typeof DropdownMenu>;

type DropDrawerTriggerProps =
    | React.ComponentProps<typeof DrawerTrigger>
    | React.ComponentProps<typeof DropdownMenuTrigger>;

function DropDrawer({ children, ...props }: DropDrawerRootProps) {
    const RootComponent = DropDrawerRootInner;

    return (
        <DropDrawerProvider>
            <RootComponent {...props}>{children}</RootComponent>
        </DropDrawerProvider>
    );
}

function DropDrawerRootInner({
    children,
    ...props
}: DropDrawerRootProps) {
    const { isMobile } = useDropDrawerContext();
    const Component = isMobile ? Drawer : DropdownMenu;

    return (
        <Component data-slot="drop-drawer" {...(props as object)}>
            {children}
        </Component>
    );
}

function DropDrawerTrigger({ children, ...props }: DropDrawerTriggerProps) {
    const { isMobile } = useDropDrawerContext();
    const Component = isMobile ? DrawerTrigger : DropdownMenuTrigger;

    return (
        <Component data-slot="drop-drawer-trigger" {...(props as object)}>
            {children}
        </Component>
    );
}

export { DropDrawer, DropDrawerTrigger };
