"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import clients from "state/clients";


function PairPageContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [status, setStatus] = useState("Completing pairing...");

    useEffect(() => {
        const code = searchParams.get("code");
        if (!code) {
            setStatus("Missing pairing code.");
            return;
        }

        let cancelled = false;
        const run = async () => {
            const result = await clients.completePairing(code);
            if (cancelled) {
                return;
            }

            if (!result) {
                setStatus("Pairing failed. The code may be invalid or expired.");
                return;
            }

            setStatus("Paired. Redirecting...");
            router.replace("/");
        };

        void run();

        return () => {
            cancelled = true;
        };
    }, [router, searchParams]);

    return (
        <main className="min-h-svh flex items-center justify-center bg-zinc-950 text-zinc-100 px-6">
            <div className="max-w-md w-full rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
                <h1 className="text-lg font-semibold">Orbit Pairing</h1>
                <p className="mt-2 text-sm text-zinc-400">{status}</p>
            </div>
        </main>
    );
}

export default function PairPage() {
    return (
        <Suspense
            fallback={
                <main className="min-h-svh flex items-center justify-center bg-zinc-950 text-zinc-100 px-6">
                    <div className="max-w-md w-full rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
                        <h1 className="text-lg font-semibold">Orbit Pairing</h1>
                        <p className="mt-2 text-sm text-zinc-400">Completing pairing...</p>
                    </div>
                </main>
            }
        >
            <PairPageContent />
        </Suspense>
    );
}
