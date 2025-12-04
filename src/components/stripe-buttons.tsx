"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PLAN_PRICES } from "@/lib/plans";

interface CheckoutButtonProps {
  interval: "monthly" | "yearly";
}

export function CheckoutButton({ interval }: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "エラーが発生しました");
      }
    } catch (error) {
      console.error("Checkout error:", error);
      alert("エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const price = interval === "yearly" ? PLAN_PRICES.pro.yearly : PLAN_PRICES.pro.monthly;
  const label = interval === "yearly" ? `年払い ¥${price}/年` : `月払い ¥${price}/月`;

  return (
    <Button
      onClick={handleCheckout}
      disabled={loading}
      className="w-full"
      variant={interval === "monthly" ? "default" : "outline"}
    >
      {loading ? "処理中..." : label}
    </Button>
  );
}

export function PortalButton() {
  const [loading, setLoading] = useState(false);

  const handlePortal = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/stripe/portal", {
        method: "POST",
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "エラーが発生しました");
      }
    } catch (error) {
      console.error("Portal error:", error);
      alert("エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handlePortal}
      disabled={loading}
      variant="outline"
      className="w-full"
    >
      {loading ? "処理中..." : "プランを管理"}
    </Button>
  );
}
