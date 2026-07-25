// Pure so it's testable without a render context. `version` comes from
// package.json (via NEXT_PUBLIC_APP_VERSION, set in next.config.ts); `appEnv`
// from NEXT_PUBLIC_APP_ENV; `commit` from NEXT_PUBLIC_APP_COMMIT (dev only —
// intentionally blank on prod builds for a clean footer, see CI).
//
// Dev:  v0.1.0 (dev · abc1234)  when commit is set
//       v0.1.0 (dev)            when commit is empty / not provided
// Prod: v0.1.0                  always clean — commit is intentionally ignored
export function formatVersionLabel(
    version: string | undefined,
    appEnv: string | undefined,
    commit?: string,
): string | null {
    if (!version) return null;
    if (appEnv === 'development') {
        const sha = commit && commit.trim();
        return sha ? `v${version} (dev · ${sha})` : `v${version} (dev)`;
    }
    return `v${version}`;
}
