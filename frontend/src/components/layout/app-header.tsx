"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { clearAuthSession, getAuthSession } from "@/lib/auth-session";

type AppHeaderProps = {
  title: string;
};

export function AppHeader({ title }: AppHeaderProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    clearAuthSession();
    setMenuOpen(false);
    router.replace("/login");
    router.refresh();
  };

  const workerName = getAuthSession()?.worker.full_name ?? "Worker";

  return (
    <header className="flex h-14 items-center justify-between bg-wkms-navy px-4 text-white">
      <h1 className="text-base font-semibold">{title}</h1>

      <div className="flex items-center gap-3">
        <div className="flex h-7 items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 text-xs">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          <span>Online</span>
        </div>

        <div className="relative">
          <button
            type="button"
            aria-label="Worker profile"
            aria-expanded={menuOpen}
            aria-controls="worker-profile-menu"
            onClick={() => setMenuOpen((open) => !open)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/30 bg-slate-500 text-xs font-semibold cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wkms-gold"
          >
            W
          </button>

          {menuOpen && (
            <div
              id="worker-profile-menu"
              className="absolute right-0 top-full z-50 mt-2 w-48 rounded-lg border border-wkms-border bg-white p-2 text-wkms-navy shadow-lg"
            >
              <p className="truncate px-3 py-2 text-xs font-medium" title={workerName}>
                {workerName}
              </p>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full rounded-md px-3 py-2 text-left text-sm font-medium text-red-600 cursor-pointer hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-wkms-gold"
              >
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

