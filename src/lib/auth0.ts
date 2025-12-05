import { Auth0Client } from "@auth0/nextjs-auth0/server";

// Auth0 v4 SDK automatically reads from environment variables:
// - AUTH0_SECRET
// - AUTH0_BASE_URL
// - AUTH0_ISSUER_BASE_URL
// - AUTH0_CLIENT_ID
// - AUTH0_CLIENT_SECRET
export const auth0 = new Auth0Client();
