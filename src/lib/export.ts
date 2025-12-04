import type { BusinessCard } from "@/types/database";

export function generateVCard(card: BusinessCard): string {
  const lines: string[] = [
    "BEGIN:VCARD",
    "VERSION:3.0",
  ];

  // Name
  const nameParts = card.name.split(/\s+/);
  if (nameParts.length >= 2) {
    lines.push(`N:${nameParts[nameParts.length - 1]};${nameParts.slice(0, -1).join(" ")};;;`);
  } else {
    lines.push(`N:${card.name};;;;`);
  }
  lines.push(`FN:${card.name}`);

  // Organization
  if (card.company_name) {
    const org = [card.company_name, card.department].filter(Boolean).join(";");
    lines.push(`ORG:${org}`);
  }

  // Title/Position
  if (card.position) {
    lines.push(`TITLE:${card.position}`);
  }

  // Email
  if (card.email) {
    lines.push(`EMAIL;TYPE=WORK:${card.email}`);
  }

  // Phone numbers
  if (card.phone) {
    lines.push(`TEL;TYPE=WORK:${card.phone}`);
  }
  if (card.mobile) {
    lines.push(`TEL;TYPE=CELL:${card.mobile}`);
  }
  if (card.fax) {
    lines.push(`TEL;TYPE=FAX:${card.fax}`);
  }

  // Address
  if (card.address || card.postal_code) {
    lines.push(`ADR;TYPE=WORK:;;${card.address || ""};;;;;${card.postal_code || ""}`);
  }

  // Website
  if (card.website) {
    lines.push(`URL:${card.website}`);
  }

  // Notes
  if (card.notes) {
    lines.push(`NOTE:${card.notes.replace(/\n/g, "\\n")}`);
  }

  lines.push("END:VCARD");

  return lines.join("\r\n");
}

export function generateCSV(cards: BusinessCard[]): string {
  const headers = [
    "名前",
    "名前（カナ）",
    "会社名",
    "部署",
    "役職",
    "メール",
    "電話",
    "携帯",
    "FAX",
    "郵便番号",
    "住所",
    "ウェブサイト",
    "メモ",
    "登録日",
  ];

  const rows = cards.map((card) => [
    card.name,
    card.name_kana || "",
    card.company_name || "",
    card.department || "",
    card.position || "",
    card.email || "",
    card.phone || "",
    card.mobile || "",
    card.fax || "",
    card.postal_code || "",
    card.address || "",
    card.website || "",
    card.notes?.replace(/\n/g, " ") || "",
    new Date(card.created_at).toLocaleDateString("ja-JP"),
  ]);

  const escapeCSV = (value: string) => {
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  const csvContent = [
    headers.map(escapeCSV).join(","),
    ...rows.map((row) => row.map(escapeCSV).join(",")),
  ].join("\n");

  // Add BOM for Excel compatibility
  return "\uFEFF" + csvContent;
}
