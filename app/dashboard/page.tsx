import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { DashboardClient } from './dashboard-client';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function DashboardPage({
    searchParams,
}: {
    searchParams?: Promise<{ token?: string }>;
}) {
    const token = await convexAuthNextjsToken();
    if (!token) {
        return redirect('/login');
    }

    // Get current user with role from Convex
    const currentUser = await fetchQuery(
        api.users.getCurrentUserWithRole,
        {},
        { token }
    );

    if (!currentUser) {
        return redirect('/login');
    }

    const { email, role, name } = currentUser;

    if (role === 'docente' || role === 'superadmin') {
        return redirect('/cms');
    }

    const resolvedSearchParams = await searchParams;
    const invitationToken = resolvedSearchParams?.token;

    if (invitationToken) {
        const validation = await fetchQuery(api.invitations.validateToken, { token: invitationToken }, { token });
        if (validation.valid) {
            await fetchMutation(
                api.invitations.acceptInvitation,
                { token: invitationToken, userEmail: email, userName: name || email?.split("@")[0] },
                { token }
            );
        }
        redirect('/dashboard');
    }

    // Call Convex query server-side
    const dashboardData = await fetchQuery(
        api.dashboard.getStudentData,
        { email },
        { token }
    );

    return (
        <DashboardClient
            bootcamps={(dashboardData?.bootcamps as any) || []}
            userName={name || email?.split("@")[0] || "Estudiante"}
            continueLearning={(dashboardData?.continueLearning as any) || null}
        />
    );
}
