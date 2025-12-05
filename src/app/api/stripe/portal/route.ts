import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { createAdminClient } from "@/lib/auth";
import { stripe } from "@/lib/stripe";

// Helper to get user's profile ID
async function getUserProfileId(session: { user: { email?: string; sub?: string } } | null): Promise<string | null> {
  if (!session) return null;

  const supabase = createAdminClient();
  const userEmail = session.user.email;
  const lineUserId = session.user.sub?.startsWith("line|")
    ? session.user.sub.replace("line|", "")
    : null;

  let profile = null;
  if (userEmail) {
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", userEmail)
      .single();
    profile = data;
  }
  if (!profile && lineUserId) {
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("line_user_id", lineUserId)
      .single();
    profile = data;
  }
  return profile?.id || null;
}

export async function POST() {
  try {
    const authSession = await auth0.getSession();
    const userId = await getUserProfileId(authSession);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();

    // Get customer id
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .single();

    if (!subscription?.stripe_customer_id) {
      return NextResponse.json({ error: "No subscription found" }, { status: 404 });
    }

    // Create portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/pricing`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    console.error("Portal error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Portal failed" },
      { status: 500 }
    );
  }
}
