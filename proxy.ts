import { NextRequest, NextResponse } from "next/server";
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
 * Normalize the Host header for auth requests behind a reverse proxy.
 *
 * @convex-dev/auth's {@link proxyAuthActionToConvex} rejects POST /api/auth
 * with 403 "Invalid origin" when the Origin header's host does not match the
 * internal Host header (common behind Traefik / Cloudflare Tunnel, where the
 * internal Host is the service name like "bootcamp-platform-prod:3000").
 *
 * This wrapper restores the real external host from X-Forwarded-Host (which
 * Traefik sets to the original Host header sent by the browser) before the
 * check runs. The check itself is defense-in-depth — the real abuse barrier
 * is at the ingress level (Traefik host matching).
 */
export function proxy(
  request: NextRequest,
  event: Parameters<typeof innerMiddleware>[1],
): ReturnType<typeof innerMiddleware> {
  return innerMiddleware(normalizeAuthHost(request), event);
}

function normalizeAuthHost(request: NextRequest): NextRequest {
  const pathname = request.nextUrl.pathname;
  if (!pathname.startsWith("/api/auth")) {
    return request;
  }

  const forwardedHost = request.headers.get("x-forwarded-host");
  if (!forwardedHost) {
    return request;
  }

  const origin = request.headers.get("origin");
  if (!origin) {
    return request;
  }

  const originURL = new URL(origin);
  if (forwardedHost === originURL.host) {
    // Reconstruct the URL with the external protocol+host so that
    // @convex-dev/auth's isCorsRequest check (which compares Origin
    // protocol against request.url protocol) passes.  Behind Traefik
    // the internal URL is http:// while the external is https://.
    const internal = new URL(request.url);
    const normalized = `${originURL.protocol}//${originURL.host}${internal.pathname}${internal.search}`;

    const modified = new NextRequest(normalized, {
      method: request.method,
      headers: new Headers(request.headers),
    });
    modified.headers.set("host", originURL.host);
    return modified;
  }

  return request;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
