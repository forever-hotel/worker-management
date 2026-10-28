"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    // Avoid interfering with Next.js development behavior.
    if (process.env.NODE_ENV !== "production") {
      return;
    }

    if (!("serviceWorker" in navigator)) {
      return;
    }

    void navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch(() => {
        // The application remains usable online even if
        // PWA registration is unavailable.
      });
  }, []);

  return null;
}
