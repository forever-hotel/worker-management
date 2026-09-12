import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "Forever City Hotel | Worker Management",
    description: "Worker Management System for Forever City Hotel",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
    return (
        <html lang="en">
        <body className={geistSans.className}>{children}</body>
        </html>
    );
}