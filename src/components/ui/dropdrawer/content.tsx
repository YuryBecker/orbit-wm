"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeftIcon } from "lucide-react";
import * as React from "react";

import { DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { DropdownMenuContent } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import { DropDrawerSub, DropDrawerSubContent } from "./submenu";
import { SubmenuContext, useDropDrawerContext } from "./shared";

type DropDrawerContentProps =
    | React.ComponentProps<typeof DrawerContent>
    | React.ComponentProps<typeof DropdownMenuContent>;

type Direction = "forward" | "backward";

function decorateSubmenuIds(children: React.ReactNode) {
    let nextId = 0;

    const decorateNode = (node: React.ReactNode): React.ReactNode => {
        if (!React.isValidElement(node)) {
            return node;
        }

        const element = node as React.ReactElement<{
            children?: React.ReactNode;
            id?: string;
            "data-submenu-id"?: string;
        }>;

        const currentChildren = element.props.children;

        if (element.type === DropDrawerSub) {
            const existingId = element.props["data-submenu-id"] ?? element.props.id;
            const submenuId = existingId || `submenu-${nextId++}`;
            const decoratedChildren = React.Children.map(currentChildren, decorateNode);

            return React.cloneElement(
                element,
                {
                    "data-submenu-id": submenuId,
                },
                decoratedChildren,
            );
        }

        if (currentChildren) {
            return React.cloneElement(
                element,
                undefined,
                React.Children.map(currentChildren, decorateNode),
            );
        }

        return element;
    };

    return React.Children.map(children, decorateNode);
}

function extractSubmenuContent(
    elements: React.ReactNode,
    targetId: string,
): React.ReactNode[] {
    const result: React.ReactNode[] = [];

    const visit = (node: React.ReactNode) => {
        if (!React.isValidElement(node)) {
            return;
        }

        const element = node as React.ReactElement<{
            children?: React.ReactNode;
            "data-submenu-id"?: string;
        }>;
        const props = element.props;

        if (
            element.type === DropDrawerSub &&
            props["data-submenu-id"] === targetId
        ) {
            React.Children.forEach(props.children, (subChild) => {
                if (
                    React.isValidElement(subChild) &&
                    subChild.type === DropDrawerSubContent
                ) {
                    const subProps = subChild.props as {
                        children?: React.ReactNode;
                    };
                    React.Children.forEach(subProps.children, (contentChild) => {
                        result.push(contentChild);
                    });
                }
            });

            return;
        }

        React.Children.forEach(props.children, visit);
    };

    React.Children.forEach(elements, visit);

    return result;
}

function DropDrawerContent({
    className,
    children,
    ...props
}: DropDrawerContentProps) {
    const { isMobile } = useDropDrawerContext();
    const [activeSubmenu, setActiveSubmenu] = React.useState<string | null>(null);
    const [submenuTitle, setSubmenuTitle] = React.useState<string | null>(null);
    const [submenuStack, setSubmenuStack] = React.useState<
        Array<{ id: string; title: string }>
    >([]);
    const [animationDirection, setAnimationDirection] =
        React.useState<Direction>("forward");

    const decoratedChildren = React.useMemo(
        () => decorateSubmenuIds(children),
        [children],
    );

    const navigateToSubmenu = React.useCallback((id: string, title: string) => {
        setAnimationDirection("forward");
        setActiveSubmenu(id);
        setSubmenuTitle(title);
        setSubmenuStack((previous) => [...previous, { id, title }]);
    }, []);

    const goBack = React.useCallback(() => {
        setAnimationDirection("backward");

        setSubmenuStack((previous) => {
            if (previous.length <= 1) {
                setActiveSubmenu(null);
                setSubmenuTitle(null);

                return [];
            }

            const next = [...previous];
            next.pop();
            const current = next[next.length - 1];

            if (!current) {
                setActiveSubmenu(null);
                setSubmenuTitle(null);

                return [];
            }

            setActiveSubmenu(current.id);
            setSubmenuTitle(current.title);

            return next;
        });
    }, []);

    const getSubmenuContent = React.useCallback(
        (id: string) => extractSubmenuContent(decoratedChildren, id),
        [decoratedChildren],
    );

    const variants = {
        enter: (direction: Direction) => ({
            x: direction === "forward" ? "100%" : "-100%",
            opacity: 0,
        }),
        center: {
            x: 0,
            opacity: 1,
        },
        exit: (direction: Direction) => ({
            x: direction === "forward" ? "-100%" : "100%",
            opacity: 0,
        }),
    };

    const transition = {
        duration: 0.22,
        ease: [0.25, 0.1, 0.25, 1] as const,
    };

    if (isMobile) {
        return (
            <SubmenuContext.Provider
                value={{
                    activeSubmenu,
                    setActiveSubmenu,
                    submenuTitle,
                    setSubmenuTitle,
                    navigateToSubmenu,
                }}
            >
                <DrawerContent
                    data-slot="drop-drawer-content"
                    className={cn("max-h-[90vh]", className)}
                    {...(props as object)}
                >
                    {activeSubmenu ? (
                        <>
                            <div className="border-border flex items-center gap-2 border-b p-4">
                                <button
                                    onClick={goBack}
                                    className="hover:bg-muted/50 inline-flex h-8 w-8 items-center justify-center rounded-md"
                                    aria-label="Go back"
                                >
                                    <ChevronLeftIcon className="h-5 w-5" />
                                </button>
                                <DrawerTitle>{submenuTitle}</DrawerTitle>
                            </div>
                            <div className="relative max-h-[70vh] flex-1 overflow-y-auto">
                                <AnimatePresence
                                    initial={false}
                                    mode="wait"
                                    custom={animationDirection}
                                >
                                    <motion.div
                                        key={activeSubmenu}
                                        custom={animationDirection}
                                        variants={variants}
                                        initial="enter"
                                        animate="center"
                                        exit="exit"
                                        transition={transition}
                                        className="pb-4"
                                    >
                                        {getSubmenuContent(activeSubmenu)}
                                    </motion.div>
                                </AnimatePresence>
                            </div>
                        </>
                    ) : (
                        <>
                            <DrawerHeader className="sr-only">
                                <DrawerTitle>Menu</DrawerTitle>
                            </DrawerHeader>
                            <div className="max-h-[70vh] overflow-y-auto">
                                <AnimatePresence
                                    initial={false}
                                    mode="wait"
                                    custom={animationDirection}
                                >
                                    <motion.div
                                        key="main-menu"
                                        custom={animationDirection}
                                        variants={variants}
                                        initial="enter"
                                        animate="center"
                                        exit="exit"
                                        transition={transition}
                                        className="pb-4"
                                    >
                                        {decoratedChildren}
                                    </motion.div>
                                </AnimatePresence>
                            </div>
                        </>
                    )}
                </DrawerContent>
            </SubmenuContext.Provider>
        );
    }

    return (
        <SubmenuContext.Provider
            value={{
                activeSubmenu,
                setActiveSubmenu,
                submenuTitle,
                setSubmenuTitle,
            }}
        >
            <DropdownMenuContent
                data-slot="drop-drawer-content"
                align="end"
                sideOffset={4}
                className={cn(
                    "max-h-[var(--radix-dropdown-menu-content-available-height)]",
                    className,
                )}
                {...(props as object)}
            >
                {decoratedChildren}
            </DropdownMenuContent>
        </SubmenuContext.Provider>
    );
}

export { DropDrawerContent };
