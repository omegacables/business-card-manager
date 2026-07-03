/**
 * Generic AI text helpers (Gemini, falling back to OpenAI when configured).
 * Used for conversation summarization and follow-up email drafting.
 */

import { logger } from "@/lib/logger";

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
  error?: { message: string };
}

async function generateWithGemini(
  prompt: string,
  maxOutputTokens: number = 1024
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens },
        }),
      }
    );

    if (!response.ok) {
      logger.error("[ai] Gemini API error:", response.statusText);
      return null;
    }

    const data: GeminiResponse = await response.json();
    if (data.error) {
      logger.error("[ai] Gemini error:", data.error.message);
      return null;
    }
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
  } catch (error) {
    logger.error("[ai] Gemini request failed:", error);
    return null;
  }
}

async function generateWithOpenAI(
  prompt: string,
  maxTokens: number = 1024
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: maxTokens,
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      logger.error("[ai] OpenAI API error:", response.statusText);
      return null;
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content ?? null;
  } catch (error) {
    logger.error("[ai] OpenAI request failed:", error);
    return null;
  }
}

/** Generate text with Gemini, falling back to OpenAI. Null if both unavailable. */
export async function generateText(
  prompt: string,
  maxTokens: number = 1024
): Promise<string | null> {
  return (
    (await generateWithGemini(prompt, maxTokens)) ??
    (await generateWithOpenAI(prompt, maxTokens))
  );
}

function extractJson(text: string): string {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return (match?.[1] ?? text).trim();
}

export interface ConversationSummary {
  title: string;
  summary: string;
  type: "meeting" | "call" | "email" | "line" | "note" | "task";
  tasks: string[];
}

const SUMMARY_PROMPT = `あなたは営業アシスタントです。以下はユーザーが特定の相手とやり取りした会話やメモの記録です。
内容を分析して、JSON形式で返してください。

抽出する項目：
- title: 記録の見出し（30文字以内。例:「新規案件の打ち合わせ日程調整」）
- summary: 要点の要約（箇条書き風に「・」区切りで3〜6行。商談の内容、決まったこと、相手の反応など）
- type: 内容の分類。次のいずれか1つ: "meeting"(打ち合わせ/商談) "call"(電話) "email"(メール) "line"(LINEでの会話) "note"(その他メモ) "task"(依頼・TODO中心)
- tasks: 自分がやるべきタスクや宿題があれば配列で（なければ空配列）

JSONのみを返してください。説明は不要です。

記録:
`;

/** Summarize forwarded conversation text into a structured activity. */
export async function summarizeConversation(
  text: string
): Promise<ConversationSummary | null> {
  const raw = await generateText(SUMMARY_PROMPT + text.slice(0, 8000), 1024);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(extractJson(raw)) as Partial<ConversationSummary>;
    if (!parsed.summary) return null;
    const validTypes = ["meeting", "call", "email", "line", "note", "task"];
    return {
      title: (parsed.title || "会話の記録").slice(0, 60),
      summary: parsed.summary,
      type: validTypes.includes(parsed.type ?? "")
        ? (parsed.type as ConversationSummary["type"])
        : "line",
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks.map(String).slice(0, 10) : [],
    };
  } catch (error) {
    logger.error("[ai] summary JSON parse failed:", error);
    return null;
  }
}

export type FollowUpTone = "formal" | "casual";

/** Draft a follow-up email based on the contact and their activity timeline. */
export async function draftFollowUpEmail(params: {
  contactName: string;
  companyName?: string | null;
  position?: string | null;
  timeline: string;
  tone: FollowUpTone;
  senderName?: string | null;
}): Promise<string | null> {
  const toneInstruction =
    params.tone === "casual"
      ? "口調: 丁寧だが堅すぎない、親しみのあるビジネスカジュアル（既に関係性がある相手向け）"
      : "口調: 正式なビジネス敬語（社外の目上の方に失礼のない文面）";

  const prompt = `あなたは日本のビジネスメール作成の専門家です。以下の相手に送る「追いメール（フォローアップメール）」の下書きを作成してください。

相手: ${params.contactName}様${params.companyName ? `（${params.companyName}${params.position ? " " + params.position : ""}）` : ""}
差出人: ${params.senderName || "（ユーザー本人）"}

これまでのやり取りの記録（新しい順）:
${params.timeline || "（記録なし。名刺交換のお礼と今後のご縁につなげる内容にしてください）"}

${toneInstruction}

要件:
- 件名と本文を作成する
- 直近のやり取りの内容に自然に触れる
- 押し付けがましくない、返信しやすい文面にする
- 本文は300字程度まで
- プレースホルダー（【】や[]）は使わず、そのまま送れる文面にする

出力形式（この形式のみ、説明不要）:
件名: ...

本文:
...`;

  return generateText(prompt, 1024);
}
