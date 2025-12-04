"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageUpload } from "@/components/image-upload";
import { toast } from "sonner";

interface FormData {
  name: string;
  name_kana: string;
  company_name: string;
  department: string;
  position: string;
  email: string;
  phone: string;
  mobile: string;
  fax: string;
  postal_code: string;
  address: string;
  website: string;
  notes: string;
  image_url: string;
}

export function CardFormWithOCR() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    name_kana: "",
    company_name: "",
    department: "",
    position: "",
    email: "",
    phone: "",
    mobile: "",
    fax: "",
    postal_code: "",
    address: "",
    website: "",
    notes: "",
    image_url: "",
  });

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleOCRComplete = (result: {
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
  }) => {
    setFormData((prev) => ({
      ...prev,
      name: result.parsed.name ?? prev.name,
      name_kana: result.parsed.name_kana ?? prev.name_kana,
      company_name: result.parsed.company_name ?? prev.company_name,
      department: result.parsed.department ?? prev.department,
      position: result.parsed.position ?? prev.position,
      email: result.parsed.email ?? prev.email,
      phone: result.parsed.phone ?? prev.phone,
      mobile: result.parsed.mobile ?? prev.mobile,
      fax: result.parsed.fax ?? prev.fax,
      postal_code: result.parsed.postal_code ?? prev.postal_code,
      address: result.parsed.address ?? prev.address,
      website: result.parsed.website ?? prev.website,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("認証エラー");
        return;
      }

      const { error } = await (supabase as any).from("business_cards").insert({
        ...formData,
        user_id: user.id,
      });

      if (error) throw error;
      toast.success("名刺を登録しました");
      router.push("/cards");
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>名刺画像から読み取り</CardTitle>
          </CardHeader>
          <CardContent>
            <ImageUpload onOCRComplete={handleOCRComplete} />
          </CardContent>
        </Card>

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
                value={formData.name_kana}
                onChange={(e) => handleChange("name_kana", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company_name">会社名</Label>
              <Input
                id="company_name"
                value={formData.company_name}
                onChange={(e) => handleChange("company_name", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">部署</Label>
              <Input
                id="department"
                value={formData.department}
                onChange={(e) => handleChange("department", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="position">役職</Label>
              <Input
                id="position"
                value={formData.position}
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
                value={formData.email}
                onChange={(e) => handleChange("email", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">電話</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mobile">携帯</Label>
              <Input
                id="mobile"
                value={formData.mobile}
                onChange={(e) => handleChange("mobile", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fax">FAX</Label>
              <Input
                id="fax"
                value={formData.fax}
                onChange={(e) => handleChange("fax", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">ウェブサイト</Label>
              <Input
                id="website"
                type="url"
                value={formData.website}
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
                value={formData.postal_code}
                onChange={(e) => handleChange("postal_code", e.target.value)}
                placeholder="000-0000"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="address">住所</Label>
              <Input
                id="address"
                value={formData.address}
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
              className="w-full min-h-[100px] p-3 border rounded-md resize-none"
              value={formData.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              placeholder="メモを入力..."
            />
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button type="submit" disabled={loading}>
            {loading ? "保存中..." : "登録"}
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
