import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

const isProtectedRoute = createRouteMatcher(["/cms(.*)", "/dashboard(.*)"]);
const isAuthRoute = createRouteMatcher(["/login(.*)"]);
const isPublicAuthRoute = createRouteMatcher(["/reset-password(.*)", "/forgot-password(.*)"]);

export const proxy = convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  // Skip auth check for password reset routes
  if (isPublicAuthRoute(request)) {
    return;
  }
  
  if (isProtectedRoute(request) && !(await convexAuth.isAuthenticated())) {
    return nextjsMiddlewareRedirect(request, "/login");
  }
  if (isAuthRoute(request) && (await convexAuth.isAuthenticated())) {
    return nextjsMiddlewareRedirect(request, "/dashboard");
  }
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
