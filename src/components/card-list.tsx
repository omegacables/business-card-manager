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
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>名前</TableHead>
            <TableHead className="hidden sm:table-cell">会社名</TableHead>
            <TableHead className="hidden md:table-cell">役職</TableHead>
            <TableHead className="hidden lg:table-cell">メール</TableHead>
            <TableHead className="hidden sm:table-cell">電話</TableHead>
            <TableHead className="hidden md:table-cell">登録日</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cards.map((card) => (
            <TableRow key={card.id}>
              <TableCell>
                <Link
                  href={`/cards/${card.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {card.name}
                </Link>
                <p className="text-sm text-muted-foreground sm:hidden">
                  {card.company_name}
                </p>
              </TableCell>
              <TableCell className="hidden sm:table-cell">{card.company_name || "-"}</TableCell>
              <TableCell className="hidden md:table-cell">{card.position || "-"}</TableCell>
              <TableCell className="hidden lg:table-cell">{card.email || "-"}</TableCell>
              <TableCell className="hidden sm:table-cell">{card.phone || card.mobile || "-"}</TableCell>
              <TableCell className="hidden md:table-cell">
                {new Date(card.created_at).toLocaleDateString("ja-JP")}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
