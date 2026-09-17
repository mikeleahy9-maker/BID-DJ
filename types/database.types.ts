/**
 * Auto-generated database types from Supabase.
 * 
 * To regenerate these types, run:
 * npx supabase gen types typescript --project-id your_project_id > types/database.types.ts
 * 
 * This file will be updated as the database schema evolves.
 * Do not manually edit these types - they are generated.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      // Tables will be auto-generated here
      profiles: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          email: string;
          display_name: string | null;
          avatar_url: string | null;
          role: "guest" | "dj_owner" | "dj_helper" | null;
        };
        Insert: {
          id: string;
          created_at?: string;
          updated_at?: string;
          email: string;
          display_name?: string | null;
          avatar_url?: string | null;
          role?: "guest" | "dj_owner" | "dj_helper" | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          email?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          role?: "guest" | "dj_owner" | "dj_helper" | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: "guest" | "dj_owner" | "dj_helper";
    };
    CompositeTypes: Record<string, never>;
  };
};
