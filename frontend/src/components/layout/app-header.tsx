type AppHeaderProps = {
    title: string;
};

export function AppHeader({ title }: AppHeaderProps) {
    return (
        <header className="flex h-14 items-center justify-between bg-wkms-navy px-4 text-white">
            <h1 className="text-base font-semibold">{title}</h1>

            <div className="flex items-center gap-3">
                <div className="flex h-7 items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 text-xs">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    <span>Online</span>
                </div>

                <div
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-white/30 bg-slate-500 text-xs font-semibold"
                    aria-label="Worker profile"
                >
                    W
                </div>
            </div>
        </header>
    );
}