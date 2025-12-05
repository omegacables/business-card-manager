import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { createAdminClient } from "@/lib/auth";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth0.getSession();
    const userEmail = session?.user?.email;

    if (!userEmail) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
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

    const supabase = createAdminClient();

    // Verify ownership
    const { data: existing } = await supabase
      .from("business_cards")
      .select("id")
      .eq("id", id)
      .eq("user_id", userEmail)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("business_cards")
      .update({
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
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", userEmail)
      .select()
      .single();

    if (error) {
      console.error("Card update error:", error);
      return NextResponse.json(
        { error: "Failed to update card" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, card: data });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth0.getSession();
    const userEmail = session?.user?.email;

    if (!userEmail) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const supabase = createAdminClient();

    const { error } = await supabase
      .from("business_cards")
      .delete()
      .eq("id", id)
      .eq("user_id", userEmail);

    if (error) {
      console.error("Card delete error:", error);
      return NextResponse.json(
        { error: "Failed to delete card" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
