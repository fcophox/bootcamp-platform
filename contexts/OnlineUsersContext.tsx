'use client';

import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { createClient } from '@/utils/supabase/client';

type PresenceState = Record<string, any>;

interface OnlineUsersContextProps {
    onlineUsers: PresenceState;
}

const OnlineUsersContext = createContext<OnlineUsersContextProps>({ onlineUsers: {} });

export const OnlineUsersProvider = ({ children }: { children: ReactNode }) => {
    const supabase = createClient();
    const [onlineUsers, setOnlineUsers] = useState<PresenceState>({});
    const channelRef = useRef<any>(null);
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;

        const connectPresence = async (user: any) => {
            if (!user) {
                console.log('OnlineUsersProvider: No user, skipping presence.');
                return;
            }

            // If channel already exists with same user, skip
            if (channelRef.current) {
                console.log('OnlineUsersProvider: Channel already exists, re-tracking...');
                // Re-track to ensure presence is up to date
                const userMetadata = user.user_metadata || {};
                await channelRef.current.track({
                    online_at: new Date().toISOString(),
                    name: userMetadata.full_name || user.email?.split('@')[0] || 'Usuario',
                    email: user.email,
                    role: userMetadata.role === 'superadmin' ? 'superadmin' : (userMetadata.role === 'docente' ? 'docente' : 'alumno'),
                });
                return;
            }

            const userId = user.id;
            const userMetadata = user.user_metadata || {};
            const role =
                userMetadata.role === 'superadmin'
                    ? 'superadmin'
                    : userMetadata.role === 'docente'
                    ? 'docente'
                    : 'alumno';

            console.log('OnlineUsersProvider: Creating channel for user:', user.email, 'role:', role);

            const channel = supabase.channel('online-users', {
                config: {
                    presence: { key: userId },
                },
            });

            channel
                .on('presence', { event: 'sync' }, () => {
                    if (!isMountedRef.current) return;
                    const state = channel.presenceState();
                    const activeUsers: Record<string, any> = {};
                    Object.keys(state).forEach((key) => {
                        if (state[key] && state[key].length > 0) {
                            activeUsers[key] = state[key][0];
                        }
                    });
                    console.log('OnlineUsersProvider: sync →', Object.values(activeUsers).map((u: any) => u.email));
                    setOnlineUsers(activeUsers);
                })
                .on('presence', { event: 'join' }, ({ key, newPresences }: any) => {
                    console.log('OnlineUsersProvider: JOIN →', key, newPresences);
                })
                .on('presence', { event: 'leave' }, ({ key, leftPresences }: any) => {
                    console.log('OnlineUsersProvider: LEAVE →', key, leftPresences);
                })
                .subscribe(async (status: string) => {
                    console.log('OnlineUsersProvider: subscription status:', status);
                    if (status === 'SUBSCRIBED') {
                        const tracked = await channel.track({
                            online_at: new Date().toISOString(),
                            name: userMetadata.full_name || user.email?.split('@')[0] || 'Usuario',
                            email: user.email,
                            role,
                        });
                        console.log('OnlineUsersProvider: track result for', user.email, '→', tracked);
                    }
                });

            channelRef.current = channel;
        };

        const disconnectPresence = () => {
            if (channelRef.current) {
                console.log('OnlineUsersProvider: Disconnecting channel.');
                channelRef.current.unsubscribe();
                channelRef.current = null;
            }
            setOnlineUsers({});
        };

        // Listen for ALL auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string, session: any) => {
            console.log('OnlineUsersProvider: auth event:', event, 'user:', session?.user?.email);

            if (event === 'SIGNED_OUT') {
                disconnectPresence();
                return;
            }

            // Connect on any auth event that provides a user session
            if (session?.user) {
                connectPresence(session.user);
            }
        });

        // Initial connection (fallback in case onAuthStateChange doesn't fire immediately)
        supabase.auth.getSession().then((res: any) => {
            const user = res.data?.session?.user;
            if (user && !channelRef.current) {
                console.log('OnlineUsersProvider: Initial getSession fallback for:', user.email);
                connectPresence(user);
            }
        });

        return () => {
            isMountedRef.current = false;
            if (subscription) subscription.unsubscribe();
            disconnectPresence();
        };
    }, []);

    return (
        <OnlineUsersContext.Provider value={{ onlineUsers }}>
            {children}
        </OnlineUsersContext.Provider>
    );
};

export const useOnlineUsers = () => useContext(OnlineUsersContext);
