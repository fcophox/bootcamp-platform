import { redirect } from 'next/navigation';
import { convexAuthNextjsToken } from '@convex-dev/auth/nextjs/server';
import { fetchQuery } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';
import { autoActivateStudents } from '@/app/actions/student';
import { ProfileClient } from './profile-client';

export default async function ProfilePage() {
    const token = await convexAuthNextjsToken();
    if (!token) redirect('/login');

    const currentUser = await fetchQuery(api.users.viewer, {}, { token });
    if (!currentUser) redirect('/login');

    const userEmail = currentUser.email || '';

    const [roleFromDB, dashboardData] = await Promise.all([
        userEmail ? fetchQuery(api.legacyAuth.getRoleByEmail, { email: userEmail }, { token }) : null,
        userEmail ? fetchQuery(api.dashboard.getStudentData, { email: userEmail }, { token }) : null,
    ]);

    // Fire-and-forget, matching the previous client-side behavior (not blocking page render).
    if (userEmail) {
        autoActivateStudents(userEmail).catch(console.error);
    }

    return (
        <ProfileClient
            currentUser={currentUser}
            userEmail={userEmail}
            roleFromDB={roleFromDB}
            bootcamps={dashboardData?.bootcamps || []}
        />
    );
}
