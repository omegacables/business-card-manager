import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { performOCR, parseBusinessCardWithAI } from "@/lib/ocr";
import { checkCanRegisterCard, checkCanSaveImage } from "@/lib/subscription";
import { validateOcrFile } from "@/lib/validation";
import { uploadCardImage } from "@/lib/storage";
import { logger } from "@/lib/logger";
import { getBearerUser } from "@/lib/user";

export async function POST(request: NextRequest) {
  try {
    const session = await auth0.getSession();
    let userEmail = session?.user?.email ?? null;

    if (!userEmail) {
      const bearer = await getBearerUser();
      userEmail = bearer?.email ?? null;
    }

    if (!userEmail) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check monthly registration limit BEFORE running OCR (save API costs).
    const { allowed, remaining, error: limitError } = await checkCanRegisterCard();
    if (!allowed) {
      return NextResponse.json(
        { error: limitError, limitReached: true },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("image") as File | null;

    const validation = validateOcrFile(file);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: validation.status });
    }

    const bytes = await file!.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString("base64");

    // OCR
    const ocrText = await performOCR(base64);
    if (!ocrText) {
      return NextResponse.json(
        { error: "画像から文字を検出できませんでした" },
        { status: 400 }
      );
    }

    // Parse with AI
    const parsedData = await parseBusinessCardWithAI(ocrText);

    // Pro-only image storage (uses signed URLs; bucket is private).
    const canSaveImages = await checkCanSaveImage();
    let imageUrl: string | null = null;

    if (canSaveImages) {
      const emailHash = Buffer.from(userEmail).toString("base64url").slice(0, 20);
      const contentType = file!.type || "image/jpeg";
      imageUrl = await uploadCardImage(emailHash, buffer, contentType);
    }

    return NextResponse.json({
      rawText: ocrText,
      parsed: parsedData,
      imageUrl,
      remaining: remaining !== null ? remaining - 1 : null,
      canSaveImages,
    });
  } catch (error) {
    logger.error("[ocr] unexpected error", error);
    return NextResponse.json(
      { error: "画像の解析に失敗しました。別の画像でお試しください。" },
      { status: 500 }
    );
  }
}
