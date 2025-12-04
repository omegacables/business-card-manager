"use server";

import { createClient } from "@/lib/supabase/server";
import { checkCanRegisterCard, incrementCardUsage, checkCanSaveImage } from "@/lib/subscription";
import { revalidatePath } from "next/cache";

interface CardData {
  name: string;
  name_kana?: string | null;
  company_name?: string | null;
  department?: string | null;
  position?: string | null;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  fax?: string | null;
  postal_code?: string | null;
  address?: string | null;
  website?: string | null;
  notes?: string | null;
  image_url?: string | null;
}

export async function createCard(data: CardData): Promise<{ success: boolean; error?: string; cardId?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "認証エラー" };
  }

  // Check if user can register more cards this month
  const { allowed, error: limitError } = await checkCanRegisterCard();
  if (!allowed) {
    return { success: false, error: limitError };
  }

  // Check if user can save images
  const canSaveImages = await checkCanSaveImage();
  const imageUrl = canSaveImages ? data.image_url : null;

  // Insert the card
  const { data: card, error: insertError } = await (supabase as any)
    .from("business_cards")
    .insert({
      user_id: user.id,
      name: data.name,
      name_kana: data.name_kana || null,
      company_name: data.company_name || null,
      department: data.department || null,
      position: data.position || null,
      email: data.email || null,
      phone: data.phone || null,
      mobile: data.mobile || null,
      fax: data.fax || null,
      postal_code: data.postal_code || null,
      address: data.address || null,
      website: data.website || null,
      notes: data.notes || null,
      image_url: imageUrl,
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("Card insert error:", insertError);
    return { success: false, error: "登録に失敗しました" };
  }

  // Increment usage count
  await incrementCardUsage();

  revalidatePath("/cards");
  revalidatePath("/dashboard");

  return { success: true, cardId: card.id };
}

export async function getUsageInfo(): Promise<{
  plan: string;
  cardsRegisteredThisMonth: number;
  remainingCards: number | null;
  canSaveImages: boolean;
}> {
  const { checkCanRegisterCard, checkCanSaveImage } = await import("@/lib/subscription");
  const { getUserPlan, getMonthlyUsage } = await import("@/lib/subscription");

  const plan = await getUserPlan();
  const usage = await getMonthlyUsage();
  const { remaining } = await checkCanRegisterCard();
  const canSaveImages = await checkCanSaveImage();

  return {
    plan,
    cardsRegisteredThisMonth: usage?.cards_registered ?? 0,
    remainingCards: remaining,
    canSaveImages,
  };
}
