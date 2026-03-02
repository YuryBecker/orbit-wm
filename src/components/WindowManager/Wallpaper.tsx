"use client";

import { observer } from "mobx-react";

import config from "state/config";


const Wallpaper = observer(() => {
    const wallpaperStyle = config.wallpaperStyle;

    return (
        <div
            className="absolute inset-0"
            style={{
                ...(config.wallpaper.type === "builtin"
                    ? { background: wallpaperStyle }
                    : {
                        backgroundImage: wallpaperStyle,
                        backgroundSize: "cover",
                    }),
                pointerEvents: "none",
            }}
        />
    );
});

export default Wallpaper;
