import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { CmsClient } from './cms-client';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function CmsPage() {
    const token = await convexAuthNextjsToken();
    if (!token) {
        return redirect('/login');
    }

    // Get current user with role from Convex (uses getAuthUserId internally)
    const currentUser = await fetchQuery(
        api.users.getCurrentUserWithRole,
        {},
        { token }
    );

    if (!currentUser) {
        return redirect('/login');
    }

    const { email, role } = currentUser;

    if (role === 'alumno') {
        return redirect('/dashboard');
    }

    // Fetch CMS data
    const bootcamps = await fetchQuery(
        api.dashboard.getCmsData,
        { email, role },
        { token }
    );

    return <CmsClient bootcamps={(bootcamps as any) || []} />;
}
