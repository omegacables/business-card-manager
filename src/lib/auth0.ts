import { Auth0Client } from "@auth0/nextjs-auth0/server";

// Auth0 v4 SDK with explicit route configuration
export const auth0 = new Auth0Client({
  authorizationParameters: {
    scope: "openid profile email",
  },
});
