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

async function normalizeExternalHost(
  request: NextRequest,
): Promise<NextRequest> {
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (!forwardedHost) {
    return request;
  }

  const internalURL = new URL(request.url);

  // For /api/auth routes, also fix URL protocol so Convex's proxy
  // doesn't reject with "Invalid origin" (it checks origin vs request URL).
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
    return modified;
  }

  // For all other routes, just fix the Host header so validateCors doesn't
  // clear auth cookies due to Host/Origin mismatch. Next.js already sets
  // request.url to the external URL (with HTTPS), so the protocol is fine.
  request.headers.set("host", forwardedHost);
  return request;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};