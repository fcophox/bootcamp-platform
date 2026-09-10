import { NextRequest } from "next/server";
import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

const isProtectedRoute = createRouteMatcher(["/cms(.*)", "/dashboard(.*)"]);
const isAuthRoute = createRouteMatcher(["/login(.*)"]);
const isPublicAuthRoute = createRouteMatcher(["/reset-password(.*)", "/forgot-password(.*)"]);

const innerMiddleware = convexAuthNextjsMiddleware(
  async (request, { convexAuth }) => {
    if (isPublicAuthRoute(request)) {
      return;
    }

    if (isProtectedRoute(request) && !(await convexAuth.isAuthenticated())) {
      return nextjsMiddlewareRedirect(request, "/login");
    }
    if (isAuthRoute(request) && (await convexAuth.isAuthenticated())) {
      return nextjsMiddlewareRedirect(request, "/dashboard");
    }
  },
);

/**
 * Reconcile the request with the real external origin behind Cloudflare Tunnel
 * + Traefik, so @convex-dev/auth's CORS check does not misfire.
 *
 * `isCorsRequest` (packages/auth/nextjs/server/utils.js) returns true when
 * EITHER the Origin header's host differs from the Host header, OR its protocol
 * differs from `new URL(request.url).protocol`. When it does, POST /api/auth is
 * answered 403 "Invalid origin", and `validateCors` silently strips the auth
 * cookies off every other request — which surfaces as a POST /api/presence 401
 * flood and as server actions failing with "An unexpected response was received
 * from the server".
 *
 * What this deployment actually sends (measured on bootcamp-dev, not assumed):
 *
 *   Host:              bootcamp-dev.nodrize.dev     <- already correct
 *   X-Forwarded-Host:  bootcamp-dev.nodrize.dev
 *   X-Forwarded-Proto: http                         <- NOT https
 *   X-Forwarded-Port:  80
 *   CF-Visitor:        {"scheme":"https"}
 *   Origin:            https://bootcamp-dev.nodrize.dev
 *   request.url:       http://0.0.0.0:3000/...      <- raw internal socket
 *
 * So the Host was never mangled — Traefik preserves it. Only the *protocol*
 * mismatches, because Cloudflare terminates TLS and reaches Traefik over plain
 * HTTP. That means X-Forwarded-Proto is the wrong signal here (it describes the
 * Cloudflare->Traefik hop, not the browser's); the browser's own Origin is the
 * authoritative source for the external scheme.
 *
 * Next.js gives no supported way to rewrite `request.url` in place, so the two
 * route classes are reconciled from opposite ends:
 *
 *   /api/auth  is consumed by the middleware itself, so the request is rebuilt
 *              on the external https URL (and the body re-attached, since a
 *              NextRequest built from a URL string starts empty).
 *   everything else only has to survive validateCors, and rebuilding it would
 *              mean buffering every server-action body — so the Origin header
 *              is stepped down to the internal protocol instead. The browser's
 *              real origin is preserved in X-External-Origin for code that
 *              builds outbound links (see app/actions/student.ts).
 */
export default async function proxy(
  request: NextRequest,
  event: Parameters<typeof innerMiddleware>[1],
): Promise<ReturnType<typeof innerMiddleware>> {
  const normalized = await normalizeExternalOrigin(request);
  return innerMiddleware(normalized, event);
}

/** Header carrying the browser's true external origin past the step-down below. */
export const EXTERNAL_ORIGIN_HEADER = "x-external-origin";

export async function normalizeExternalOrigin(
  request: NextRequest,
): Promise<NextRequest> {
  // No Origin means isCorsRequest() is already false; nothing to reconcile.
  const origin = request.headers.get("origin");
  if (!origin) {
    return request;
  }

  const externalHost =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!externalHost) {
    return request;
  }

  let originURL: URL;
  try {
    originURL = new URL(origin);
  } catch {
    return request;
  }

  // A genuinely foreign Origin is left untouched so the CORS check still bites.
  if (originURL.host !== externalHost) {
    return request;
  }

  const internalURL = new URL(request.url);
  if (originURL.protocol === internalURL.protocol) {
    return request;
  }

  if (internalURL.pathname.startsWith("/api/auth")) {
    const externalURL = `${originURL.protocol}//${externalHost}${internalURL.pathname}${internalURL.search}`;
    const body = await request.text();
    const modified = new NextRequest(externalURL, {
      method: request.method,
      headers: new Headers(request.headers),
      body,
    });
    // `new Headers(request.headers)` would otherwise carry the upstream Host
    // through unchanged.
    modified.headers.set("host", externalHost);
    return modified;
  }

  request.headers.set(EXTERNAL_ORIGIN_HEADER, originURL.origin);
  request.headers.set("host", externalHost);

  const steppedDown = new URL(originURL.toString());
  steppedDown.protocol = internalURL.protocol;
  request.headers.set("origin", steppedDown.origin);

  return request;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
