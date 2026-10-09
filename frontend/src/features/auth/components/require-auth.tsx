"use client";

import type { ReactNode } from "react";
import {
    useEffect,
    useSyncExternalStore,
} from "react";
import { useRouter } from "next/navigation";

import { getAuthSession } from "@/lib/auth-session";

type RequireAuthProps = {
    children: ReactNode;
};

const subscribe = () => () => {};

export function RequireAuth({
    children,
}: RequireAuthProps) {
    const router = useRouter();

    const hydrated =
        useSyncExternalStore(
            subscribe,
            () => true,
            () => false,
        );

    const authenticated =
        hydrated &&
        getAuthSession() !== null;

    useEffect(() => {
        if (
            hydrated &&
            !authenticated
        ) {
            router.replace(
                "/login",
            );
        }
    }, [
        authenticated,
        hydrated,
        router,
    ]);

    if (
        !hydrated ||
        !authenticated
    ) {
        return (
            <main className="flex min-h-dvh items-center justify-center bg-wkms-page">
                <p className="text-sm text-slate-500">
                    Loading...
                </p>
            </main>
        );
    }

    return children;
}
