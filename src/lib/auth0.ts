import { Auth0Client } from "@auth0/nextjs-auth0/server";
import { NextResponse } from "next/server";

// Auth0 v4 SDK with explicit route configuration
export const auth0 = new Auth0Client({
  authorizationParameters: {
    scope: "openid profile email",
  },
  // Redirect to dashboard after login
  async onCallback(error, context) {
    const baseUrl = process.env.APP_BASE_URL || process.env.AUTH0_BASE_URL || "";
    if (error) {
      console.error("Auth0 callback error:", error);
      return NextResponse.redirect(new URL("/login?error=auth_failed", baseUrl));
    }
    // Redirect to dashboard after successful login
    return NextResponse.redirect(new URL("/dashboard", baseUrl));
  },
});
