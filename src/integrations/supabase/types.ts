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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      api_keys: {
        Row: {
          bonus_credits: number
          created_at: string
          daily_limit: number
          id: string
          is_active: boolean
          key_hash: string
          key_prefix: string
          key_value: string | null
          last_used_at: string | null
          name: string
          tier: string
          user_id: string
        }
        Insert: {
          bonus_credits?: number
          created_at?: string
          daily_limit?: number
          id?: string
          is_active?: boolean
          key_hash: string
          key_prefix: string
          key_value?: string | null
          last_used_at?: string | null
          name?: string
          tier?: string
          user_id: string
        }
        Update: {
          bonus_credits?: number
          created_at?: string
          daily_limit?: number
          id?: string
          is_active?: boolean
          key_hash?: string
          key_prefix?: string
          key_value?: string | null
          last_used_at?: string | null
          name?: string
          tier?: string
          user_id?: string
        }
        Relationships: []
      }
      api_usage: {
        Row: {
          api_key_id: string
          cached_count: number
          created_at: string
          id: string
          request_count: number
          updated_at: string
          usage_date: string
        }
        Insert: {
          api_key_id: string
          cached_count?: number
          created_at?: string
          id?: string
          request_count?: number
          updated_at?: string
          usage_date?: string
        }
        Update: {
          api_key_id?: string
          cached_count?: number
          created_at?: string
          id?: string
          request_count?: number
          updated_at?: string
          usage_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_usage_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      articles: {
        Row: {
          author: string | null
          content: string
          created_at: string
          id: string
          publish_time: string | null
          raw_html: string | null
          slug: string | null
          source_url: string | null
          summary: string | null
          title: string
          view_count: number
        }
        Insert: {
          author?: string | null
          content: string
          created_at?: string
          id?: string
          publish_time?: string | null
          raw_html?: string | null
          slug?: string | null
          source_url?: string | null
          summary?: string | null
          title: string
          view_count?: number
        }
        Update: {
          author?: string | null
          content?: string
          created_at?: string
          id?: string
          publish_time?: string | null
          raw_html?: string | null
          slug?: string | null
          source_url?: string | null
          summary?: string | null
          title?: string
          view_count?: number
        }
        Relationships: []
      }
      comment_votes: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          vote_type: string
          voter_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          vote_type: string
          voter_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          vote_type?: string
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_votes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          content: string
          created_at: string
          dislikes_count: number
          id: string
          is_anonymous: boolean
          likes_count: number
          parent_id: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          dislikes_count?: number
          id?: string
          is_anonymous?: boolean
          likes_count?: number
          parent_id?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          dislikes_count?: number
          id?: string
          is_anonymous?: boolean
          likes_count?: number
          parent_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_credits: {
        Row: {
          claim_date: string
          created_at: string
          credits_claimed: number
          id: string
          user_id: string
        }
        Insert: {
          claim_date?: string
          created_at?: string
          credits_claimed?: number
          id?: string
          user_id: string
        }
        Update: {
          claim_date?: string
          created_at?: string
          credits_claimed?: number
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          created_at: string
          id: string
          ip_address: string
          request_count: number
          request_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address: string
          request_count?: number
          request_date?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: string
          request_count?: number
          request_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
    }
    Views: {
      articles_public: {
        Row: {
          author: string | null
          created_at: string | null
          id: string | null
          publish_time: string | null
          slug: string | null
          source_url: string | null
          summary: string | null
          title: string | null
          view_count: number | null
        }
        Insert: {
          author?: string | null
          created_at?: string | null
          id?: string | null
          publish_time?: string | null
          slug?: string | null
          source_url?: string | null
          summary?: string | null
          title?: string | null
          view_count?: number | null
        }
        Update: {
          author?: string | null
          created_at?: string | null
          id?: string | null
          publish_time?: string | null
          slug?: string | null
          source_url?: string | null
          summary?: string | null
          title?: string | null
          view_count?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      check_rate_limit: {
        Args: { p_daily_limit?: number; p_ip: string }
        Returns: Json
      }
      cleanup_old_rate_limits: { Args: never; Returns: undefined }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_api_usage_stats: { Args: { p_date?: string }; Returns: Json }
      get_comment_profiles: {
        Args: { p_user_ids: string[] }
        Returns: {
          avatar_url: string
          display_name: string
          id: string
          is_admin: boolean
        }[]
      }
      get_public_article_detail: {
        Args: { p_article_id?: string; p_slug?: string }
        Returns: Json
      }
      get_token_stats: { Args: never; Returns: Json }
      get_total_anon_requests: { Args: { p_date?: string }; Returns: number }
      get_total_views: { Args: never; Returns: number }
      get_user_balance: { Args: { p_user_id: string }; Returns: Json }
      increment_view_count: { Args: { article_id: string }; Returns: undefined }
      is_admin: { Args: never; Returns: boolean }
      list_public_articles: {
        Args: { p_limit?: number; p_offset?: number; p_search?: string }
        Returns: Json
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      record_cache_hit: { Args: { p_key_hash: string }; Returns: undefined }
      validate_api_key:
        | { Args: { p_key_hash: string }; Returns: Json }
        | {
            Args: { p_credit_cost?: number; p_key_hash: string }
            Returns: Json
          }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
