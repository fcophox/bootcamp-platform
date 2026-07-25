import { NextResponse } from 'next/server';
import { fetchQuery } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';

// Verifies actual Convex connectivity (not just "the Next.js process is up") —
// used by the Docker HEALTHCHECK and the k8s readiness/liveness probes.
export async function GET() {
    try {
        await fetchQuery(api.bootcamps.list, {});
        return NextResponse.json({ status: 'healthy', timestamp: new Date().toISOString() });
    } catch (error) {
        console.error('Healthcheck failed:', error);
        return NextResponse.json(
            {
                status: 'unhealthy',
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString(),
            },
            { status: 503 },
        );
    }
}
