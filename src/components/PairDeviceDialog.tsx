"use client";

import { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";

import { clients } from "state";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";


const PairDeviceDialog = observer(() => {
    const [allowControl, setAllowControl] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    useEffect(() => {
        if (!clients.pairingDialogOpen) {
            return;
        }

        setAllowControl(clients.pairing?.scope !== "readonly");
    }, [clients.pairingDialogOpen, clients.pairing?.scope]);

    const refreshPairing = async (scope: "readonly" | "control", silent = false) => {
        setIsRefreshing(true);
        try {
            const payload = await clients.createPairing(scope);
            if (!payload?.pairingUrl) {
                toast.error("Failed to generate pairing link.");
                return;
            }

            if (!silent) {
                toast.success(
                    scope === "control"
                        ? "Control link generated."
                        : "Readonly link generated.",
                );
            }
        } finally {
            setIsRefreshing(false);
        }
    };

    return (
        <Dialog open={clients.pairingDialogOpen} onOpenChange={clients.setPairingDialogOpen}>
            <DialogContent className="max-w-lg bg-zinc-950 border-zinc-800 text-zinc-100">
                <DialogHeader>
                    <DialogTitle>Add Device</DialogTitle>
                    <DialogDescription>
                        Scan this QR code on your phone/tablet, or copy the link manually.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="rounded-md border border-zinc-800 bg-zinc-900/40 p-3">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <div className="text-sm font-medium text-zinc-100">
                                    Control Access
                                </div>
                                <div className="mt-1 text-xs text-zinc-400">
                                    On: full control (type, open/close windows, change settings). Off: view-only.
                                </div>
                            </div>
                            <Switch
                                checked={allowControl}
                                onCheckedChange={(checked) => {
                                    const next = !!checked;
                                    setAllowControl(next);
                                    void refreshPairing(next ? "control" : "readonly");
                                }}
                            />
                        </div>
                    </div>

                    {clients.pairing?.pairingUrl ? (
                        <>
                            <div className="rounded border border-zinc-800 bg-white p-3 w-fit mx-auto">
                                <QRCodeSVG value={clients.pairing.pairingUrl} size={220} />
                            </div>
                            <div className="text-xs text-zinc-400 break-all">
                                {clients.pairing.pairingUrl}
                            </div>
                        </>
                    ) : (
                        <div className="text-sm text-zinc-400">
                            Creating pairing link...
                        </div>
                    )}

                    <div className="flex items-center justify-end gap-2">
                        <Button
                            variant="outline"
                            onClick={async () => {
                                const copied = await clients.copyPairingUrl();
                                if (copied) {
                                    toast.success("Pairing link copied.");
                                }
                            }}
                        >
                            Copy Link
                        </Button>
                        <Button
                            variant="secondary"
                            disabled={isRefreshing}
                            onClick={() => {
                                void refreshPairing(allowControl ? "control" : "readonly", true);
                            }}
                        >
                            {isRefreshing ? "Generating..." : "Regenerate Link"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
});

export default PairDeviceDialog;
