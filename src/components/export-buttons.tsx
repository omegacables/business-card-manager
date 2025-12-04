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
    <Button variant="outline" onClick={handleExport}>
      vCard
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
