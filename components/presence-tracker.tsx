'use client';

import { useEffect } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';

export function PresenceTracker() {
  const heartbeat = useMutation(api.presence.heartbeat);

  useEffect(() => {
    const interval = setInterval(() => {
      // Send heartbeat periodically
    }, 30000);
    return () => clearInterval(interval);
  }, [heartbeat]);

  return null;
}
