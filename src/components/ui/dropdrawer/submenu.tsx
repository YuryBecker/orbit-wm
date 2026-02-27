"use client";

import { ChevronRightIcon } from "lucide-react";
import * as React from "react";

import {
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import { SubmenuContext, useDropDrawerContext } from "./shared";

type DropDrawerSubProps = React.ComponentProps<typeof DropdownMenuSub> & {
    id?: string;
    "data-submenu-id"?: string;
};

function DropDrawerSub({ children, ...props }: DropDrawerSubProps) {
    const { isMobile } = useDropDrawerContext();

    if (isMobile) {
        const submenuId =
            (props as Record<string, unknown>)["data-submenu-id"] || props.id;

        const processedChildren = React.Children.map(children, (child) => {
            if (!React.isValidElement(child)) {
                return child;
            }

            if (child.type === DropDrawerSubTrigger) {
                return React.cloneElement(child, {
                    "data-submenu-id": submenuId,
                } as React.HTMLAttributes<HTMLElement>);
            }

            return child;
        });

        return (
            <div data-submenu-id={submenuId} data-slot="drop-drawer-sub">
                {processedChildren}
            </div>
        );
    }

    return (
        <DropdownMenuSub data-slot="drop-drawer-sub" {...props}>
            {children}
        </DropdownMenuSub>
    );
}

function isInDropDrawerGroup(element: HTMLElement | null): boolean {
    if (!element) {
        return false;
    }

    let parent = element.parentElement;

    while (parent) {
        if (parent.hasAttribute("data-drop-drawer-group")) {
            return true;
        }

        parent = parent.parentElement;
    }

    return false;
}

function DropDrawerSubTrigger({
    className,
    inset,
    children,
    ...props
}: React.ComponentProps<typeof DropdownMenuSubTrigger>) {
    const { isMobile } = useDropDrawerContext();
    const { navigateToSubmenu } = React.useContext(SubmenuContext);
    const itemRef = React.useRef<HTMLDivElement>(null);
    const [isInsideGroup, setIsInsideGroup] = React.useState(false);

    React.useEffect(() => {
        if (!isMobile) {
            return;
        }

        const timer = setTimeout(() => {
            setIsInsideGroup(isInDropDrawerGroup(itemRef.current));
        }, 0);

        return () => clearTimeout(timer);
    }, [isMobile]);

    if (isMobile) {
        const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
            event.preventDefault();
            event.stopPropagation();

            const submenuId =
                ((props as Record<string, unknown>)["data-submenu-id"] as
                    | string
                    | undefined) ||
                event.currentTarget.getAttribute("data-submenu-id");

            if (!submenuId || !navigateToSubmenu) {
                return;
            }

            const title =
                typeof children === "string" || typeof children === "number"
                    ? String(children)
                    : "Submenu";

            navigateToSubmenu(submenuId, title);
        };

        const rawOnClick = (props as Record<string, unknown>).onClick;

        const onClick = (event: React.MouseEvent<HTMLDivElement>) => {
            if (typeof rawOnClick === "function") {
                (rawOnClick as React.MouseEventHandler<HTMLDivElement>)(event);
            }

            handleClick(event);
        };

        return (
            <div
                ref={itemRef}
                data-slot="drop-drawer-sub-trigger"
                data-submenu-id={(props as Record<string, unknown>)["data-submenu-id"]}
                data-inset={inset}
                className={cn(
                    "flex cursor-pointer items-center justify-between px-4 py-4",
                    !isInsideGroup && "bg-accent mx-2 my-1.5 rounded-md",
                    isInsideGroup && "bg-transparent py-4",
                    inset && "pl-8",
                    className,
                )}
                onClick={onClick}
            >
                <div className="flex items-center gap-2">{children}</div>
                <ChevronRightIcon className="h-5 w-5" />
            </div>
        );
    }

    return (
        <DropdownMenuSubTrigger
            data-slot="drop-drawer-sub-trigger"
            data-inset={inset}
            className={className}
            inset={inset}
            {...props}
        >
            {children}
        </DropdownMenuSubTrigger>
    );
}

function DropDrawerSubContent({
    className,
    sideOffset = 4,
    children,
    ...props
}: React.ComponentProps<typeof DropdownMenuSubContent>) {
    const { isMobile } = useDropDrawerContext();

    if (isMobile) {
        return null;
    }

    return (
        <DropdownMenuSubContent
            data-slot="drop-drawer-sub-content"
            sideOffset={sideOffset}
            className={cn(
                "max-h-[var(--radix-dropdown-menu-content-available-height)] overflow-y-auto",
                className,
            )}
            {...props}
        >
            {children}
        </DropdownMenuSubContent>
    );
}

export { DropDrawerSub, DropDrawerSubContent, DropDrawerSubTrigger };
