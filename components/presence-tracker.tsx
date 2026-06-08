'use client';

import { useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';

export function PresenceTracker() {
    const supabase = createClient();

    useEffect(() => {
        let channel: any;

        const handleAuthChange = async (session: any) => {
            // Clean up previous channel
            if (channel) {
                channel.unsubscribe();
                channel = null;
            }

            const user = session?.user;
            if (!user) return;

            const userId = user.id;
            const userMetadata = user.user_metadata || {};
            const role = userMetadata.role === 'superadmin' ? 'superadmin' : (userMetadata.role === 'docente' ? 'docente' : 'alumno');

            // Suscribirse al canal global de presencia
            channel = supabase.channel('online-users', {
                config: {
                    presence: {
                        key: userId,
                    },
                },
            });

            channel
                .on('presence', { event: 'sync' }, () => {
                    // Sincronización silenciosa
                })
                .subscribe(async (status: string) => {
                    if (status === 'SUBSCRIBED') {
                        await channel.track({
                            online_at: new Date().toISOString(),
                            name: userMetadata.full_name || user.email?.split('@')[0] || 'Usuario',
                            email: user.email,
                            role: role,
                        });
                    }
                });
        };

        // Listen for auth changes (useful since Layout doesn't remount on login redirect)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            handleAuthChange(session);
        });

        // Initialize with current session
        supabase.auth.getSession().then(({ data: { session } }) => {
            handleAuthChange(session);
        });

        return () => {
            if (subscription) {
                subscription.unsubscribe();
            }
            if (channel) {
                channel.unsubscribe();
            }
        };
    }, []);

    return null;
}
