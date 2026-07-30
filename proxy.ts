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
 * This wrapper restores the real external host from X-Forwarded-Host for every
 * request, so the Convex auth middleware never sees a mismatched Host/Origin pair.
 */
export default async function proxy(
  request: NextRequest,
  event: Parameters<typeof innerMiddleware>[1],
): Promise<ReturnType<typeof innerMiddleware>> {
  return innerMiddleware(await normalizeExternalHost(request), event);
}

async function normalizeExternalHost(request: NextRequest): Promise<NextRequest> {
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (!forwardedHost) {
    return request;
  }

  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  const internalURL = new URL(request.url);

  const externalURL = `${forwardedProto}://${forwardedHost}${internalURL.pathname}${internalURL.search}`;

  const body = request.method === "GET" || request.method === "HEAD"
    ? undefined
    : await request.text();

  const modified = new NextRequest(externalURL, {
    method: request.method,
    headers: new Headers(request.headers),
    body,
  });
  modified.headers.set("host", forwardedHost);
  return modified;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};