import { redirect } from 'next/navigation';
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { getEncuestasAlumno } from '@/app/actions/medicion';
import { EncuestasClient } from './encuestas-client';

export const dynamic = 'force-dynamic';

export default async function EncuestasPage() {
    const token = await convexAuthNextjsToken();
    if (!token) return redirect('/login');

    const currentUser = await fetchQuery(
        api.users.getCurrentUserWithRole,
        {},
        { token }
    );

    if (!currentUser) return redirect('/login');

    const { role } = currentUser;
    if (role === 'docente' || role === 'superadmin') return redirect('/cms');

    const encuestas = await getEncuestasAlumno();

    return <EncuestasClient encuestas={encuestas} />;
}
