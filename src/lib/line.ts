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
            text: "名刺管理Bot",
            weight: "bold",
            size: "xxl",
            align: "center",
            color: "#FFFFFF",
          },
          {
            type: "text",
            text: "写真を送るだけでカンタン登録",
            size: "sm",
            align: "center",
            color: "#FFFFFF",
            margin: "sm",
          },
        ],
        paddingAll: "24px",
        backgroundColor: "#2563EB",
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "box",
            layout: "horizontal",
            contents: [
              {
                type: "text",
                text: "STEP 1",
                size: "xs",
                color: "#FFFFFF",
                weight: "bold",
                align: "center",
                flex: 0,
              },
            ],
            backgroundColor: "#2563EB",
            paddingAll: "4px",
            cornerRadius: "md",
            width: "60px",
          },
          {
            type: "text",
            text: "LINE IDを連携する",
            weight: "bold",
            size: "sm",
            margin: "sm",
          },
          {
            type: "text",
            text: "「ID取得」ボタンでIDを確認 → Webサイトの設定ページで登録",
            wrap: true,
            size: "xs",
            color: "#888888",
            margin: "sm",
          },
          {
            type: "separator",
            margin: "lg",
          },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              {
                type: "text",
                text: "STEP 2",
                size: "xs",
                color: "#FFFFFF",
                weight: "bold",
                align: "center",
                flex: 0,
              },
            ],
            backgroundColor: "#2563EB",
            paddingAll: "4px",
            cornerRadius: "md",
            width: "60px",
            margin: "lg",
          },
          {
            type: "text",
            text: "名刺を撮影して送信",
            weight: "bold",
            size: "sm",
            margin: "sm",
          },
          {
            type: "text",
            text: "名刺の写真を送ると自動でテキストを読み取り、データベースに登録します",
            wrap: true,
            size: "xs",
            color: "#888888",
            margin: "sm",
          },
          {
            type: "separator",
            margin: "lg",
          },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              {
                type: "text",
                text: "STEP 3",
                size: "xs",
                color: "#FFFFFF",
                weight: "bold",
                align: "center",
                flex: 0,
              },
            ],
            backgroundColor: "#2563EB",
            paddingAll: "4px",
            cornerRadius: "md",
            width: "60px",
            margin: "lg",
          },
          {
            type: "text",
            text: "Webで検索・管理",
            weight: "bold",
            size: "sm",
            margin: "sm",
          },
          {
            type: "text",
            text: "登録した名刺はWebサイトでいつでも検索・編集できます",
            wrap: true,
            size: "xs",
            color: "#888888",
            margin: "sm",
          },
        ],
        paddingAll: "20px",
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "button",
            style: "primary",
            color: "#2563EB",
            action: {
              type: "cameraRoll",
              label: "名刺を登録する",
            },
            height: "sm",
          },
          {
            type: "box",
            layout: "horizontal",
            spacing: "sm",
            contents: [
              {
                type: "button",
                style: "secondary",
                action: {
                  type: "message",
                  label: "ID取得",
                  text: "id",
                },
                height: "sm",
                flex: 1,
              },
              {
                type: "button",
                style: "secondary",
                action: {
                  type: "camera",
                  label: "カメラ",
                },
                height: "sm",
                flex: 1,
              },
            ],
          },
          ...(siteUrl
            ? [
                {
                  type: "button" as const,
                  style: "link" as const,
                  action: {
                    type: "uri" as const,
                    label: "Webサイトを開く",
                    uri: siteUrl,
                  },
                  height: "sm" as const,
                },
              ]
            : []),
        ],
        paddingAll: "12px",
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
