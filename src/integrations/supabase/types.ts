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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      competitor_analyses: {
        Row: {
          id: string
          user_id: string
          source_channel_id: string
          source_channel_name: string
          source_channel_handle: string | null
          source_channel_thumbnail: string | null
          similar_channels: Json
          total_channels_found: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          source_channel_id: string
          source_channel_name: string
          source_channel_handle?: string | null
          source_channel_thumbnail?: string | null
          similar_channels?: Json
          total_channels_found?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          source_channel_id?: string
          source_channel_name?: string
          source_channel_handle?: string | null
          source_channel_thumbnail?: string | null
          similar_channels?: Json
          total_channels_found?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      channel_update_logs: {
        Row: {
          api_calls_used: number | null
          channel_id: string | null
          created_at: string
          error_message: string | null
          id: string
          status: string
          update_type: string
        }
        Insert: {
          api_calls_used?: number | null
          channel_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          status: string
          update_type: string
        }
        Update: {
          api_calls_used?: number | null
          channel_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          status?: string
          update_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_update_logs_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          channel_id: string | null
          channel_name: string
          channel_subscribers: number | null
          created_at: string
          id: string
          last_updated: string | null
          total_videos: number
          total_views: number | null
          update_status: string | null
        }
        Insert: {
          channel_id?: string | null
          channel_name: string
          channel_subscribers?: number | null
          created_at?: string
          id?: string
          last_updated?: string | null
          total_videos?: number
          total_views?: number | null
          update_status?: string | null
        }
        Update: {
          channel_id?: string | null
          channel_name?: string
          channel_subscribers?: number | null
          created_at?: string
          id?: string
          last_updated?: string | null
          total_videos?: number
          total_views?: number | null
          update_status?: string | null
        }
        Relationships: []
      }
      competitor_channels: {
        Row: {
          channel_id: string
          channel_name: string
          channel_subscribers: number | null
          created_at: string
          id: string
          total_videos: number | null
        }
        Insert: {
          channel_id: string
          channel_name: string
          channel_subscribers?: number | null
          created_at?: string
          id?: string
          total_videos?: number | null
        }
        Update: {
          channel_id?: string
          channel_name?: string
          channel_subscribers?: number | null
          created_at?: string
          id?: string
          total_videos?: number | null
        }
        Relationships: []
      }
      competitor_videos: {
        Row: {
          id: string
          video_id: string
          title: string
          youtube_url: string
          thumbnail_url: string | null
          channel_name: string | null
          channel_subscribers: number | null
          view_count: number | null
          upload_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          video_id: string
          title: string
          youtube_url: string
          thumbnail_url?: string | null
          channel_name?: string | null
          channel_subscribers?: number | null
          view_count?: number | null
          upload_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          video_id?: string
          title?: string
          youtube_url?: string
          thumbnail_url?: string | null
          channel_name?: string | null
          channel_subscribers?: number | null
          view_count?: number | null
          upload_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_tool_usage: {
        Row: {
          id: string
          user_id: string
          month: string
          word_usage: number
          max_words: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          month: string
          word_usage?: number
          max_words?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          month?: string
          word_usage?: number
          max_words?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_scripts: {
        Row: {
          id: string
          user_id: string
          original_article: string | null
          outline: string | null
          result: string
          word_count: number | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          original_article?: string | null
          outline?: string | null
          result: string
          word_count?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          original_article?: string | null
          outline?: string | null
          result?: string
          word_count?: number | null
          created_at?: string
        }
        Relationships: []
      }
      user_seo_descriptions: {
        Row: {
          id: string
          user_id: string
          script: string
          titles: Json
          description: string
          tags: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          script: string
          titles?: Json
          description: string
          tags: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          script?: string
          titles?: Json
          description?: string
          tags?: string
          created_at?: string
        }
        Relationships: []
      }
      user_competitor_channels: {
        Row: {
          id: string
          user_id: string
          channel_name: string
          channel_id: string
          channel_subscribers: number | null
          total_videos: number | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          channel_name: string
          channel_id: string
          channel_subscribers?: number | null
          total_videos?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          channel_name?: string
          channel_id?: string
          channel_subscribers?: number | null
          total_videos?: number | null
          created_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          is_admin: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          is_admin?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_admin?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      proven_niches: {
        Row: {
          created_at: string
          id: string
          image_url: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      speakers: {
        Row: {
          created_at: string
          id: string
          images: string[]
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          images?: string[]
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          images?: string[]
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      speakers_v2: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
          videos: string[]
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          videos?: string[]
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          videos?: string[]
        }
        Relationships: []
      }
      title_generations: {
        Row: {
          created_at: string
          feedback_score: number | null
          generated_titles: Json
          id: string
          performance_scores: Json | null
          selected_niche: string | null
          user_script: string
        }
        Insert: {
          created_at?: string
          feedback_score?: number | null
          generated_titles: Json
          id?: string
          performance_scores?: Json | null
          selected_niche?: string | null
          user_script: string
        }
        Update: {
          created_at?: string
          feedback_score?: number | null
          generated_titles?: Json
          id?: string
          performance_scores?: Json | null
          selected_niche?: string | null
          user_script?: string
        }
        Relationships: []
      }
      videos: {
        Row: {
          added_at: string
          channel_name: string | null
          channel_subscribers: number | null
          created_at: string
          id: string
          is_favorite: boolean | null
          niche: string | null
          thumbnail_url: string
          title: string
          upload_date: string | null
          video_id: string
          view_count: number | null
          vph: number | null
          youtube_url: string
        }
        Insert: {
          added_at?: string
          channel_name?: string | null
          channel_subscribers?: number | null
          created_at?: string
          id?: string
          is_favorite?: boolean | null
          niche?: string | null
          thumbnail_url: string
          title: string
          upload_date?: string | null
          video_id: string
          view_count?: number | null
          vph?: number | null
          youtube_url: string
        }
        Update: {
          added_at?: string
          channel_name?: string | null
          channel_subscribers?: number | null
          created_at?: string
          id?: string
          is_favorite?: boolean | null
          niche?: string | null
          thumbnail_url?: string
          title?: string
          upload_date?: string | null
          video_id?: string
          view_count?: number | null
          vph?: number | null
          youtube_url?: string
        }
        Relationships: []
      }
      viewboard_cache: {
        Row: {
          channel_id: string | null
          channel_name: string
          channel_subscribers: number
          created_at: string
          id: string
          last_updated: string
          total_views: number
          video_count: number
        }
        Insert: {
          channel_id?: string | null
          channel_name: string
          channel_subscribers?: number
          created_at?: string
          id?: string
          last_updated?: string
          total_views?: number
          video_count?: number
        }
        Update: {
          channel_id?: string | null
          channel_name?: string
          channel_subscribers?: number
          created_at?: string
          id?: string
          last_updated?: string
          total_views?: number
          video_count?: number
        }
        Relationships: []
      }
      user_videos: {
        Row: {
          id: string
          user_id: string
          title: string
          youtube_url: string
          video_id: string
          thumbnail_url: string
          channel_name: string | null
          channel_subscribers: number | null
          upload_date: string | null
          view_count: number | null
          vph: number | null
          niche: string | null
          is_favorite: boolean | null
          created_at: string
          added_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          youtube_url: string
          video_id: string
          thumbnail_url: string
          channel_name?: string | null
          channel_subscribers?: number | null
          upload_date?: string | null
          view_count?: number | null
          vph?: number | null
          niche?: string | null
          is_favorite?: boolean | null
          created_at?: string
          added_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          youtube_url?: string
          video_id?: string
          thumbnail_url?: string
          channel_name?: string | null
          channel_subscribers?: number | null
          upload_date?: string | null
          view_count?: number | null
          vph?: number | null
          niche?: string | null
          is_favorite?: boolean | null
          created_at?: string
          added_at?: string
        }
        Relationships: []
      }
      user_niches: {
        Row: {
          id: string
          user_id: string
          name: string
          image_url: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          image_url: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          image_url?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      tracked_channels: {
        Row: {
          id: string
          user_id: string
          channel_id: string
          channel_name: string | null
          channel_handle: string | null
          channel_thumbnail: string | null
          channel_subscribers: number | null
          rss_feed_url: string | null
          webhook_subscribed: boolean
          subscription_expires_at: string | null
          last_webhook_received_at: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          channel_id: string
          channel_name?: string | null
          channel_handle?: string | null
          channel_thumbnail?: string | null
          channel_subscribers?: number | null
          rss_feed_url?: string | null
          webhook_subscribed?: boolean
          subscription_expires_at?: string | null
          last_webhook_received_at?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          channel_id?: string
          channel_name?: string | null
          channel_handle?: string | null
          channel_thumbnail?: string | null
          channel_subscribers?: number | null
          rss_feed_url?: string | null
          webhook_subscribed?: boolean
          subscription_expires_at?: string | null
          last_webhook_received_at?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      tracked_videos: {
        Row: {
          id: string
          video_id: string
          channel_id: string
          title: string
          description: string | null
          thumbnail_url: string | null
          published_at: string
          youtube_url: string | null
          view_count: number | null
          like_count: number | null
          comment_count: number | null
          source: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          video_id: string
          channel_id: string
          title: string
          description?: string | null
          thumbnail_url?: string | null
          published_at: string
          youtube_url?: string | null
          view_count?: number | null
          like_count?: number | null
          comment_count?: number | null
          source?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          video_id?: string
          channel_id?: string
          title?: string
          description?: string | null
          thumbnail_url?: string | null
          published_at?: string
          youtube_url?: string | null
          view_count?: number | null
          like_count?: number | null
          comment_count?: number | null
          source?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_activity: {
        Row: {
          id: string
          user_id: string
          last_competitor_route_opened_at: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          last_competitor_route_opened_at?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          last_competitor_route_opened_at?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      websub_subscription_logs: {
        Row: {
          id: string
          channel_id: string
          action: string
          status: string
          hub_response: string | null
          error_message: string | null
          created_at: string
        }
        Insert: {
          id?: string
          channel_id: string
          action: string
          status: string
          hub_response?: string | null
          error_message?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          channel_id?: string
          action?: string
          status?: string
          hub_response?: string | null
          error_message?: string | null
          created_at?: string
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          id: string
          event_type: string
          channel_id: string | null
          video_id: string | null
          payload: string | null
          processed: boolean
          error_message: string | null
          created_at: string
        }
        Insert: {
          id?: string
          event_type: string
          channel_id?: string | null
          video_id?: string | null
          payload?: string | null
          processed?: boolean
          error_message?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          event_type?: string
          channel_id?: string | null
          video_id?: string | null
          payload?: string | null
          processed?: boolean
          error_message?: string | null
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: { user_id: string }; Returns: boolean }
      populate_channels_from_videos: { Args: never; Returns: undefined }
      get_or_create_monthly_usage: { 
        Args: { p_user_id: string }
        Returns: { word_usage: number; max_words: number; month: string }[]
      }
      add_word_usage: { 
        Args: { p_user_id: string; p_word_count: number }
        Returns: { word_usage: number; max_words: number; month: string }[]
      }
      subtract_word_usage: { 
        Args: { p_user_id: string; p_word_count: number }
        Returns: { word_usage: number; max_words: number; month: string }[]
      }
      is_user_active: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      get_channels_needing_renewal: {
        Args: Record<string, never>
        Returns: {
          id: string
          user_id: string
          channel_id: string
          channel_name: string | null
          rss_feed_url: string | null
          subscription_expires_at: string | null
        }[]
      }
      get_channels_for_rss_poll: {
        Args: Record<string, never>
        Returns: {
          id: string
          user_id: string
          channel_id: string
          channel_name: string | null
          rss_feed_url: string | null
        }[]
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
