"use client";

import { LoaderCircle, Rocket } from "lucide-react";


type BootOverlayProps = {
    message: string;
};

const BootOverlay = ({ message }: BootOverlayProps) => {
    return (
        <div className="absolute inset-0 z-[70]  flex items-center justify-center  bg-black/70 backdrop-blur-sm">
            <div className="w-[92%] max-w-md rounded-xl border border-zinc-800  bg-zinc-950/90 p-6 text-zinc-100">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-900">
                        <Rocket size={18} />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold">Booting Orbit Sandbox</h2>
                        <p className="text-sm text-zinc-400">{message}</p>
                    </div>
                </div>

                <div className="mt-5 flex items-center gap-2 text-sm text-zinc-300">
                    <LoaderCircle className="animate-spin" size={16} />
                    Preparing your terminal runtime...
                </div>
            </div>
        </div>
    );
};

export default BootOverlay;
