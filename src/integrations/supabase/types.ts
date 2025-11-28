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
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      config_options: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_required: boolean
          name: string
          option_type: string
          product_id: string | null
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          is_required?: boolean
          name: string
          option_type: string
          product_id?: string | null
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_required?: boolean
          name?: string
          option_type?: string
          product_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "config_options_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      configuration_analytics: {
        Row: {
          abandonment_point: string | null
          completion_rate: number | null
          configuration_data: Json
          created_at: string
          id: string
          product_id: string | null
          session_id: string | null
          user_agent: string | null
        }
        Insert: {
          abandonment_point?: string | null
          completion_rate?: number | null
          configuration_data: Json
          created_at?: string
          id?: string
          product_id?: string | null
          session_id?: string | null
          user_agent?: string | null
        }
        Update: {
          abandonment_point?: string | null
          completion_rate?: number | null
          configuration_data?: Json
          created_at?: string
          id?: string
          product_id?: string | null
          session_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "configuration_analytics_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      configuration_rules: {
        Row: {
          actions: Json
          conditions: Json
          created_at: string
          id: string
          is_active: boolean
          priority: number
          product_id: string | null
          rule_name: string
          rule_type: string
          updated_at: string
        }
        Insert: {
          actions: Json
          conditions: Json
          created_at?: string
          id?: string
          is_active?: boolean
          priority?: number
          product_id?: string | null
          rule_name: string
          rule_type: string
          updated_at?: string
        }
        Update: {
          actions?: Json
          conditions?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          priority?: number
          product_id?: string | null
          rule_name?: string
          rule_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "configuration_rules_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_levels: {
        Row: {
          available_quantity: number
          id: string
          low_stock_threshold: number
          option_value_id: string | null
          reserved_quantity: number
          updated_at: string
        }
        Insert: {
          available_quantity?: number
          id?: string
          low_stock_threshold?: number
          option_value_id?: string | null
          reserved_quantity?: number
          updated_at?: string
        }
        Update: {
          available_quantity?: number
          id?: string
          low_stock_threshold?: number
          option_value_id?: string | null
          reserved_quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_levels_option_value_id_fkey"
            columns: ["option_value_id"]
            isOneToOne: false
            referencedRelation: "option_values"
            referencedColumns: ["id"]
          },
        ]
      }
      option_values: {
        Row: {
          config_option_id: string | null
          created_at: string
          display_order: number
          hex_color: string | null
          id: string
          image_url: string | null
          is_available: boolean
          name: string
          price_modifier: number
        }
        Insert: {
          config_option_id?: string | null
          created_at?: string
          display_order?: number
          hex_color?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          name: string
          price_modifier?: number
        }
        Update: {
          config_option_id?: string | null
          created_at?: string
          display_order?: number
          hex_color?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          name?: string
          price_modifier?: number
        }
        Relationships: [
          {
            foreignKeyName: "option_values_config_option_id_fkey"
            columns: ["config_option_id"]
            isOneToOne: false
            referencedRelation: "config_options"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          configuration_data: Json
          created_at: string
          id: string
          order_id: string
          product_id: string | null
          quantity: number
          total_price: number
          unit_price: number
        }
        Insert: {
          configuration_data: Json
          created_at?: string
          id?: string
          order_id: string
          product_id?: string | null
          quantity?: number
          total_price: number
          unit_price: number
        }
        Update: {
          configuration_data?: Json
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string | null
          quantity?: number
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          configuration_data: Json
          configuration_id: string | null
          created_at: string
          id: string
          payment_status: string | null
          product_id: string | null
          quantity: number
          shipping_address: Json | null
          shipping_method: string | null
          status: string
          total_price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          configuration_data: Json
          configuration_id?: string | null
          created_at?: string
          id?: string
          payment_status?: string | null
          product_id?: string | null
          quantity?: number
          shipping_address?: Json | null
          shipping_method?: string | null
          status?: string
          total_price: number
          updated_at?: string
          user_id: string
        }
        Update: {
          configuration_data?: Json
          configuration_id?: string | null
          created_at?: string
          id?: string
          payment_status?: string | null
          product_id?: string | null
          quantity?: number
          shipping_address?: Json | null
          shipping_method?: string | null
          status?: string
          total_price?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_configuration_id_fkey"
            columns: ["configuration_id"]
            isOneToOne: false
            referencedRelation: "product_configurations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_rules: {
        Row: {
          conditions: Json
          created_at: string
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean
          min_quantity: number | null
          product_id: string | null
          rule_name: string
          rule_type: string
          updated_at: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          conditions: Json
          created_at?: string
          discount_type: string
          discount_value?: number
          id?: string
          is_active?: boolean
          min_quantity?: number | null
          product_id?: string | null
          rule_name: string
          rule_type: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          conditions?: Json
          created_at?: string
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          min_quantity?: number | null
          product_id?: string | null
          rule_name?: string
          rule_type?: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pricing_rules_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_configurations: {
        Row: {
          configuration_data: Json
          configuration_name: string | null
          created_at: string
          id: string
          product_id: string | null
          session_id: string | null
          total_price: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          configuration_data: Json
          configuration_name?: string | null
          created_at?: string
          id?: string
          product_id?: string | null
          session_id?: string | null
          total_price: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          configuration_data?: Json
          configuration_name?: string | null
          created_at?: string
          id?: string
          product_id?: string | null
          session_id?: string | null
          total_price?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_configurations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          base_price: number
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          base_price?: number
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          base_price?: number
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          created_at: string
          id: string
          interaction_score: number
          preferences: Json
          product_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          interaction_score?: number
          preferences: Json
          product_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          interaction_score?: number
          preferences?: Json
          product_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
