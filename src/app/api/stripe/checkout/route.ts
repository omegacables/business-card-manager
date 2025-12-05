import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { createAdminClient } from "@/lib/auth";
import { stripe, PRICE_IDS } from "@/lib/stripe";

// Helper to get user's profile ID and email
async function getUserProfile(session: { user: { email?: string; sub?: string } } | null): Promise<{ id: string; email: string } | null> {
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
      .select("id, email")
      .eq("email", userEmail)
      .single();
    profile = data;
  }
  if (!profile && lineUserId) {
    const { data } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("line_user_id", lineUserId)
      .single();
    profile = data;
  }
  if (profile && profile.email) {
    return { id: profile.id, email: profile.email };
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth0.getSession();
    const profile = await getUserProfile(session);

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = profile.id;
    const userEmail = profile.email;
    const supabase = createAdminClient();

    const { interval } = await request.json();
    const priceId = interval === "yearly" ? PRICE_IDS.pro_yearly : PRICE_IDS.pro_monthly;

    if (!priceId) {
      return NextResponse.json({ error: "Price not configured" }, { status: 500 });
    }

    // Check if user already has a stripe customer id
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .single();

    let customerId = subscription?.stripe_customer_id;

    // Create new customer if doesn't exist
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: {
          user_id: userId,
          user_email: userEmail,
        },
      });
      customerId = customer.id;

      // Save customer id
      await supabase
        .from("subscriptions")
        .upsert({
          user_id: userId,
          stripe_customer_id: customerId,
          plan: "free",
          status: "active",
        }, { onConflict: "user_id" });
    }

    // Create checkout session
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/pricing?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/pricing?canceled=true`,
      subscription_data: {
        metadata: {
          user_id: userId,
          user_email: userEmail,
        },
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Checkout failed" },
      { status: 500 }
    );
  }
}
