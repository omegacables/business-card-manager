"use client";

import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { BusinessCard } from "@/types/database";

export function CardList({ cards }: { cards: BusinessCard[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>名前</TableHead>
          <TableHead>会社名</TableHead>
          <TableHead>役職</TableHead>
          <TableHead>メール</TableHead>
          <TableHead>電話</TableHead>
          <TableHead>登録日</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {cards.map((card) => (
          <TableRow key={card.id}>
            <TableCell>
              <Link
                href={`/cards/${card.id}`}
                className="font-medium text-blue-600 hover:underline"
              >
                {card.name}
              </Link>
            </TableCell>
            <TableCell>{card.company_name || "-"}</TableCell>
            <TableCell>{card.position || "-"}</TableCell>
            <TableCell>{card.email || "-"}</TableCell>
            <TableCell>{card.phone || card.mobile || "-"}</TableCell>
            <TableCell>
              {new Date(card.created_at).toLocaleDateString("ja-JP")}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
