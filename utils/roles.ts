export type Role = 'superadmin' | 'docente' | 'alumno';

export function getRoleFromEmail(email: string | undefined | null, metadata?: unknown): Role {
    const lowerEmail = email?.toLowerCase();

    // 1. Hardcoded VIP list — overrides everything (admin safety net)
    if (lowerEmail === 'fcojhormazabalh@gmail.com') return 'superadmin';
    if (lowerEmail === 'dpinto@cleveritgroup.com') return 'superadmin';
    if (lowerEmail === 'docente@cleverex.com') return 'docente';

    // 2. Check metadata (Convex users table) — set during sign-up
    const meta = metadata as { role?: string } | null | undefined;
    if (meta?.role === 'superadmin') return 'superadmin';
    if (meta?.role === 'docente') return 'docente';

    return 'alumno'; // Default (includes meta?.role === 'alumno')
}
