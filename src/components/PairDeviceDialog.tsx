"use client";

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


const PairDeviceDialog = observer(() => (
    <Dialog open={clients.pairingDialogOpen} onOpenChange={clients.setPairingDialogOpen}>
        <DialogContent className="max-w-lg bg-zinc-950 border-zinc-800 text-zinc-100">
            <DialogHeader>
                <DialogTitle>Add Device</DialogTitle>
                <DialogDescription>
                    Scan this QR code on your phone/tablet, or copy the link manually.
                </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
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
                        onClick={async () => {
                            const payload = await clients.createPairing("readonly");
                            if (payload?.pairingUrl) {
                                toast.success("Readonly link generated.");
                            }
                        }}
                    >
                        Readonly
                    </Button>
                    <Button
                        onClick={async () => {
                            const payload = await clients.createPairing("control");
                            if (payload?.pairingUrl) {
                                toast.success("Control link generated.");
                            }
                        }}
                    >
                        Control
                    </Button>
                </div>
            </div>
        </DialogContent>
    </Dialog>
));

export default PairDeviceDialog;
