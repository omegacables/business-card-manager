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
        label: "🔍 検索",
        text: "検索 ",
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

// Business card type for search results
export interface BusinessCardResult {
  id: string;
  name: string;
  company_name: string | null;
  department: string | null;
  position: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
}

// Create search result message
export function createSearchResultMessage(
  cards: BusinessCardResult[],
  query: string,
  siteUrl?: string
): FlexMessage {
  if (cards.length === 0) {
    return {
      type: "flex",
      altText: "検索結果: 該当なし",
      contents: {
        type: "bubble",
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: "検索結果",
              weight: "bold",
              size: "lg",
            },
            {
              type: "text",
              text: `「${query}」に該当する名刺は見つかりませんでした。`,
              wrap: true,
              size: "sm",
              color: "#888888",
              margin: "md",
            },
          ],
        },
      },
      quickReply: quickReplyButtons,
    };
  }

  // Show up to 5 results in carousel
  const bubbles = cards.slice(0, 5).map((card) => ({
    type: "bubble" as const,
    size: "kilo" as const,
    header: {
      type: "box" as const,
      layout: "vertical" as const,
      contents: [
        {
          type: "text" as const,
          text: card.name,
          weight: "bold" as const,
          size: "lg" as const,
          wrap: true,
        },
        ...(card.company_name
          ? [
              {
                type: "text" as const,
                text: card.company_name,
                size: "sm" as const,
                color: "#888888",
                wrap: true,
              },
            ]
          : []),
      ],
      paddingAll: "12px",
      backgroundColor: "#F8F9FA",
    },
    body: {
      type: "box" as const,
      layout: "vertical" as const,
      contents: [
        ...(card.position
          ? [
              {
                type: "box" as const,
                layout: "horizontal" as const,
                contents: [
                  {
                    type: "text" as const,
                    text: "役職",
                    size: "xs" as const,
                    color: "#888888",
                    flex: 0,
                  },
                  {
                    type: "text" as const,
                    text: card.position,
                    size: "sm" as const,
                    wrap: true,
                    margin: "md" as const,
                  },
                ],
              },
            ]
          : []),
        ...(card.phone
          ? [
              {
                type: "box" as const,
                layout: "horizontal" as const,
                contents: [
                  {
                    type: "text" as const,
                    text: "TEL",
                    size: "xs" as const,
                    color: "#888888",
                    flex: 0,
                  },
                  {
                    type: "text" as const,
                    text: card.phone,
                    size: "sm" as const,
                    margin: "md" as const,
                  },
                ],
                margin: "sm" as const,
              },
            ]
          : []),
        ...(card.mobile
          ? [
              {
                type: "box" as const,
                layout: "horizontal" as const,
                contents: [
                  {
                    type: "text" as const,
                    text: "携帯",
                    size: "xs" as const,
                    color: "#888888",
                    flex: 0,
                  },
                  {
                    type: "text" as const,
                    text: card.mobile,
                    size: "sm" as const,
                    margin: "md" as const,
                  },
                ],
                margin: "sm" as const,
              },
            ]
          : []),
        ...(card.email
          ? [
              {
                type: "box" as const,
                layout: "horizontal" as const,
                contents: [
                  {
                    type: "text" as const,
                    text: "Email",
                    size: "xs" as const,
                    color: "#888888",
                    flex: 0,
                  },
                  {
                    type: "text" as const,
                    text: card.email,
                    size: "xs" as const,
                    wrap: true,
                    margin: "md" as const,
                  },
                ],
                margin: "sm" as const,
              },
            ]
          : []),
      ],
      paddingAll: "12px",
      spacing: "sm",
    },
    footer: {
      type: "box" as const,
      layout: "horizontal" as const,
      spacing: "sm" as const,
      contents: [
        ...(card.phone
          ? [
              {
                type: "button" as const,
                style: "primary" as const,
                height: "sm" as const,
                action: {
                  type: "uri" as const,
                  label: "電話",
                  uri: `tel:${card.phone.replace(/[-\s]/g, "")}`,
                },
                flex: 1,
              },
            ]
          : []),
        ...(card.email
          ? [
              {
                type: "button" as const,
                style: "secondary" as const,
                height: "sm" as const,
                action: {
                  type: "uri" as const,
                  label: "メール",
                  uri: `mailto:${card.email}`,
                },
                flex: 1,
              },
            ]
          : []),
      ],
      paddingAll: "12px",
    },
  }));

  return {
    type: "flex",
    altText: `検索結果: ${cards.length}件`,
    contents: {
      type: "carousel",
      contents: bubbles,
    },
    quickReply: quickReplyButtons,
  };
}
