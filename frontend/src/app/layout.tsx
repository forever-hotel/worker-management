import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import {AppProviders} from "@/providers/app-providers";

const geistSans = Geist({
    subsets: ["latin"],
});


export const metadata: Metadata = {
    title: "Forever City Hotel | Worker Management",
    description: "Worker Management System for Forever City Hotel",
    applicationName: "Forever City Hotel WKMS",
    manifest: "/manifest.webmanifest",
    appleWebApp: {
        capable: true,
        statusBarStyle: "default",
        title: "WKMS",
    },
    icons: {
        icon: [
            {
                url: "/icons/wkms-192.png",
                sizes: "192x192",
                type: "image/png",
            },
            {
                url: "/icons/wkms-512.png",
                sizes: "512x512",
                type: "image/png",
            },
        ],
        apple: "/icons/wkms-192.png",
    },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
    return (
        <html lang="en">
        <body className={geistSans.className}>
        <AppProviders>{children}</AppProviders>
        </body>
        </html>
    );
}