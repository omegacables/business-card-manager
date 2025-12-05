import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { createAdminClient } from "@/lib/auth";
import { stripe, PRICE_IDS } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  try {
    const session = await auth0.getSession();
    const userEmail = session?.user?.email;

    if (!userEmail) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
      .eq("user_id", userEmail)
      .single();

    let customerId = subscription?.stripe_customer_id;

    // Create new customer if doesn't exist
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: {
          user_email: userEmail,
        },
      });
      customerId = customer.id;

      // Save customer id
      await supabase
        .from("subscriptions")
        .upsert({
          user_id: userEmail,
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
