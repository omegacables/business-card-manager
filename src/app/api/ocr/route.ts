import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { createAdminClient } from "@/lib/auth";
import { performOCR, parseBusinessCardWithAI } from "@/lib/ocr";
import { checkCanRegisterCard, checkCanSaveImage } from "@/lib/subscription";

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const session = await auth0.getSession();
    const userEmail = session?.user?.email;

    if (!userEmail) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();

    // Check registration limit
    const { allowed, remaining, error: limitError } = await checkCanRegisterCard();
    if (!allowed) {
      return NextResponse.json(
        { error: limitError, limitReached: true },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("image") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString("base64");

    // Perform OCR
    const ocrText = await performOCR(base64);

    if (!ocrText) {
      return NextResponse.json(
        { error: "No text found in image" },
        { status: 400 }
      );
    }

    // Parse the OCR text with AI
    const parsedData = await parseBusinessCardWithAI(ocrText);

    // Check if user can save images (Pro plan only)
    const canSaveImages = await checkCanSaveImage();
    let imageUrl: string | null = null;

    if (canSaveImages) {
      // Upload image to Supabase Storage (use email hash for folder name)
      const emailHash = Buffer.from(userEmail).toString("base64url").slice(0, 20);
      const fileName = `${emailHash}/${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("card-images")
        .upload(fileName, buffer, {
          contentType: file.type || "image/jpeg",
          upsert: false,
        });

      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from("card-images")
          .getPublicUrl(fileName);
        imageUrl = urlData.publicUrl;
      } else {
        console.error("Image upload error:", uploadError);
      }
    }

    return NextResponse.json({
      rawText: ocrText,
      parsed: parsedData,
      imageUrl,
      remaining: remaining !== null ? remaining - 1 : null,
      canSaveImages,
    });
  } catch (error) {
    console.error("OCR error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "OCR failed" },
      { status: 500 }
    );
  }
}
