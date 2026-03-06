import type { Application, Request, RequestHandler } from "express";

import multer from "multer";
import fs from "fs";
import path from "path";



type WallpaperDependencies = {
    app: Application;
    requireControl: RequestHandler;
    accessMode: "approval" | "auto";
};

const WALLPAPER_DIR = path.join(process.cwd(), "public", "wallpapers");
const MAX_FILE_SIZE = 25 * 1024 * 1024;

const ensureWallpaperDir = () => {
    if (!fs.existsSync(WALLPAPER_DIR)) {
        fs.mkdirSync(WALLPAPER_DIR, { recursive: true });
    }
};

const storage = multer.diskStorage({
    destination: (
        _req: Request,
        _file: Express.Multer.File,
        cb: (error: Error | null, destination: string) => void,
    ) => {
        ensureWallpaperDir();
        cb(null, WALLPAPER_DIR);
    },
    filename: (
        _req: Request,
        file: Express.Multer.File,
        cb: (error: Error | null, filename: string) => void,
    ) => {
        const safeName = path.basename(file.originalname || "wallpaper.png");
        cb(null, safeName);
    },
});

const upload = multer({
    storage,
    limits: {
        fileSize: MAX_FILE_SIZE,
    },
    fileFilter: (
        _req: Request,
        file: Express.Multer.File,
        cb: multer.FileFilterCallback,
    ) => {
        const allowed = ["image/png", "image/jpeg", "image/webp"];
        if (!allowed.includes(file.mimetype)) {
            cb(null, false);
            return;
        }
        cb(null, true);
    },
});

const registerWallpaperRoutes = ({
    app,
    requireControl,
    accessMode,
}: WallpaperDependencies) => {
    app.post("/api/wallpaper", requireControl, upload.single("file"), (req, res) => {
        if (accessMode === "auto") {
            res.status(403).json({
                error: "Wallpaper uploads are disabled in demo mode.",
            });
            return;
        }

        const file = (req as Request & { file?: Express.Multer.File }).file;
        if (!file) {
            res.status(400).json({ error: "Missing file." });
            return;
        }

        const url = `/wallpapers/${file.filename}`;
        res.json({ url });
    });
};

export type { WallpaperDependencies };
export { registerWallpaperRoutes };
