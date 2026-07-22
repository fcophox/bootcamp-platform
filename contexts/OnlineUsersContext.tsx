'use client';

import { createContext, useContext, useEffect, ReactNode } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';

type PresenceState = Record<string, any>;

interface OnlineUsersContextProps {
    onlineUsers: PresenceState;
}

const OnlineUsersContext = createContext<OnlineUsersContextProps>({ onlineUsers: {} });

export const OnlineUsersProvider = ({ children }: { children: ReactNode }) => {
    const onlineUsers = useQuery(api.presence.listOnline) || {};

    return (
        <OnlineUsersContext.Provider value={{ onlineUsers }}>
            {children}
        </OnlineUsersContext.Provider>
    );
};

export const useOnlineUsers = () => useContext(OnlineUsersContext);
