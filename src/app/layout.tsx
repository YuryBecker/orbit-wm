import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Theme } from "@radix-ui/themes";
import { Toaster } from "sonner";
import "@radix-ui/themes/styles.css";
import "./globals.css";

import { TooltipProvider } from "@/components/ui/tooltip";
import PwaRegister from "@/components/PwaRegister";
import DebugUI from "@/components/DebugUI";


const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "Orbit WM",
    description: "Orbit Window Manager",
    manifest: "/manifest.webmanifest",
    icons: {
        icon: "/window.svg",
        apple: "/window.svg",
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" className="dark">
            <body
                className={`${geistSans.variable} ${geistMono.variable} antialiased`}
            >
                <Theme appearance="dark" accentColor="gray" radius="large">
                    <TooltipProvider>
                        {children}
                        <DebugUI />
                        <PwaRegister />
                        <Toaster theme="dark" richColors closeButton />
                    </TooltipProvider>
                </Theme>
            </body>
        </html>
    );
}
