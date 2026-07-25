import { NextResponse } from 'next/server';
import { convexAuthNextjsToken } from '@convex-dev/auth/nextjs/server';
import { fetchQuery, fetchMutation } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';

// Backs the client-side presence poll (see contexts/OnlineUsersContext.tsx)
// and heartbeat (see components/presence-tracker.tsx). Kept server-side so
// the browser never calls Convex directly for this.

export async function GET() {
    const onlineUsers = await fetchQuery(api.presence.listOnline, {});
    return NextResponse.json(onlineUsers);
}

export async function POST() {
    const token = await convexAuthNextjsToken();
    if (!token) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const currentUser = await fetchQuery(api.users.viewer, {}, { token });
    if (!currentUser) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const email = currentUser.email || '';
    const role = email
        ? await fetchQuery(api.legacyAuth.getRoleByEmail, { email }, { token })
        : null;

    await fetchMutation(
        api.presence.heartbeat,
        {
            userId: currentUser._id,
            email,
            name: currentUser.name || '',
            role: role || 'alumno',
        },
        { token },
    );

    return NextResponse.json({ success: true });
}
