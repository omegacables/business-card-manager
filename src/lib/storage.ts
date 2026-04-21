/**
 * Storage helpers for the private `card-images` bucket.
 * Use createSignedUrl instead of getPublicUrl now that the bucket is private.
 */

import { createAdminClient } from "@/lib/auth";
import { logger } from "@/lib/logger";

const BUCKET = "card-images";
// 1 year — long enough that DB-stored URLs don't expire during normal use.
const DEFAULT_SIGN_TTL = 60 * 60 * 24 * 365;

/**
 * Upload a buffer and return a signed URL.
 */
export async function uploadCardImage(
  folder: string,
  buffer: Buffer,
  contentType: string = "image/jpeg"
): Promise<string | null> {
  const supabase = createAdminClient();
  const fileName = `${folder}/${Date.now()}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, buffer, { contentType, upsert: false });

  if (uploadError) {
    logger.error("[storage] upload failed", uploadError.message);
    return null;
  }

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(fileName, DEFAULT_SIGN_TTL);

  if (error || !data?.signedUrl) {
    logger.error("[storage] sign failed", error?.message);
    return null;
  }
  return data.signedUrl;
}

/**
 * Extract the object path inside the bucket from a stored URL.
 * Works for both public and signed Supabase URLs.
 */
export function extractCardImagePath(urlOrPath: string | null | undefined): string | null {
  if (!urlOrPath) return null;
  // If someone stored just the path, pass it through.
  if (!urlOrPath.startsWith("http")) return urlOrPath;

  // signed URLs:  /storage/v1/object/sign/card-images/<path>?token=...
  // public URLs:  /storage/v1/object/public/card-images/<path>
  const match = urlOrPath.match(/\/(?:sign|public)\/card-images\/([^?]+)/);
  return match?.[1] ?? null;
}

/**
 * Refresh the signed URL for an existing stored path.
 * Returns null if the URL could not be generated.
 */
export async function refreshCardImageSignedUrl(
  urlOrPath: string,
  ttlSeconds: number = 60 * 60
): Promise<string | null> {
  const path = extractCardImagePath(urlOrPath);
  if (!path) return null;

  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, ttlSeconds);

  if (error || !data?.signedUrl) {
    logger.error("[storage] refresh sign failed", error?.message);
    return null;
  }
  return data.signedUrl;
}
