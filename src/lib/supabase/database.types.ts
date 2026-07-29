// Generated from the Supabase schema. Do not edit by hand.
// Regenerate after every migration with: npm run types:generate
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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      body_parts: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          label: string
          organization_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          organization_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          organization_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "body_parts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_events: {
        Row: {
          completed_by: string | null
          completed_date: string | null
          created_at: string
          due_date: string
          evidence_notes: string | null
          id: string
          obligation_id: string
          organization_id: string
          status: Database["public"]["Enums"]["obligation_status"]
          updated_at: string
        }
        Insert: {
          completed_by?: string | null
          completed_date?: string | null
          created_at?: string
          due_date: string
          evidence_notes?: string | null
          id?: string
          obligation_id: string
          organization_id: string
          status?: Database["public"]["Enums"]["obligation_status"]
          updated_at?: string
        }
        Update: {
          completed_by?: string | null
          completed_date?: string | null
          created_at?: string
          due_date?: string
          evidence_notes?: string | null
          id?: string
          obligation_id?: string
          organization_id?: string
          status?: Database["public"]["Enums"]["obligation_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_events_obligation_id_organization_id_fkey"
            columns: ["obligation_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "compliance_obligations"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "compliance_events_obligation_id_organization_id_fkey"
            columns: ["obligation_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "compliance_obligations_enriched"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "compliance_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_obligations: {
        Row: {
          agency: string | null
          citation: string | null
          created_at: string
          due_date: string | null
          frequency: Database["public"]["Enums"]["obligation_frequency"]
          id: string
          is_verified: boolean
          jurisdiction: Database["public"]["Enums"]["jurisdiction"]
          lead_time_days: number
          notes: string | null
          obligation: string
          organization_id: string
          permit_ref: string | null
          program_area: string | null
          recurrence_day: number | null
          recurrence_month: number | null
          responsible_party: string | null
          site_id: string | null
          status: Database["public"]["Enums"]["obligation_status"]
          updated_at: string
        }
        Insert: {
          agency?: string | null
          citation?: string | null
          created_at?: string
          due_date?: string | null
          frequency: Database["public"]["Enums"]["obligation_frequency"]
          id?: string
          is_verified?: boolean
          jurisdiction: Database["public"]["Enums"]["jurisdiction"]
          lead_time_days?: number
          notes?: string | null
          obligation: string
          organization_id: string
          permit_ref?: string | null
          program_area?: string | null
          recurrence_day?: number | null
          recurrence_month?: number | null
          responsible_party?: string | null
          site_id?: string | null
          status?: Database["public"]["Enums"]["obligation_status"]
          updated_at?: string
        }
        Update: {
          agency?: string | null
          citation?: string | null
          created_at?: string
          due_date?: string | null
          frequency?: Database["public"]["Enums"]["obligation_frequency"]
          id?: string
          is_verified?: boolean
          jurisdiction?: Database["public"]["Enums"]["jurisdiction"]
          lead_time_days?: number
          notes?: string | null
          obligation?: string
          organization_id?: string
          permit_ref?: string | null
          program_area?: string | null
          recurrence_day?: number | null
          recurrence_month?: number | null
          responsible_party?: string | null
          site_id?: string | null
          status?: Database["public"]["Enums"]["obligation_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_obligations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_obligations_site_id_organization_id_fkey"
            columns: ["site_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      corrective_actions: {
        Row: {
          assigned_to_name: string | null
          assigned_to_profile_id: string | null
          completed_date: string | null
          created_at: string
          description: string
          due_date: string | null
          hierarchy_of_controls: string | null
          id: string
          incident_id: string
          organization_id: string
          status: Database["public"]["Enums"]["corrective_action_status"]
          updated_at: string
          verification_notes: string | null
        }
        Insert: {
          assigned_to_name?: string | null
          assigned_to_profile_id?: string | null
          completed_date?: string | null
          created_at?: string
          description: string
          due_date?: string | null
          hierarchy_of_controls?: string | null
          id?: string
          incident_id: string
          organization_id: string
          status?: Database["public"]["Enums"]["corrective_action_status"]
          updated_at?: string
          verification_notes?: string | null
        }
        Update: {
          assigned_to_name?: string | null
          assigned_to_profile_id?: string | null
          completed_date?: string | null
          created_at?: string
          description?: string
          due_date?: string | null
          hierarchy_of_controls?: string | null
          id?: string
          incident_id?: string
          organization_id?: string
          status?: Database["public"]["Enums"]["corrective_action_status"]
          updated_at?: string
          verification_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "corrective_actions_assigned_to_profile_id_organization_id_fkey"
            columns: ["assigned_to_profile_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "corrective_actions_hierarchy_of_controls_fkey"
            columns: ["hierarchy_of_controls"]
            isOneToOne: false
            referencedRelation: "hierarchy_of_control_levels"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "corrective_actions_incident_id_organization_id_fkey"
            columns: ["incident_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "corrective_actions_incident_id_organization_id_fkey"
            columns: ["incident_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "incidents_enriched"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "corrective_actions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          organization_id: string
          site_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          site_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          site_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_site_id_organization_id_fkey"
            columns: ["site_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      employees: {
        Row: {
          created_at: string
          department_id: string | null
          display_name: string | null
          employee_ref: string | null
          hire_date: string | null
          id: string
          is_active: boolean
          organization_id: string
          site_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          display_name?: string | null
          employee_ref?: string | null
          hire_date?: string | null
          id?: string
          is_active?: boolean
          organization_id: string
          site_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          display_name?: string | null
          employee_ref?: string | null
          hire_date?: string | null
          id?: string
          is_active?: boolean
          organization_id?: string
          site_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_department_id_organization_id_fkey"
            columns: ["department_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "employees_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_site_id_organization_id_fkey"
            columns: ["site_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      hierarchy_of_control_levels: {
        Row: {
          code: string
          created_at: string
          description: string
          label: string
          rank: number
        }
        Insert: {
          code: string
          created_at?: string
          description: string
          label: string
          rank: number
        }
        Update: {
          code?: string
          created_at?: string
          description?: string
          label?: string
          rank?: number
        }
        Relationships: []
      }
      hours_worked: {
        Row: {
          created_at: string
          hours: number
          id: string
          is_estimate: boolean
          organization_id: string
          period_month: number
          period_year: number
          site_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          hours: number
          id?: string
          is_estimate?: boolean
          organization_id: string
          period_month: number
          period_year: number
          site_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          hours?: number
          id?: string
          is_estimate?: boolean
          organization_id?: string
          period_month?: number
          period_year?: number
          site_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hours_worked_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hours_worked_site_id_organization_id_fkey"
            columns: ["site_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      incidents: {
        Row: {
          actual_cost_to_date: number | null
          body_part: string | null
          claim_ref: string | null
          classification:
            | Database["public"]["Enums"]["incident_classification"]
            | null
          created_at: string
          days_away: number
          days_restricted: number
          department_id: string | null
          description: string | null
          employee_id: string | null
          expected_cost: number | null
          id: string
          incident_date: string
          incident_type: Database["public"]["Enums"]["incident_type"]
          injury_type: string | null
          is_lost_time: boolean
          machine_involved: boolean
          organization_id: string
          recently_transferred: boolean
          reported_date: string | null
          root_cause_category:
            | Database["public"]["Enums"]["root_cause_category"]
            | null
          root_cause_detail: string | null
          safety_violation: boolean
          severity_rating: Database["public"]["Enums"]["severity_rating"] | null
          shift: Database["public"]["Enums"]["shift_type"] | null
          site_id: string
          updated_at: string
        }
        Insert: {
          actual_cost_to_date?: number | null
          body_part?: string | null
          claim_ref?: string | null
          classification?:
            | Database["public"]["Enums"]["incident_classification"]
            | null
          created_at?: string
          days_away?: number
          days_restricted?: number
          department_id?: string | null
          description?: string | null
          employee_id?: string | null
          expected_cost?: number | null
          id?: string
          incident_date: string
          incident_type: Database["public"]["Enums"]["incident_type"]
          injury_type?: string | null
          is_lost_time?: boolean
          machine_involved?: boolean
          organization_id: string
          recently_transferred?: boolean
          reported_date?: string | null
          root_cause_category?:
            | Database["public"]["Enums"]["root_cause_category"]
            | null
          root_cause_detail?: string | null
          safety_violation?: boolean
          severity_rating?:
            | Database["public"]["Enums"]["severity_rating"]
            | null
          shift?: Database["public"]["Enums"]["shift_type"] | null
          site_id: string
          updated_at?: string
        }
        Update: {
          actual_cost_to_date?: number | null
          body_part?: string | null
          claim_ref?: string | null
          classification?:
            | Database["public"]["Enums"]["incident_classification"]
            | null
          created_at?: string
          days_away?: number
          days_restricted?: number
          department_id?: string | null
          description?: string | null
          employee_id?: string | null
          expected_cost?: number | null
          id?: string
          incident_date?: string
          incident_type?: Database["public"]["Enums"]["incident_type"]
          injury_type?: string | null
          is_lost_time?: boolean
          machine_involved?: boolean
          organization_id?: string
          recently_transferred?: boolean
          reported_date?: string | null
          root_cause_category?:
            | Database["public"]["Enums"]["root_cause_category"]
            | null
          root_cause_detail?: string | null
          safety_violation?: boolean
          severity_rating?:
            | Database["public"]["Enums"]["severity_rating"]
            | null
          shift?: Database["public"]["Enums"]["shift_type"] | null
          site_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidents_department_id_organization_id_fkey"
            columns: ["department_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "incidents_employee_id_organization_id_fkey"
            columns: ["employee_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "incidents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_site_id_organization_id_fkey"
            columns: ["site_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      injury_types: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          label: string
          organization_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          organization_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          organization_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "injury_types_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      leading_indicators: {
        Row: {
          created_at: string
          gemba_walks: number
          hazards_reported: number
          id: string
          inspections_completed: number
          organization_id: string
          period_month: number
          period_year: number
          safety_meetings: number
          site_id: string
          trainings_delivered: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          gemba_walks?: number
          hazards_reported?: number
          id?: string
          inspections_completed?: number
          organization_id: string
          period_month: number
          period_year: number
          safety_meetings?: number
          site_id: string
          trainings_delivered?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          gemba_walks?: number
          hazards_reported?: number
          id?: string
          inspections_completed?: number
          organization_id?: string
          period_month?: number
          period_year?: number
          safety_meetings?: number
          site_id?: string
          trainings_delivered?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leading_indicators_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leading_indicators_site_id_organization_id_fkey"
            columns: ["site_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      organizations: {
        Row: {
          anonymize_employees: boolean
          created_at: string
          employee_count: number | null
          id: string
          naics_code: string | null
          name: string
          updated_at: string
        }
        Insert: {
          anonymize_employees?: boolean
          created_at?: string
          employee_count?: number | null
          id?: string
          naics_code?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          anonymize_employees?: boolean
          created_at?: string
          employee_count?: number | null
          id?: string
          naics_code?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          organization_id: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          organization_id: string
          state: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          state?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          state?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      compliance_events_enriched: {
        Row: {
          agency: string | null
          citation: string | null
          completed_by: string | null
          completed_date: string | null
          completed_on_time: boolean | null
          created_at: string | null
          days_until_due: number | null
          due_date: string | null
          evidence_notes: string | null
          frequency: Database["public"]["Enums"]["obligation_frequency"] | null
          id: string | null
          is_verified: boolean | null
          jurisdiction: Database["public"]["Enums"]["jurisdiction"] | null
          lead_time_days: number | null
          obligation: string | null
          obligation_id: string | null
          organization_id: string | null
          permit_ref: string | null
          program_area: string | null
          responsible_party: string | null
          site_id: string | null
          site_name: string | null
          state: string | null
          state_rank: number | null
          status: Database["public"]["Enums"]["obligation_status"] | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compliance_events_obligation_id_organization_id_fkey"
            columns: ["obligation_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "compliance_obligations"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "compliance_events_obligation_id_organization_id_fkey"
            columns: ["obligation_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "compliance_obligations_enriched"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "compliance_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_obligations_enriched: {
        Row: {
          agency: string | null
          citation: string | null
          completed_events: number | null
          created_at: string | null
          due_date: string | null
          frequency: Database["public"]["Enums"]["obligation_frequency"] | null
          id: string | null
          is_scheduled: boolean | null
          is_verified: boolean | null
          jurisdiction: Database["public"]["Enums"]["jurisdiction"] | null
          last_completed_date: string | null
          lead_time_days: number | null
          next_due_date: string | null
          next_event_id: string | null
          next_state: string | null
          notes: string | null
          obligation: string | null
          open_events: number | null
          organization_id: string | null
          overdue_events: number | null
          permit_ref: string | null
          program_area: string | null
          recurrence_day: number | null
          recurrence_month: number | null
          responsible_party: string | null
          site_id: string | null
          site_name: string | null
          status: Database["public"]["Enums"]["obligation_status"] | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compliance_obligations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_obligations_site_id_organization_id_fkey"
            columns: ["site_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      corrective_actions_enriched: {
        Row: {
          assigned_to_name: string | null
          assigned_to_profile_id: string | null
          completed_date: string | null
          created_at: string | null
          department_id: string | null
          department_name: string | null
          description: string | null
          due_date: string | null
          hierarchy_of_controls: string | null
          hoc_description: string | null
          hoc_label: string | null
          hoc_rank: number | null
          hoc_sort_rank: number | null
          hoc_token: number | null
          id: string | null
          incident_date: string | null
          incident_id: string | null
          is_engineering_or_above: boolean | null
          needs_classification: boolean | null
          organization_id: string | null
          site_id: string | null
          site_name: string | null
          status: Database["public"]["Enums"]["corrective_action_status"] | null
          updated_at: string | null
          verification_notes: string | null
        }
        Relationships: [
          {
            foreignKeyName: "corrective_actions_assigned_to_profile_id_organization_id_fkey"
            columns: ["assigned_to_profile_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "corrective_actions_hierarchy_of_controls_fkey"
            columns: ["hierarchy_of_controls"]
            isOneToOne: false
            referencedRelation: "hierarchy_of_control_levels"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "corrective_actions_incident_id_organization_id_fkey"
            columns: ["incident_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "corrective_actions_incident_id_organization_id_fkey"
            columns: ["incident_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "incidents_enriched"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "corrective_actions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      corrective_actions_needing_classification: {
        Row: {
          assigned_to_name: string | null
          assigned_to_profile_id: string | null
          completed_date: string | null
          created_at: string | null
          department_id: string | null
          department_name: string | null
          description: string | null
          due_date: string | null
          hierarchy_of_controls: string | null
          hoc_description: string | null
          hoc_label: string | null
          hoc_rank: number | null
          hoc_sort_rank: number | null
          hoc_token: number | null
          id: string | null
          incident_date: string | null
          incident_id: string | null
          is_engineering_or_above: boolean | null
          needs_classification: boolean | null
          organization_id: string | null
          site_id: string | null
          site_name: string | null
          status: Database["public"]["Enums"]["corrective_action_status"] | null
          updated_at: string | null
          verification_notes: string | null
        }
        Relationships: [
          {
            foreignKeyName: "corrective_actions_assigned_to_profile_id_organization_id_fkey"
            columns: ["assigned_to_profile_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "corrective_actions_hierarchy_of_controls_fkey"
            columns: ["hierarchy_of_controls"]
            isOneToOne: false
            referencedRelation: "hierarchy_of_control_levels"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "corrective_actions_incident_id_organization_id_fkey"
            columns: ["incident_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "corrective_actions_incident_id_organization_id_fkey"
            columns: ["incident_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "incidents_enriched"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "corrective_actions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents_enriched: {
        Row: {
          actual_cost_to_date: number | null
          body_part: string | null
          claim_ref: string | null
          classification:
            | Database["public"]["Enums"]["incident_classification"]
            | null
          created_at: string | null
          days_away: number | null
          days_restricted: number | null
          department_id: string | null
          department_name: string | null
          description: string | null
          employee_display: string | null
          employee_id: string | null
          employee_ref: string | null
          expected_cost: number | null
          hire_date: string | null
          id: string | null
          incident_date: string | null
          incident_type: Database["public"]["Enums"]["incident_type"] | null
          injury_type: string | null
          is_dart_case: boolean | null
          is_lost_time: boolean | null
          is_recordable: boolean | null
          machine_involved: boolean | null
          organization_id: string | null
          recently_transferred: boolean | null
          reported_date: string | null
          root_cause_category:
            | Database["public"]["Enums"]["root_cause_category"]
            | null
          root_cause_detail: string | null
          safety_violation: boolean | null
          severity_rating: Database["public"]["Enums"]["severity_rating"] | null
          shift: Database["public"]["Enums"]["shift_type"] | null
          site_id: string | null
          site_name: string | null
          tenure_bucket: string | null
          tenure_bucket_rank: number | null
          tenure_days: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incidents_department_id_organization_id_fkey"
            columns: ["department_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "incidents_employee_id_organization_id_fkey"
            columns: ["employee_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "incidents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_site_id_organization_id_fkey"
            columns: ["site_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
    }
    Functions: {
      add_member_to_current_org: {
        Args: {
          p_full_name?: string
          p_role?: Database["public"]["Enums"]["user_role"]
          p_user_id: string
        }
        Returns: undefined
      }
      apply_tenant_guards: { Args: { p_table: unknown }; Returns: undefined }
      bootstrap_organization: {
        Args: {
          p_employee_count?: number
          p_full_name?: string
          p_naics_code?: string
          p_org_name: string
        }
        Returns: string
      }
      can_write: { Args: never; Returns: boolean }
      compliance_anchor_date: {
        Args: {
          p_as_of?: string
          p_due_date: string
          p_frequency: Database["public"]["Enums"]["obligation_frequency"]
          p_recurrence_day: number
          p_recurrence_month: number
        }
        Returns: string
      }
      compliance_event_state: {
        Args: {
          p_as_of?: string
          p_completed_date: string
          p_due_date: string
          p_lead_time_days: number
        }
        Returns: string
      }
      compliance_generation_window: {
        Args: {
          p_frequency: Database["public"]["Enums"]["obligation_frequency"]
        }
        Returns: Record<string, unknown>
      }
      compliance_month_day: {
        Args: { p_day: number; p_month: number; p_year: number }
        Returns: string
      }
      compliance_recurrence_step: {
        Args: {
          p_frequency: Database["public"]["Enums"]["obligation_frequency"]
        }
        Returns: string
      }
      compliance_state_rank: { Args: { p_state: string }; Returns: number }
      current_org_id: { Args: never; Returns: string }
      current_org_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      generate_compliance_events: {
        Args: { p_as_of?: string; p_obligation_id: string }
        Returns: number
      }
      is_org_admin: { Args: never; Returns: boolean }
      refresh_compliance_calendar: {
        Args: { p_as_of?: string }
        Returns: number
      }
      regenerate_compliance_events: {
        Args: { p_as_of?: string; p_obligation_id: string }
        Returns: number
      }
    }
    Enums: {
      corrective_action_status:
        | "Not Started"
        | "In Progress"
        | "Complete"
        | "Overdue"
      incident_classification:
        | "LTI"
        | "MTI"
        | "FAI"
        | "Near Miss"
        | "Property Damage"
        | "Hazard"
      incident_type:
        | "OSHA Recordable"
        | "First Aid"
        | "Near Miss"
        | "Property Damage"
        | "Hazard"
      jurisdiction: "Federal" | "State" | "Local/Regional"
      obligation_frequency:
        | "One-time"
        | "Daily"
        | "Weekly"
        | "Monthly"
        | "Quarterly"
        | "Semi-annual"
        | "Annual"
        | "Biennial"
        | "Every 4 years"
        | "5-year cycle"
        | "Ongoing"
        | "Per event"
      obligation_status:
        | "Compliant"
        | "In Progress"
        | "Action Required"
        | "Overdue"
        | "Not Started"
        | "N/A - Verify"
      root_cause_category:
        | "Unsafe Act"
        | "Unsafe Condition"
        | "Personnel/Behavioral"
        | "Management System"
        | "Environmental"
      severity_rating:
        | "1 - Insignificant"
        | "2 - Minor"
        | "3 - Significant"
        | "4 - Major"
        | "5 - Severe"
      shift_type: "First" | "Second" | "Third"
      user_role: "owner" | "admin" | "contributor" | "viewer"
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
      corrective_action_status: [
        "Not Started",
        "In Progress",
        "Complete",
        "Overdue",
      ],
      incident_classification: [
        "LTI",
        "MTI",
        "FAI",
        "Near Miss",
        "Property Damage",
        "Hazard",
      ],
      incident_type: [
        "OSHA Recordable",
        "First Aid",
        "Near Miss",
        "Property Damage",
        "Hazard",
      ],
      jurisdiction: ["Federal", "State", "Local/Regional"],
      obligation_frequency: [
        "One-time",
        "Daily",
        "Weekly",
        "Monthly",
        "Quarterly",
        "Semi-annual",
        "Annual",
        "Biennial",
        "Every 4 years",
        "5-year cycle",
        "Ongoing",
        "Per event",
      ],
      obligation_status: [
        "Compliant",
        "In Progress",
        "Action Required",
        "Overdue",
        "Not Started",
        "N/A - Verify",
      ],
      root_cause_category: [
        "Unsafe Act",
        "Unsafe Condition",
        "Personnel/Behavioral",
        "Management System",
        "Environmental",
      ],
      severity_rating: [
        "1 - Insignificant",
        "2 - Minor",
        "3 - Significant",
        "4 - Major",
        "5 - Severe",
      ],
      shift_type: ["First", "Second", "Third"],
      user_role: ["owner", "admin", "contributor", "viewer"],
    },
  },
} as const
