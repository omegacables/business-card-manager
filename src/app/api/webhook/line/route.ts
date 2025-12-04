import { NextRequest, NextResponse } from "next/server";
import { WebhookEvent } from "@line/bot-sdk";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  verifySignature,
  replyMessage,
  getImageContent,
  isImageMessage,
  isTextMessage,
} from "@/lib/line";
import { performOCR, parseBusinessCardText } from "@/lib/ocr";
import type { Database } from "@/types/database";

async function createAdminClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignore
          }
        },
      },
    }
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

async function handleEvent(event: WebhookEvent): Promise<void> {
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
  const supabase = await createAdminClient();
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

    await replyMessage(event.replyToken, [{ type: "text", text: responseText }]);
  } catch (error) {
    console.error("Error processing image:", error);
    await replyMessage(event.replyToken, [
      {
        type: "text",
        text: "名刺の処理中にエラーが発生しました。\nしばらくしてからもう一度お試しください。",
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

  if (text === "ヘルプ" || text === "help" || text === "？") {
    await replyMessage(event.replyToken, [
      {
        type: "text",
        text: `【名刺管理Bot ヘルプ】

📷 名刺の登録
→ 名刺の写真を送信してください

🔍 名刺の検索
→ Webサイトから検索できます

💡 使い方
1. 名刺の写真を撮影
2. このチャットに送信
3. 自動で読み取り・登録！

※ 事前にWebサイトでLINE連携が必要です`,
      },
    ]);
    return;
  }

  // Default response
  await replyMessage(event.replyToken, [
    {
      type: "text",
      text: "名刺の画像を送信してください。\n「ヘルプ」と送信すると使い方を確認できます。",
    },
  ]);
}
