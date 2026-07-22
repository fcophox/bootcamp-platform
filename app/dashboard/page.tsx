import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { DashboardClient } from './dashboard-client';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
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
