import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { redirect } from 'next/navigation';
import { EncuestasGestionClient } from './encuestas-gestion-client';
import { getEncuestasGestion } from '@/app/actions/medicion';

export const dynamic = 'force-dynamic';

export default async function EncuestasGestionPage() {
    const token = await convexAuthNextjsToken();
    if (!token) return redirect('/login');

    // Get current user with role from Convex
    const currentUser = await fetchQuery(
        api.users.getCurrentUserWithRole,
        {},
        { token }
    );

    if (!currentUser || currentUser.role === 'alumno') {
        return redirect('/dashboard');
    }

    const encuestas = await getEncuestasGestion();

    return <EncuestasGestionClient encuestas={encuestas} />;
}
