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
