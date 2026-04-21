import { NextRequest, NextResponse } from "next/server";
import { WebhookEvent } from "@line/bot-sdk";
import { createAdminClient } from "@/lib/auth";
import {
  verifySignature,
  replyMessage,
  getImageContent,
  isImageMessage,
  isTextMessage,
  quickReplyButtons,
  createWelcomeMessage,
  createSearchResultMessage,
  BusinessCardResult,
} from "@/lib/line";
import { performOCR, parseBusinessCardWithAI } from "@/lib/ocr";
import { uploadCardImage } from "@/lib/storage";
import { logger, maskId } from "@/lib/logger";
import { sanitizeSearchQuery } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("x-line-signature") || "";

    // Verify webhook signature
    if (!verifySignature(body, signature)) {
      logger.error("Invalid signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const { events } = JSON.parse(body) as { events: WebhookEvent[] };

    // Process events
    await Promise.all(events.map(handleEvent));

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function isFollowEvent(
  event: WebhookEvent
): event is WebhookEvent & {
  type: "follow";
  replyToken: string;
  source: { userId?: string };
} {
  return event.type === "follow";
}

async function handleEvent(event: WebhookEvent): Promise<void> {
  // Handle follow (friend added) event
  if (isFollowEvent(event)) {
    await handleFollowEvent(event);
    return;
  }

  // Handle image messages
  if (isImageMessage(event)) {
    await handleImageMessage(event);
    return;
  }

  // Handle text messages (for help/commands)
  if (isTextMessage(event)) {
    await handleTextMessage(event);
    return;
  }
}

async function handleFollowEvent(
  event: WebhookEvent & {
    type: "follow";
    replyToken: string;
    source: { userId?: string };
  }
): Promise<void> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  await replyMessage(event.replyToken, [createWelcomeMessage(siteUrl)]);
}

async function handleImageMessage(
  event: WebhookEvent & {
    type: "message";
    message: { type: "image"; id: string };
    replyToken: string;
    source: { userId?: string };
  }
): Promise<void> {
  const lineUserId = event.source.userId;

  if (!lineUserId) {
    await replyMessage(event.replyToken, [
      { type: "text", text: "ユーザー情報を取得できませんでした。" },
    ]);
    return;
  }

  // Find user by LINE user ID
  const supabase = createAdminClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("line_user_id", lineUserId)
    .single();

  if (profileError || !profile) {
    await replyMessage(event.replyToken, [
      {
        type: "text",
        text: "LINEアカウントが連携されていません。\nWebサイトでLINE連携を設定してください。",
      },
    ]);
    return;
  }

  try {
    const profileData = profile as { id: string };

    // Check subscription and usage limits
    const { data: subscription } = await (supabase as any)
      .from("subscriptions")
      .select("plan")
      .eq("user_id", profileData.id)
      .single();

    const plan = ((subscription as any)?.plan as "free" | "pro") || "free";
    const yearMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

    // Get current month usage
    const { data: usage } = await (supabase as any)
      .from("monthly_usage")
      .select("cards_registered")
      .eq("user_id", profileData.id)
      .eq("year_month", yearMonth)
      .single();

    const currentCount = (usage as any)?.cards_registered ?? 0;
    const monthlyLimit = plan === "pro" ? null : 10;

    if (monthlyLimit !== null && currentCount >= monthlyLimit) {
      await replyMessage(event.replyToken, [
        {
          type: "text",
          text: `今月の登録上限（${monthlyLimit}枚）に達しました。\n\nプロプランにアップグレードすると無制限に登録できます。\n設定ページからアップグレードしてください。`,
          quickReply: quickReplyButtons,
        },
      ]);
      return;
    }

    // Get image content
    const imageBuffer = await getImageContent(event.message.id);
    const base64 = imageBuffer.toString("base64");

    // Perform OCR and AI analysis
    const ocrText = await performOCR(base64);
    const parsed = await parseBusinessCardWithAI(ocrText);

    if (!parsed.name) {
      await replyMessage(event.replyToken, [
        {
          type: "text",
          text: "名刺から氏名を読み取れませんでした。\n別の画像を送信してください。",
        },
      ]);
      return;
    }

    // Only save image for Pro users (private bucket + signed URL).
    let imageUrl: string | null = null;
    if (plan === "pro") {
      const folder = Buffer.from(profileData.id).toString("base64url").slice(0, 20);
      imageUrl = await uploadCardImage(folder, imageBuffer, "image/jpeg");
    }

    // Save to database
    const { error: insertError } = await (supabase as any).from("business_cards").insert({
      user_id: profileData.id,
      name: parsed.name,
      name_kana: parsed.name_kana,
      company_name: parsed.company_name,
      department: parsed.department,
      position: parsed.position,
      email: parsed.email,
      phone: parsed.phone,
      mobile: parsed.mobile,
      fax: parsed.fax,
      postal_code: parsed.postal_code,
      address: parsed.address,
      website: parsed.website,
      image_url: imageUrl,
    });

    if (insertError) {
      throw insertError;
    }

    // Increment usage count
    await (supabase as any)
      .from("monthly_usage")
      .upsert(
        {
          user_id: profileData.id,
          year_month: yearMonth,
          cards_registered: currentCount + 1,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,year_month" }
      );

    // Build response message
    const remaining = monthlyLimit !== null ? monthlyLimit - currentCount - 1 : null;
    let responseText = `名刺を登録しました！\n\n`;
    responseText += `【登録内容】\n`;
    responseText += `氏名: ${parsed.name}\n`;
    if (parsed.company_name) responseText += `会社: ${parsed.company_name}\n`;
    if (parsed.position) responseText += `役職: ${parsed.position}\n`;
    if (parsed.email) responseText += `Email: ${parsed.email}\n`;
    if (parsed.phone) responseText += `TEL: ${parsed.phone}\n`;
    if (parsed.mobile) responseText += `携帯: ${parsed.mobile}\n`;
    if (remaining !== null) {
      responseText += `\n今月の残り登録可能数: ${remaining}枚`;
    }

    await replyMessage(event.replyToken, [
      { type: "text", text: responseText, quickReply: quickReplyButtons },
    ]);
  } catch (error) {
    logger.error("Error processing image:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    await replyMessage(event.replyToken, [
      {
        type: "text",
        text: `名刺の処理中にエラーが発生しました。\n\nエラー: ${errorMessage}`,
        quickReply: quickReplyButtons,
      },
    ]);
  }
}

async function handleTextMessage(
  event: WebhookEvent & {
    type: "message";
    message: { type: "text"; text: string };
    replyToken: string;
    source: { userId?: string };
  }
): Promise<void> {
  const originalText = event.message.text;
  const text = originalText.toLowerCase();
  const lineUserId = event.source.userId;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  // Show LINE user ID for setup
  if (text === "id" || text === "myid") {
    await replyMessage(event.replyToken, [
      {
        type: "text",
        text: lineUserId
          ? `あなたのユーザーIDは：\n${lineUserId}\n\n━━━━━━━━━━━━━━\n📝 LINE連携の設定手順\n━━━━━━━━━━━━━━\n\n① 上のユーザーIDを長押ししてコピー\n\n② 下記URLにアクセス\n${siteUrl}/settings\n\n③ 「LINE ユーザーID」欄にペースト\n\n④ 「保存」ボタンをタップ\n\n━━━━━━━━━━━━━━\n✅ 設定完了後、名刺の写真を送信すると自動で登録されます！`
          : "ユーザーIDを取得できませんでした。",
        quickReply: quickReplyButtons,
      },
    ]);
    return;
  }

  // Show welcome/help message
  if (text === "ヘルプ" || text === "help" || text === "？" || text === "メニュー" || text === "menu") {
    try {
      await replyMessage(event.replyToken, [createWelcomeMessage(siteUrl)]);
    } catch (error) {
      logger.error("Help message error:", error);
      // Fallback to simple text message
      await replyMessage(event.replyToken, [
        {
          type: "text",
          text: `【名刺管理Bot ヘルプ】

📷 名刺の登録
→ 名刺の写真を送信してください

🔍 名刺の検索
→ 「検索 名前」で検索できます

🆔 LINE ID取得
→ 「id」と送信してください

※ 初回はWebサイトでLINE連携が必要です`,
          quickReply: quickReplyButtons,
        },
      ]);
    }
    return;
  }

  // Search command: "検索 キーワード" or "@キーワード"
  const searchMatch = originalText.match(/^(?:検索\s*|@)(.+)$/);
  if (searchMatch) {
    await handleSearch(event.replyToken, lineUserId, searchMatch[1].trim());
    return;
  }

  // Default response with search hint
  await replyMessage(event.replyToken, [
    {
      type: "text",
      text: "名刺の画像を送信するか、「検索 名前」で名刺を検索できます。\n\n例: 検索 田中\n例: @山田\n\n「ヘルプ」と送信すると使い方を確認できます。",
      quickReply: quickReplyButtons,
    },
  ]);
}

async function handleSearch(
  replyToken: string,
  lineUserId: string | undefined,
  query: string
): Promise<void> {
  if (!lineUserId) {
    await replyMessage(replyToken, [
      {
        type: "text",
        text: "ユーザー情報を取得できませんでした。",
        quickReply: quickReplyButtons,
      },
    ]);
    return;
  }

  const supabase = createAdminClient();

  // Find user by LINE user ID
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("line_user_id", lineUserId)
    .single();

  if (profileError || !profile) {
    await replyMessage(replyToken, [
      {
        type: "text",
        text: "LINEアカウントが連携されていません。\nWebサイトでLINE連携を設定してください。",
        quickReply: quickReplyButtons,
      },
    ]);
    return;
  }

  try {
    // Sanitize to prevent PostgREST filter injection via user input.
    const safeQuery = sanitizeSearchQuery(query);
    if (!safeQuery) {
      await replyMessage(replyToken, [
        {
          type: "text",
          text: "検索キーワードが無効です。別のキーワードをお試しください。",
          quickReply: quickReplyButtons,
        },
      ]);
      return;
    }

    // Search business cards by name, company, or other fields (user-scoped).
    const profileData = profile as { id: string };
    const { data: cards, error: searchError } = await supabase
      .from("business_cards")
      .select("id, name, company_name, department, position, email, phone, mobile")
      .eq("user_id", profileData.id)
      .or(`name.ilike.%${safeQuery}%,company_name.ilike.%${safeQuery}%,department.ilike.%${safeQuery}%,position.ilike.%${safeQuery}%,email.ilike.%${safeQuery}%`)
      .order("updated_at", { ascending: false })
      .limit(10);

    if (searchError) {
      throw searchError;
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    const searchResults = (cards || []) as BusinessCardResult[];

    await replyMessage(replyToken, [
      createSearchResultMessage(searchResults, query, siteUrl),
    ]);
  } catch (error) {
    logger.error("Search error:", error);
    await replyMessage(replyToken, [
      {
        type: "text",
        text: "検索中にエラーが発生しました。",
        quickReply: quickReplyButtons,
      },
    ]);
  }
}
