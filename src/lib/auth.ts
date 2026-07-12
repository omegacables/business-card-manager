import { auth0 } from "@/lib/auth0";
import { createClient } from "@supabase/supabase-js";

// Admin client to bypass RLS
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Auth0 の発行者ベースURL（https://<domain>）を返す。
// SDK v4 は AUTH0_DOMAIN、旧設定/ローカルは AUTH0_ISSUER_BASE_URL を使うため両対応。
export function auth0IssuerBaseUrl(): string {
  const domain = process.env.AUTH0_DOMAIN;
  if (domain) {
    const d = domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
    return `https://${d}`;
  }
  return (process.env.AUTH0_ISSUER_BASE_URL || "").replace(/\/$/, "");
}

// Get current user's email (used as user ID)
export async function getCurrentUserEmail(): Promise<string | null> {
  const session = await auth0.getSession();
  return session?.user?.email || null;
}

// Get current user info
export async function getCurrentUser() {
  const session = await auth0.getSession();
  if (!session) return null;

  return {
    email: session.user.email,
    name: session.user.name,
    picture: session.user.picture,
    sub: session.user.sub,
  };
}
