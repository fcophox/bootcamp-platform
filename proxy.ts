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
 * Normalize the Host header behind a reverse proxy (Traefik / Cloudflare Tunnel).
 *
 * Problem: Traefik sets the internal Host header (e.g. "bootcamp-platform-dev:3000")
 * while the browser sends Origin: "https://bootcamp-dev.nodrize.dev".
 *
 * @convex-dev/auth's {@link proxyAuthActionToConvex} rejects POST /api/auth
 * with 403 "Invalid origin" when the Host does not match the Origin — and its
 * internal {@link validateCors} clears the auth cookies on every request where
 * Origin !== Host.
 *
 * This wrapper restores the real external host from X-Forwarded-Host, so the
 * Convex auth middleware never sees a mismatched Host/Origin pair.
 */
export default async function proxy(
  request: NextRequest,
  event: Parameters<typeof innerMiddleware>[1],
): Promise<ReturnType<typeof innerMiddleware>> {
  const normalized = await normalizeExternalHost(request);
  return innerMiddleware(normalized, event);
}

export async function normalizeExternalHost(
  request: NextRequest,
): Promise<NextRequest> {
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (!forwardedHost) {
    return request;
  }

  const internalURL = new URL(request.url);

  // /api/auth is proxied straight to Convex by proxyAuthActionToConvex, which
  // 403s "Invalid origin" when isCorsRequest is true. Both halves of that check
  // must be satisfied, so rebuild the URL with the external protocol/host AND
  // rewrite the Host header — `new Headers(request.headers)` would otherwise
  // carry the internal Traefik host straight through. The body has to be read
  // and re-attached because a NextRequest built from a URL string starts empty.
  if (internalURL.pathname.startsWith("/api/auth")) {
    const forwardedProto =
      request.headers.get("x-forwarded-proto") ?? "https";
    const externalURL = `${forwardedProto}://${forwardedHost}${internalURL.pathname}${internalURL.search}`;

    const body = await request.text();
    const modified = new NextRequest(externalURL, {
      method: request.method,
      headers: new Headers(request.headers),
      body,
    });
    modified.headers.set("host", forwardedHost);
    return modified;
  }

  // Every other route only needs to survive validateCors, which silently strips
  // the auth cookies when isCorsRequest is true. Fixing the Host header covers
  // the first half of that check.
  request.headers.set("host", forwardedHost);

  // The second half compares Origin's protocol against request.url's protocol,
  // and request.url is whatever Traefik forwarded on (typically plain http
  // inside the cluster). We can't rewrite request.url without rebuilding the
  // request — which would mean buffering every server-action body — so align
  // the Origin header's protocol with the internal URL instead. This is only
  // done when the request is genuinely same-origin (Origin host already equals
  // the external host); real cross-origin requests keep their Origin untouched
  // and are still flagged. Next's own server-action CSRF check compares hosts
  // only, so it is unaffected.
  const origin = request.headers.get("origin");
  if (origin) {
    const originURL = new URL(origin);
    if (
      originURL.host === forwardedHost &&
      originURL.protocol !== internalURL.protocol
    ) {
      originURL.protocol = internalURL.protocol;
      request.headers.set("origin", originURL.origin);
    }
  }

  return request;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};