export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      catalog_consultation_leads: {
        Row: {
          business_name: string | null;
          created_at: string;
          full_name: string;
          id: string;
          message: string | null;
          phone: string;
          source: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          business_name?: string | null;
          created_at?: string;
          full_name: string;
          id?: string;
          message?: string | null;
          phone: string;
          source?: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          business_name?: string | null;
          created_at?: string;
          full_name?: string;
          id?: string;
          message?: string | null;
          phone?: string;
          source?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      ai_assistant_logs: {
        Row: {
          completion_tokens: number | null;
          created_at: string;
          customer_id: string | null;
          error_message: string | null;
          id: string;
          mode: string;
          prompt_tokens: number | null;
          retrieved_chunks: Json | null;
          status: string;
          task_id: string | null;
          total_tokens: number | null;
          user_id: string | null;
        };
        Insert: {
          completion_tokens?: number | null;
          created_at?: string;
          customer_id?: string | null;
          error_message?: string | null;
          id?: string;
          mode: string;
          prompt_tokens?: number | null;
          retrieved_chunks?: Json | null;
          status?: string;
          task_id?: string | null;
          total_tokens?: number | null;
          user_id?: string | null;
        };
        Update: {
          completion_tokens?: number | null;
          created_at?: string;
          customer_id?: string | null;
          error_message?: string | null;
          id?: string;
          mode?: string;
          prompt_tokens?: number | null;
          retrieved_chunks?: Json | null;
          status?: string;
          task_id?: string | null;
          total_tokens?: number | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ai_assistant_logs_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_assistant_logs_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_invalid_source";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_assistant_logs_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_invalid_status";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_assistant_logs_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_missing_required_info";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_assistant_logs_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_contacted_recently";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_assistant_logs_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_ready_for_email_marketing";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_assistant_logs_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_ready_for_zalo_marketing";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_assistant_logs_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_unassigned";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_assistant_logs_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "customer_tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_banned_phrases: {
        Row: {
          category: string;
          created_at: string;
          created_by: string | null;
          id: string;
          is_active: boolean;
          phrase: string;
          severity: string;
        };
        Insert: {
          category?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          phrase: string;
          severity?: string;
        };
        Update: {
          category?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          phrase?: string;
          severity?: string;
        };
        Relationships: [];
      };
      ai_cache: {
        Row: {
          cache_key: string;
          cache_type: string;
          created_at: string;
          expires_at: string | null;
          hit_count: number | null;
          id: string;
          payload: Json;
          updated_at: string;
        };
        Insert: {
          cache_key: string;
          cache_type: string;
          created_at?: string;
          expires_at?: string | null;
          hit_count?: number | null;
          id?: string;
          payload: Json;
          updated_at?: string;
        };
        Update: {
          cache_key?: string;
          cache_type?: string;
          created_at?: string;
          expires_at?: string | null;
          hit_count?: number | null;
          id?: string;
          payload?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      ai_conversation_logs: {
        Row: {
          completion_tokens: number | null;
          created_at: string | null;
          customer_id: string | null;
          error_message: string | null;
          estimated_cost_usd: number | null;
          id: string;
          mode: string;
          prompt_tokens: number | null;
          request_id: string;
          request_preview: string | null;
          response_preview: string | null;
          retrieved_chunks: Json | null;
          status: string | null;
          task_id: string | null;
          total_tokens: number | null;
          user_id: string | null;
        };
        Insert: {
          completion_tokens?: number | null;
          created_at?: string | null;
          customer_id?: string | null;
          error_message?: string | null;
          estimated_cost_usd?: number | null;
          id?: string;
          mode: string;
          prompt_tokens?: number | null;
          request_id: string;
          request_preview?: string | null;
          response_preview?: string | null;
          retrieved_chunks?: Json | null;
          status?: string | null;
          task_id?: string | null;
          total_tokens?: number | null;
          user_id?: string | null;
        };
        Update: {
          completion_tokens?: number | null;
          created_at?: string | null;
          customer_id?: string | null;
          error_message?: string | null;
          estimated_cost_usd?: number | null;
          id?: string;
          mode?: string;
          prompt_tokens?: number | null;
          request_id?: string;
          request_preview?: string | null;
          response_preview?: string | null;
          retrieved_chunks?: Json | null;
          status?: string | null;
          task_id?: string | null;
          total_tokens?: number | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      ai_conversations: {
        Row: {
          blocked_phrases: string[] | null;
          completion_tokens: number | null;
          created_at: string;
          customer_id: string | null;
          error_message: string | null;
          feedback_note: string | null;
          feedback_score: number | null;
          hallucination_blocked: boolean | null;
          hallucination_flag: boolean | null;
          hallucination_note: string | null;
          id: string;
          knowledge_version: number | null;
          mode: string;
          prompt: string | null;
          prompt_tokens: number | null;
          response: string | null;
          retrieved_chunks: Json | null;
          status: string | null;
          total_tokens: number | null;
          user_id: string | null;
        };
        Insert: {
          blocked_phrases?: string[] | null;
          completion_tokens?: number | null;
          created_at?: string;
          customer_id?: string | null;
          error_message?: string | null;
          feedback_note?: string | null;
          feedback_score?: number | null;
          hallucination_blocked?: boolean | null;
          hallucination_flag?: boolean | null;
          hallucination_note?: string | null;
          id?: string;
          knowledge_version?: number | null;
          mode: string;
          prompt?: string | null;
          prompt_tokens?: number | null;
          response?: string | null;
          retrieved_chunks?: Json | null;
          status?: string | null;
          total_tokens?: number | null;
          user_id?: string | null;
        };
        Update: {
          blocked_phrases?: string[] | null;
          completion_tokens?: number | null;
          created_at?: string;
          customer_id?: string | null;
          error_message?: string | null;
          feedback_note?: string | null;
          feedback_score?: number | null;
          hallucination_blocked?: boolean | null;
          hallucination_flag?: boolean | null;
          hallucination_note?: string | null;
          id?: string;
          knowledge_version?: number | null;
          mode?: string;
          prompt?: string | null;
          prompt_tokens?: number | null;
          response?: string | null;
          retrieved_chunks?: Json | null;
          status?: string | null;
          total_tokens?: number | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ai_conversations_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_conversations_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_invalid_source";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_conversations_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_invalid_status";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_conversations_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_missing_required_info";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_conversations_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_contacted_recently";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_conversations_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_ready_for_email_marketing";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_conversations_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_ready_for_zalo_marketing";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_conversations_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_unassigned";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_customer_suggestions: {
        Row: {
          accepted_at: string | null;
          confidence: number | null;
          created_at: string | null;
          customer_id: string;
          dismissed_at: string | null;
          generated_for: string;
          id: string;
          model: string | null;
          provider: string | null;
          source_snapshot: Json | null;
          status: string | null;
          suggestion_json: Json;
          suggestion_type: string;
          token_usage: Json | null;
        };
        Insert: {
          accepted_at?: string | null;
          confidence?: number | null;
          created_at?: string | null;
          customer_id: string;
          dismissed_at?: string | null;
          generated_for: string;
          id?: string;
          model?: string | null;
          provider?: string | null;
          source_snapshot?: Json | null;
          status?: string | null;
          suggestion_json: Json;
          suggestion_type: string;
          token_usage?: Json | null;
        };
        Update: {
          accepted_at?: string | null;
          confidence?: number | null;
          created_at?: string | null;
          customer_id?: string;
          dismissed_at?: string | null;
          generated_for?: string;
          id?: string;
          model?: string | null;
          provider?: string | null;
          source_snapshot?: Json | null;
          status?: string | null;
          suggestion_json?: Json;
          suggestion_type?: string;
          token_usage?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "ai_customer_suggestions_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_customer_suggestions_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_invalid_source";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_customer_suggestions_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_invalid_status";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_customer_suggestions_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_missing_required_info";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_customer_suggestions_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_contacted_recently";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_customer_suggestions_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_ready_for_email_marketing";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_customer_suggestions_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_ready_for_zalo_marketing";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_customer_suggestions_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_unassigned";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_feedback: {
        Row: {
          content_shown: string | null;
          conversation_id: string | null;
          created_at: string;
          customer_id: string | null;
          feedback_note: string | null;
          feedback_type: string;
          id: string;
          mode: string | null;
          user_id: string | null;
        };
        Insert: {
          content_shown?: string | null;
          conversation_id?: string | null;
          created_at?: string;
          customer_id?: string | null;
          feedback_note?: string | null;
          feedback_type: string;
          id?: string;
          mode?: string | null;
          user_id?: string | null;
        };
        Update: {
          content_shown?: string | null;
          conversation_id?: string | null;
          created_at?: string;
          customer_id?: string | null;
          feedback_note?: string | null;
          feedback_type?: string;
          id?: string;
          mode?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ai_feedback_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "ai_conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_feedback_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_feedback_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_invalid_source";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_feedback_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_invalid_status";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_feedback_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_missing_required_info";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_feedback_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_contacted_recently";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_feedback_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_ready_for_email_marketing";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_feedback_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_ready_for_zalo_marketing";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_feedback_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_unassigned";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_safety_events: {
        Row: {
          created_at: string | null;
          customer_id: string | null;
          event_type: string;
          handled: boolean | null;
          id: string;
          original_response_preview: string | null;
          phrase: string;
          request_id: string;
          severity: string;
          user_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          customer_id?: string | null;
          event_type: string;
          handled?: boolean | null;
          id?: string;
          original_response_preview?: string | null;
          phrase: string;
          request_id: string;
          severity: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          customer_id?: string | null;
          event_type?: string;
          handled?: boolean | null;
          id?: string;
          original_response_preview?: string | null;
          phrase?: string;
          request_id?: string;
          severity?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      ai_search_qa_tests: {
        Row: {
          created_at: string;
          description: string | null;
          expected_field: string;
          expected_keyword: string;
          id: string;
          is_active: boolean;
          query: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          expected_field: string;
          expected_keyword: string;
          id?: string;
          is_active?: boolean;
          query: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          expected_field?: string;
          expected_keyword?: string;
          id?: string;
          is_active?: boolean;
          query?: string;
        };
        Relationships: [];
      };
      ai_settings: {
        Row: {
          ai_cache_minutes: number | null;
          ai_customer_suggestions_enabled: boolean | null;
          ai_daily_limit: number | null;
          ai_enabled: boolean | null;
          ai_rag_enabled: boolean | null;
          ai_rewrite_enabled: boolean | null;
          ai_sales_assistant_enabled: boolean | null;
          anthropic_api_key: string | null;
          chat_model: string | null;
          daily_token_limit: number | null;
          embedding_model: string | null;
          gemini_api_key: string | null;
          id: string;
          is_active: boolean | null;
          max_tokens: number | null;
          module_customer_summary: boolean | null;
          module_product_tutor: boolean | null;
          module_rewrite: boolean | null;
          module_sales_assistant: boolean | null;
          monthly_cost_limit: number | null;
          openai_api_key: string | null;
          product_copilot_admin_enabled: boolean;
          product_copilot_daily_limit: number;
          product_copilot_enabled: boolean;
          product_copilot_require_context: boolean;
          product_copilot_sale_enabled: boolean;
          provider: string | null;
          system_tone: string | null;
          temperature: number | null;
          updated_at: string | null;
          updated_by: string | null;
        };
        Insert: {
          ai_cache_minutes?: number | null;
          ai_customer_suggestions_enabled?: boolean | null;
          ai_daily_limit?: number | null;
          ai_enabled?: boolean | null;
          ai_rag_enabled?: boolean | null;
          ai_rewrite_enabled?: boolean | null;
          ai_sales_assistant_enabled?: boolean | null;
          anthropic_api_key?: string | null;
          chat_model?: string | null;
          daily_token_limit?: number | null;
          embedding_model?: string | null;
          gemini_api_key?: string | null;
          id?: string;
          is_active?: boolean | null;
          max_tokens?: number | null;
          module_customer_summary?: boolean | null;
          module_product_tutor?: boolean | null;
          module_rewrite?: boolean | null;
          module_sales_assistant?: boolean | null;
          monthly_cost_limit?: number | null;
          openai_api_key?: string | null;
          product_copilot_admin_enabled?: boolean;
          product_copilot_daily_limit?: number;
          product_copilot_enabled?: boolean;
          product_copilot_require_context?: boolean;
          product_copilot_sale_enabled?: boolean;
          provider?: string | null;
          system_tone?: string | null;
          temperature?: number | null;
          updated_at?: string | null;
          updated_by?: string | null;
        };
        Update: {
          ai_cache_minutes?: number | null;
          ai_customer_suggestions_enabled?: boolean | null;
          ai_daily_limit?: number | null;
          ai_enabled?: boolean | null;
          ai_rag_enabled?: boolean | null;
          ai_rewrite_enabled?: boolean | null;
          ai_sales_assistant_enabled?: boolean | null;
          anthropic_api_key?: string | null;
          chat_model?: string | null;
          daily_token_limit?: number | null;
          embedding_model?: string | null;
          gemini_api_key?: string | null;
          id?: string;
          is_active?: boolean | null;
          max_tokens?: number | null;
          module_customer_summary?: boolean | null;
          module_product_tutor?: boolean | null;
          module_rewrite?: boolean | null;
          module_sales_assistant?: boolean | null;
          monthly_cost_limit?: number | null;
          openai_api_key?: string | null;
          product_copilot_admin_enabled?: boolean;
          product_copilot_daily_limit?: number;
          product_copilot_enabled?: boolean;
          product_copilot_require_context?: boolean;
          product_copilot_sale_enabled?: boolean;
          provider?: string | null;
          system_tone?: string | null;
          temperature?: number | null;
          updated_at?: string | null;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      ai_suggestion_analytics: {
        Row: {
          conversion_status: string | null;
          converted_order_id: string | null;
          converted_revenue: number | null;
          created_at: string;
          customer_id: string | null;
          id: string;
          ignored: boolean | null;
          sale_user_id: string | null;
          status: string;
          suggested_products: number[] | null;
          suggestion_rule: string;
          suggestion_type: string;
          updated_at: string;
          used_in_activity: string | null;
        };
        Insert: {
          conversion_status?: string | null;
          converted_order_id?: string | null;
          converted_revenue?: number | null;
          created_at?: string;
          customer_id?: string | null;
          id?: string;
          ignored?: boolean | null;
          sale_user_id?: string | null;
          status?: string;
          suggested_products?: number[] | null;
          suggestion_rule: string;
          suggestion_type: string;
          updated_at?: string;
          used_in_activity?: string | null;
        };
        Update: {
          conversion_status?: string | null;
          converted_order_id?: string | null;
          converted_revenue?: number | null;
          created_at?: string;
          customer_id?: string | null;
          id?: string;
          ignored?: boolean | null;
          sale_user_id?: string | null;
          status?: string;
          suggested_products?: number[] | null;
          suggestion_rule?: string;
          suggestion_type?: string;
          updated_at?: string;
          used_in_activity?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ai_suggestion_analytics_converted_order_id_fkey";
            columns: ["converted_order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_suggestion_analytics_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_suggestion_analytics_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_invalid_source";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_suggestion_analytics_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_invalid_status";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_suggestion_analytics_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_missing_required_info";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_suggestion_analytics_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_contacted_recently";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_suggestion_analytics_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_ready_for_email_marketing";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_suggestion_analytics_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_ready_for_zalo_marketing";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_suggestion_analytics_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_unassigned";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_suggestion_analytics_used_in_activity_fkey";
            columns: ["used_in_activity"];
            isOneToOne: false;
            referencedRelation: "customer_activities";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_usage_logs: {
        Row: {
          cache_hit: boolean | null;
          completion_tokens: number | null;
          created_at: string;
          customer_id: string | null;
          estimated_cost_usd: number | null;
          id: string;
          latency_ms: number | null;
          mode: string;
          model: string | null;
          prompt_tokens: number | null;
          provider: string | null;
          total_tokens: number | null;
          user_id: string | null;
        };
        Insert: {
          cache_hit?: boolean | null;
          completion_tokens?: number | null;
          created_at?: string;
          customer_id?: string | null;
          estimated_cost_usd?: number | null;
          id?: string;
          latency_ms?: number | null;
          mode: string;
          model?: string | null;
          prompt_tokens?: number | null;
          provider?: string | null;
          total_tokens?: number | null;
          user_id?: string | null;
        };
        Update: {
          cache_hit?: boolean | null;
          completion_tokens?: number | null;
          created_at?: string;
          customer_id?: string | null;
          estimated_cost_usd?: number | null;
          id?: string;
          latency_ms?: number | null;
          mode?: string;
          model?: string | null;
          prompt_tokens?: number | null;
          provider?: string | null;
          total_tokens?: number | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ai_usage_logs_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_usage_logs_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_invalid_source";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_usage_logs_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_invalid_status";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_usage_logs_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_missing_required_info";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_usage_logs_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_contacted_recently";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_usage_logs_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_ready_for_email_marketing";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_usage_logs_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_ready_for_zalo_marketing";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_usage_logs_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_unassigned";
            referencedColumns: ["id"];
          },
        ];
      };
      app_error_logs: {
        Row: {
          created_at: string | null;
          error_message: string;
          error_type: string;
          id: string;
          metadata: Json | null;
          page_key: string | null;
          stack_trace: string | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          error_message: string;
          error_type: string;
          id?: string;
          metadata?: Json | null;
          page_key?: string | null;
          stack_trace?: string | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          error_message?: string;
          error_type?: string;
          id?: string;
          metadata?: Json | null;
          page_key?: string | null;
          stack_trace?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      automation_logs: {
        Row: {
          automation_type: string;
          created_at: string;
          created_by: string | null;
          customer_id: string | null;
          error_message: string | null;
          id: string;
          lead_id: string | null;
          metadata: Json | null;
          notification_id: string | null;
          rule_id: string | null;
          status: string;
          task_id: string | null;
        };
        Insert: {
          automation_type: string;
          created_at?: string;
          created_by?: string | null;
          customer_id?: string | null;
          error_message?: string | null;
          id?: string;
          lead_id?: string | null;
          metadata?: Json | null;
          notification_id?: string | null;
          rule_id?: string | null;
          status?: string;
          task_id?: string | null;
        };
        Update: {
          automation_type?: string;
          created_at?: string;
          created_by?: string | null;
          customer_id?: string | null;
          error_message?: string | null;
          id?: string;
          lead_id?: string | null;
          metadata?: Json | null;
          notification_id?: string | null;
          rule_id?: string | null;
          status?: string;
          task_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "automation_logs_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "automation_logs_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_invalid_source";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "automation_logs_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_invalid_status";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "automation_logs_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_missing_required_info";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "automation_logs_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_contacted_recently";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "automation_logs_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_ready_for_email_marketing";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "automation_logs_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_ready_for_zalo_marketing";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "automation_logs_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_unassigned";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "automation_logs_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "automation_logs_notification_id_fkey";
            columns: ["notification_id"];
            isOneToOne: false;
            referencedRelation: "notifications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "automation_logs_rule_id_fkey";
            columns: ["rule_id"];
            isOneToOne: false;
            referencedRelation: "automation_rules";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "automation_logs_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "customer_tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      automation_rules: {
        Row: {
          action_json: Json | null;
          action_type: string | null;
          category: string;
          condition_json: Json | null;
          created_at: string | null;
          created_by: string | null;
          description: string | null;
          id: string;
          is_active: boolean | null;
          is_configurable: boolean;
          is_enabled: boolean;
          last_run_at: string | null;
          metadata: Json | null;
          name: string;
          run_frequency: string | null;
          threshold_unit: string | null;
          threshold_value: number | null;
          trigger_type: string | null;
          updated_at: string | null;
          updated_by: string | null;
        };
        Insert: {
          action_json?: Json | null;
          action_type?: string | null;
          category: string;
          condition_json?: Json | null;
          created_at?: string | null;
          created_by?: string | null;
          description?: string | null;
          id: string;
          is_active?: boolean | null;
          is_configurable?: boolean;
          is_enabled?: boolean;
          last_run_at?: string | null;
          metadata?: Json | null;
          name: string;
          run_frequency?: string | null;
          threshold_unit?: string | null;
          threshold_value?: number | null;
          trigger_type?: string | null;
          updated_at?: string | null;
          updated_by?: string | null;
        };
        Update: {
          action_json?: Json | null;
          action_type?: string | null;
          category?: string;
          condition_json?: Json | null;
          created_at?: string | null;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          is_active?: boolean | null;
          is_configurable?: boolean;
          is_enabled?: boolean;
          last_run_at?: string | null;
          metadata?: Json | null;
          name?: string;
          run_frequency?: string | null;
          threshold_unit?: string | null;
          threshold_value?: number | null;
          trigger_type?: string | null;
          updated_at?: string | null;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      automation_run_logs: {
        Row: {
          action_count: number | null;
          created_at: string | null;
          error_message: string | null;
          id: string;
          matched_count: number | null;
          metadata: Json | null;
          rule_id: string | null;
          run_by: string | null;
          status: string | null;
        };
        Insert: {
          action_count?: number | null;
          created_at?: string | null;
          error_message?: string | null;
          id?: string;
          matched_count?: number | null;
          metadata?: Json | null;
          rule_id?: string | null;
          run_by?: string | null;
          status?: string | null;
        };
        Update: {
          action_count?: number | null;
          created_at?: string | null;
          error_message?: string | null;
          id?: string;
          matched_count?: number | null;
          metadata?: Json | null;
          rule_id?: string | null;
          run_by?: string | null;
          status?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "automation_run_logs_rule_id_fkey";
            columns: ["rule_id"];
            isOneToOne: false;
            referencedRelation: "automation_rules";
            referencedColumns: ["id"];
          },
        ];
      };
      calendar_events: {
        Row: {
          assigned_sale_id: string | null;
          assigned_user_ids: string[] | null;
          attendees: Json | null;
          cancelled_at: string | null;
          color: string | null;
          completed_at: string | null;
          created_at: string;
          created_by: string | null;
          customer_id: string | null;
          description: string | null;
          ends_at: string | null;
          event_campaign_status: string | null;
          event_type: string;
          id: string;
          is_all_day: boolean | null;
          location: string | null;
          max_attendees: number | null;
          order_id: string | null;
          owner_user_id: string | null;
          remind_before_minutes: number;
          reminder_sent_at: string | null;
          starts_at: string;
          status: string;
          title: string;
          updated_at: string;
          visibility: string | null;
        };
        Insert: {
          assigned_sale_id?: string | null;
          assigned_user_ids?: string[] | null;
          attendees?: Json | null;
          cancelled_at?: string | null;
          color?: string | null;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          customer_id?: string | null;
          description?: string | null;
          ends_at?: string | null;
          event_campaign_status?: string | null;
          event_type?: string;
          id?: string;
          is_all_day?: boolean | null;
          location?: string | null;
          max_attendees?: number | null;
          order_id?: string | null;
          owner_user_id?: string | null;
          remind_before_minutes?: number;
          reminder_sent_at?: string | null;
          starts_at: string;
          status?: string;
          title: string;
          updated_at?: string;
          visibility?: string | null;
        };
        Update: {
          assigned_sale_id?: string | null;
          assigned_user_ids?: string[] | null;
          attendees?: Json | null;
          cancelled_at?: string | null;
          color?: string | null;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          customer_id?: string | null;
          description?: string | null;
          ends_at?: string | null;
          event_campaign_status?: string | null;
          event_type?: string;
          id?: string;
          is_all_day?: boolean | null;
          location?: string | null;
          max_attendees?: number | null;
          order_id?: string | null;
          owner_user_id?: string | null;
          remind_before_minutes?: number;
          reminder_sent_at?: string | null;
          starts_at?: string;
          status?: string;
          title?: string;
          updated_at?: string;
          visibility?: string | null;
        };
        Relationships: [];
      };
      campaign_recipient_snapshots: {
        Row: {
          campaign_id: string;
          created_at: string;
          customer_id: string;
          delivery_log_id: string | null;
          failure_reason: string | null;
          id: string;
          payload_preview: Json;
          processed_at: string | null;
          sender_account_id: string;
          status: string;
          updated_at: string;
          zns_template_id: string;
        };
        Insert: {
          campaign_id: string;
          created_at?: string;
          customer_id: string;
          delivery_log_id?: string | null;
          failure_reason?: string | null;
          id?: string;
          payload_preview?: Json;
          processed_at?: string | null;
          sender_account_id: string;
          status?: string;
          updated_at?: string;
          zns_template_id: string;
        };
        Update: {
          campaign_id?: string;
          created_at?: string;
          customer_id?: string;
          delivery_log_id?: string | null;
          failure_reason?: string | null;
          id?: string;
          payload_preview?: Json;
          processed_at?: string | null;
          sender_account_id?: string;
          status?: string;
          updated_at?: string;
          zns_template_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "campaign_recipient_snapshots_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "marketing_campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_recipient_snapshots_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_recipient_snapshots_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_invalid_source";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_recipient_snapshots_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_invalid_status";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_recipient_snapshots_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_missing_required_info";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_recipient_snapshots_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_contacted_recently";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_recipient_snapshots_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_ready_for_email_marketing";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_recipient_snapshots_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_ready_for_zalo_marketing";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_recipient_snapshots_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_unassigned";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_recipient_snapshots_delivery_log_id_fkey";
            columns: ["delivery_log_id"];
            isOneToOne: false;
            referencedRelation: "marketing_delivery_logs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_recipient_snapshots_sender_account_id_fkey";
            columns: ["sender_account_id"];
            isOneToOne: false;
            referencedRelation: "sender_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_recipient_snapshots_zns_template_id_fkey";
            columns: ["zns_template_id"];
            isOneToOne: false;
            referencedRelation: "zns_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      categories: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          name: string;
          name_vi: string | null;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id: string;
          name: string;
          name_vi?: string | null;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          name?: string;
          name_vi?: string | null;
        };
        Relationships: [];
      };
      client_retry_queue: {
        Row: {
          action_type: string;
          created_at: string | null;
          id: string;
          last_error: string | null;
          payload: Json;
          retry_count: number | null;
          status: string;
          updated_at: string | null;
          user_id: string | null;
        };
        Insert: {
          action_type: string;
          created_at?: string | null;
          id?: string;
          last_error?: string | null;
          payload: Json;
          retry_count?: number | null;
          status?: string;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          action_type?: string;
          created_at?: string | null;
          id?: string;
          last_error?: string | null;
          payload?: Json;
          retry_count?: number | null;
          status?: string;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      company_events: {
        Row: {
          cancel_reason: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          capacity: number | null;
          created_at: string;
          created_by: string | null;
          description: string | null;
          ends_at: string | null;
          event_type: string;
          google_calendar_event_id: string | null;
          google_calendar_html_link: string | null;
          google_sync_error: string | null;
          google_sync_status: string;
          google_synced_at: string | null;
          id: string;
          location: string | null;
          meeting_url: string | null;
          registration_deadline: string | null;
          starts_at: string;
          status: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          cancel_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          capacity?: number | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          ends_at?: string | null;
          event_type?: string;
          google_calendar_event_id?: string | null;
          google_calendar_html_link?: string | null;
          google_sync_error?: string | null;
          google_sync_status?: string;
          google_synced_at?: string | null;
          id?: string;
          location?: string | null;
          meeting_url?: string | null;
          registration_deadline?: string | null;
          starts_at: string;
          status?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          cancel_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          capacity?: number | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          ends_at?: string | null;
          event_type?: string;
          google_calendar_event_id?: string | null;
          google_calendar_html_link?: string | null;
          google_sync_error?: string | null;
          google_sync_status?: string;
          google_synced_at?: string | null;
          id?: string;
          location?: string | null;
          meeting_url?: string | null;
          registration_deadline?: string | null;
          starts_at?: string;
          status?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      company_locations: {
        Row: {
          address: string | null;
          city: string | null;
          code: string;
          created_at: string;
          district: string | null;
          id: string;
          is_active: boolean;
          is_default: boolean;
          latitude: number;
          location_type: string;
          longitude: number;
          name: string;
          updated_at: string;
        };
        Insert: {
          address?: string | null;
          city?: string | null;
          code: string;
          created_at?: string;
          district?: string | null;
          id?: string;
          is_active?: boolean;
          is_default?: boolean;
          latitude: number;
          location_type?: string;
          longitude: number;
          name: string;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          city?: string | null;
          code?: string;
          created_at?: string;
          district?: string | null;
          id?: string;
          is_active?: boolean;
          is_default?: boolean;
          latitude?: number;
          location_type?: string;
          longitude?: number;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      crm_sync_logs: {
        Row: {
          completed_at: string | null;
          created_at: string;
          created_by: string | null;
          error_message: string | null;
          id: string;
          metadata: Json;
          provider: string;
          started_at: string;
          status: string;
          target: string | null;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          error_message?: string | null;
          id?: string;
          metadata?: Json;
          provider?: string;
          started_at?: string;
          status?: string;
          target?: string | null;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          error_message?: string | null;
          id?: string;
          metadata?: Json;
          provider?: string;
          started_at?: string;
          status?: string;
          target?: string | null;
        };
        Relationships: [];
      };
      customer_activities: {
        Row: {
          activity_type: string;
          channel: string | null;
          content: string | null;
          created_at: string;
          created_by: string | null;
          customer_id: string;
          event_registration_id: string | null;
          id: string;
          interaction_quality: string | null;
          interaction_weight: number | null;
          lead_id: string | null;
          location: string | null;
          metadata: Json | null;
          next_follow_up_at: string | null;
          order_id: string | null;
          result: string | null;
          task_id: string | null;
          title: string;
        };
        Insert: {
          activity_type?: string;
          channel?: string | null;
          content?: string | null;
          created_at?: string;
          created_by?: string | null;
          customer_id: string;
          event_registration_id?: string | null;
          id?: string;
          interaction_quality?: string | null;
          interaction_weight?: number | null;
          lead_id?: string | null;
          location?: string | null;
          metadata?: Json | null;
          next_follow_up_at?: string | null;
          order_id?: string | null;
          result?: string | null;
          task_id?: string | null;
          title: string;
        };
        Update: {
          activity_type?: string;
          channel?: string | null;
          content?: string | null;
          created_at?: string;
          created_by?: string | null;
          customer_id?: string;
          event_registration_id?: string | null;
          id?: string;
          interaction_quality?: string | null;
          interaction_weight?: number | null;
          lead_id?: string | null;
          location?: string | null;
          metadata?: Json | null;
          next_follow_up_at?: string | null;
          order_id?: string | null;
          result?: string | null;
          task_id?: string | null;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customer_activities_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_activities_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_invalid_source";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_activities_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_invalid_status";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_activities_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_missing_required_info";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_activities_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_contacted_recently";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_activities_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_ready_for_email_marketing";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_activities_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_ready_for_zalo_marketing";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_activities_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_unassigned";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_activities_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_activities_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "customer_tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      customer_consents: {
        Row: {
          channel: string;
          created_at: string | null;
          customer_id: string | null;
          id: string;
          is_opt_in: boolean;
          opt_in_at: string | null;
          opt_out_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          channel: string;
          created_at?: string | null;
          customer_id?: string | null;
          id?: string;
          is_opt_in?: boolean;
          opt_in_at?: string | null;
          opt_out_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          channel?: string;
          created_at?: string | null;
          customer_id?: string | null;
          id?: string;
          is_opt_in?: boolean;
          opt_in_at?: string | null;
          opt_out_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "customer_consents_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_consents_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_invalid_source";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_consents_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_invalid_status";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_consents_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_missing_required_info";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_consents_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_contacted_recently";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_consents_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_ready_for_email_marketing";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_consents_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_ready_for_zalo_marketing";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_consents_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_unassigned";
            referencedColumns: ["id"];
          },
        ];
      };
      customer_contact_channels: {
        Row: {
          channel_purpose: string | null;
          channel_type: string;
          channel_value: string;
          consent_status: string | null;
          created_at: string | null;
          created_by: string | null;
          customer_id: string;
          do_not_call: boolean | null;
          engagement_score: number | null;
          external_id: string | null;
          id: string;
          is_primary: boolean | null;
          is_verified: boolean | null;
          last_contacted_at: string | null;
          last_verified_at: string | null;
          normalized_value: string | null;
          notes: string | null;
          owner_user_id: string | null;
          phone_verified: boolean | null;
          preferred_call_time: string | null;
          profile_type: string | null;
          remarketing_enabled: boolean | null;
          resolve_error: string | null;
          resolve_status: string | null;
          scope: string;
          source: string | null;
          updated_at: string | null;
          updated_by: string | null;
          username: string | null;
          verified_at: string | null;
          visibility: string;
        };
        Insert: {
          channel_purpose?: string | null;
          channel_type: string;
          channel_value: string;
          consent_status?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          customer_id: string;
          do_not_call?: boolean | null;
          engagement_score?: number | null;
          external_id?: string | null;
          id?: string;
          is_primary?: boolean | null;
          is_verified?: boolean | null;
          last_contacted_at?: string | null;
          last_verified_at?: string | null;
          normalized_value?: string | null;
          notes?: string | null;
          owner_user_id?: string | null;
          phone_verified?: boolean | null;
          preferred_call_time?: string | null;
          profile_type?: string | null;
          remarketing_enabled?: boolean | null;
          resolve_error?: string | null;
          resolve_status?: string | null;
          scope?: string;
          source?: string | null;
          updated_at?: string | null;
          updated_by?: string | null;
          username?: string | null;
          verified_at?: string | null;
          visibility?: string;
        };
        Update: {
          channel_purpose?: string | null;
          channel_type?: string;
          channel_value?: string;
          consent_status?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          customer_id?: string;
          do_not_call?: boolean | null;
          engagement_score?: number | null;
          external_id?: string | null;
          id?: string;
          is_primary?: boolean | null;
          is_verified?: boolean | null;
          last_contacted_at?: string | null;
          last_verified_at?: string | null;
          normalized_value?: string | null;
          notes?: string | null;
          owner_user_id?: string | null;
          phone_verified?: boolean | null;
          preferred_call_time?: string | null;
          profile_type?: string | null;
          remarketing_enabled?: boolean | null;
          resolve_error?: string | null;
          resolve_status?: string | null;
          scope?: string;
          source?: string | null;
          updated_at?: string | null;
          updated_by?: string | null;
          username?: string | null;
          verified_at?: string | null;
          visibility?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customer_contact_channels_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_contact_channels_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_invalid_source";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_contact_channels_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_invalid_status";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_contact_channels_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_missing_required_info";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_contact_channels_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_contacted_recently";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_contact_channels_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_ready_for_email_marketing";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_contact_channels_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_ready_for_zalo_marketing";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_contact_channels_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_unassigned";
            referencedColumns: ["id"];
          },
        ];
      };
      customer_import_batches: {
        Row: {
          completed_at: string | null;
          created_at: string | null;
          created_by: string | null;
          duplicate_rows: number | null;
          error_message: string | null;
          failed_rows: number | null;
          file_name: string;
          id: string;
          import_mode: string | null;
          inserted_rows: number | null;
          invalid_rows: number | null;
          skipped_rows: number | null;
          source_type: string | null;
          status: string;
          success_rows: number | null;
          total_rows: number | null;
          updated_at: string | null;
          updated_rows: number | null;
          valid_rows: number | null;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          duplicate_rows?: number | null;
          error_message?: string | null;
          failed_rows?: number | null;
          file_name: string;
          id?: string;
          import_mode?: string | null;
          inserted_rows?: number | null;
          invalid_rows?: number | null;
          skipped_rows?: number | null;
          source_type?: string | null;
          status?: string;
          success_rows?: number | null;
          total_rows?: number | null;
          updated_at?: string | null;
          updated_rows?: number | null;
          valid_rows?: number | null;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          duplicate_rows?: number | null;
          error_message?: string | null;
          failed_rows?: number | null;
          file_name?: string;
          id?: string;
          import_mode?: string | null;
          inserted_rows?: number | null;
          invalid_rows?: number | null;
          skipped_rows?: number | null;
          source_type?: string | null;
          status?: string;
          success_rows?: number | null;
          total_rows?: number | null;
          updated_at?: string | null;
          updated_rows?: number | null;
          valid_rows?: number | null;
        };
        Relationships: [];
      };
      customer_import_rows: {
        Row: {
          address: string | null;
          batch_id: string | null;
          business_name: string | null;
          city: string | null;
          contact_name: string | null;
          created_at: string | null;
          customer_channel: string | null;
          duplicate_reason: string | null;
          email: string | null;
          error_message: string | null;
          facility_name: string | null;
          id: string;
          import_action: string | null;
          imported_customer_id: string | null;
          is_valid: boolean | null;
          lifecycle_stage: string | null;
          matched_customer_id: string | null;
          name: string | null;
          normalized_email: string | null;
          normalized_phone: string | null;
          note: string | null;
          owner_sale_email: string | null;
          owner_sale_id: string | null;
          owner_tele_email: string | null;
          owner_tele_id: string | null;
          parsed_data: Json | null;
          phone: string | null;
          raw_data: Json;
          reviewed_at: string | null;
          reviewed_by: string | null;
          row_number: number | null;
          source: string | null;
          status: string;
          validation_errors: Json | null;
          validation_status: string | null;
          warning_message: string | null;
        };
        Insert: {
          address?: string | null;
          batch_id?: string | null;
          business_name?: string | null;
          city?: string | null;
          contact_name?: string | null;
          created_at?: string | null;
          customer_channel?: string | null;
          duplicate_reason?: string | null;
          email?: string | null;
          error_message?: string | null;
          facility_name?: string | null;
          id?: string;
          import_action?: string | null;
          imported_customer_id?: string | null;
          is_valid?: boolean | null;
          lifecycle_stage?: string | null;
          matched_customer_id?: string | null;
          name?: string | null;
          normalized_email?: string | null;
          normalized_phone?: string | null;
          note?: string | null;
          owner_sale_email?: string | null;
          owner_sale_id?: string | null;
          owner_tele_email?: string | null;
          owner_tele_id?: string | null;
          parsed_data?: Json | null;
          phone?: string | null;
          raw_data: Json;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          row_number?: number | null;
          source?: string | null;
          status?: string;
          validation_errors?: Json | null;
          validation_status?: string | null;
          warning_message?: string | null;
        };
        Update: {
          address?: string | null;
          batch_id?: string | null;
          business_name?: string | null;
          city?: string | null;
          contact_name?: string | null;
          created_at?: string | null;
          customer_channel?: string | null;
          duplicate_reason?: string | null;
          email?: string | null;
          error_message?: string | null;
          facility_name?: string | null;
          id?: string;
          import_action?: string | null;
          imported_customer_id?: string | null;
          is_valid?: boolean | null;
          lifecycle_stage?: string | null;
          matched_customer_id?: string | null;
          name?: string | null;
          normalized_email?: string | null;
          normalized_phone?: string | null;
          note?: string | null;
          owner_sale_email?: string | null;
          owner_sale_id?: string | null;
          owner_tele_email?: string | null;
          owner_tele_id?: string | null;
          parsed_data?: Json | null;
          phone?: string | null;
          raw_data?: Json;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          row_number?: number | null;
          source?: string | null;
          status?: string;
          validation_errors?: Json | null;
          validation_status?: string | null;
          warning_message?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "customer_import_rows_batch_id_fkey";
            columns: ["batch_id"];
            isOneToOne: false;
            referencedRelation: "customer_import_batches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_import_rows_imported_customer_id_fkey";
            columns: ["imported_customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_import_rows_imported_customer_id_fkey";
            columns: ["imported_customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_invalid_source";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_import_rows_imported_customer_id_fkey";
            columns: ["imported_customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_invalid_status";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_import_rows_imported_customer_id_fkey";
            columns: ["imported_customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_missing_required_info";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_import_rows_imported_customer_id_fkey";
            columns: ["imported_customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_contacted_recently";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_import_rows_imported_customer_id_fkey";
            columns: ["imported_customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_ready_for_email_marketing";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_import_rows_imported_customer_id_fkey";
            columns: ["imported_customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_ready_for_zalo_marketing";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_import_rows_imported_customer_id_fkey";
            columns: ["imported_customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_unassigned";
            referencedColumns: ["id"];
          },
        ];
      };
      customer_interactions: {
        Row: {
          account_id: string | null;
          contact_channel_id: string | null;
          content_preview: string | null;
          created_at: string | null;
          customer_id: string;
          direction: string | null;
          id: string;
          interaction_quality: string | null;
          interaction_type: string | null;
          interaction_weight: number | null;
          metadata: Json | null;
          platform: string | null;
          result: string | null;
          template_id: string | null;
          template_title: string | null;
          user_id: string;
        };
        Insert: {
          account_id?: string | null;
          contact_channel_id?: string | null;
          content_preview?: string | null;
          created_at?: string | null;
          customer_id: string;
          direction?: string | null;
          id?: string;
          interaction_quality?: string | null;
          interaction_type?: string | null;
          interaction_weight?: number | null;
          metadata?: Json | null;
          platform?: string | null;
          result?: string | null;
          template_id?: string | null;
          template_title?: string | null;
          user_id: string;
        };
        Update: {
          account_id?: string | null;
          contact_channel_id?: string | null;
          content_preview?: string | null;
          created_at?: string | null;
          customer_id?: string;
          direction?: string | null;
          id?: string;
          interaction_quality?: string | null;
          interaction_type?: string | null;
          interaction_weight?: number | null;
          metadata?: Json | null;
          platform?: string | null;
          result?: string | null;
          template_id?: string | null;
          template_title?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customer_interactions_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "user_communication_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_interactions_contact_channel_id_fkey";
            columns: ["contact_channel_id"];
            isOneToOne: false;
            referencedRelation: "customer_contact_channels";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_interactions_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_interactions_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_invalid_source";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_interactions_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_invalid_status";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_interactions_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_missing_required_info";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_interactions_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_contacted_recently";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_interactions_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_ready_for_email_marketing";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_interactions_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_ready_for_zalo_marketing";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_interactions_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_unassigned";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_interactions_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "message_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      customer_segments: {
        Row: {
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          name: string;
          rules: Json | null;
          segment_type: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          name: string;
          rules?: Json | null;
          segment_type?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          name?: string;
          rules?: Json | null;
          segment_type?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      customer_segments_map: {
        Row: {
          created_at: string;
          customer_id: string;
          segment_id: string;
        };
        Insert: {
          created_at?: string;
          customer_id: string;
          segment_id: string;
        };
        Update: {
          created_at?: string;
          customer_id?: string;
          segment_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customer_segments_map_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_segments_map_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_invalid_source";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_segments_map_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_invalid_status";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_segments_map_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_missing_required_info";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_segments_map_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_contacted_recently";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_segments_map_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_ready_for_email_marketing";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_segments_map_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_ready_for_zalo_marketing";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_segments_map_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_unassigned";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_segments_map_segment_id_fkey";
            columns: ["segment_id"];
            isOneToOne: false;
            referencedRelation: "customer_segments";
            referencedColumns: ["id"];
          },
        ];
      };
      customer_tag_links: {
        Row: {
          assigned_by: string | null;
          created_at: string | null;
          customer_id: string;
          tag_id: string;
        };
        Insert: {
          assigned_by?: string | null;
          created_at?: string | null;
          customer_id: string;
          tag_id: string;
        };
        Update: {
          assigned_by?: string | null;
          created_at?: string | null;
          customer_id?: string;
          tag_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customer_tag_links_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_tag_links_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_invalid_source";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_tag_links_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_invalid_status";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_tag_links_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_missing_required_info";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_tag_links_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_contacted_recently";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_tag_links_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_ready_for_email_marketing";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_tag_links_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_ready_for_zalo_marketing";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_tag_links_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_unassigned";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_tag_links_tag_id_fkey";
            columns: ["tag_id"];
            isOneToOne: false;
            referencedRelation: "customer_tags";
            referencedColumns: ["id"];
          },
        ];
      };
      customer_tags: {
        Row: {
          color: string | null;
          created_at: string | null;
          id: string;
          name: string;
        };
        Insert: {
          color?: string | null;
          created_at?: string | null;
          id?: string;
          name: string;
        };
        Update: {
          color?: string | null;
          created_at?: string | null;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      customer_tasks: {
        Row: {
          assigned_by: string | null;
          assigned_to: string | null;
          completed_at: string | null;
          created_at: string;
          customer_id: string | null;
          due_at: string | null;
          id: string;
          lead_id: string | null;
          next_action: string | null;
          note: string | null;
          owner_tele_id: string | null;
          priority: string;
          result: string | null;
          started_at: string | null;
          status: string;
          task_type: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          assigned_by?: string | null;
          assigned_to?: string | null;
          completed_at?: string | null;
          created_at?: string;
          customer_id?: string | null;
          due_at?: string | null;
          id?: string;
          lead_id?: string | null;
          next_action?: string | null;
          note?: string | null;
          owner_tele_id?: string | null;
          priority?: string;
          result?: string | null;
          started_at?: string | null;
          status?: string;
          task_type?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          assigned_by?: string | null;
          assigned_to?: string | null;
          completed_at?: string | null;
          created_at?: string;
          customer_id?: string | null;
          due_at?: string | null;
          id?: string;
          lead_id?: string | null;
          next_action?: string | null;
          note?: string | null;
          owner_tele_id?: string | null;
          priority?: string;
          result?: string | null;
          started_at?: string | null;
          status?: string;
          task_type?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customer_tasks_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_tasks_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_invalid_source";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_tasks_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_invalid_status";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_tasks_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_missing_required_info";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_tasks_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_contacted_recently";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_tasks_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_ready_for_email_marketing";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_tasks_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_ready_for_zalo_marketing";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_tasks_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_unassigned";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_tasks_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
        ];
      };
      customer_visit_checkins: {
        Row: {
          accuracy_meters: number | null;
          checked_in_at: string;
          checked_in_by: string | null;
          created_at: string;
          customer_id: string;
          customer_latitude: number | null;
          customer_longitude: number | null;
          distance_meters: number | null;
          id: string;
          is_valid_location: boolean;
          latitude: number;
          longitude: number;
          note: string | null;
          photo_url: string | null;
          valid_radius_meters: number;
        };
        Insert: {
          accuracy_meters?: number | null;
          checked_in_at?: string;
          checked_in_by?: string | null;
          created_at?: string;
          customer_id: string;
          customer_latitude?: number | null;
          customer_longitude?: number | null;
          distance_meters?: number | null;
          id?: string;
          is_valid_location?: boolean;
          latitude: number;
          longitude: number;
          note?: string | null;
          photo_url?: string | null;
          valid_radius_meters?: number;
        };
        Update: {
          accuracy_meters?: number | null;
          checked_in_at?: string;
          checked_in_by?: string | null;
          created_at?: string;
          customer_id?: string;
          customer_latitude?: number | null;
          customer_longitude?: number | null;
          distance_meters?: number | null;
          id?: string;
          is_valid_location?: boolean;
          latitude?: number;
          longitude?: number;
          note?: string | null;
          photo_url?: string | null;
          valid_radius_meters?: number;
        };
        Relationships: [
          {
            foreignKeyName: "customer_visit_checkins_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_visit_checkins_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_invalid_source";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_visit_checkins_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_invalid_status";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_visit_checkins_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_missing_required_info";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_visit_checkins_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_contacted_recently";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_visit_checkins_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_ready_for_email_marketing";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_visit_checkins_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_ready_for_zalo_marketing";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_visit_checkins_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_unassigned";
            referencedColumns: ["id"];
          },
        ];
      };
      customer_zalo_profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string | null;
          customer_id: string | null;
          id: string;
          is_following_oa: boolean | null;
          updated_at: string | null;
          zalo_id: string | null;
          zalo_name: string | null;
          zalo_phone: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string | null;
          customer_id?: string | null;
          id?: string;
          is_following_oa?: boolean | null;
          updated_at?: string | null;
          zalo_id?: string | null;
          zalo_name?: string | null;
          zalo_phone?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string | null;
          customer_id?: string | null;
          id?: string;
          is_following_oa?: boolean | null;
          updated_at?: string | null;
          zalo_id?: string | null;
          zalo_name?: string | null;
          zalo_phone?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "customer_zalo_profiles_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_zalo_profiles_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_invalid_source";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_zalo_profiles_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_invalid_status";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_zalo_profiles_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_missing_required_info";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_zalo_profiles_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_contacted_recently";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_zalo_profiles_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_ready_for_email_marketing";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_zalo_profiles_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_ready_for_zalo_marketing";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_zalo_profiles_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_unassigned";
            referencedColumns: ["id"];
          },
        ];
      };
      customers: {
        Row: {
          address: string | null;
          anniversary_date: string | null;
          at_risk_at: string | null;
          backup_contact_no: string | null;
          bed_count: number | null;
          brand_affinity: string | null;
          business_license_no: string | null;
          business_name: string | null;
          business_size: string | null;
          business_type: string | null;
          care_model: string | null;
          channel_preferences: Json | null;
          city: string | null;
          contact_name: string | null;
          created_at: string;
          created_by: string | null;
          current_brands: string | null;
          customer_channel: string | null;
          customer_distance_type: string | null;
          data_quality_status: string;
          decision_maker: string | null;
          decision_maker_dob: string | null;
          decision_maker_gender: string | null;
          decision_role: string | null;
          delete_reason: string | null;
          deleted_at: string | null;
          deleted_by: string | null;
          district: string | null;
          email: string | null;
          email_opt_in: boolean | null;
          facebook: string | null;
          facility_name: string | null;
          formatted_address: string | null;
          free_pool_at: string | null;
          geo_source: string | null;
          geo_verified_at: string | null;
          geo_verified_by: string | null;
          geocode_status: string | null;
          geocoded_at: string | null;
          historical_last_purchase_at: string | null;
          historical_order_count: number | null;
          historical_revenue_note: string | null;
          historical_revenue_source: string | null;
          historical_revenue_total: number | null;
          historical_revenue_updated_at: string | null;
          id: string;
          interested_products: string | null;
          internal_security_note: string | null;
          last_activity_at: string | null;
          last_assigned_at: string | null;
          last_contacted_at: string | null;
          last_marketing_sent_at: string | null;
          last_order_at: string | null;
          last_owner_activity_at: string | null;
          last_reassigned_at: string | null;
          latitude: number | null;
          lead_score: number | null;
          lifecycle_stage: string | null;
          longitude: number | null;
          loyalty_score: number | null;
          main_service: string | null;
          map_note: string | null;
          marketing_opt_in: boolean | null;
          marketing_opt_in_at: string | null;
          marketing_opt_out_at: string | null;
          merged_into_customer_id: string | null;
          monthly_purchase_potential: number | null;
          name: string;
          next_follow_up_at: string | null;
          normalized_email: string | null;
          normalized_phone: string | null;
          note: string | null;
          operating_status: string | null;
          opt_out_reason: string | null;
          owner_sale_id: string | null;
          owner_tele_id: string | null;
          ownership_status: string;
          personality_trait: string | null;
          phone: string | null;
          potential_level: string;
          preferred_contact_channel: string | null;
          preferred_marketing_content: string[] | null;
          reassigned_by: string | null;
          reclaim_reason: string | null;
          reclaimable_at: string | null;
          region: string | null;
          skin_concern_focus: string | null;
          sms_opt_in: boolean | null;
          source: string | null;
          spa_equipment: string[] | null;
          staff_count: number | null;
          status: string;
          tags: string[] | null;
          tax_code: string | null;
          tech_equipment: string | null;
          total_order_amount: number;
          total_orders_count: number;
          training_needs: string[] | null;
          treatment_focus: string[] | null;
          updated_at: string;
          updated_by: string | null;
          user_id: string | null;
          zalo: string | null;
          zalo_opt_in: boolean | null;
        };
        Insert: {
          address?: string | null;
          anniversary_date?: string | null;
          at_risk_at?: string | null;
          backup_contact_no?: string | null;
          bed_count?: number | null;
          brand_affinity?: string | null;
          business_license_no?: string | null;
          business_name?: string | null;
          business_size?: string | null;
          business_type?: string | null;
          care_model?: string | null;
          channel_preferences?: Json | null;
          city?: string | null;
          contact_name?: string | null;
          created_at?: string;
          created_by?: string | null;
          current_brands?: string | null;
          customer_channel?: string | null;
          customer_distance_type?: string | null;
          data_quality_status?: string;
          decision_maker?: string | null;
          decision_maker_dob?: string | null;
          decision_maker_gender?: string | null;
          decision_role?: string | null;
          delete_reason?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          district?: string | null;
          email?: string | null;
          email_opt_in?: boolean | null;
          facebook?: string | null;
          facility_name?: string | null;
          formatted_address?: string | null;
          free_pool_at?: string | null;
          geo_source?: string | null;
          geo_verified_at?: string | null;
          geo_verified_by?: string | null;
          geocode_status?: string | null;
          geocoded_at?: string | null;
          historical_last_purchase_at?: string | null;
          historical_order_count?: number | null;
          historical_revenue_note?: string | null;
          historical_revenue_source?: string | null;
          historical_revenue_total?: number | null;
          historical_revenue_updated_at?: string | null;
          id?: string;
          interested_products?: string | null;
          internal_security_note?: string | null;
          last_activity_at?: string | null;
          last_assigned_at?: string | null;
          last_contacted_at?: string | null;
          last_marketing_sent_at?: string | null;
          last_order_at?: string | null;
          last_owner_activity_at?: string | null;
          last_reassigned_at?: string | null;
          latitude?: number | null;
          lead_score?: number | null;
          lifecycle_stage?: string | null;
          longitude?: number | null;
          loyalty_score?: number | null;
          main_service?: string | null;
          map_note?: string | null;
          marketing_opt_in?: boolean | null;
          marketing_opt_in_at?: string | null;
          marketing_opt_out_at?: string | null;
          merged_into_customer_id?: string | null;
          monthly_purchase_potential?: number | null;
          name: string;
          next_follow_up_at?: string | null;
          normalized_email?: string | null;
          normalized_phone?: string | null;
          note?: string | null;
          operating_status?: string | null;
          opt_out_reason?: string | null;
          owner_sale_id?: string | null;
          owner_tele_id?: string | null;
          ownership_status?: string;
          personality_trait?: string | null;
          phone?: string | null;
          potential_level?: string;
          preferred_contact_channel?: string | null;
          preferred_marketing_content?: string[] | null;
          reassigned_by?: string | null;
          reclaim_reason?: string | null;
          reclaimable_at?: string | null;
          region?: string | null;
          skin_concern_focus?: string | null;
          sms_opt_in?: boolean | null;
          source?: string | null;
          spa_equipment?: string[] | null;
          staff_count?: number | null;
          status?: string;
          tags?: string[] | null;
          tax_code?: string | null;
          tech_equipment?: string | null;
          total_order_amount?: number;
          total_orders_count?: number;
          training_needs?: string[] | null;
          treatment_focus?: string[] | null;
          updated_at?: string;
          updated_by?: string | null;
          user_id?: string | null;
          zalo?: string | null;
          zalo_opt_in?: boolean | null;
        };
        Update: {
          address?: string | null;
          anniversary_date?: string | null;
          at_risk_at?: string | null;
          backup_contact_no?: string | null;
          bed_count?: number | null;
          brand_affinity?: string | null;
          business_license_no?: string | null;
          business_name?: string | null;
          business_size?: string | null;
          business_type?: string | null;
          care_model?: string | null;
          channel_preferences?: Json | null;
          city?: string | null;
          contact_name?: string | null;
          created_at?: string;
          created_by?: string | null;
          current_brands?: string | null;
          customer_channel?: string | null;
          customer_distance_type?: string | null;
          data_quality_status?: string;
          decision_maker?: string | null;
          decision_maker_dob?: string | null;
          decision_maker_gender?: string | null;
          decision_role?: string | null;
          delete_reason?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          district?: string | null;
          email?: string | null;
          email_opt_in?: boolean | null;
          facebook?: string | null;
          facility_name?: string | null;
          formatted_address?: string | null;
          free_pool_at?: string | null;
          geo_source?: string | null;
          geo_verified_at?: string | null;
          geo_verified_by?: string | null;
          geocode_status?: string | null;
          geocoded_at?: string | null;
          historical_last_purchase_at?: string | null;
          historical_order_count?: number | null;
          historical_revenue_note?: string | null;
          historical_revenue_source?: string | null;
          historical_revenue_total?: number | null;
          historical_revenue_updated_at?: string | null;
          id?: string;
          interested_products?: string | null;
          internal_security_note?: string | null;
          last_activity_at?: string | null;
          last_assigned_at?: string | null;
          last_contacted_at?: string | null;
          last_marketing_sent_at?: string | null;
          last_order_at?: string | null;
          last_owner_activity_at?: string | null;
          last_reassigned_at?: string | null;
          latitude?: number | null;
          lead_score?: number | null;
          lifecycle_stage?: string | null;
          longitude?: number | null;
          loyalty_score?: number | null;
          main_service?: string | null;
          map_note?: string | null;
          marketing_opt_in?: boolean | null;
          marketing_opt_in_at?: string | null;
          marketing_opt_out_at?: string | null;
          merged_into_customer_id?: string | null;
          monthly_purchase_potential?: number | null;
          name?: string;
          next_follow_up_at?: string | null;
          normalized_email?: string | null;
          normalized_phone?: string | null;
          note?: string | null;
          operating_status?: string | null;
          opt_out_reason?: string | null;
          owner_sale_id?: string | null;
          owner_tele_id?: string | null;
          ownership_status?: string;
          personality_trait?: string | null;
          phone?: string | null;
          potential_level?: string;
          preferred_contact_channel?: string | null;
          preferred_marketing_content?: string[] | null;
          reassigned_by?: string | null;
          reclaim_reason?: string | null;
          reclaimable_at?: string | null;
          region?: string | null;
          skin_concern_focus?: string | null;
          sms_opt_in?: boolean | null;
          source?: string | null;
          spa_equipment?: string[] | null;
          staff_count?: number | null;
          status?: string;
          tags?: string[] | null;
          tax_code?: string | null;
          tech_equipment?: string | null;
          total_order_amount?: number;
          total_orders_count?: number;
          training_needs?: string[] | null;
          treatment_focus?: string[] | null;
          updated_at?: string;
          updated_by?: string | null;
          user_id?: string | null;
          zalo?: string | null;
          zalo_opt_in?: boolean | null;
        };
        Relationships: [
          {
            foreignKeyName: "customers_merged_into_customer_id_fkey";
            columns: ["merged_into_customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customers_merged_into_customer_id_fkey";
            columns: ["merged_into_customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_invalid_source";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customers_merged_into_customer_id_fkey";
            columns: ["merged_into_customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_invalid_status";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customers_merged_into_customer_id_fkey";
            columns: ["merged_into_customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_missing_required_info";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customers_merged_into_customer_id_fkey";
            columns: ["merged_into_customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_contacted_recently";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customers_merged_into_customer_id_fkey";
            columns: ["merged_into_customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_ready_for_email_marketing";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customers_merged_into_customer_id_fkey";
            columns: ["merged_into_customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_ready_for_zalo_marketing";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customers_merged_into_customer_id_fkey";
            columns: ["merged_into_customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_unassigned";
            referencedColumns: ["id"];
          },
        ];
      };
      event_registrations: {
        Row: {
          add_to_calendar_url: string | null;
          assigned_sale_id: string | null;
          attendee_email: string | null;
          calendar_link_sent_at: string | null;
          calendar_link_sent_by: string | null;
          checked_in_at: string | null;
          converted_order_id: string | null;
          created_at: string;
          customer_business_name: string | null;
          customer_id: string | null;
          customer_name: string | null;
          customer_phone: string | null;
          event_id: string;
          id: string;
          note: string | null;
          registered_by: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          add_to_calendar_url?: string | null;
          assigned_sale_id?: string | null;
          attendee_email?: string | null;
          calendar_link_sent_at?: string | null;
          calendar_link_sent_by?: string | null;
          checked_in_at?: string | null;
          converted_order_id?: string | null;
          created_at?: string;
          customer_business_name?: string | null;
          customer_id?: string | null;
          customer_name?: string | null;
          customer_phone?: string | null;
          event_id: string;
          id?: string;
          note?: string | null;
          registered_by?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          add_to_calendar_url?: string | null;
          assigned_sale_id?: string | null;
          attendee_email?: string | null;
          calendar_link_sent_at?: string | null;
          calendar_link_sent_by?: string | null;
          checked_in_at?: string | null;
          converted_order_id?: string | null;
          created_at?: string;
          customer_business_name?: string | null;
          customer_id?: string | null;
          customer_name?: string | null;
          customer_phone?: string | null;
          event_id?: string;
          id?: string;
          note?: string | null;
          registered_by?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_registrations_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_registrations_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_invalid_source";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_registrations_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_invalid_status";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_registrations_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_missing_required_info";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_registrations_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_contacted_recently";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_registrations_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_ready_for_email_marketing";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_registrations_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_ready_for_zalo_marketing";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_registrations_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_unassigned";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_registrations_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "company_events";
            referencedColumns: ["id"];
          },
        ];
      };
      google_calendar_accounts: {
        Row: {
          auth_type: string;
          calendar_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          is_active: boolean;
          is_default: boolean;
          name: string;
          owner_email: string | null;
          provider: string;
          updated_at: string;
        };
        Insert: {
          auth_type?: string;
          calendar_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          is_default?: boolean;
          name: string;
          owner_email?: string | null;
          provider?: string;
          updated_at?: string;
        };
        Update: {
          auth_type?: string;
          calendar_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          is_default?: boolean;
          name?: string;
          owner_email?: string | null;
          provider?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      leads: {
        Row: {
          assigned_sale_id: string | null;
          created_at: string;
          distance_type: string | null;
          email: string | null;
          facility_name: string | null;
          id: string;
          lead_route: string | null;
          name: string;
          notes: string | null;
          owner_sale_id: string | null;
          owner_tele_id: string | null;
          phone: string | null;
          status: string | null;
          updated_at: string;
        };
        Insert: {
          assigned_sale_id?: string | null;
          created_at?: string;
          distance_type?: string | null;
          email?: string | null;
          facility_name?: string | null;
          id?: string;
          lead_route?: string | null;
          name: string;
          notes?: string | null;
          owner_sale_id?: string | null;
          owner_tele_id?: string | null;
          phone?: string | null;
          status?: string | null;
          updated_at?: string;
        };
        Update: {
          assigned_sale_id?: string | null;
          created_at?: string;
          distance_type?: string | null;
          email?: string | null;
          facility_name?: string | null;
          id?: string;
          lead_route?: string | null;
          name?: string;
          notes?: string | null;
          owner_sale_id?: string | null;
          owner_tele_id?: string | null;
          phone?: string | null;
          status?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      marketing_campaigns: {
        Row: {
          approval_status: string | null;
          approved_at: string | null;
          approved_by: string | null;
          audience_count: number | null;
          cancelled_at: string | null;
          channel: string | null;
          completed_at: string | null;
          created_at: string;
          created_by: string | null;
          draft_body: string | null;
          draft_subject: string | null;
          estimated_recipients: number | null;
          failed_recipients: number | null;
          failure_reason: string | null;
          final_confirmed_at: string | null;
          final_confirmed_by: string | null;
          id: string;
          last_previewed_at: string | null;
          metrics: Json | null;
          name: string;
          override_variables: Json | null;
          pause_reason: string | null;
          paused_at: string | null;
          paused_by: string | null;
          processed_recipients: number | null;
          scheduled_at: string | null;
          segment_id: string | null;
          sender_account_id: string | null;
          started_at: string | null;
          status: string;
          successful_recipients: number | null;
          target_criteria: Json | null;
          template_id: string | null;
          updated_at: string;
          zns_template_id: string | null;
        };
        Insert: {
          approval_status?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
          audience_count?: number | null;
          cancelled_at?: string | null;
          channel?: string | null;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          draft_body?: string | null;
          draft_subject?: string | null;
          estimated_recipients?: number | null;
          failed_recipients?: number | null;
          failure_reason?: string | null;
          final_confirmed_at?: string | null;
          final_confirmed_by?: string | null;
          id?: string;
          last_previewed_at?: string | null;
          metrics?: Json | null;
          name: string;
          override_variables?: Json | null;
          pause_reason?: string | null;
          paused_at?: string | null;
          paused_by?: string | null;
          processed_recipients?: number | null;
          scheduled_at?: string | null;
          segment_id?: string | null;
          sender_account_id?: string | null;
          started_at?: string | null;
          status?: string;
          successful_recipients?: number | null;
          target_criteria?: Json | null;
          template_id?: string | null;
          updated_at?: string;
          zns_template_id?: string | null;
        };
        Update: {
          approval_status?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
          audience_count?: number | null;
          cancelled_at?: string | null;
          channel?: string | null;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          draft_body?: string | null;
          draft_subject?: string | null;
          estimated_recipients?: number | null;
          failed_recipients?: number | null;
          failure_reason?: string | null;
          final_confirmed_at?: string | null;
          final_confirmed_by?: string | null;
          id?: string;
          last_previewed_at?: string | null;
          metrics?: Json | null;
          name?: string;
          override_variables?: Json | null;
          pause_reason?: string | null;
          paused_at?: string | null;
          paused_by?: string | null;
          processed_recipients?: number | null;
          scheduled_at?: string | null;
          segment_id?: string | null;
          sender_account_id?: string | null;
          started_at?: string | null;
          status?: string;
          successful_recipients?: number | null;
          target_criteria?: Json | null;
          template_id?: string | null;
          updated_at?: string;
          zns_template_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "marketing_campaigns_segment_id_fkey";
            columns: ["segment_id"];
            isOneToOne: false;
            referencedRelation: "customer_segments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketing_campaigns_sender_account_id_fkey";
            columns: ["sender_account_id"];
            isOneToOne: false;
            referencedRelation: "sender_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketing_campaigns_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "message_templates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketing_campaigns_zns_template_id_fkey";
            columns: ["zns_template_id"];
            isOneToOne: false;
            referencedRelation: "zns_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      marketing_delivery_logs: {
        Row: {
          campaign_id: string | null;
          channel: string;
          created_at: string;
          created_by: string | null;
          customer_id: string | null;
          dedupe_key: string | null;
          delivery_metadata: Json | null;
          id: string;
          last_retry_at: string | null;
          mode: string;
          normalized_error_code: string | null;
          personal_sender_id: string | null;
          provider_message_id: string | null;
          provider_response: Json | null;
          reason: string | null;
          retry_count: number | null;
          sender_account_id: string | null;
          status: string;
          template_id: string | null;
          zns_template_id: string | null;
        };
        Insert: {
          campaign_id?: string | null;
          channel: string;
          created_at?: string;
          created_by?: string | null;
          customer_id?: string | null;
          dedupe_key?: string | null;
          delivery_metadata?: Json | null;
          id?: string;
          last_retry_at?: string | null;
          mode?: string;
          normalized_error_code?: string | null;
          personal_sender_id?: string | null;
          provider_message_id?: string | null;
          provider_response?: Json | null;
          reason?: string | null;
          retry_count?: number | null;
          sender_account_id?: string | null;
          status?: string;
          template_id?: string | null;
          zns_template_id?: string | null;
        };
        Update: {
          campaign_id?: string | null;
          channel?: string;
          created_at?: string;
          created_by?: string | null;
          customer_id?: string | null;
          dedupe_key?: string | null;
          delivery_metadata?: Json | null;
          id?: string;
          last_retry_at?: string | null;
          mode?: string;
          normalized_error_code?: string | null;
          personal_sender_id?: string | null;
          provider_message_id?: string | null;
          provider_response?: Json | null;
          reason?: string | null;
          retry_count?: number | null;
          sender_account_id?: string | null;
          status?: string;
          template_id?: string | null;
          zns_template_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "marketing_delivery_logs_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "marketing_campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketing_delivery_logs_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketing_delivery_logs_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_invalid_source";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketing_delivery_logs_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_invalid_status";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketing_delivery_logs_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_missing_required_info";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketing_delivery_logs_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_contacted_recently";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketing_delivery_logs_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_ready_for_email_marketing";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketing_delivery_logs_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_ready_for_zalo_marketing";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketing_delivery_logs_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_unassigned";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketing_delivery_logs_zns_template_id_fkey";
            columns: ["zns_template_id"];
            isOneToOne: false;
            referencedRelation: "zns_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      marketing_retry_queue: {
        Row: {
          channel: string;
          created_at: string | null;
          customer_id: string | null;
          delivery_log_id: string | null;
          id: string;
          max_retries: number | null;
          next_retry_at: string | null;
          normalized_error_code: string | null;
          payload: Json | null;
          retry_count: number | null;
          retry_reason: string | null;
          sender_account_id: string | null;
          status: string;
          template_id: string | null;
          updated_at: string | null;
        };
        Insert: {
          channel: string;
          created_at?: string | null;
          customer_id?: string | null;
          delivery_log_id?: string | null;
          id?: string;
          max_retries?: number | null;
          next_retry_at?: string | null;
          normalized_error_code?: string | null;
          payload?: Json | null;
          retry_count?: number | null;
          retry_reason?: string | null;
          sender_account_id?: string | null;
          status?: string;
          template_id?: string | null;
          updated_at?: string | null;
        };
        Update: {
          channel?: string;
          created_at?: string | null;
          customer_id?: string | null;
          delivery_log_id?: string | null;
          id?: string;
          max_retries?: number | null;
          next_retry_at?: string | null;
          normalized_error_code?: string | null;
          payload?: Json | null;
          retry_count?: number | null;
          retry_reason?: string | null;
          sender_account_id?: string | null;
          status?: string;
          template_id?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "marketing_retry_queue_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketing_retry_queue_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_invalid_source";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketing_retry_queue_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_invalid_status";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketing_retry_queue_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_missing_required_info";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketing_retry_queue_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_contacted_recently";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketing_retry_queue_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_ready_for_email_marketing";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketing_retry_queue_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_ready_for_zalo_marketing";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketing_retry_queue_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_unassigned";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketing_retry_queue_delivery_log_id_fkey";
            columns: ["delivery_log_id"];
            isOneToOne: false;
            referencedRelation: "marketing_delivery_logs";
            referencedColumns: ["id"];
          },
        ];
      };
      marketing_suppression_list: {
        Row: {
          channel: string;
          contact_value: string;
          created_at: string;
          created_by: string | null;
          id: string;
          is_active: boolean;
          metadata: Json;
          normalized_contact_value: string;
          note: string | null;
          reason: string;
          source: string | null;
          updated_at: string;
        };
        Insert: {
          channel: string;
          contact_value: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          metadata?: Json;
          normalized_contact_value: string;
          note?: string | null;
          reason: string;
          source?: string | null;
          updated_at?: string;
        };
        Update: {
          channel?: string;
          contact_value?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          metadata?: Json;
          normalized_contact_value?: string;
          note?: string | null;
          reason?: string;
          source?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      message_send_logs: {
        Row: {
          campaign_id: string | null;
          channel: string;
          created_at: string;
          customer_id: string | null;
          error_message: string | null;
          event_registration_id: string | null;
          id: string;
          lead_id: string | null;
          provider_response: Json | null;
          purpose: string;
          recipient_email: string | null;
          recipient_phone: string | null;
          sender_account_id: string | null;
          sent_by: string | null;
          status: string;
          template_id: string | null;
        };
        Insert: {
          campaign_id?: string | null;
          channel: string;
          created_at?: string;
          customer_id?: string | null;
          error_message?: string | null;
          event_registration_id?: string | null;
          id?: string;
          lead_id?: string | null;
          provider_response?: Json | null;
          purpose: string;
          recipient_email?: string | null;
          recipient_phone?: string | null;
          sender_account_id?: string | null;
          sent_by?: string | null;
          status?: string;
          template_id?: string | null;
        };
        Update: {
          campaign_id?: string | null;
          channel?: string;
          created_at?: string;
          customer_id?: string | null;
          error_message?: string | null;
          event_registration_id?: string | null;
          id?: string;
          lead_id?: string | null;
          provider_response?: Json | null;
          purpose?: string;
          recipient_email?: string | null;
          recipient_phone?: string | null;
          sender_account_id?: string | null;
          sent_by?: string | null;
          status?: string;
          template_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "message_send_logs_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "marketing_campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_send_logs_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_send_logs_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_invalid_source";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_send_logs_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_invalid_status";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_send_logs_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_missing_required_info";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_send_logs_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_contacted_recently";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_send_logs_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_ready_for_email_marketing";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_send_logs_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_ready_for_zalo_marketing";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_send_logs_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_unassigned";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_send_logs_sender_account_id_fkey";
            columns: ["sender_account_id"];
            isOneToOne: false;
            referencedRelation: "sender_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_send_logs_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "message_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      message_templates: {
        Row: {
          attachment_urls: Json | null;
          banner_image_url: string | null;
          body_template: string;
          category: string | null;
          channel: string;
          content: string;
          created_at: string;
          created_by: string | null;
          cta_label: string | null;
          cta_url: string | null;
          description: string | null;
          footer_template: string | null;
          id: string;
          include_unsubscribe: boolean;
          is_active: boolean;
          is_shared: boolean | null;
          key: string;
          max_send_frequency_days: number | null;
          name: string;
          platform: string;
          purpose: string;
          requires_opt_in: boolean;
          sample_variables: Json | null;
          subject_template: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          attachment_urls?: Json | null;
          banner_image_url?: string | null;
          body_template: string;
          category?: string | null;
          channel?: string;
          content?: string;
          created_at?: string;
          created_by?: string | null;
          cta_label?: string | null;
          cta_url?: string | null;
          description?: string | null;
          footer_template?: string | null;
          id?: string;
          include_unsubscribe?: boolean;
          is_active?: boolean;
          is_shared?: boolean | null;
          key: string;
          max_send_frequency_days?: number | null;
          name: string;
          platform?: string;
          purpose?: string;
          requires_opt_in?: boolean;
          sample_variables?: Json | null;
          subject_template?: string | null;
          title?: string;
          updated_at?: string;
        };
        Update: {
          attachment_urls?: Json | null;
          banner_image_url?: string | null;
          body_template?: string;
          category?: string | null;
          channel?: string;
          content?: string;
          created_at?: string;
          created_by?: string | null;
          cta_label?: string | null;
          cta_url?: string | null;
          description?: string | null;
          footer_template?: string | null;
          id?: string;
          include_unsubscribe?: boolean;
          is_active?: boolean;
          is_shared?: boolean | null;
          key?: string;
          max_send_frequency_days?: number | null;
          name?: string;
          platform?: string;
          purpose?: string;
          requires_opt_in?: boolean;
          sample_variables?: Json | null;
          subject_template?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          actor_user_id: string | null;
          created_at: string;
          customer_id: string | null;
          deep_link: string | null;
          dismissed_at: string | null;
          id: string;
          message: string | null;
          metadata: Json | null;
          notification_type: string;
          priority: string;
          read_at: string | null;
          recipient_user_id: string;
          related_id: string | null;
          related_type: string | null;
          status: string | null;
          title: string;
        };
        Insert: {
          actor_user_id?: string | null;
          created_at?: string;
          customer_id?: string | null;
          deep_link?: string | null;
          dismissed_at?: string | null;
          id?: string;
          message?: string | null;
          metadata?: Json | null;
          notification_type: string;
          priority?: string;
          read_at?: string | null;
          recipient_user_id: string;
          related_id?: string | null;
          related_type?: string | null;
          status?: string | null;
          title: string;
        };
        Update: {
          actor_user_id?: string | null;
          created_at?: string;
          customer_id?: string | null;
          deep_link?: string | null;
          dismissed_at?: string | null;
          id?: string;
          message?: string | null;
          metadata?: Json | null;
          notification_type?: string;
          priority?: string;
          read_at?: string | null;
          recipient_user_id?: string;
          related_id?: string | null;
          related_type?: string | null;
          status?: string | null;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_invalid_source";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_invalid_status";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_missing_required_info";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_contacted_recently";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_ready_for_email_marketing";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_ready_for_zalo_marketing";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_unassigned";
            referencedColumns: ["id"];
          },
        ];
      };
      order_items: {
        Row: {
          created_at: string;
          id: string;
          line_total: number;
          order_id: string;
          product_name: string;
          product_no: number | null;
          quantity: number;
          size: string | null;
          size_type: string | null;
          unit_price: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          line_total?: number;
          order_id: string;
          product_name: string;
          product_no?: number | null;
          quantity?: number;
          size?: string | null;
          size_type?: string | null;
          unit_price?: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          line_total?: number;
          order_id?: string;
          product_name?: string;
          product_no?: number | null;
          quantity?: number;
          size?: string | null;
          size_type?: string | null;
          unit_price?: number;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          created_at: string;
          customer_address: string | null;
          customer_id: string | null;
          customer_name: string;
          customer_phone: string | null;
          discount_rate: number;
          id: string;
          note: string | null;
          order_no: number;
          sale_user_id: string;
          status: string;
          subtotal: number;
          total: number;
          updated_at: string;
          vat_rate: number;
        };
        Insert: {
          created_at?: string;
          customer_address?: string | null;
          customer_id?: string | null;
          customer_name: string;
          customer_phone?: string | null;
          discount_rate?: number;
          id?: string;
          note?: string | null;
          order_no?: number;
          sale_user_id: string;
          status?: string;
          subtotal?: number;
          total?: number;
          updated_at?: string;
          vat_rate?: number;
        };
        Update: {
          created_at?: string;
          customer_address?: string | null;
          customer_id?: string | null;
          customer_name?: string;
          customer_phone?: string | null;
          discount_rate?: number;
          id?: string;
          note?: string | null;
          order_no?: number;
          sale_user_id?: string;
          status?: string;
          subtotal?: number;
          total?: number;
          updated_at?: string;
          vat_rate?: number;
        };
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_invalid_source";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_invalid_status";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_missing_required_info";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_contacted_recently";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_ready_for_email_marketing";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_ready_for_zalo_marketing";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_unassigned";
            referencedColumns: ["id"];
          },
        ];
      };
      pilot_feedback_logs: {
        Row: {
          action_key: string | null;
          created_at: string;
          customer_id: string | null;
          feedback_note: string | null;
          feedback_type: string;
          id: string;
          page_key: string;
          user_id: string;
        };
        Insert: {
          action_key?: string | null;
          created_at?: string;
          customer_id?: string | null;
          feedback_note?: string | null;
          feedback_type: string;
          id?: string;
          page_key: string;
          user_id: string;
        };
        Update: {
          action_key?: string | null;
          created_at?: string;
          customer_id?: string | null;
          feedback_note?: string | null;
          feedback_type?: string;
          id?: string;
          page_key?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pilot_feedback_logs_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pilot_feedback_logs_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_invalid_source";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pilot_feedback_logs_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_invalid_status";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pilot_feedback_logs_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_missing_required_info";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pilot_feedback_logs_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_contacted_recently";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pilot_feedback_logs_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_ready_for_email_marketing";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pilot_feedback_logs_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_ready_for_zalo_marketing";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pilot_feedback_logs_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_unassigned";
            referencedColumns: ["id"];
          },
        ];
      };
      pilot_modules: {
        Row: {
          module_category: string;
          module_key: string;
          module_name: string;
          rollout_state: string;
          updated_at: string | null;
        };
        Insert: {
          module_category: string;
          module_key: string;
          module_name: string;
          rollout_state?: string;
          updated_at?: string | null;
        };
        Update: {
          module_category?: string;
          module_key?: string;
          module_name?: string;
          rollout_state?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      pilot_usage_metrics: {
        Row: {
          action_key: string;
          created_at: string;
          id: string;
          metric_data: Json | null;
          page_key: string;
          session_id: string | null;
          user_id: string;
        };
        Insert: {
          action_key: string;
          created_at?: string;
          id?: string;
          metric_data?: Json | null;
          page_key: string;
          session_id?: string | null;
          user_id: string;
        };
        Update: {
          action_key?: string;
          created_at?: string;
          id?: string;
          metric_data?: Json | null;
          page_key?: string;
          session_id?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      pilot_users: {
        Row: {
          created_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pilot_users_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      product_copilot_quick_replies: {
        Row: {
          category: string;
          created_at: string;
          created_by: string | null;
          id: string;
          is_active: boolean;
          prompt: string;
          requires_context: boolean;
          sort_order: number;
          title: string;
        };
        Insert: {
          category?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          prompt: string;
          requires_context?: boolean;
          sort_order?: number;
          title: string;
        };
        Update: {
          category?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          prompt?: string;
          requires_context?: boolean;
          sort_order?: number;
          title?: string;
        };
        Relationships: [];
      };
      product_faqs: {
        Row: {
          answer: string;
          created_at: string;
          created_by: string | null;
          id: string;
          is_active: boolean | null;
          product_id: number;
          question: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          answer: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean | null;
          product_id: number;
          question: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          answer?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean | null;
          product_id?: number;
          question?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      product_knowledge: {
        Row: {
          approved_at: string | null;
          approved_by: string | null;
          benefits: string;
          build_status: string | null;
          contraindications: string[] | null;
          created_at: string;
          created_by: string | null;
          cross_sell_products: number[] | null;
          embedding_error: string | null;
          id: string;
          ingredient_highlights: string[] | null;
          is_active: boolean | null;
          knowledge_version: number;
          last_embedded_at: string | null;
          pregnancy_safe: boolean | null;
          product_id: number;
          qa_notes: string | null;
          qa_status: string;
          rejection_reason: string | null;
          restock_cycle_days: number | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          routine_position: string | null;
          sales_pitch: string;
          seasonal_usage: string[] | null;
          skin_concerns: string[] | null;
          skin_type: string[] | null;
          skin_types: string[] | null;
          status_reason_type: string | null;
          suitable_spa_types: string[] | null;
          updated_at: string;
          updated_by: string | null;
          usage_instructions: string;
          warnings: string | null;
        };
        Insert: {
          approved_at?: string | null;
          approved_by?: string | null;
          benefits: string;
          build_status?: string | null;
          contraindications?: string[] | null;
          created_at?: string;
          created_by?: string | null;
          cross_sell_products?: number[] | null;
          embedding_error?: string | null;
          id?: string;
          ingredient_highlights?: string[] | null;
          is_active?: boolean | null;
          knowledge_version?: number;
          last_embedded_at?: string | null;
          pregnancy_safe?: boolean | null;
          product_id: number;
          qa_notes?: string | null;
          qa_status?: string;
          rejection_reason?: string | null;
          restock_cycle_days?: number | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          routine_position?: string | null;
          sales_pitch: string;
          seasonal_usage?: string[] | null;
          skin_concerns?: string[] | null;
          skin_type?: string[] | null;
          skin_types?: string[] | null;
          status_reason_type?: string | null;
          suitable_spa_types?: string[] | null;
          updated_at?: string;
          updated_by?: string | null;
          usage_instructions: string;
          warnings?: string | null;
        };
        Update: {
          approved_at?: string | null;
          approved_by?: string | null;
          benefits?: string;
          build_status?: string | null;
          contraindications?: string[] | null;
          created_at?: string;
          created_by?: string | null;
          cross_sell_products?: number[] | null;
          embedding_error?: string | null;
          id?: string;
          ingredient_highlights?: string[] | null;
          is_active?: boolean | null;
          knowledge_version?: number;
          last_embedded_at?: string | null;
          pregnancy_safe?: boolean | null;
          product_id?: number;
          qa_notes?: string | null;
          qa_status?: string;
          rejection_reason?: string | null;
          restock_cycle_days?: number | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          routine_position?: string | null;
          sales_pitch?: string;
          seasonal_usage?: string[] | null;
          skin_concerns?: string[] | null;
          skin_type?: string[] | null;
          skin_types?: string[] | null;
          status_reason_type?: string | null;
          suitable_spa_types?: string[] | null;
          updated_at?: string;
          updated_by?: string | null;
          usage_instructions?: string;
          warnings?: string | null;
        };
        Relationships: [];
      };
      product_knowledge_chunks: {
        Row: {
          chunk_type: string;
          content: string;
          created_at: string;
          embedding: string | null;
          id: string;
          is_active: boolean;
          knowledge_version: number;
          metadata: Json | null;
          product_id: number;
        };
        Insert: {
          chunk_type: string;
          content: string;
          created_at?: string;
          embedding?: string | null;
          id?: string;
          is_active?: boolean;
          knowledge_version?: number;
          metadata?: Json | null;
          product_id: number;
        };
        Update: {
          chunk_type?: string;
          content?: string;
          created_at?: string;
          embedding?: string | null;
          id?: string;
          is_active?: boolean;
          knowledge_version?: number;
          metadata?: Json | null;
          product_id?: number;
        };
        Relationships: [];
      };
      product_knowledge_import_logs: {
        Row: {
          created_at: string;
          error_count: number;
          id: string;
          metadata: Json | null;
          source_type: string;
          success_count: number;
          total_rows: number;
          uploaded_by: string;
          warning_count: number;
        };
        Insert: {
          created_at?: string;
          error_count: number;
          id?: string;
          metadata?: Json | null;
          source_type: string;
          success_count: number;
          total_rows: number;
          uploaded_by: string;
          warning_count: number;
        };
        Update: {
          created_at?: string;
          error_count?: number;
          id?: string;
          metadata?: Json | null;
          source_type?: string;
          success_count?: number;
          total_rows?: number;
          uploaded_by?: string;
          warning_count?: number;
        };
        Relationships: [];
      };
      product_knowledge_status_changes: {
        Row: {
          changed_by: string | null;
          created_at: string | null;
          from_status: string | null;
          id: string;
          note: string | null;
          product_knowledge_id: string | null;
          to_status: string;
        };
        Insert: {
          changed_by?: string | null;
          created_at?: string | null;
          from_status?: string | null;
          id?: string;
          note?: string | null;
          product_knowledge_id?: string | null;
          to_status: string;
        };
        Update: {
          changed_by?: string | null;
          created_at?: string | null;
          from_status?: string | null;
          id?: string;
          note?: string | null;
          product_knowledge_id?: string | null;
          to_status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_knowledge_status_changes_product_knowledge_id_fkey";
            columns: ["product_knowledge_id"];
            isOneToOne: false;
            referencedRelation: "product_knowledge";
            referencedColumns: ["id"];
          },
        ];
      };
      product_objections: {
        Row: {
          created_at: string;
          created_by: string | null;
          customer_statement: string;
          id: string;
          is_active: boolean | null;
          objection_type: string;
          product_id: number;
          suggested_response: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          customer_statement: string;
          id?: string;
          is_active?: boolean | null;
          objection_type: string;
          product_id: number;
          suggested_response: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          customer_statement?: string;
          id?: string;
          is_active?: boolean | null;
          objection_type?: string;
          product_id?: number;
          suggested_response?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      product_overrides: {
        Row: {
          deleted: boolean;
          desc: string | null;
          image_url: string | null;
          is_custom: boolean;
          link_url: string | null;
          name: string | null;
          no: number;
          retail_price: number | null;
          retail_size: string | null;
          salon_price: number | null;
          salon_size: string | null;
          section: string | null;
          updated_at: string;
        };
        Insert: {
          deleted?: boolean;
          desc?: string | null;
          image_url?: string | null;
          is_custom?: boolean;
          link_url?: string | null;
          name?: string | null;
          no: number;
          retail_price?: number | null;
          retail_size?: string | null;
          salon_price?: number | null;
          salon_size?: string | null;
          section?: string | null;
          updated_at?: string;
        };
        Update: {
          deleted?: boolean;
          desc?: string | null;
          image_url?: string | null;
          is_custom?: boolean;
          link_url?: string | null;
          name?: string | null;
          no?: number;
          retail_price?: number | null;
          retail_size?: string | null;
          salon_price?: number | null;
          salon_size?: string | null;
          section?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      product_variants: {
        Row: {
          created_at: string;
          id: string;
          price: number;
          product_id: number | null;
          size: string;
          type: string;
        };
        Insert: {
          created_at?: string;
          id: string;
          price?: number;
          product_id?: number | null;
          size: string;
          type: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          price?: number;
          product_id?: number | null;
          size?: string;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          category_id: string | null;
          created_at: string;
          description: string | null;
          id: number;
          image_url: string | null;
          is_custom: boolean;
          is_deleted: boolean;
          link_url: string | null;
          name: string;
          updated_at: string;
        };
        Insert: {
          category_id?: string | null;
          created_at?: string;
          description?: string | null;
          id: number;
          image_url?: string | null;
          is_custom?: boolean;
          is_deleted?: boolean;
          link_url?: string | null;
          name: string;
          updated_at?: string;
        };
        Update: {
          category_id?: string | null;
          created_at?: string;
          description?: string | null;
          id?: number;
          image_url?: string | null;
          is_custom?: boolean;
          is_deleted?: boolean;
          link_url?: string | null;
          name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string | null;
          email: string | null;
          id: string;
          must_change_password: boolean;
        };
        Insert: {
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          id: string;
          must_change_password?: boolean;
        };
        Update: {
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          id?: string;
          must_change_password?: boolean;
        };
        Relationships: [];
      };
      rag_audit_logs: {
        Row: {
          created_at: string;
          created_by: string | null;
          evaluation: Json;
          final_answer: string | null;
          id: string;
          query: string;
          retrieved_chunks: Json;
          selected_mode: string;
          similarity_threshold: number;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          evaluation?: Json;
          final_answer?: string | null;
          id?: string;
          query: string;
          retrieved_chunks?: Json;
          selected_mode: string;
          similarity_threshold: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          evaluation?: Json;
          final_answer?: string | null;
          id?: string;
          query?: string;
          retrieved_chunks?: Json;
          selected_mode?: string;
          similarity_threshold?: number;
        };
        Relationships: [];
      };
      sender_account_tokens: {
        Row: {
          access_token_enc: string;
          created_at: string;
          refresh_token_enc: string;
          sender_account_id: string;
          token_expires_at: string;
          token_scope: string[] | null;
          updated_at: string;
        };
        Insert: {
          access_token_enc?: string;
          created_at?: string;
          refresh_token_enc?: string;
          sender_account_id: string;
          token_expires_at?: string;
          token_scope?: string[] | null;
          updated_at?: string;
        };
        Update: {
          access_token_enc?: string;
          created_at?: string;
          refresh_token_enc?: string;
          sender_account_id?: string;
          token_expires_at?: string;
          token_scope?: string[] | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sender_account_tokens_sender_account_id_fkey";
            columns: ["sender_account_id"];
            isOneToOne: true;
            referencedRelation: "sender_accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      sender_accounts: {
        Row: {
          archived_at: string | null;
          archived_by: string | null;
          auth_type: string;
          calendar_id: string | null;
          channel: string | null;
          created_at: string;
          created_by: string | null;
          daily_limit: number | null;
          daily_usage: number | null;
          display_name: string | null;
          domain: string | null;
          external_account_id: string | null;
          external_app_id: string | null;
          health_status: string | null;
          id: string;
          is_active: boolean;
          is_default: boolean;
          last_checked_at: string | null;
          last_error: string | null;
          last_used_at: string | null;
          name: string;
          provider: string;
          provider_secret: string | null;
          secret_prefix: string;
          sender_email: string;
          sender_name: string | null;
          status: string | null;
          updated_at: string;
        };
        Insert: {
          archived_at?: string | null;
          archived_by?: string | null;
          auth_type?: string;
          calendar_id?: string | null;
          channel?: string | null;
          created_at?: string;
          created_by?: string | null;
          daily_limit?: number | null;
          daily_usage?: number | null;
          display_name?: string | null;
          domain?: string | null;
          external_account_id?: string | null;
          external_app_id?: string | null;
          health_status?: string | null;
          id?: string;
          is_active?: boolean;
          is_default?: boolean;
          last_checked_at?: string | null;
          last_error?: string | null;
          last_used_at?: string | null;
          name: string;
          provider?: string;
          provider_secret?: string | null;
          secret_prefix: string;
          sender_email: string;
          sender_name?: string | null;
          status?: string | null;
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          archived_by?: string | null;
          auth_type?: string;
          calendar_id?: string | null;
          channel?: string | null;
          created_at?: string;
          created_by?: string | null;
          daily_limit?: number | null;
          daily_usage?: number | null;
          display_name?: string | null;
          domain?: string | null;
          external_account_id?: string | null;
          external_app_id?: string | null;
          health_status?: string | null;
          id?: string;
          is_active?: boolean;
          is_default?: boolean;
          last_checked_at?: string | null;
          last_error?: string | null;
          last_used_at?: string | null;
          name?: string;
          provider?: string;
          provider_secret?: string | null;
          secret_prefix?: string;
          sender_email?: string;
          sender_name?: string | null;
          status?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      sender_action_logs: {
        Row: {
          action: string;
          created_at: string | null;
          id: string;
          note: string | null;
          performed_by: string | null;
          result: string | null;
          sender_id: string | null;
          sender_type: string;
        };
        Insert: {
          action: string;
          created_at?: string | null;
          id?: string;
          note?: string | null;
          performed_by?: string | null;
          result?: string | null;
          sender_id?: string | null;
          sender_type: string;
        };
        Update: {
          action?: string;
          created_at?: string | null;
          id?: string;
          note?: string | null;
          performed_by?: string | null;
          result?: string | null;
          sender_id?: string | null;
          sender_type?: string;
        };
        Relationships: [];
      };
      system_execution_locks: {
        Row: {
          expires_at: string;
          id: string;
          lock_key: string;
          locked_at: string | null;
          locked_by: string | null;
          metadata: Json | null;
        };
        Insert: {
          expires_at: string;
          id?: string;
          lock_key: string;
          locked_at?: string | null;
          locked_by?: string | null;
          metadata?: Json | null;
        };
        Update: {
          expires_at?: string;
          id?: string;
          lock_key?: string;
          locked_at?: string | null;
          locked_by?: string | null;
          metadata?: Json | null;
        };
        Relationships: [];
      };
      system_settings: {
        Row: {
          accent_color: string | null;
          address: string | null;
          automation_daily_limit: number | null;
          automation_enabled: boolean | null;
          company_name: string | null;
          cross_sell_rules: Json | null;
          dark_mode: boolean | null;
          default_discount: number | null;
          diamond_discount: number | null;
          diamond_threshold: number | null;
          due_generator_enabled: boolean | null;
          enable_notifications: boolean | null;
          gold_discount: number | null;
          gold_threshold: number | null;
          id: string;
          lead_overdue_days: number | null;
          logo_dark_url: string | null;
          logo_light_url: string | null;
          notification_daily_limit: number | null;
          notification_enabled: boolean | null;
          pilot_mode_enabled: boolean | null;
          primary_color: string | null;
          product_cycles: Json | null;
          refill_cycle_days: number | null;
          routing_city_km: number | null;
          routing_far_km: number | null;
          routing_near_km: number | null;
          spa_equipment_scripts: Json | null;
          support_email: string | null;
          support_phone: string | null;
          system_language: string | null;
          updated_at: string | null;
          vat_rate: number | null;
        };
        Insert: {
          accent_color?: string | null;
          address?: string | null;
          automation_daily_limit?: number | null;
          automation_enabled?: boolean | null;
          company_name?: string | null;
          cross_sell_rules?: Json | null;
          dark_mode?: boolean | null;
          default_discount?: number | null;
          diamond_discount?: number | null;
          diamond_threshold?: number | null;
          due_generator_enabled?: boolean | null;
          enable_notifications?: boolean | null;
          gold_discount?: number | null;
          gold_threshold?: number | null;
          id?: string;
          lead_overdue_days?: number | null;
          logo_dark_url?: string | null;
          logo_light_url?: string | null;
          notification_daily_limit?: number | null;
          notification_enabled?: boolean | null;
          pilot_mode_enabled?: boolean | null;
          primary_color?: string | null;
          product_cycles?: Json | null;
          refill_cycle_days?: number | null;
          routing_city_km?: number | null;
          routing_far_km?: number | null;
          routing_near_km?: number | null;
          spa_equipment_scripts?: Json | null;
          support_email?: string | null;
          support_phone?: string | null;
          system_language?: string | null;
          updated_at?: string | null;
          vat_rate?: number | null;
        };
        Update: {
          accent_color?: string | null;
          address?: string | null;
          automation_daily_limit?: number | null;
          automation_enabled?: boolean | null;
          company_name?: string | null;
          cross_sell_rules?: Json | null;
          dark_mode?: boolean | null;
          default_discount?: number | null;
          diamond_discount?: number | null;
          diamond_threshold?: number | null;
          due_generator_enabled?: boolean | null;
          enable_notifications?: boolean | null;
          gold_discount?: number | null;
          gold_threshold?: number | null;
          id?: string;
          lead_overdue_days?: number | null;
          logo_dark_url?: string | null;
          logo_light_url?: string | null;
          notification_daily_limit?: number | null;
          notification_enabled?: boolean | null;
          pilot_mode_enabled?: boolean | null;
          primary_color?: string | null;
          product_cycles?: Json | null;
          refill_cycle_days?: number | null;
          routing_city_km?: number | null;
          routing_far_km?: number | null;
          routing_near_km?: number | null;
          spa_equipment_scripts?: Json | null;
          support_email?: string | null;
          support_phone?: string | null;
          system_language?: string | null;
          updated_at?: string | null;
          vat_rate?: number | null;
        };
        Relationships: [];
      };
      template_assets: {
        Row: {
          asset_type: string;
          created_at: string;
          created_by: string | null;
          file_name: string;
          file_size: number | null;
          file_url: string;
          id: string;
          mime_type: string | null;
          template_id: string | null;
        };
        Insert: {
          asset_type?: string;
          created_at?: string;
          created_by?: string | null;
          file_name: string;
          file_size?: number | null;
          file_url: string;
          id?: string;
          mime_type?: string | null;
          template_id?: string | null;
        };
        Update: {
          asset_type?: string;
          created_at?: string;
          created_by?: string | null;
          file_name?: string;
          file_size?: number | null;
          file_url?: string;
          id?: string;
          mime_type?: string | null;
          template_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "template_assets_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "message_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      template_test_logs: {
        Row: {
          calendar_account_id: string | null;
          created_at: string;
          error_message: string | null;
          id: string;
          provider_response: Json | null;
          sender_account_id: string | null;
          status: string;
          template_id: string | null;
          test_email: string;
          tested_by: string | null;
        };
        Insert: {
          calendar_account_id?: string | null;
          created_at?: string;
          error_message?: string | null;
          id?: string;
          provider_response?: Json | null;
          sender_account_id?: string | null;
          status?: string;
          template_id?: string | null;
          test_email: string;
          tested_by?: string | null;
        };
        Update: {
          calendar_account_id?: string | null;
          created_at?: string;
          error_message?: string | null;
          id?: string;
          provider_response?: Json | null;
          sender_account_id?: string | null;
          status?: string;
          template_id?: string | null;
          test_email?: string;
          tested_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "template_test_logs_calendar_account_id_fkey";
            columns: ["calendar_account_id"];
            isOneToOne: false;
            referencedRelation: "google_calendar_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "template_test_logs_sender_account_id_fkey";
            columns: ["sender_account_id"];
            isOneToOne: false;
            referencedRelation: "sender_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "template_test_logs_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "message_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      user_communication_accounts: {
        Row: {
          account_identifier: string | null;
          account_name: string;
          created_at: string | null;
          health_status: string | null;
          id: string;
          is_active: boolean | null;
          is_default: boolean | null;
          last_error: string | null;
          last_used_at: string | null;
          last_verified_at: string | null;
          platform: string;
          provider_secret: string | null;
          status: string | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          account_identifier?: string | null;
          account_name: string;
          created_at?: string | null;
          health_status?: string | null;
          id?: string;
          is_active?: boolean | null;
          is_default?: boolean | null;
          last_error?: string | null;
          last_used_at?: string | null;
          last_verified_at?: string | null;
          platform: string;
          provider_secret?: string | null;
          status?: string | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          account_identifier?: string | null;
          account_name?: string;
          created_at?: string | null;
          health_status?: string | null;
          id?: string;
          is_active?: boolean | null;
          is_default?: boolean | null;
          last_error?: string | null;
          last_used_at?: string | null;
          last_verified_at?: string | null;
          platform?: string;
          provider_secret?: string | null;
          status?: string | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      webhook_events: {
        Row: {
          attempt_count: number | null;
          channel: string | null;
          created_at: string | null;
          dedupe_key: string;
          error_message: string | null;
          event_type: string;
          event_version: string | null;
          headers_redacted: Json | null;
          id: string;
          payload: Json;
          processed_at: string | null;
          provider: string;
          provider_event_id: string | null;
          received_at: string | null;
          related_campaign_id: string | null;
          related_customer_id: string | null;
          related_message_id: string | null;
          signature_valid: boolean | null;
          status: string | null;
        };
        Insert: {
          attempt_count?: number | null;
          channel?: string | null;
          created_at?: string | null;
          dedupe_key: string;
          error_message?: string | null;
          event_type: string;
          event_version?: string | null;
          headers_redacted?: Json | null;
          id?: string;
          payload: Json;
          processed_at?: string | null;
          provider: string;
          provider_event_id?: string | null;
          received_at?: string | null;
          related_campaign_id?: string | null;
          related_customer_id?: string | null;
          related_message_id?: string | null;
          signature_valid?: boolean | null;
          status?: string | null;
        };
        Update: {
          attempt_count?: number | null;
          channel?: string | null;
          created_at?: string | null;
          dedupe_key?: string;
          error_message?: string | null;
          event_type?: string;
          event_version?: string | null;
          headers_redacted?: Json | null;
          id?: string;
          payload?: Json;
          processed_at?: string | null;
          provider?: string;
          provider_event_id?: string | null;
          received_at?: string | null;
          related_campaign_id?: string | null;
          related_customer_id?: string | null;
          related_message_id?: string | null;
          signature_valid?: boolean | null;
          status?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "webhook_events_related_campaign_id_fkey";
            columns: ["related_campaign_id"];
            isOneToOne: false;
            referencedRelation: "marketing_campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "webhook_events_related_customer_id_fkey";
            columns: ["related_customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "webhook_events_related_customer_id_fkey";
            columns: ["related_customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_invalid_source";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "webhook_events_related_customer_id_fkey";
            columns: ["related_customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_invalid_status";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "webhook_events_related_customer_id_fkey";
            columns: ["related_customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_missing_required_info";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "webhook_events_related_customer_id_fkey";
            columns: ["related_customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_contacted_recently";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "webhook_events_related_customer_id_fkey";
            columns: ["related_customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_ready_for_email_marketing";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "webhook_events_related_customer_id_fkey";
            columns: ["related_customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_not_ready_for_zalo_marketing";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "webhook_events_related_customer_id_fkey";
            columns: ["related_customer_id"];
            isOneToOne: false;
            referencedRelation: "v_customers_unassigned";
            referencedColumns: ["id"];
          },
        ];
      };
      zns_templates: {
        Row: {
          category: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          is_active: boolean | null;
          last_synced_at: string | null;
          purpose: string | null;
          required_params: Json | null;
          sample_payload: Json | null;
          sender_account_id: string;
          status: string | null;
          template_name: string;
          updated_at: string;
          zalo_template_id: string;
        };
        Insert: {
          category?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean | null;
          last_synced_at?: string | null;
          purpose?: string | null;
          required_params?: Json | null;
          sample_payload?: Json | null;
          sender_account_id: string;
          status?: string | null;
          template_name: string;
          updated_at?: string;
          zalo_template_id: string;
        };
        Update: {
          category?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean | null;
          last_synced_at?: string | null;
          purpose?: string | null;
          required_params?: Json | null;
          sample_payload?: Json | null;
          sender_account_id?: string;
          status?: string | null;
          template_name?: string;
          updated_at?: string;
          zalo_template_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "zns_templates_sender_account_id_fkey";
            columns: ["sender_account_id"];
            isOneToOne: false;
            referencedRelation: "sender_accounts";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      ai_conversation_analytics: {
        Row: {
          avg_feedback_score: number | null;
          avg_tokens: number | null;
          hallucination_count: number | null;
          hallucination_rate_pct: number | null;
          mode: string | null;
          total_calls: number | null;
        };
        Relationships: [];
      };
      ai_daily_usage_summary: {
        Row: {
          avg_tokens_per_request: number | null;
          cache_hit_rate_pct: number | null;
          cache_hits: number | null;
          day: string | null;
          mode: string | null;
          total_cost_usd: number | null;
          total_requests: number | null;
          total_tokens: number | null;
        };
        Relationships: [];
      };
      ai_feedback_summary: {
        Row: {
          feedback_type: string | null;
          last_7_days: number | null;
          mode: string | null;
          total: number | null;
        };
        Relationships: [];
      };
      ai_performance_daily: {
        Row: {
          avg_latency_ms: number | null;
          avg_tokens: number | null;
          cache_hit_rate_pct: number | null;
          cache_hits: number | null;
          day: string | null;
          mode: string | null;
          total_cost_usd: number | null;
          total_requests: number | null;
        };
        Relationships: [];
      };
      ai_top_users: {
        Row: {
          total_cost_usd: number | null;
          total_requests: number | null;
          total_tokens: number | null;
          user_id: string | null;
        };
        Relationships: [];
      };
      execution_locks: {
        Row: {
          expires_at: string | null;
          id: string | null;
          lock_key: string | null;
          locked_at: string | null;
          locked_by: string | null;
          metadata: Json | null;
        };
        Insert: {
          expires_at?: string | null;
          id?: string | null;
          lock_key?: string | null;
          locked_at?: string | null;
          locked_by?: string | null;
          metadata?: Json | null;
        };
        Update: {
          expires_at?: string | null;
          id?: string | null;
          lock_key?: string | null;
          locked_at?: string | null;
          locked_by?: string | null;
          metadata?: Json | null;
        };
        Relationships: [];
      };
      v_customers_duplicate_email: {
        Row: {
          customer_ids: string[] | null;
          duplicate_count: number | null;
          normalized_email: string | null;
        };
        Relationships: [];
      };
      v_customers_duplicate_phone: {
        Row: {
          customer_ids: string[] | null;
          duplicate_count: number | null;
          normalized_phone: string | null;
        };
        Relationships: [];
      };
      v_customers_invalid_source: {
        Row: {
          id: string | null;
          name: string | null;
          owner_sale_id: string | null;
          source: string | null;
        };
        Insert: {
          id?: string | null;
          name?: string | null;
          owner_sale_id?: string | null;
          source?: string | null;
        };
        Update: {
          id?: string | null;
          name?: string | null;
          owner_sale_id?: string | null;
          source?: string | null;
        };
        Relationships: [];
      };
      v_customers_invalid_status: {
        Row: {
          id: string | null;
          name: string | null;
          owner_sale_id: string | null;
          status: string | null;
        };
        Insert: {
          id?: string | null;
          name?: string | null;
          owner_sale_id?: string | null;
          status?: string | null;
        };
        Update: {
          id?: string | null;
          name?: string | null;
          owner_sale_id?: string | null;
          status?: string | null;
        };
        Relationships: [];
      };
      v_customers_missing_required_info: {
        Row: {
          created_at: string | null;
          email: string | null;
          id: string | null;
          name: string | null;
          owner_sale_id: string | null;
          phone: string | null;
        };
        Insert: {
          created_at?: string | null;
          email?: string | null;
          id?: string | null;
          name?: string | null;
          owner_sale_id?: string | null;
          phone?: string | null;
        };
        Update: {
          created_at?: string | null;
          email?: string | null;
          id?: string | null;
          name?: string | null;
          owner_sale_id?: string | null;
          phone?: string | null;
        };
        Relationships: [];
      };
      v_customers_not_contacted_recently: {
        Row: {
          created_at: string | null;
          email: string | null;
          id: string | null;
          last_contacted_at: string | null;
          name: string | null;
          owner_sale_id: string | null;
          phone: string | null;
          status: string | null;
        };
        Insert: {
          created_at?: string | null;
          email?: string | null;
          id?: string | null;
          last_contacted_at?: string | null;
          name?: string | null;
          owner_sale_id?: string | null;
          phone?: string | null;
          status?: string | null;
        };
        Update: {
          created_at?: string | null;
          email?: string | null;
          id?: string | null;
          last_contacted_at?: string | null;
          name?: string | null;
          owner_sale_id?: string | null;
          phone?: string | null;
          status?: string | null;
        };
        Relationships: [];
      };
      v_customers_not_ready_for_email_marketing: {
        Row: {
          email: string | null;
          email_opt_in: boolean | null;
          id: string | null;
          marketing_opt_in: boolean | null;
          name: string | null;
          normalized_email: string | null;
        };
        Insert: {
          email?: string | null;
          email_opt_in?: boolean | null;
          id?: string | null;
          marketing_opt_in?: boolean | null;
          name?: string | null;
          normalized_email?: string | null;
        };
        Update: {
          email?: string | null;
          email_opt_in?: boolean | null;
          id?: string | null;
          marketing_opt_in?: boolean | null;
          name?: string | null;
          normalized_email?: string | null;
        };
        Relationships: [];
      };
      v_customers_not_ready_for_zalo_marketing: {
        Row: {
          id: string | null;
          marketing_opt_in: boolean | null;
          name: string | null;
          zalo: string | null;
          zalo_id: string | null;
          zalo_opt_in: boolean | null;
        };
        Relationships: [];
      };
      v_customers_unassigned: {
        Row: {
          created_at: string | null;
          email: string | null;
          id: string | null;
          name: string | null;
          phone: string | null;
          source: string | null;
          status: string | null;
        };
        Insert: {
          created_at?: string | null;
          email?: string | null;
          id?: string | null;
          name?: string | null;
          phone?: string | null;
          source?: string | null;
          status?: string | null;
        };
        Update: {
          created_at?: string | null;
          email?: string | null;
          id?: string | null;
          name?: string | null;
          phone?: string | null;
          source?: string | null;
          status?: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      acquire_execution_lock: {
        Args: { p_lock_key: string; p_ttl_seconds?: number };
        Returns: boolean;
      };
      bulk_assign_customers: {
        Args: {
          p_customer_ids: string[];
          p_reason: string;
          p_sale_id: string;
          p_tele_id: string;
          p_update_sale: boolean;
          p_update_tele: boolean;
        };
        Returns: Json;
      };
      can_view_customer: {
        Args: { p_customer_id: string; p_user_id: string };
        Returns: boolean;
      };
      check_and_trigger_scheduled_campaigns: { Args: never; Returns: undefined };
      check_pilot_access: {
        Args: { p_module_key: string; p_user_id: string };
        Returns: boolean;
      };
      cleanup_expired_cache: { Args: never; Returns: number };
      confirm_customer_import_batch: {
        Args: { p_batch_id: string };
        Returns: Json;
      };
      create_notification_safe: {
        Args: {
          p_actor_user_id?: string;
          p_customer_id?: string;
          p_deep_link?: string;
          p_message?: string;
          p_metadata?: Json;
          p_notification_type: string;
          p_priority?: string;
          p_recipient_user_id: string;
          p_related_id?: string;
          p_related_type?: string;
          p_title: string;
        };
        Returns: Json;
      };
      create_system_notification: {
        Args: {
          p_action_url: string;
          p_entity_id: string;
          p_entity_type: string;
          p_message: string;
          p_priority: string;
          p_recipient_id: string;
          p_title: string;
          p_type: string;
        };
        Returns: undefined;
      };
      dismiss_notification: {
        Args: { p_notification_id: string };
        Returns: undefined;
      };
      generate_due_notifications: { Args: never; Returns: Json };
      get_ai_performance_summary: { Args: never; Returns: Json };
      get_ai_settings_masked: { Args: never; Returns: Json };
      get_automation_governance_summary: { Args: never; Returns: Json };
      get_automation_rules_summary: { Args: never; Returns: Json };
      get_cache_stats: {
        Args: never;
        Returns: {
          cache_type: string;
          expired_entries: number;
          total_entries: number;
          total_hits: number;
        }[];
      };
      get_customer_channel_summary: {
        Args: { p_customer_ids: string[] };
        Returns: {
          channel_health_score: number;
          channels_summary: Json;
          customer_id: string;
          duplicate_risk: Json;
          has_email: boolean;
          has_facebook: boolean;
          has_phone: boolean;
          has_primary: boolean;
          has_remarketing: boolean;
          has_tiktok: boolean;
          has_website: boolean;
          has_zalo: boolean;
          private_count: number;
        }[];
      };
      get_customer_interaction_summary: {
        Args: { p_customer_id: string };
        Returns: Json;
      };
      get_customer_list_intelligence: {
        Args: { p_customer_ids: string[] };
        Returns: {
          activity_at: string;
          channels_summary: Json;
          customer_id: string;
          latest_activity: string;
          primary_channel_type: string;
          primary_channel_value: string;
          priority_score: number;
          verified_channels_count: number;
        }[];
      };
      get_customer_management_summary: {
        Args: { p_customer_ids: string[] };
        Returns: {
          customer_id: string;
          open_tasks: number;
          overdue_tasks: number;
        }[];
      };
      get_customer_timeline: { Args: { p_customer_id: string }; Returns: Json };
      get_due_notification_preview: { Args: never; Returns: Json };
      get_embedding_health_metrics: {
        Args: never;
        Returns: {
          avg_chunk_size: number;
          duplicate_chunks: number;
          missing_embeddings: number;
          total_chunks: number;
        }[];
      };
      get_lead_performance_dashboard: {
        Args: { p_from?: string; p_to?: string };
        Returns: Json;
      };
      get_my_notifications: {
        Args: { p_limit?: number; p_status?: string };
        Returns: Json;
      };
      get_my_roles: {
        Args: never;
        Returns: Database["public"]["Enums"]["app_role"][];
      };
      get_stale_chunks: {
        Args: never;
        Returns: {
          chunk_version: number;
          current_knowledge_version: number;
          product_id: number;
          stale_chunk_count: number;
        }[];
      };
      get_workspace_execution_dashboard: { Args: never; Returns: Json };
      has_role:
        | {
            Args: {
              _role: Database["public"]["Enums"]["app_role"];
              _user_id: string;
            };
            Returns: boolean;
          }
        | { Args: { _role: string; _user_id: string }; Returns: boolean };
      increment_campaign_metrics: {
        Args: {
          p_campaign_id: string;
          p_failed: number;
          p_processed: number;
          p_successful: number;
        };
        Returns: undefined;
      };
      increment_sender_daily_usage: {
        Args: { p_sender_id: string };
        Returns: undefined;
      };
      is_admin_or_sub_admin: { Args: { user_id: string }; Returns: boolean };
      is_sales_member: { Args: { user_id: string }; Returns: boolean };
      is_tele_lead: { Args: { _user_id: string }; Returns: boolean };
      log_communication_interaction: {
        Args: {
          p_account_id?: string;
          p_contact_channel_id?: string;
          p_content_preview?: string;
          p_customer_id: string;
          p_interaction_type?: string;
          p_platform: string;
          p_result?: string;
          p_template_id?: string;
          p_template_title?: string;
        };
        Returns: Json;
      };
      log_marketing_delivery_event: {
        Args: {
          p_campaign_id?: string;
          p_channel?: string;
          p_customer_id: string;
          p_mode?: string;
          p_personal_sender_id?: string;
          p_provider_message_id?: string;
          p_reason?: string;
          p_sender_account_id?: string;
          p_status?: string;
          p_template_id?: string;
        };
        Returns: string;
      };
      log_pilot_feedback: {
        Args: {
          p_action_key?: string;
          p_customer_id?: string;
          p_feedback_note: string;
          p_feedback_type: string;
          p_page_key: string;
        };
        Returns: undefined;
      };
      log_pilot_usage_metric: {
        Args: { p_action_key: string; p_metric_data?: Json; p_page_key: string };
        Returns: undefined;
      };
      log_quick_call_result: {
        Args: {
          p_customer_id: string;
          p_next_follow_up_at?: string;
          p_note: string;
          p_result_type: string;
        };
        Returns: Json;
      };
      mark_all_notifications_read: { Args: never; Returns: undefined };
      mark_notification_read: {
        Args: { p_notification_id: string };
        Returns: undefined;
      };
      match_product_chunks: {
        Args: {
          filter_product_ids?: number[];
          match_count: number;
          match_threshold: number;
          query_embedding: string;
          required_knowledge_version?: number;
        };
        Returns: {
          chunk_type: string;
          content: string;
          id: string;
          metadata: Json;
          product_id: number;
          similarity: number;
        }[];
      };
      release_execution_lock: {
        Args: { p_lock_key: string };
        Returns: undefined;
      };
      revoke_customer_assignment: {
        Args: { p_customer_ids: string[]; p_reason: string };
        Returns: Json;
      };
      run_active_automation_rules: { Args: never; Returns: Json };
      run_automation_rule:
        | {
            Args: { p_rule_id: string };
            Returns: {
              error: true;
            } & "Could not choose the best candidate function between: public.run_automation_rule(p_rule_id => text), public.run_automation_rule(p_rule_id => uuid). Try renaming the parameters or the function itself in the database so function overloading can be resolved";
          }
        | {
            Args: { p_rule_id: string };
            Returns: {
              error: true;
            } & "Could not choose the best candidate function between: public.run_automation_rule(p_rule_id => text), public.run_automation_rule(p_rule_id => uuid). Try renaming the parameters or the function itself in the database so function overloading can be resolved";
          };
      run_crm_maintenance_tasks: { Args: never; Returns: undefined };
      run_rpc_tests: { Args: never; Returns: Json };
      update_ai_settings: {
        Args: {
          p_ai_cache_minutes?: number;
          p_ai_customer_suggestions_enabled?: boolean;
          p_ai_daily_limit?: number;
          p_ai_enabled?: boolean;
          p_ai_rag_enabled?: boolean;
          p_ai_rewrite_enabled?: boolean;
          p_ai_sales_assistant_enabled?: boolean;
          p_anthropic_api_key?: string;
          p_chat_model?: string;
          p_daily_token_limit?: number;
          p_embedding_model?: string;
          p_gemini_api_key?: string;
          p_max_tokens?: number;
          p_module_customer_summary?: boolean;
          p_module_product_tutor?: boolean;
          p_module_rewrite?: boolean;
          p_module_sales_assistant?: boolean;
          p_monthly_cost_limit?: number;
          p_openai_api_key?: string;
          p_provider?: string;
          p_system_tone?: string;
          p_temperature?: number;
        };
        Returns: undefined;
      };
      update_product_knowledge_status:
        | {
            Args: {
              new_status: string;
              note: string;
              p_id: string;
              status_reason_type: string;
            };
            Returns: undefined;
          }
        | {
            Args: { p_id: string; p_new_status: string; p_note?: string };
            Returns: undefined;
          };
      user_has_customer_task: {
        Args: { c_id: string; u_id: string };
        Returns: boolean;
      };
      user_owns_customer_of_task: {
        Args: { task_customer_id: string; u_id: string };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "admin" | "sale" | "sub_admin" | "tele_lead";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "sale", "sub_admin", "tele_lead"],
    },
  },
} as const;
