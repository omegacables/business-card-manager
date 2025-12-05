import { notFound, redirect } from "next/navigation";
import { auth0 } from "@/lib/auth0";
import { createAdminClient } from "@/lib/auth";
import { CardForm } from "@/components/card-form";
import type { BusinessCard } from "@/types/database";

export default async function EditCardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth0.getSession();
  if (!session) {
    redirect("/");
  }

  const { id } = await params;
  const supabase = createAdminClient();

  // プロフィールを取得（メールまたはLINE IDで）
  const userEmail = session.user.email;
  const lineUserId = session.user.sub?.startsWith("line|")
    ? session.user.sub.replace("line|", "")
    : null;

  let profile = null;
  if (userEmail) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("email", userEmail)
      .single();
    profile = data;
  }
  if (!profile && lineUserId) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("line_user_id", lineUserId)
      .single();
    profile = data;
  }

  if (!profile) {
    redirect("/settings?setup=email");
  }

  const userId = profile.id;

  const { data, error } = await supabase
    .from("business_cards")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    notFound();
  }

  const card = data as BusinessCard;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">名刺の編集</h1>
      <CardForm initialData={card} mode="edit" />
    </div>
  );
}
