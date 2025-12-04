"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

interface OCRResult {
  rawText: string;
  parsed: {
    name: string | null;
    name_kana: string | null;
    company_name: string | null;
    department: string | null;
    position: string | null;
    email: string | null;
    phone: string | null;
    mobile: string | null;
    fax: string | null;
    postal_code: string | null;
    address: string | null;
    website: string | null;
  };
}

interface ImageUploadProps {
  onOCRComplete: (result: OCRResult) => void;
}

export function ImageUpload({ onOCRComplete }: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("画像ファイルを選択してください");
      return;
    }

    // Preview
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    // OCR
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);

      const response = await fetch("/api/ocr", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "OCR failed");
      }

      const result: OCRResult = await response.json();
      onOCRComplete(result);
      toast.success("名刺を読み取りました");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "OCR処理に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [onOCRComplete]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  return (
    <Card>
      <CardContent className="pt-6">
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive
              ? "border-primary bg-primary/10"
              : "border-border hover:border-primary/50"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
        >
          {preview ? (
            <div className="space-y-4">
              <img
                src={preview}
                alt="名刺プレビュー"
                className="max-h-48 mx-auto rounded-md"
              />
              {loading && (
                <p className="text-muted-foreground">読み取り中...</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-4xl">📷</div>
              <p className="text-muted-foreground">
                名刺の画像をドラッグ＆ドロップ
                <br />
                または
              </p>
              <label>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleChange}
                  disabled={loading}
                />
                <Button type="button" variant="outline" disabled={loading} asChild>
                  <span>ファイルを選択</span>
                </Button>
              </label>
            </div>
          )}
        </div>

        {preview && !loading && (
          <div className="mt-4 text-center">
            <label>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleChange}
              />
              <Button type="button" variant="outline" size="sm" asChild>
                <span>別の画像を選択</span>
              </Button>
            </label>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
