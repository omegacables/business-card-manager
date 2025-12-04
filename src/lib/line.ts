import { Client, validateSignature, WebhookEvent, MessageAPIResponseBase } from "@line/bot-sdk";

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
  messages: { type: "text"; text: string }[]
): Promise<MessageAPIResponseBase> {
  return lineClient.replyMessage(replyToken, messages);
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
