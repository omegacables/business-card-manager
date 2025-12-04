import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { performOCR, parseBusinessCardText } from "@/lib/ocr";

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("image") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");

    // Perform OCR
    const ocrText = await performOCR(base64);

    if (!ocrText) {
      return NextResponse.json(
        { error: "No text found in image" },
        { status: 400 }
      );
    }

    // Parse the OCR text
    const parsedData = parseBusinessCardText(ocrText);

    return NextResponse.json({
      rawText: ocrText,
      parsed: parsedData,
    });
  } catch (error) {
    console.error("OCR error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "OCR failed" },
      { status: 500 }
    );
  }
}
