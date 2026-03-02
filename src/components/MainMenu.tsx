"use client";

import { IconButton } from "@radix-ui/themes";
import { Check, ImageUp, Plus, Shield, SlidersHorizontal, Trash2, Users } from "lucide-react";
import { observer } from "mobx-react";
import { ChromePicker, type ColorResult } from "react-color";
import { toast } from "sonner";

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Slider } from "@/components/ui/slider";
import config from "state/config";
import { clients, windowManager } from "state";


const toRgbaString = (color: { r: number; g: number; b: number; a?: number }) => {
    if (typeof color.a === "number" && color.a < 1) {
        return `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`;
    }

    return `rgb(${color.r}, ${color.g}, ${color.b})`;
};

const MainMenu = observer(() => (
    <nav className="fixed top-5 right-5 z-50">
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <IconButton variant="soft" aria-label="Open options">
                    <SlidersHorizontal size={16} />
                </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="min-w-[220px]">
                <NewMenu />
                <LayoutsMenu />
                <DevicesMenu />
                <WallpaperMenu />
                <TerminalMenu />
                <LayoutStyleMenu />
                <DropdownMenuItem
                    onSelect={(event) => {
                        event.preventDefault();
                        config.toggleTitleBar();
                    }}
                >
                    {config.showTitleBar ? <Check size={14} /> : null}
                    Title Bars
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    </nav>
));

const WallpaperMenu = observer(() => (
    <DropdownMenuSub>
        <DropdownMenuSubTrigger>Wallpaper</DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
            {config.wallpapers.map((wallpaper) => (
                <DropdownMenuItem
                    key={wallpaper.id}
                    onSelect={() => config.setWallpaperById(wallpaper.id)}
                >
                    {wallpaper.id === config.wallpaper.value ? <Check size={14} /> : null}
                    {wallpaper.label}
                </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />

            <DropdownMenuItem
                onSelect={(event) => {
                    event.preventDefault();
                    config.selectWallpaperFile();
                }}
            >
                <ImageUp size={14} />
                Upload Wallpaper
            </DropdownMenuItem>
        </DropdownMenuSubContent>
    </DropdownMenuSub>
));

const NewMenu = observer(() => (
    <DropdownMenuSub>
        <DropdownMenuSubTrigger>New</DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
            <DropdownMenuItem
                onSelect={(event) => {
                    event.preventDefault();
                    windowManager.createTerminalWindow();
                }}
            >
                Terminal
            </DropdownMenuItem>
            <DropdownMenuItem
                onSelect={(event) => {
                    event.preventDefault();
                    windowManager.createBrowserWindow();
                }}
            >
                Browser
            </DropdownMenuItem>
        </DropdownMenuSubContent>
    </DropdownMenuSub>
));

const DevicesMenu = observer(() => (
    <DropdownMenuSub>
        <DropdownMenuSubTrigger>Devices</DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
            <DropdownMenuItem
                onSelect={(event) => {
                    event.preventDefault();
                    clients.setApprovalDialogOpen(true);
                }}
            >
                <Users size={14} />
                Manage Devices
            </DropdownMenuItem>
            <DropdownMenuItem
                onSelect={async (event) => {
                    event.preventDefault();
                    const payload = await clients.openPairingDialog("control");
                    if (!payload?.pairingUrl) {
                        toast.error("Failed to create pairing link.");
                    }
                }}
            >
                <Shield size={14} />
                Add Device
            </DropdownMenuItem>
        </DropdownMenuSubContent>
    </DropdownMenuSub>
));

const LayoutsMenu = observer(() => {
    const openLayout = async (layoutNumber: number) => {
        const opened = await windowManager.openLayoutByIndex(layoutNumber);
        if (!opened) {
            toast.error(`Layout ${layoutNumber} is not available.`);
        }
    };

    const createLayout = async () => {
        const created = await windowManager.createLayout();
        if (!created) {
            toast.error("Failed to create layout.");
            return;
        }

        toast.success("Created a new layout.");
    };

    const deleteLayout = async (layoutId: string, layoutNumber: number) => {
        const deleted = await windowManager.deleteLayout(layoutId);
        if (!deleted) {
            toast.error(`Failed to delete layout ${layoutNumber}.`);
            return;
        }

        toast.success(`Deleted layout ${layoutNumber}.`);
    };

    const activeLayoutNumber = windowManager.activeLayoutIndex;

    return (
        <DropdownMenuSub>
            <DropdownMenuSubTrigger>Layouts</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-[260px]">
                <DropdownMenuLabel>Layouts</DropdownMenuLabel>
                <DropdownMenuItem
                    onSelect={(event) => {
                        event.preventDefault();
                        void createLayout();
                    }}
                >
                    <Plus size={14} />
                    New Layout
                </DropdownMenuItem>
                <div className="px-2 pb-2 text-xs text-muted-foreground">
                    Use Meta/Ctrl + 1..9 to open or create numbered layouts.
                </div>
                <DropdownMenuSeparator />
                {windowManager.layouts.length === 0 ? (
                    <div className="px-2 py-2 text-xs text-muted-foreground">
                        No layouts available.
                    </div>
                ) : null}
                {windowManager.layouts.map((layout) => {
                    const layoutNumber = layout.slot;
                    const isActive = layout.id === windowManager.layoutId;

                    return (
                        <div
                            key={layout.id}
                            className="flex items-center gap-1"
                        >
                            <DropdownMenuItem
                                className="flex-1"
                                onSelect={(event) => {
                                    event.preventDefault();
                                    void openLayout(layoutNumber);
                                }}
                            >
                                {isActive ? <Check size={14} /> : null}
                                Layout {layoutNumber}
                                {layoutNumber <= 9 ? (
                                    <span className="ml-auto text-[10px] tracking-wider text-muted-foreground">
                                        {`META+${layoutNumber}`}
                                    </span>
                                ) : null}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                variant="destructive"
                                className="px-2"
                                disabled={windowManager.layouts.length <= 1}
                                onSelect={(event) => {
                                    event.preventDefault();
                                    void deleteLayout(layout.id, layoutNumber);
                                }}
                            >
                                <Trash2 size={14} />
                            </DropdownMenuItem>
                        </div>
                    );
                })}
                {activeLayoutNumber ? (
                    <div className="px-2 pt-2 text-xs text-muted-foreground">
                        Active: Layout {activeLayoutNumber}
                    </div>
                ) : null}
            </DropdownMenuSubContent>
        </DropdownMenuSub>
    );
});

const TerminalMenu = observer(() => (
    <DropdownMenuSub>
        <DropdownMenuSubTrigger>Terminal</DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
            <DropdownMenuGroup>
                <div className="px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Padding
                    </div>
                    <div className="mt-3">
                        <Slider
                            min={0}
                            max={64}
                            step={1}
                            value={[config.terminalPadding]}
                            onValueChange={(value) => {
                                const [next] = value;
                                if (typeof next === "number") {
                                    config.setTerminalPadding(next);
                                }
                            }}
                        />
                        <div className="mt-2 text-xs text-muted-foreground">
                            {config.terminalPadding}px
                        </div>
                    </div>
                </div>
            </DropdownMenuGroup>

            <DropdownMenuGroup>
                <div className="px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Opacity
                    </div>
                    <div className="mt-3">
                        <Slider
                            min={0}
                            max={100}
                            step={1}
                            value={[config.terminalOpacity * 100]}
                            onValueChange={(value) => {
                                const [next] = value;
                                if (typeof next === "number") {
                                    config.setTerminalOpacity(next / 100);
                                }
                            }}
                        />
                        <div className="mt-2 text-xs text-muted-foreground">
                            {Math.round(config.terminalOpacity * 100)}%
                        </div>
                    </div>
                </div>
            </DropdownMenuGroup>

            <DropdownMenuSub>
                <DropdownMenuSubTrigger>Terminal Color</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                    <DropdownMenuGroup>
                        <div className="px-4 py-3">
                            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                                Terminal Color
                            </div>
                            <div className="mt-3">
                                <ChromePicker
                                    color={config.terminalColor}
                                    onChange={(color: ColorResult) => {
                                        config.setTerminalColor(toRgbaString(color.rgb));
                                    }}
                                />
                            </div>
                        </div>
                    </DropdownMenuGroup>
                </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSub>
                <DropdownMenuSubTrigger>Font</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                    <DropdownMenuGroup>
                        <div className="px-4 py-3">
                            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                                Font Size
                            </div>
                            <div className="mt-3">
                                <Slider
                                    min={10}
                                    max={22}
                                    step={1}
                                    value={[config.terminalFontSize]}
                                    onValueChange={(value) => {
                                        const [next] = value;
                                        if (typeof next === "number") {
                                            config.setTerminalFontSize(next);
                                        }
                                    }}
                                />
                                <div className="mt-2 text-xs text-muted-foreground">
                                    {config.terminalFontSize}px
                                </div>
                            </div>
                        </div>
                    </DropdownMenuGroup>

                    {config.terminalFonts.map((font) => (
                        <DropdownMenuItem
                            key={font.id}
                            onSelect={() => config.setTerminalFontFamily(font.value)}
                        >
                            {config.terminalFontFamily === font.value ? <Check size={14} /> : null}
                            {font.label}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuSubContent>
            </DropdownMenuSub>
        </DropdownMenuSubContent>
    </DropdownMenuSub>
));

const LayoutStyleMenu = observer(() => (
    <DropdownMenuSub>
        <DropdownMenuSubTrigger>Layout Style</DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
            <DropdownMenuGroup>
                <div className="px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Gap
                    </div>
                    <div className="mt-3">
                        <Slider
                            min={0}
                            max={96}
                            step={1}
                            value={[config.gap]}
                            onValueChange={(value) => {
                                const [next] = value;
                                if (typeof next === "number") {
                                    config.setGap(next);
                                }
                            }}
                        />
                        <div className="mt-2 text-xs text-muted-foreground">
                            {config.gap}px
                        </div>
                    </div>
                </div>
            </DropdownMenuGroup>

            <DropdownMenuGroup>
                <div className="px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Border Width
                    </div>
                    <div className="mt-3">
                        <Slider
                            min={0}
                            max={12}
                            step={1}
                            value={[Number.parseInt(config.borderWidth, 10) || 0]}
                            onValueChange={(value) => {
                                const [next] = value;
                                if (typeof next === "number") {
                                    config.setBorderWidth(next);
                                }
                            }}
                        />
                        <div className="mt-2 text-xs text-muted-foreground">
                            {config.borderWidth}
                        </div>
                    </div>
                </div>
            </DropdownMenuGroup>

            <DropdownMenuGroup>
                <div className="px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Border Radius
                    </div>
                    <div className="mt-3">
                        <Slider
                            min={0}
                            max={32}
                            step={1}
                            value={[config.borderRadius]}
                            onValueChange={(value) => {
                                const [next] = value;
                                if (typeof next === "number") {
                                    config.setBorderRadius(next);
                                }
                            }}
                        />
                        <div className="mt-2 text-xs text-muted-foreground">
                            {config.borderRadius}px
                        </div>
                    </div>
                </div>
            </DropdownMenuGroup>

            <DropdownMenuSub>
                <DropdownMenuSubTrigger>Border Color</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                    <DropdownMenuGroup>
                        <div className="px-4 py-3">
                            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                                Border Color
                            </div>
                            <div className="mt-3">
                                <ChromePicker
                                    color={config.borderColor}
                                    onChange={(color: ColorResult) => {
                                        config.setBorderColor(toRgbaString(color.rgb));
                                    }}
                                />
                            </div>
                        </div>
                    </DropdownMenuGroup>
                </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSub>
                <DropdownMenuSubTrigger>Active Border</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                    <DropdownMenuGroup>
                        <div className="px-4 py-3">
                            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                                Active Border
                            </div>
                            <div className="mt-3">
                                <ChromePicker
                                    color={config.activeBorderColor}
                                    onChange={(color: ColorResult) => {
                                        config.setActiveBorderColor(toRgbaString(color.rgb));
                                    }}
                                />
                            </div>
                        </div>
                    </DropdownMenuGroup>
                </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuGroup>
                <div className="px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Shadow Blur
                    </div>
                    <div className="mt-3">
                        <Slider
                            min={0}
                            max={80}
                            step={1}
                            value={[config.shadowBlur]}
                            onValueChange={(value) => {
                                const [next] = value;
                                if (typeof next === "number") {
                                    config.setShadowBlur(next);
                                }
                            }}
                        />
                        <div className="mt-2 text-xs text-muted-foreground">
                            {config.shadowBlur}px
                        </div>
                    </div>
                </div>
            </DropdownMenuGroup>

            <DropdownMenuGroup>
                <div className="px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Shadow Spread
                    </div>
                    <div className="mt-3">
                        <Slider
                            min={0}
                            max={40}
                            step={1}
                            value={[config.shadowAmount]}
                            onValueChange={(value) => {
                                const [next] = value;
                                if (typeof next === "number") {
                                    config.setShadowAmount(next);
                                }
                            }}
                        />
                        <div className="mt-2 text-xs text-muted-foreground">
                            {config.shadowAmount}px
                        </div>
                    </div>
                </div>
            </DropdownMenuGroup>
        </DropdownMenuSubContent>
    </DropdownMenuSub>
));

export default MainMenu;
