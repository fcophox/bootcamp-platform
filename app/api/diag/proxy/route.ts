import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { isProdEnv } from '@/utils/env';

/**
 * TEMPORARY diagnostic — remove once the Traefik Host/Origin normalization in
 * proxy.ts is confirmed working. It reports what the pod actually receives at
 * the reverse-proxy boundary, because four fix attempts have now been made on
 * assumptions about these values rather than measurements.
 *
 * Disabled entirely on production builds. Cookie and authorization headers are
 * never echoed.
 */

const REDACTED = new Set(['cookie', 'authorization', 'proxy-authorization']);

export async function GET() {
    if (isProdEnv()) {
        return new NextResponse('Not found', { status: 404 });
    }

    const h = await headers();
    const received: Record<string, string> = {};
    h.forEach((value, key) => {
        received[key] = REDACTED.has(key.toLowerCase()) ? '<redacted>' : value;
    });

    return NextResponse.json({
        // Stamped by proxy.ts BEFORE normalization ran.
        beforeProxy: {
            url: h.get('x-dbg-orig-url') ?? '(proxy did not stamp)',
            host: h.get('x-dbg-orig-host') ?? '(proxy did not stamp)',
            urlProtocol: h.get('x-dbg-orig-url-proto') ?? '(proxy did not stamp)',
            xForwardedHost: h.get('x-dbg-xfh') ?? '(proxy did not stamp)',
            xForwardedProto: h.get('x-dbg-xfp') ?? '(proxy did not stamp)',
            origin: h.get('x-dbg-origin') ?? '(proxy did not stamp)',
            branch: h.get('x-dbg-branch') ?? '(proxy did not stamp)',
        },
        // Simulation of the /api/auth branch, run inside the middleware runtime.
        authBranchSimulation: {
            hostBeforeSet: h.get('x-dbg-auth-host-before') ?? '(not run)',
            hostAfterSet: h.get('x-dbg-auth-host-after') ?? '(not run)',
            rebuiltUrl: h.get('x-dbg-auth-url') ?? '(not run)',
            error: h.get('x-dbg-auth-error') ?? null,
        },
        // What the route handler sees, i.e. after middleware normalization.
        afterProxy: {
            host: h.get('host') ?? '(none)',
            origin: h.get('origin') ?? '(none)',
        },
        received,
    });
}
