export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          display_name: string | null;
          line_user_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          display_name?: string | null;
          line_user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          display_name?: string | null;
          line_user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      business_cards: {
        Row: {
          id: string;
          user_id: string;
          company_name: string | null;
          department: string | null;
          position: string | null;
          name: string;
          name_kana: string | null;
          email: string | null;
          phone: string | null;
          mobile: string | null;
          fax: string | null;
          postal_code: string | null;
          address: string | null;
          website: string | null;
          notes: string | null;
          image_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          company_name?: string | null;
          department?: string | null;
          position?: string | null;
          name: string;
          name_kana?: string | null;
          email?: string | null;
          phone?: string | null;
          mobile?: string | null;
          fax?: string | null;
          postal_code?: string | null;
          address?: string | null;
          website?: string | null;
          notes?: string | null;
          image_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          company_name?: string | null;
          department?: string | null;
          position?: string | null;
          name?: string;
          name_kana?: string | null;
          email?: string | null;
          phone?: string | null;
          mobile?: string | null;
          fax?: string | null;
          postal_code?: string | null;
          address?: string | null;
          website?: string | null;
          notes?: string | null;
          image_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      tags: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          color: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          color?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          color?: string | null;
          created_at?: string;
        };
      };
      card_tags: {
        Row: {
          card_id: string;
          tag_id: string;
          created_at: string;
        };
        Insert: {
          card_id: string;
          tag_id: string;
          created_at?: string;
        };
        Update: {
          card_id?: string;
          tag_id?: string;
          created_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type BusinessCard = Database["public"]["Tables"]["business_cards"]["Row"];
export type Tag = Database["public"]["Tables"]["tags"]["Row"];
export type CardTag = Database["public"]["Tables"]["card_tags"]["Row"];

export type Plan = "free" | "pro";

// 活動記録（アポ・商談・会話履歴）。migration 004 で追加。
export type ActivityType = "meeting" | "call" | "email" | "line" | "note" | "task";
export type ActivitySource = "manual" | "line" | "calendar" | "ai";

export interface Activity {
  id: string;
  user_id: string;
  card_id: string;
  type: ActivityType;
  title: string | null;
  content: string | null;
  occurred_at: string;
  source: ActivitySource;
  created_at: string;
}
export type SubscriptionStatus = "active" | "canceled" | "past_due";

export interface Subscription {
  id: string;
  user_id: string;
  plan: Plan;
  status: SubscriptionStatus;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

export interface MonthlyUsage {
  id: string;
  user_id: string;
  year_month: string;
  cards_registered: number;
  created_at: string;
  updated_at: string;
}
