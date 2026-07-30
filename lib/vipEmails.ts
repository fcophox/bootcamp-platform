/**
 * Hardcoded role overrides — the admin safety net that works even when the
 * database has no role record (a fresh deployment, a wiped dev backend, a
 * failed migration).
 *
 * Single source of truth, imported by BOTH role-resolution paths:
 *   - `utils/roles.ts`        (Next.js side)
 *   - `convex/users.ts`       (`getCurrentUserWithRole`, what actually gates /cms)
 *
 * These used to be two separate literal lists and they drifted: the Convex copy
 * was missing an entry the Next.js copy had, so that account resolved as
 * `alumno` and was redirected away from /cms even though every other part of
 * the app considered it a superadmin. Add entries here only.
 *
 * No imports, no `server-only` — this file is bundled into Convex functions as
 * well as the Next.js app.
 */
export type VipRole = 'superadmin' | 'docente';

export const VIP_EMAIL_ROLES: Readonly<Record<string, VipRole>> = {
    'fcojhormazabalh@gmail.com': 'superadmin',
    'dpinto@cleveritgroup.com': 'superadmin',
    'docente@cleverex.com': 'docente',
};

/** Returns the override role for an email, or null when there is none. */
export function getVipRole(email: string | undefined | null): VipRole | null {
    const normalized = email?.toLowerCase().trim();
    if (!normalized) return null;
    return VIP_EMAIL_ROLES[normalized] ?? null;
}
