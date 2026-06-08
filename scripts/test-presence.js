const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
}

console.log('Connecting to Supabase:', url);
const supabase = createClient(url, key);

const runTest = async () => {
    const channel = supabase.channel('online-users', {
        config: {
            presence: {
                key: 'test-user-id',
            },
        },
    });

    channel
        .on('presence', { event: 'sync' }, () => {
            console.log('Presence synced! Current state:', JSON.stringify(channel.presenceState(), null, 2));
        })
        .on('presence', { event: 'join' }, ({ key, newPresences }) => {
            console.log('User joined:', key, newPresences);
        })
        .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
            console.log('User left:', key, leftPresences);
        })
        .subscribe(async (status) => {
            console.log('Channel subscription status:', status);
            if (status === 'SUBSCRIBED') {
                console.log('Tracking presence...');
                const tracked = await channel.track({
                    online_at: new Date().toISOString(),
                    name: 'Test Student',
                    email: 'alumno301@cleverex.com',
                    role: 'alumno'
                });
                console.log('Track result:', tracked);
            }
        });
};

runTest();

// Keep script alive for 10 seconds
setTimeout(() => {
    console.log('Test completed.');
    process.exit(0);
}, 10000);
