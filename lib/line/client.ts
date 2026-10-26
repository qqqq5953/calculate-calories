import { messagingApi } from "@line/bot-sdk";
import { env } from "@/lib/env";

let client: messagingApi.MessagingApiClient | undefined;
let blobClient: messagingApi.MessagingApiBlobClient | undefined;

export function lineClient() {
  client ??= new messagingApi.MessagingApiClient({
    channelAccessToken: env.lineChannelAccessToken(),
  });
  return client;
}

export function lineBlobClient() {
  blobClient ??= new messagingApi.MessagingApiBlobClient({
    channelAccessToken: env.lineChannelAccessToken(),
  });
  return blobClient;
}

export async function reply(replyToken: string, messages: messagingApi.Message[]) {
  // LINE 一次最多 5 則
  await lineClient().replyMessage({ replyToken, messages: messages.slice(0, 5) });
}

export function text(
  t: string,
  quickReply?: messagingApi.QuickReply,
): messagingApi.TextMessage {
  return quickReply ? { type: "text", text: t, quickReply } : { type: "text", text: t };
}

/** 聊天室顯示「…」動畫，AI 辨識需要幾秒鐘 */
export async function showLoading(userId: string, seconds = 20) {
  try {
    await lineClient().showLoadingAnimation({ chatId: userId, loadingSeconds: seconds });
  } catch (err) {
    console.warn("showLoadingAnimation failed", err);
  }
}

export async function downloadMessageContent(messageId: string): Promise<Buffer> {
  const stream = await lineBlobClient().getMessageContent(messageId);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}
