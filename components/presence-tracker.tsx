'use client';

import { useEffect } from 'react';
import { useConvexAuth } from 'convex/react';

const HEARTBEAT_INTERVAL_MS = 30000;

export function PresenceTracker() {
  const { isAuthenticated } = useConvexAuth();

  useEffect(() => {
    if (!isAuthenticated) return;

    const sendHeartbeat = () => {
      fetch('/api/presence', { method: 'POST' }).catch(() => {});
    };

    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  return null;
}
