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
                    console.log('PresenceTracker: synced presence, current state:', channel.presenceState());
                })
                .subscribe(async (status: string) => {
                    console.log('PresenceTracker: subscription status:', status);
                    if (status === 'SUBSCRIBED') {
                        const tracked = await channel.track({
                            online_at: new Date().toISOString(),
                            name: userMetadata.full_name || user.email?.split('@')[0] || 'Usuario',
                            email: user.email,
                            role: role,
                        });
                        console.log('PresenceTracker: track result:', tracked);
                    }
                });
        };

        // Listen for auth changes (useful since Layout doesn't remount on login redirect)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            console.log('PresenceTracker: auth state changed event:', event, 'user:', session?.user?.email);
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
