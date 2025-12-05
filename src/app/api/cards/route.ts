import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { createAdminClient } from "@/lib/auth";
import { incrementCardUsage } from "@/lib/subscription";

export async function POST(request: NextRequest) {
  try {
    const session = await auth0.getSession();
    const userEmail = session?.user?.email;

    if (!userEmail) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      name_kana,
      company_name,
      department,
      position,
      email,
      phone,
      mobile,
      fax,
      postal_code,
      address,
      website,
      notes,
      image_url,
    } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Increment usage count (checks limits)
    const usageResult = await incrementCardUsage();
    if (!usageResult.success) {
      return NextResponse.json(
        { error: usageResult.error, limitReached: true },
        { status: 403 }
      );
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("business_cards")
      .insert({
        user_id: userEmail,
        name,
        name_kana: name_kana || null,
        company_name: company_name || null,
        department: department || null,
        position: position || null,
        email: email || null,
        phone: phone || null,
        mobile: mobile || null,
        fax: fax || null,
        postal_code: postal_code || null,
        address: address || null,
        website: website || null,
        notes: notes || null,
        image_url: image_url || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Card creation error:", error);
      return NextResponse.json(
        { error: "Failed to create card" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, card: data });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
