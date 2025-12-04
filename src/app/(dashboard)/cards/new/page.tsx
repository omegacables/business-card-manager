"use client";

import { CardFormWithOCR } from "@/components/card-form-with-ocr";

export default function NewCardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">名刺の新規登録</h1>
      <CardFormWithOCR />
    </div>
  );
}
