"use client";

import { Button } from "@/components/ui/button";

interface ExportButtonsProps {
  cardId: string;
}

export function ExportVCardButton({ cardId }: ExportButtonsProps) {
  const handleExport = () => {
    window.location.href = `/api/export/vcard/${cardId}`;
  };

  return (
    <Button variant="outline" onClick={handleExport} className="gap-1">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
      <span className="hidden sm:inline">連絡先に登録</span>
      <span className="sm:hidden">連絡先</span>
    </Button>
  );
}

export function ExportCSVButton() {
  const handleExport = () => {
    window.location.href = "/api/export/csv";
  };

  return (
    <Button variant="outline" onClick={handleExport}>
      CSV出力
    </Button>
  );
}
