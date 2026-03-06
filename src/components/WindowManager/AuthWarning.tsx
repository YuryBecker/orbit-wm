"use client";

import { observer } from "mobx-react";

import { clients } from "state";


const AuthWarning = observer(() => {
    if (!clients.ready || clients.hasAccess || !clients.needsApproval) return null;

    return (
        <div className="absolute inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-6 text-zinc-100 max-w-md w-[92%]">
                <h2 className="text-lg font-semibold">
                    Waiting for approval
                </h2>

                <p className="mt-2 text-sm text-zinc-400">
                    This device is not authorized yet. A request was sent to the host machine.
                </p>

                { clients.pendingRequestId ? (
                    <p className="mt-3 text-xs text-zinc-500">
                        Request ID: {clients.pendingRequestId}
                    </p>
                ) : null }
            </div>
        </div>
    );
});

export default AuthWarning;
