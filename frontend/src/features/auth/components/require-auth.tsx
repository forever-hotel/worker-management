"use client";
import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { staffRequest, sessionResponse } from "../api/auth.api";
import { saveAuthSession, clearAuthSession } from "@/lib/auth-session";

export function RequireAuth({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    const expired = () => {
      setReady(false);
      router.replace("/login");
    };
    window.addEventListener("wms:unauthenticated", expired);
    let expiry: ReturnType<typeof setTimeout> | undefined;
    void staffRequest("session")
      .then((session) => {
        if (!active) return;
        if (session.passwordChangeRequired) {
          router.replace("/change-password");
          return;
        }
        saveAuthSession(sessionResponse(session));
        setReady(true);
        expiry = setTimeout(
          expired,
          Math.max(0, session.expiresAt * 1000 - Date.now()),
        );
      })
      .catch((error) => {
        if (!active) return;
        if (error.status === 401 || error.status === 403) {
          clearAuthSession();
          router.replace("/login");
        } else setError(true);
      });
    return () => {
      active = false;
      clearTimeout(expiry);
      window.removeEventListener("wms:unauthenticated", expired);
    };
  }, [router]);
  if (!ready)
    return (
      <main className="flex min-h-dvh items-center justify-center bg-wkms-page">
        <p role="status">
          {error
            ? "Staff authentication is unavailable. Please retry."
            : "Checking staff session..."}
        </p>
      </main>
    );
  return children;
}
