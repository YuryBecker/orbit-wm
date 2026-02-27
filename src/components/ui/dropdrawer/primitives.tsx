"use client";

import * as React from "react";

import { DrawerClose, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import {
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import { SubmenuContext, useDropDrawerContext } from "./shared";

type DropDrawerItemProps = React.ComponentProps<typeof DropdownMenuItem> & {
    icon?: React.ReactNode;
};

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

function DropDrawerItem({
    children,
    onSelect,
    onClick,
    icon,
    variant = "default",
    inset,
    disabled,
    className,
    ...props
}: DropDrawerItemProps) {
    const { isMobile } = useDropDrawerContext();
    const { activeSubmenu } = React.useContext(SubmenuContext);
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
            if (disabled) {
                return;
            }

            if (onClick) {
                onClick(event as unknown as React.MouseEvent<HTMLDivElement>);
            }

            if (onSelect) {
                onSelect(event as unknown as Event);
            }
        };

        const content = (
            <div
                ref={itemRef}
                data-slot="drop-drawer-item"
                data-variant={variant}
                data-inset={inset}
                data-disabled={disabled}
                className={cn(
                    "flex cursor-pointer items-center justify-between px-4 py-4",
                    !isInsideGroup && "bg-accent mx-2 my-1.5 rounded-md",
                    isInsideGroup && "bg-transparent py-4",
                    variant === "destructive" && "text-destructive",
                    disabled && "pointer-events-none opacity-50",
                    inset && "pl-8",
                    className,
                )}
                onClick={handleClick}
                {...props}
            >
                <div className="flex items-center gap-2">{children}</div>
                {icon ? <div>{icon}</div> : null}
            </div>
        );

        if (activeSubmenu) {
            return content;
        }

        return <DrawerClose asChild>{content}</DrawerClose>;
    }

    return (
        <DropdownMenuItem
            data-slot="drop-drawer-item"
            data-variant={variant}
            data-inset={inset}
            className={className}
            onSelect={onSelect}
            onClick={onClick as React.MouseEventHandler<HTMLDivElement>}
            variant={variant}
            inset={inset}
            disabled={disabled}
            {...props}
        >
            <div className="flex w-full items-center justify-between">
                <div>{children}</div>
                {icon ? <div>{icon}</div> : null}
            </div>
        </DropdownMenuItem>
    );
}

function DropDrawerSeparator({
    className,
    ...props
}: React.ComponentProps<typeof DropdownMenuSeparator>) {
    const { isMobile } = useDropDrawerContext();

    if (isMobile) {
        return null;
    }

    return (
        <DropdownMenuSeparator
            data-slot="drop-drawer-separator"
            className={className}
            {...props}
        />
    );
}

function DropDrawerLabel({
    className,
    children,
    ...props
}: React.ComponentProps<typeof DropdownMenuLabel> | React.ComponentProps<typeof DrawerTitle>) {
    const { isMobile } = useDropDrawerContext();

    if (isMobile) {
        return (
            <DrawerHeader className="p-0">
                <DrawerTitle
                    data-slot="drop-drawer-label"
                    className={cn("text-muted-foreground px-4 py-2 text-sm", className)}
                    {...props}
                >
                    {children}
                </DrawerTitle>
            </DrawerHeader>
        );
    }

    return (
        <DropdownMenuLabel
            data-slot="drop-drawer-label"
            className={className}
            {...props}
        >
            {children}
        </DropdownMenuLabel>
    );
}

function DropDrawerFooter({
    className,
    children,
    ...props
}: React.ComponentProps<typeof DrawerFooter> | React.ComponentProps<"div">) {
    const { isMobile } = useDropDrawerContext();

    if (isMobile) {
        return (
            <DrawerFooter
                data-slot="drop-drawer-footer"
                className={cn("p-4", className)}
                {...props}
            >
                {children}
            </DrawerFooter>
        );
    }

    return (
        <div
            data-slot="drop-drawer-footer"
            className={cn("p-2", className)}
            {...props}
        >
            {children}
        </div>
    );
}

function DropDrawerGroup({
    className,
    children,
    ...props
}: React.ComponentProps<"div"> & {
    children: React.ReactNode;
}) {
    const { isMobile } = useDropDrawerContext();

    const childrenWithSeparators = React.useMemo(() => {
        if (!isMobile) {
            return children;
        }

        const childArray = React.Children.toArray(children);
        const filtered = childArray.filter(
            (child) =>
                !(React.isValidElement(child) && child.type === DropDrawerSeparator),
        );

        return filtered.flatMap((child, index) => {
            if (index === filtered.length - 1) {
                return [child];
            }

            return [
                child,
                <div
                    key={`separator-${index}`}
                    className="bg-border h-px"
                    aria-hidden="true"
                />,
            ];
        });
    }, [children, isMobile]);

    if (isMobile) {
        return (
            <div
                data-drop-drawer-group
                data-slot="drop-drawer-group"
                role="group"
                className={cn(
                    "bg-accent mx-2 my-3 overflow-hidden rounded-xl",
                    className,
                )}
                {...props}
            >
                {childrenWithSeparators}
            </div>
        );
    }

    return (
        <div
            data-drop-drawer-group
            data-slot="drop-drawer-group"
            role="group"
            className={className}
            {...props}
        >
            {children}
        </div>
    );
}

export {
    DropDrawerFooter,
    DropDrawerGroup,
    DropDrawerItem,
    DropDrawerLabel,
    DropDrawerSeparator,
};
