/**
 * Centralized Zod schemas for API input validation.
 */
import { z } from "zod";

// Generic sanitized string (trims and enforces length).
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null));

// Business card create/update payload.
export const cardInputSchema = z.object({
  name: text(100).min(1, "名前は必須です"),
  name_kana: optionalText(100),
  company_name: optionalText(200),
  department: optionalText(200),
  position: optionalText(100),
  email: z
    .string()
    .trim()
    .email("メールアドレスの形式が不正です")
    .max(200)
    .nullable()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  phone: optionalText(30),
  mobile: optionalText(30),
  fax: optionalText(30),
  postal_code: optionalText(20),
  address: optionalText(500),
  website: optionalText(300),
  notes: optionalText(2000),
  image_url: z
    .string()
    .trim()
    .url()
    .max(1000)
    .nullable()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export type CardInput = z.infer<typeof cardInputSchema>;

// Sanitize a free-form search query to avoid PostgREST filter injection.
// Removes metacharacters that could break out of `.or()` / `.ilike()` filters.
export function sanitizeSearchQuery(raw: string): string {
  return raw
    .replace(/[,()%\\]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}

// OCR endpoint: validate file metadata.
export const ocrFileConstraints = {
  maxBytes: 10 * 1024 * 1024, // 10 MB
  allowedMimeTypes: new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]),
};

export function validateOcrFile(file: File | null | undefined): {
  ok: true;
} | {
  ok: false;
  error: string;
  status: number;
} {
  if (!file) {
    return { ok: false, error: "画像が選択されていません", status: 400 };
  }
  if (file.size > ocrFileConstraints.maxBytes) {
    return { ok: false, error: "画像サイズは10MB以下にしてください", status: 413 };
  }
  const mime = (file.type || "").toLowerCase();
  if (mime && !ocrFileConstraints.allowedMimeTypes.has(mime)) {
    return { ok: false, error: "JPEG / PNG / WebP 形式のみ対応しています", status: 400 };
  }
  return { ok: true };
}
