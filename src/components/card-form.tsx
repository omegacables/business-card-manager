"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import type { BusinessCard } from "@/types/database";

type CardFormData = Omit<BusinessCard, "id" | "user_id" | "created_at" | "updated_at">;

interface CardFormProps {
  initialData?: BusinessCard;
  mode: "create" | "edit";
}

export function CardForm({ initialData, mode }: CardFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<CardFormData>({
    name: initialData?.name ?? "",
    name_kana: initialData?.name_kana ?? "",
    company_name: initialData?.company_name ?? "",
    department: initialData?.department ?? "",
    position: initialData?.position ?? "",
    email: initialData?.email ?? "",
    phone: initialData?.phone ?? "",
    mobile: initialData?.mobile ?? "",
    fax: initialData?.fax ?? "",
    postal_code: initialData?.postal_code ?? "",
    address: initialData?.address ?? "",
    website: initialData?.website ?? "",
    notes: initialData?.notes ?? "",
    image_url: initialData?.image_url ?? "",
  });

  const handleChange = (field: keyof CardFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "create") {
        const res = await fetch("/api/cards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to create card");
        }

        toast.success("名刺を登録しました");
        router.push("/cards");
      } else {
        const res = await fetch(`/api/cards/${initialData!.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to update card");
        }

        toast.success("名刺を更新しました");
        router.push(`/cards/${initialData!.id}`);
      }

      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>基本情報</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">氏名 *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name_kana">氏名（カナ）</Label>
              <Input
                id="name_kana"
                value={formData.name_kana ?? ""}
                onChange={(e) => handleChange("name_kana", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company_name">会社名</Label>
              <Input
                id="company_name"
                value={formData.company_name ?? ""}
                onChange={(e) => handleChange("company_name", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">部署</Label>
              <Input
                id="department"
                value={formData.department ?? ""}
                onChange={(e) => handleChange("department", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="position">役職</Label>
              <Input
                id="position"
                value={formData.position ?? ""}
                onChange={(e) => handleChange("position", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>連絡先</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">メール</Label>
              <Input
                id="email"
                type="email"
                value={formData.email ?? ""}
                onChange={(e) => handleChange("email", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">電話</Label>
              <Input
                id="phone"
                value={formData.phone ?? ""}
                onChange={(e) => handleChange("phone", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mobile">携帯</Label>
              <Input
                id="mobile"
                value={formData.mobile ?? ""}
                onChange={(e) => handleChange("mobile", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fax">FAX</Label>
              <Input
                id="fax"
                value={formData.fax ?? ""}
                onChange={(e) => handleChange("fax", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">ウェブサイト</Label>
              <Input
                id="website"
                type="url"
                value={formData.website ?? ""}
                onChange={(e) => handleChange("website", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>住所</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="postal_code">郵便番号</Label>
              <Input
                id="postal_code"
                value={formData.postal_code ?? ""}
                onChange={(e) => handleChange("postal_code", e.target.value)}
                placeholder="000-0000"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="address">住所</Label>
              <Input
                id="address"
                value={formData.address ?? ""}
                onChange={(e) => handleChange("address", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>メモ</CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              id="notes"
              className="w-full min-h-[100px] p-3 border rounded-md resize-none text-base md:text-sm"
              value={formData.notes ?? ""}
              onChange={(e) => handleChange("notes", e.target.value)}
              placeholder="メモを入力..."
            />
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button type="submit" disabled={loading}>
            {loading ? "保存中..." : mode === "create" ? "登録" : "更新"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            キャンセル
          </Button>
        </div>
      </div>
    </form>
  );
}
