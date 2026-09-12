export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      analysis: {
        Row: {
          id: string
          title: string
          slug: string | null
          html_content: string
          created_at: string
          brand_id: string
          user_id: string
        }
        Insert: {
          id?: string
          title: string
          slug?: string | null
          html_content: string
          created_at?: string
          brand_id: string
          user_id: string
        }
        Update: {
          id?: string
          title?: string
          slug?: string | null
          html_content?: string
          created_at?: string
          brand_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analysis_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analysis_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      content_calendar: {
        Row: {
          created_at: string
          date: string
          description: string
          hashtags: string | null
          id: string
          media_prompt: string | null
          notes: string | null
          platforms: string
          sources: string | null
          ststus: boolean | null
          time: string
          topic: string
        }
        Insert: {
          created_at?: string
          date: string
          description: string
          hashtags?: string | null
          id?: string
          media_prompt?: string | null
          notes?: string | null
          platforms: string
          sources?: string | null
          ststus?: boolean | null
          time: string
          topic: string
        }
        Update: {
          created_at?: string
          date?: string
          description?: string
          hashtags?: string | null
          id?: string
          media_prompt?: string | null
          notes?: string | null
          platforms?: string
          sources?: string | null
          ststus?: boolean | null
          time?: string
          topic?: string
        }
        Relationships: []
      }
      "Data Scraped": {
        Row: {
          Encapsulations: Json[] | null
          id: number
        }
        Insert: {
          Encapsulations?: Json[] | null
          id?: number
        }
        Update: {
          Encapsulations?: Json[] | null
          id?: number
        }
        Relationships: []
      }
      post_errors: {
        Row: {
          error_detail: Json | null
          error_message: string | null
          id: number
          occurred_at: string | null
          post_id: number | null
        }
        Insert: {
          error_detail?: Json | null
          error_message?: string | null
          id?: number
          occurred_at?: string | null
          post_id?: number | null
        }
        Update: {
          error_detail?: Json | null
          error_message?: string | null
          id?: number
          occurred_at?: string | null
          post_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "post_errors_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_schedule: {
        Row: {
          created_at: string
          id: number
          post_id: number
          scheduled_at: string
          status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: number
          post_id: number
          scheduled_at: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: number
          post_id?: number
          scheduled_at?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_schedule_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          content: string
          created_at: string | null
          hashtags: string[] | null
          id: number
          image_prompt: string | null
          image_url: string | null
          platform: string
          scheduled_at: string | null
          status: string
          topic: string
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          hashtags?: string[] | null
          id?: number
          image_prompt?: string | null
          image_url?: string | null
          platform: string
          scheduled_at?: string | null
          status?: string
          topic: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          hashtags?: string[] | null
          id?: number
          image_prompt?: string | null
          image_url?: string | null
          platform?: string
          scheduled_at?: string | null
          status?: string
          topic?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      primary_content_calendar: {
        Row: {
          created_at: string
          date: string
          description: string
          hashtags: string | null
          id: string
          idx: string
          media_prompt: string | null
          media_url: string | null
          notes: string | null
          platforms: string
          post_status: Database["public"]["Enums"]["post_status"]
          sources: string | null
          time: string
          topic: string
        }
        Insert: {
          created_at?: string
          date: string
          description: string
          hashtags?: string | null
          id?: string
          idx: string
          media_prompt?: string | null
          media_url?: string | null
          notes?: string | null
          platforms: string
          post_status?: Database["public"]["Enums"]["post_status"]
          sources?: string | null
          time: string
          topic: string
        }
        Update: {
          created_at?: string
          date?: string
          description?: string
          hashtags?: string | null
          id?: string
          idx?: string
          media_prompt?: string | null
          media_url?: string | null
          notes?: string | null
          platforms?: string
          post_status?: Database["public"]["Enums"]["post_status"]
          sources?: string | null
          time?: string
          topic?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          id: string
          name: string
          description: string | null
          created_at: string
          updated_at: string
          price: string | null
          is_active: boolean
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          created_at?: string
          updated_at?: string
          price?: string | null
          is_active?: boolean
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          created_at?: string
          updated_at?: string
          price?: string | null
          is_active?: boolean
        }
        Relationships: []
      }
      user_product_access: {
        Row: {
          id: string
          user_id: string
          product_id: string
          granted_at: string
        }
        Insert: {
          id?: string
          user_id: string
          product_id: string
          granted_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          product_id?: string
          granted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_product_access_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_product_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          }
        ]
      }
      published_posts: {
        Row: {
          id: number
          platform_post_id: string | null
          post_id: number | null
          published_at: string | null
          scheduled_for: string | null
          status: string
        }
        Insert: {
          id?: number
          platform_post_id?: string | null
          post_id?: number | null
          published_at?: string | null
          scheduled_for?: string | null
          status?: string
        }
        Update: {
          id?: number
          platform_post_id?: string | null
          post_id?: number | null
          published_at?: string | null
          scheduled_for?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "published_posts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      rejected_posts: {
        Row: {
          id: number
          post_id: number | null
          rejected_at: string | null
          rejection_reason: string | null
        }
        Insert: {
          id?: number
          post_id?: number | null
          rejected_at?: string | null
          rejection_reason?: string | null
        }
        Update: {
          id?: number
          post_id?: number | null
          rejected_at?: string | null
          rejection_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rejected_posts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_posting_strategies: {
        Row: {
          best_times_by_day: Json
          cadence: Json
          category_names: Json
          created_at: string
          day_playbooks: Json
          generation_rules: Json | null
          goal: string
          id: string
          js_code: string | null
          kpi_plan: Json
          libraries: Json
          name: string
          pillars: Json
          platform: string
          posting_plan: Json
          raw_object: Json | null
          raw_text: string | null
          region_timezone: string
          schedule_templates: Json | null
          scope_default: string
          slug: string
          topics_library: Json | null
          updated_at: string
          version: string
        }
        Insert: {
          best_times_by_day: Json
          cadence: Json
          category_names: Json
          created_at?: string
          day_playbooks: Json
          generation_rules?: Json | null
          goal: string
          id?: string
          js_code?: string | null
          kpi_plan: Json
          libraries: Json
          name: string
          pillars: Json
          platform: string
          posting_plan: Json
          raw_object?: Json | null
          raw_text?: string | null
          region_timezone: string
          schedule_templates?: Json | null
          scope_default: string
          slug: string
          topics_library?: Json | null
          updated_at?: string
          version: string
        }
        Update: {
          best_times_by_day?: Json
          cadence?: Json
          category_names?: Json
          created_at?: string
          day_playbooks?: Json
          generation_rules?: Json | null
          goal?: string
          id?: string
          js_code?: string | null
          kpi_plan?: Json
          libraries?: Json
          name?: string
          pillars?: Json
          platform?: string
          posting_plan?: Json
          raw_object?: Json | null
          raw_text?: string | null
          region_timezone?: string
          schedule_templates?: Json | null
          scope_default?: string
          slug?: string
          topics_library?: Json | null
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      brands: {
        Row: {
          brand_colors: Json | null
          created_at: string
          id: string
          logo: string | null
          name: string
          niche: string | null
          target_market: string | null
          timezone: string | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          brand_colors?: Json | null
          created_at?: string
          id?: string
          logo?: string | null
          name: string
          niche?: string | null
          target_market?: string | null
          timezone?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          brand_colors?: Json | null
          created_at?: string
          id?: string
          logo?: string | null
          name?: string
          niche?: string | null
          target_market?: string | null
          timezone?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      social_accounts: {
        Row: {
          auth: Json | null
          brand_id: string | null
          created_at: string
          created_by: string | null
          external_id: string | null
          handle: string
          id: string
          is_active: boolean
          meta: Json | null
          provider: string
          updated_at: string
          linkedin_user_id: string | null
          linkedin_organization_id: string | null
          linkedin_organization_name: string | null
          linkedin_organization_type: string | null
          linkedin_organization_vanity_name: string | null
          linkedin_permissions: Json | null
        }
        Insert: {
          auth?: Json | null
          brand_id?: string | null
          created_at?: string
          created_by?: string | null
          external_id?: string | null
          handle: string
          id?: string
          is_active?: boolean
          meta?: Json | null
          provider: string
          updated_at?: string
          linkedin_user_id?: string | null
          linkedin_organization_id?: string | null
          linkedin_organization_name?: string | null
          linkedin_organization_type?: string | null
          linkedin_organization_vanity_name?: string | null
          linkedin_permissions?: Json | null
        }
        Update: {
          auth?: Json | null
          brand_id?: string | null
          created_at?: string
          created_by?: string | null
          external_id?: string | null
          handle?: string
          id?: string
          is_active?: boolean
          meta?: Json | null
          provider?: string
          updated_at?: string
          linkedin_user_id?: string | null
          linkedin_organization_id?: string | null
          linkedin_organization_name?: string | null
          linkedin_organization_type?: string | null
          linkedin_organization_vanity_name?: string | null
          linkedin_permissions?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "sa_brand_fk"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      linkedin_organizations: {
        Row: {
          id: string
          linkedin_user_id: string
          organization_id: string
          organization_name: string
          organization_type: string
          vanity_name: string | null
          logo_url: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          linkedin_user_id: string
          organization_id: string
          organization_name: string
          organization_type: string
          vanity_name?: string | null
          logo_url?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          linkedin_user_id?: string
          organization_id?: string
          organization_name?: string
          organization_type?: string
          vanity_name?: string | null
          logo_url?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      strategies: {
        Row: {
          "Analytics Data": string | null
          best_times_by_day: Json
          cadence: Json
          category_names: Json
          created_at: string
          day_playbooks: Json
          id: string
          kpi_plan: Json
          libraries: Json
          platform: string | null
          posting_plan: Json
          profile_url: string | null
          strategy_name: string | null
          updated_at: string
        }
        Insert: {
          "Analytics Data"?: string | null
          best_times_by_day?: Json
          cadence?: Json
          category_names?: Json
          created_at?: string
          day_playbooks?: Json
          id?: string
          kpi_plan?: Json
          libraries?: Json
          platform?: string | null
          posting_plan?: Json
          profile_url?: string | null
          strategy_name?: string | null
          updated_at?: string
        }
        Update: {
          "Analytics Data"?: string | null
          best_times_by_day?: Json
          cadence?: Json
          category_names?: Json
          created_at?: string
          day_playbooks?: Json
          id?: string
          kpi_plan?: Json
          libraries?: Json
          platform?: string | null
          posting_plan?: Json
          profile_url?: string | null
          strategy_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      genie_bots: {
        Row: {
          id: string
          owner_user_id: string
          name: string
          company_name: string
          website_url: string | null
          phone_number: string
          goal: string | null
          background: string | null
          welcome_message: string | null
          instruction_voice: string | null
          script: string | null
          voice: string
          language: string | null
          agent_type: string | null
          tone: string | null
          model: string
          background_noise: string | null
          max_timeout: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_user_id: string
          name: string
          company_name: string
          website_url?: string | null
          phone_number: string
          goal?: string | null
          background?: string | null
          welcome_message?: string | null
          instruction_voice?: string | null
          script?: string | null
          voice: string
          language?: string | null
          agent_type?: string | null
          tone?: string | null
          model: string
          background_noise?: string | null
          max_timeout?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_user_id?: string
          name?: string
          company_name?: string
          website_url?: string | null
          phone_number?: string
          goal?: string | null
          background?: string | null
          welcome_message?: string | null
          instruction_voice?: string | null
          script?: string | null
          voice?: string
          language?: string | null
          agent_type?: string | null
          tone?: string | null
          model?: string
          background_noise?: string | null
          max_timeout?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      post_status: "draft" | "ready" | "scheduled" | "published" | "archived"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      post_status: ["draft", "ready", "scheduled", "published", "archived"],
    },
  },
} as const

