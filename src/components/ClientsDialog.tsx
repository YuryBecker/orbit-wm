"use client";

import { observer } from "mobx-react";
import { Check, ShieldBan, ShieldOff } from "lucide-react";
import { toast } from "sonner";

import { clients } from "state";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";


const clip = (value: string | null) => {
    if (!value) {
        return "Unknown";
    }

    return value.length > 28 ? `${value.slice(0, 28)}...` : value;
};

const ClientsDialog = observer(() => (
    <Dialog open={clients.approvalDialogOpen} onOpenChange={clients.setApprovalDialogOpen}>
        <DialogContent className="max-w-4xl bg-zinc-950 border-zinc-800 text-zinc-100">
            <DialogHeader>
                <DialogTitle>Devices</DialogTitle>
                <DialogDescription>
                    Review join requests, manage users, and revoke device access.
                </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-1">
                <section className="space-y-2">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold">Pending Requests</h3>
                        <Badge variant="outline">{clients.pendingRequests.length}</Badge>
                    </div>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Device</TableHead>
                                <TableHead>Agent</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {clients.pendingRequests.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-zinc-500">
                                        No pending requests.
                                    </TableCell>
                                </TableRow>
                            ) : clients.pendingRequests.map((request) => (
                                <TableRow key={request.id}>
                                    <TableCell>{request.ip || request.label}</TableCell>
                                    <TableCell className="text-zinc-400">{clip(request.userAgent)}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline">Pending</Badge>
                                    </TableCell>
                                    <TableCell className="space-x-2">
                                        <Button
                                            size="xs"
                                            onClick={async () => {
                                                await request.allow("control");
                                                toast.success("Device approved.");
                                            }}
                                        >
                                            Allow
                                        </Button>
                                        <Button
                                            size="xs"
                                            variant="secondary"
                                            onClick={async () => {
                                                await request.allow("readonly");
                                                toast.success("Readonly access approved.");
                                            }}
                                        >
                                            Readonly
                                        </Button>
                                        <Button
                                            size="xs"
                                            variant="destructive"
                                            onClick={async () => {
                                                await request.disallow();
                                                toast.success("Device denied.");
                                            }}
                                        >
                                            Deny
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </section>

                <section className="space-y-2">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold">Users</h3>
                        <Badge variant="outline">{clients.users.length}</Badge>
                    </div>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Label</TableHead>
                                <TableHead>IP</TableHead>
                                <TableHead>Readonly</TableHead>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {clients.users.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-zinc-500">
                                        No approved users yet.
                                    </TableCell>
                                </TableRow>
                            ) : clients.users.map((user) => (
                                <TableRow key={user.id}>
                                    <TableCell>{user.label}</TableCell>
                                    <TableCell>{user.ip || "Unknown"}</TableCell>
                                    <TableCell>
                                        <Switch
                                            checked={user.isReadonly}
                                            onCheckedChange={(checked) => {
                                                void user.setReadonly(checked);
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Button
                                            size="xs"
                                            variant="outline"
                                            onClick={async () => {
                                                await user.revokeTokens();
                                                toast.success("Tokens revoked.");
                                            }}
                                        >
                                            Revoke Tokens
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </section>

                <section className="space-y-2">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold">Request History</h3>
                        <Badge variant="outline">{clients.requestHistory.length}</Badge>
                    </div>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Device</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Created</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {clients.requestHistory.slice(0, 30).map((request) => (
                                <TableRow key={request.id}>
                                    <TableCell>{request.ip || request.label}</TableCell>
                                    <TableCell>
                                        {request.status === "approved" ? (
                                            <Badge className="bg-emerald-700"><Check size={12} />Approved</Badge>
                                        ) : request.status === "denied" ? (
                                            <Badge className="bg-red-700"><ShieldBan size={12} />Denied</Badge>
                                        ) : (
                                            <Badge variant="outline"><ShieldOff size={12} />Pending</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell>{request.createdAt || "-"}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </section>
            </div>
        </DialogContent>
    </Dialog>
));

export default ClientsDialog;
