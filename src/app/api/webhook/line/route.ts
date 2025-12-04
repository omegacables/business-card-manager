import { NextRequest, NextResponse } from "next/server";
import { WebhookEvent } from "@line/bot-sdk";
import { createClient } from "@supabase/supabase-js";
import {
  verifySignature,
  replyMessage,
  getImageContent,
  isImageMessage,
  isTextMessage,
  quickReplyButtons,
  createWelcomeMessage,
} from "@/lib/line";
import { performOCR, parseBusinessCardText } from "@/lib/ocr";
import type { Database } from "@/types/database";

// Service role client to bypass RLS for webhook operations
function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("x-line-signature") || "";

    // Verify webhook signature
    if (!verifySignature(body, signature)) {
      console.error("Invalid signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const { events } = JSON.parse(body) as { events: WebhookEvent[] };

    // Process events
    await Promise.all(events.map(handleEvent));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Webhook error:", error);
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
    // Get image content
    const imageBuffer = await getImageContent(event.message.id);
    const base64 = imageBuffer.toString("base64");

    // Perform OCR
    const ocrText = await performOCR(base64);
    const parsed = parseBusinessCardText(ocrText);

    if (!parsed.name) {
      await replyMessage(event.replyToken, [
        {
          type: "text",
          text: "名刺から氏名を読み取れませんでした。\n別の画像を送信してください。",
        },
      ]);
      return;
    }

    // Save to database
    const profileData = profile as any;
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
    });

    if (insertError) {
      throw insertError;
    }

    // Build response message
    let responseText = `名刺を登録しました！\n\n`;
    responseText += `【登録内容】\n`;
    responseText += `氏名: ${parsed.name}\n`;
    if (parsed.company_name) responseText += `会社: ${parsed.company_name}\n`;
    if (parsed.position) responseText += `役職: ${parsed.position}\n`;
    if (parsed.email) responseText += `Email: ${parsed.email}\n`;
    if (parsed.phone) responseText += `TEL: ${parsed.phone}\n`;
    if (parsed.mobile) responseText += `携帯: ${parsed.mobile}\n`;

    await replyMessage(event.replyToken, [
      { type: "text", text: responseText, quickReply: quickReplyButtons },
    ]);
  } catch (error) {
    console.error("Error processing image:", error);
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
  const text = event.message.text.toLowerCase();
  const lineUserId = event.source.userId;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  // Show LINE user ID for setup
  if (text === "id" || text === "myid") {
    await replyMessage(event.replyToken, [
      {
        type: "text",
        text: lineUserId
          ? `あなたのLINEユーザーIDは:\n${lineUserId}\n\nこのIDをWebサイトの設定ページに登録してください。`
          : "ユーザーIDを取得できませんでした。",
        quickReply: quickReplyButtons,
      },
    ]);
    return;
  }

  // Show welcome/help message
  if (text === "ヘルプ" || text === "help" || text === "？" || text === "メニュー" || text === "menu") {
    await replyMessage(event.replyToken, [createWelcomeMessage(siteUrl)]);
    return;
  }

  // Default response
  await replyMessage(event.replyToken, [
    {
      type: "text",
      text: "名刺の画像を送信してください。\n「ヘルプ」と送信すると使い方を確認できます。",
      quickReply: quickReplyButtons,
    },
  ]);
}
