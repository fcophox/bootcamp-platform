export type Role = 'superadmin' | 'docente' | 'alumno';

export function getRoleFromEmail(email: string | undefined | null, metadata?: unknown): Role {
    const meta = metadata as { role?: string } | null | undefined;
    // 1. Check metadata (Supabase User Metadata) - Quick check before DB fetch
    if (meta?.role === 'superadmin') return 'superadmin';
    if (meta?.role === 'docente') return 'docente';
    if (meta?.role === 'alumno') return 'alumno';

    const lowerEmail = email?.toLowerCase();

    // 2. Email hardcoded fallback (VIP users)
    if (lowerEmail === 'fcojhormazabalh@gmail.com') return 'superadmin';
    if (lowerEmail === 'docente@cleverex.com') return 'docente';
    
    return 'alumno'; // Default
}
