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
            <TableRow key={card.id} className="hover:bg-accent/50">
              <TableCell>
                <Link
                  href={`/cards/${card.id}`}
                  className="flex items-center gap-3"
                >
                  <span className="flex items-center justify-center w-8 h-8 shrink-0 rounded-full bg-primary/10 text-primary text-sm font-bold">
                    {(card.name || "?").charAt(0)}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium text-primary hover:underline truncate">
                      {card.name}
                    </span>
                    <span className="block text-sm text-muted-foreground sm:hidden truncate">
                      {card.company_name}
                    </span>
                  </span>
                </Link>
              </TableCell>
              <TableCell className="hidden sm:table-cell">{card.company_name || "-"}</TableCell>
              <TableCell className="hidden md:table-cell">{card.position || "-"}</TableCell>
              <TableCell className="hidden lg:table-cell">{card.email || "-"}</TableCell>
              <TableCell className="hidden sm:table-cell">{card.phone || card.mobile || "-"}</TableCell>
              <TableCell className="hidden md:table-cell tabular-nums text-muted-foreground">
                {new Date(card.created_at).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
