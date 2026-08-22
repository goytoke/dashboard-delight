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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          account_name: string
          activated_on: string | null
          broker: string
          created_at: string
          cycle_days: number
          email: string | null
          first_deposit: number
          id: string
          login: string | null
          login_password: string | null
          notes: string | null
          password: string | null
          status: string
          updated_at: string
          user_id: string
          vps_id: string | null
        }
        Insert: {
          account_name: string
          activated_on?: string | null
          broker?: string
          created_at?: string
          cycle_days?: number
          email?: string | null
          first_deposit?: number
          id?: string
          login?: string | null
          login_password?: string | null
          notes?: string | null
          password?: string | null
          status?: string
          updated_at?: string
          user_id: string
          vps_id?: string | null
        }
        Update: {
          account_name?: string
          activated_on?: string | null
          broker?: string
          created_at?: string
          cycle_days?: number
          email?: string | null
          first_deposit?: number
          id?: string
          login?: string | null
          login_password?: string | null
          notes?: string | null
          password?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          vps_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_vps_id_fkey"
            columns: ["vps_id"]
            isOneToOne: false
            referencedRelation: "vps"
            referencedColumns: ["id"]
          },
        ]
      }
      bots: {
        Row: {
          created_at: string
          email: string | null
          id: string
          magic_number: number
          notes: string | null
          password: string | null
          status: string
          updated_at: string
          user_id: string
          username: string | null
          vps_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          magic_number: number
          notes?: string | null
          password?: string | null
          status?: string
          updated_at?: string
          user_id: string
          username?: string | null
          vps_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          magic_number?: number
          notes?: string | null
          password?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          username?: string | null
          vps_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bots_vps_id_fkey"
            columns: ["vps_id"]
            isOneToOne: false
            referencedRelation: "vps"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_purposes: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: []
      }
      costs: {
        Row: {
          amount: number
          cost_date: string
          created_at: string
          duration_unit: string
          duration_value: number | null
          id: string
          is_subscription: boolean
          notes: string | null
          notify_before_hours: number
          payment_source_id: string | null
          purpose: string | null
          reason: string
          starts_on: string | null
          user_id: string
          vps_id: string | null
        }
        Insert: {
          amount?: number
          cost_date?: string
          created_at?: string
          duration_unit?: string
          duration_value?: number | null
          id?: string
          is_subscription?: boolean
          notes?: string | null
          notify_before_hours?: number
          payment_source_id?: string | null
          purpose?: string | null
          reason: string
          starts_on?: string | null
          user_id: string
          vps_id?: string | null
        }
        Update: {
          amount?: number
          cost_date?: string
          created_at?: string
          duration_unit?: string
          duration_value?: number | null
          id?: string
          is_subscription?: boolean
          notes?: string | null
          notify_before_hours?: number
          payment_source_id?: string | null
          purpose?: string | null
          reason?: string
          starts_on?: string | null
          user_id?: string
          vps_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "costs_payment_source_id_fkey"
            columns: ["payment_source_id"]
            isOneToOne: false
            referencedRelation: "payment_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "costs_vps_id_fkey"
            columns: ["vps_id"]
            isOneToOne: false
            referencedRelation: "vps"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_logs: {
        Row: {
          account_id: string
          closing_balance: number | null
          created_at: string
          id: string
          log_date: string
          note: string | null
          opening_balance: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          closing_balance?: number | null
          created_at?: string
          id?: string
          log_date?: string
          note?: string | null
          opening_balance?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          closing_balance?: number | null
          created_at?: string
          id?: string
          log_date?: string
          note?: string | null
          opening_balance?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_logs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      day_results: {
        Row: {
          amount: number
          created_at: string
          direction: string
          id: string
          label: string | null
          note: string | null
          register_number: string | null
          result_date: string
          updated_at: string
          user_id: string
          vps_id: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          direction?: string
          id?: string
          label?: string | null
          note?: string | null
          register_number?: string | null
          result_date?: string
          updated_at?: string
          user_id: string
          vps_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          direction?: string
          id?: string
          label?: string | null
          note?: string | null
          register_number?: string | null
          result_date?: string
          updated_at?: string
          user_id?: string
          vps_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "day_results_vps_id_fkey"
            columns: ["vps_id"]
            isOneToOne: false
            referencedRelation: "vps"
            referencedColumns: ["id"]
          },
        ]
      }
      funding_events: {
        Row: {
          account_id: string
          amount: number
          balance_after: number | null
          balance_before: number | null
          created_at: string
          event_date: string
          fee: number
          from_account_id: string | null
          from_balance_after: number | null
          from_balance_before: number | null
          has_fee: boolean
          id: string
          kind: string
          note: string | null
          payment_source_id: string | null
          source_type: string
          user_id: string
        }
        Insert: {
          account_id: string
          amount?: number
          balance_after?: number | null
          balance_before?: number | null
          created_at?: string
          event_date?: string
          fee?: number
          from_account_id?: string | null
          from_balance_after?: number | null
          from_balance_before?: number | null
          has_fee?: boolean
          id?: string
          kind?: string
          note?: string | null
          payment_source_id?: string | null
          source_type?: string
          user_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          balance_after?: number | null
          balance_before?: number | null
          created_at?: string
          event_date?: string
          fee?: number
          from_account_id?: string | null
          from_balance_after?: number | null
          from_balance_before?: number | null
          has_fee?: boolean
          id?: string
          kind?: string
          note?: string | null
          payment_source_id?: string | null
          source_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "funding_events_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funding_events_from_account_id_fkey"
            columns: ["from_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funding_events_payment_source_id_fkey"
            columns: ["payment_source_id"]
            isOneToOne: false
            referencedRelation: "payment_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      movements: {
        Row: {
          created_at: string
          deposit_amount: number
          extra_amount: number
          extra_source_id: string | null
          from_account_id: string | null
          id: string
          move_date: string
          note: string | null
          payment_source_id: string | null
          to_account_id: string | null
          to_balance_after: number | null
          to_balance_before: number | null
          updated_at: string
          user_id: string
          withdraw_amount: number
        }
        Insert: {
          created_at?: string
          deposit_amount?: number
          extra_amount?: number
          extra_source_id?: string | null
          from_account_id?: string | null
          id?: string
          move_date?: string
          note?: string | null
          payment_source_id?: string | null
          to_account_id?: string | null
          to_balance_after?: number | null
          to_balance_before?: number | null
          updated_at?: string
          user_id: string
          withdraw_amount?: number
        }
        Update: {
          created_at?: string
          deposit_amount?: number
          extra_amount?: number
          extra_source_id?: string | null
          from_account_id?: string | null
          id?: string
          move_date?: string
          note?: string | null
          payment_source_id?: string | null
          to_account_id?: string | null
          to_balance_after?: number | null
          to_balance_before?: number | null
          updated_at?: string
          user_id?: string
          withdraw_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "movements_extra_source_id_fkey"
            columns: ["extra_source_id"]
            isOneToOne: false
            referencedRelation: "payment_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_from_account_id_fkey"
            columns: ["from_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_payment_source_id_fkey"
            columns: ["payment_source_id"]
            isOneToOne: false
            referencedRelation: "payment_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_sources: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          starting_balance: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          starting_balance?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          starting_balance?: number
          user_id?: string
        }
        Relationships: []
      }
      people: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: []
      }
      problems: {
        Row: {
          action_note: string | null
          created_at: string
          details: string | null
          id: string
          solved_on: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_note?: string | null
          created_at?: string
          details?: string | null
          id?: string
          solved_on?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_note?: string | null
          created_at?: string
          details?: string | null
          id?: string
          solved_on?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          phone: string | null
          updated_at: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id: string
          phone?: string | null
          updated_at?: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          phone?: string | null
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      saved_reports: {
        Row: {
          created_at: string
          from_date: string
          heading: string
          id: string
          kind: string
          name: string
          sheets: Json
          theory: Json
          to_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          from_date: string
          heading: string
          id?: string
          kind?: string
          name: string
          sheets?: Json
          theory?: Json
          to_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          from_date?: string
          heading?: string
          id?: string
          kind?: string
          name?: string
          sheets?: Json
          theory?: Json
          to_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trading_days: {
        Row: {
          closed_at: string | null
          created_at: string
          day_date: string
          grand_closing: number | null
          grand_opening: number | null
          id: string
          net_of_day: number | null
          note: string | null
          opened_at: string
          snapshot: Json | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          day_date?: string
          grand_closing?: number | null
          grand_opening?: number | null
          id?: string
          net_of_day?: number | null
          note?: string | null
          opened_at?: string
          snapshot?: Json | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          day_date?: string
          grand_closing?: number | null
          grand_opening?: number | null
          id?: string
          net_of_day?: number | null
          note?: string | null
          opened_at?: string
          snapshot?: Json | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          direction: string
          id: string
          payment_source_id: string | null
          person_id: string | null
          reason: string | null
          tx_date: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          direction?: string
          id?: string
          payment_source_id?: string | null
          person_id?: string | null
          reason?: string | null
          tx_date?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          direction?: string
          id?: string
          payment_source_id?: string | null
          person_id?: string | null
          reason?: string | null
          tx_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_payment_source_id_fkey"
            columns: ["payment_source_id"]
            isOneToOne: false
            referencedRelation: "payment_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      vps: {
        Row: {
          created_at: string
          email: string | null
          id: string
          ip: string | null
          name: string
          notes: string | null
          password: string | null
          provider: string | null
          purchased_on: string | null
          term_days: number
          updated_at: string
          user_id: string
          username: string | null
          vps_number: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          ip?: string | null
          name: string
          notes?: string | null
          password?: string | null
          provider?: string | null
          purchased_on?: string | null
          term_days?: number
          updated_at?: string
          user_id: string
          username?: string | null
          vps_number?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          ip?: string | null
          name?: string
          notes?: string | null
          password?: string | null
          provider?: string | null
          purchased_on?: string | null
          term_days?: number
          updated_at?: string
          user_id?: string
          username?: string | null
          vps_number?: string | null
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
