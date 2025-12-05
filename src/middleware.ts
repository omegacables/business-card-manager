import { type NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";

export async function middleware(request: NextRequest) {
  // Handle Auth0 authentication routes
  const authResponse = await auth0.middleware(request);

  // If Auth0 handled the request, return its response
  if (authResponse.status !== 404) {
    return authResponse;
  }

  // For other routes, just continue
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api/webhook (LINE webhook endpoint)
     */
    "/((?!_next/static|_next/image|favicon.ico|api/webhook).*)",
  ],
};
