"use client";

import { IconButton } from "@radix-ui/themes";
import { Check, ImageUp, SlidersHorizontal } from "lucide-react";
import { observer } from "mobx-react";
import { ChromePicker, type ColorResult } from "react-color";

import {
    DropDrawer,
    DropDrawerContent,
    DropDrawerGroup,
    DropDrawerItem,
    DropDrawerLabel,
    DropDrawerSeparator,
    DropDrawerSub,
    DropDrawerSubContent,
    DropDrawerSubTrigger,
    DropDrawerTrigger,
} from "@/components/ui/dropdrawer";
import { Slider } from "@/components/ui/slider";
import config from "state/config";
import { windowManager } from "state";



const toRgbaString = (color: { r: number; g: number; b: number; a?: number }) => {
    if (typeof color.a === "number" && color.a < 1) {
        return `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`;
    }

    return `rgb(${color.r}, ${color.g}, ${color.b})`;
};

const MainMenu = observer(() => (
    <DropDrawer>
        <DropDrawerTrigger asChild>
            <IconButton variant="soft" aria-label="Open options">
                <SlidersHorizontal size={16} />
            </IconButton>
        </DropDrawerTrigger>
        <DropDrawerContent className="min-w-[220px]">
            <DropDrawerLabel>Options</DropDrawerLabel>
            <DropDrawerSeparator />
            <NewMenu />
            <WallpaperMenu />
            <TerminalMenu />
            <LayoutMenu />
            <DropDrawerItem
                icon={config.showTitleBar ? <Check size={14} /> : null}
                onSelect={(event) => {
                    event.preventDefault();
                    config.toggleTitleBar();
                }}
            >
                Title Bars
            </DropDrawerItem>
        </DropDrawerContent>
    </DropDrawer>
));

const WallpaperMenu = observer(() => (
    <DropDrawerSub>
        <DropDrawerSubTrigger>Wallpaper</DropDrawerSubTrigger>
        <DropDrawerSubContent>
            {config.wallpapers.map((wallpaper) => (
                <DropDrawerItem
                    key={wallpaper.id}
                    icon={
                        wallpaper.id === config.wallpaper.value ? (
                            <Check size={14} />
                        ) : null
                    }
                    onSelect={() => config.setWallpaperById(wallpaper.id)}
                >
                    {wallpaper.label}
                </DropDrawerItem>
            ))}
            <DropDrawerSeparator />

            <DropDrawerItem
                icon={<ImageUp size={14} />}
                onSelect={(event) => {
                    event.preventDefault();
                    config.selectWallpaperFile();
                }}
            >
                Upload Wallpaper
            </DropDrawerItem>
        </DropDrawerSubContent>
    </DropDrawerSub>
));

const NewMenu = observer(() => (
    <DropDrawerSub>
        <DropDrawerSubTrigger>New</DropDrawerSubTrigger>
        <DropDrawerSubContent>
            <DropDrawerItem
                onSelect={(event) => {
                    event.preventDefault();
                    windowManager.createWindowWithSession();
                }}
            >
                Terminal
            </DropDrawerItem>
            <DropDrawerItem
                onSelect={(event) => {
                    event.preventDefault();
                    windowManager.createBrowserWindow();
                }}
            >
                Browser
            </DropDrawerItem>
        </DropDrawerSubContent>
    </DropDrawerSub>
));

const TerminalMenu = observer(() => (
    <DropDrawerSub>
        <DropDrawerSubTrigger>Terminal</DropDrawerSubTrigger>
        <DropDrawerSubContent>
            <DropDrawerGroup>
                <div className="px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.2em] text-white/60">
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
                        <div className="mt-2 text-xs text-white/50">
                            {config.terminalPadding}px
                        </div>
                    </div>
                </div>
            </DropDrawerGroup>

            <DropDrawerGroup>
                <div className="px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.2em] text-white/60">
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
                        <div className="mt-2 text-xs text-white/50">
                            {Math.round(config.terminalOpacity * 100)}%
                        </div>
                    </div>
                </div>
            </DropDrawerGroup>

            <DropDrawerSub>
                <DropDrawerSubTrigger>Terminal Color</DropDrawerSubTrigger>
                <DropDrawerSubContent>
                    <DropDrawerGroup>
                        <div className="px-4 py-3">
                            <div className="text-xs uppercase tracking-[0.2em] text-white/60">
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
                    </DropDrawerGroup>
                </DropDrawerSubContent>
            </DropDrawerSub>

            <DropDrawerSub>
                <DropDrawerSubTrigger>Font</DropDrawerSubTrigger>
                <DropDrawerSubContent>
                    <DropDrawerGroup>
                        <div className="px-4 py-3">
                            <div className="text-xs uppercase tracking-[0.2em] text-white/60">
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
                                <div className="mt-2 text-xs text-white/50">
                                    {config.terminalFontSize}px
                                </div>
                            </div>
                        </div>
                    </DropDrawerGroup>

                    {config.terminalFonts.map((font) => (
                        <DropDrawerItem
                            key={font.id}
                            icon={
                                config.terminalFontFamily === font.value ? (
                                    <Check size={14} />
                                ) : null
                            }
                            onSelect={() => config.setTerminalFontFamily(font.value)}
                        >
                            {font.label}
                        </DropDrawerItem>
                    ))}
                </DropDrawerSubContent>
            </DropDrawerSub>
        </DropDrawerSubContent>
    </DropDrawerSub>
));

const LayoutMenu = observer(() => (
    <DropDrawerSub>
        <DropDrawerSubTrigger>Layout</DropDrawerSubTrigger>
        <DropDrawerSubContent>
            <DropDrawerGroup>
                <div className="px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.2em] text-white/60">
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
                        <div className="mt-2 text-xs text-white/50">
                            {config.gap}px
                        </div>
                    </div>
                </div>
            </DropDrawerGroup>

            <DropDrawerGroup>
                <div className="px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.2em] text-white/60">
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
                        <div className="mt-2 text-xs text-white/50">
                            {config.borderWidth}
                        </div>
                    </div>
                </div>
            </DropDrawerGroup>

            <DropDrawerGroup>
                <div className="px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.2em] text-white/60">
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
                        <div className="mt-2 text-xs text-white/50">
                            {config.borderRadius}px
                        </div>
                    </div>
                </div>
            </DropDrawerGroup>

            <DropDrawerSub>
                <DropDrawerSubTrigger>Border Color</DropDrawerSubTrigger>
                <DropDrawerSubContent>
                    <DropDrawerGroup>
                        <div className="px-4 py-3">
                            <div className="text-xs uppercase tracking-[0.2em] text-white/60">
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
                    </DropDrawerGroup>
                </DropDrawerSubContent>
            </DropDrawerSub>

            <DropDrawerSub>
                <DropDrawerSubTrigger>Active Border</DropDrawerSubTrigger>
                <DropDrawerSubContent>
                    <DropDrawerGroup>
                        <div className="px-4 py-3">
                            <div className="text-xs uppercase tracking-[0.2em] text-white/60">
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
                    </DropDrawerGroup>
                </DropDrawerSubContent>
            </DropDrawerSub>

            <DropDrawerGroup>
                <div className="px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.2em] text-white/60">
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
                        <div className="mt-2 text-xs text-white/50">
                            {config.shadowBlur}px
                        </div>
                    </div>
                </div>
            </DropDrawerGroup>

            <DropDrawerGroup>
                <div className="px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.2em] text-white/60">
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
                        <div className="mt-2 text-xs text-white/50">
                            {config.shadowAmount}px
                        </div>
                    </div>
                </div>
            </DropDrawerGroup>
        </DropDrawerSubContent>
    </DropDrawerSub>
));

export default MainMenu;
