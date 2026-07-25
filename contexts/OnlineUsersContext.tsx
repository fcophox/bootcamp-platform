'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type PresenceState = Record<string, any>;

interface OnlineUsersContextProps {
    onlineUsers: PresenceState;
}

const OnlineUsersContext = createContext<OnlineUsersContextProps>({ onlineUsers: {} });

const POLL_INTERVAL_MS = 10000;

export const OnlineUsersProvider = ({ children }: { children: ReactNode }) => {
    const [onlineUsers, setOnlineUsers] = useState<PresenceState>({});

    useEffect(() => {
        let cancelled = false;

        const poll = async () => {
            try {
                const res = await fetch('/api/presence');
                if (!res.ok) return;
                const data = await res.json();
                if (!cancelled) setOnlineUsers(data);
            } catch {
                // transient network error, next poll retries
            }
        };

        poll();
        const interval = setInterval(poll, POLL_INTERVAL_MS);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, []);

    return (
        <OnlineUsersContext.Provider value={{ onlineUsers }}>
            {children}
        </OnlineUsersContext.Provider>
    );
};

export const useOnlineUsers = () => useContext(OnlineUsersContext);
