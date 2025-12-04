import { Client, validateSignature, WebhookEvent, MessageAPIResponseBase, Message, QuickReply, FlexMessage } from "@line/bot-sdk";

const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN!;
const channelSecret = process.env.LINE_CHANNEL_SECRET!;

export const lineClient = new Client({
  channelAccessToken,
});

export function verifySignature(body: string, signature: string): boolean {
  return validateSignature(body, channelSecret, signature);
}

export async function replyMessage(
  replyToken: string,
  messages: Message[]
): Promise<MessageAPIResponseBase> {
  return lineClient.replyMessage(replyToken, messages);
}

// Quick reply buttons
export const quickReplyButtons: QuickReply = {
  items: [
    {
      type: "action",
      action: {
        type: "cameraRoll",
        label: "📷 名刺を登録",
      },
    },
    {
      type: "action",
      action: {
        type: "camera",
        label: "📸 カメラで撮影",
      },
    },
    {
      type: "action",
      action: {
        type: "message",
        label: "🆔 ID取得",
        text: "id",
      },
    },
    {
      type: "action",
      action: {
        type: "message",
        label: "❓ ヘルプ",
        text: "ヘルプ",
      },
    },
  ],
};

// Welcome message with buttons
export function createWelcomeMessage(siteUrl?: string): FlexMessage {
  return {
    type: "flex",
    altText: "名刺管理Botへようこそ！",
    contents: {
      type: "bubble",
      hero: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "📇 名刺管理Bot",
            weight: "bold",
            size: "xl",
            align: "center",
            color: "#1DB446",
          },
        ],
        paddingAll: "20px",
        backgroundColor: "#F0FFF0",
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "名刺の写真を送信するだけで自動で登録できます！",
            wrap: true,
            size: "sm",
            color: "#666666",
          },
          {
            type: "separator",
            margin: "lg",
          },
          {
            type: "box",
            layout: "vertical",
            margin: "lg",
            spacing: "sm",
            contents: [
              {
                type: "text",
                text: "【使い方】",
                weight: "bold",
                size: "sm",
              },
              {
                type: "text",
                text: "1. 下のボタンで名刺を撮影/選択",
                size: "sm",
                color: "#666666",
              },
              {
                type: "text",
                text: "2. 自動でOCR読み取り＆登録",
                size: "sm",
                color: "#666666",
              },
              {
                type: "text",
                text: "3. Webサイトで検索・管理",
                size: "sm",
                color: "#666666",
              },
            ],
          },
          {
            type: "separator",
            margin: "lg",
          },
          {
            type: "text",
            text: "※初回は「ID取得」でLINE IDを確認し、Webサイトで連携設定してください",
            wrap: true,
            size: "xs",
            color: "#999999",
            margin: "lg",
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "button",
            style: "primary",
            color: "#1DB446",
            action: {
              type: "cameraRoll",
              label: "📷 名刺を登録する",
            },
          },
          {
            type: "button",
            style: "secondary",
            action: {
              type: "message",
              label: "🆔 LINE IDを取得",
              text: "id",
            },
          },
          ...(siteUrl
            ? [
                {
                  type: "button" as const,
                  style: "link" as const,
                  action: {
                    type: "uri" as const,
                    label: "🌐 Webサイトを開く",
                    uri: siteUrl,
                  },
                },
              ]
            : []),
        ],
      },
    },
    quickReply: quickReplyButtons,
  };
}

export async function getImageContent(messageId: string): Promise<Buffer> {
  const stream = await lineClient.getMessageContent(messageId);
  const chunks: Buffer[] = [];

  return new Promise((resolve, reject) => {
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

export function isImageMessage(
  event: WebhookEvent
): event is WebhookEvent & {
  type: "message";
  message: { type: "image"; id: string };
  replyToken: string;
  source: { userId?: string };
} {
  return (
    event.type === "message" &&
    "message" in event &&
    event.message.type === "image"
  );
}

export function isTextMessage(
  event: WebhookEvent
): event is WebhookEvent & {
  type: "message";
  message: { type: "text"; text: string };
  replyToken: string;
  source: { userId?: string };
} {
  return (
    event.type === "message" &&
    "message" in event &&
    event.message.type === "text"
  );
}
