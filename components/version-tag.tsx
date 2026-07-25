import { formatVersionLabel } from '@/utils/version';

// Small, unobtrusive build identifier in the corner of every page — lets
// anyone confirm "did my deploy actually land" without checking kubectl.
export function VersionTag() {
    const label = formatVersionLabel(
        process.env.NEXT_PUBLIC_APP_VERSION,
        process.env.NEXT_PUBLIC_APP_ENV,
        process.env.NEXT_PUBLIC_APP_COMMIT,
    );

    if (!label) return null;

    return (
        <div className="fixed bottom-1 right-1.5 z-[9998] pointer-events-none select-none text-[10px] text-white/25 dark:text-white/20">
            {label}
        </div>
    );
}
