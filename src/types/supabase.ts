export interface Database {
  public: {
    Tables: {
      configs: {
        Row: {
          id: number
          owner: string
          repo: string
          token: string
          issues_per_page: number
          created_at: string
          updated_at: string
        }
        Insert: {
          owner: string
          repo: string
          token: string
          issues_per_page?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          owner?: string
          repo?: string
          token?: string
          issues_per_page?: number
          updated_at?: string
        }
      }
      issues: {
        Row: {
          id: number
          owner: string
          repo: string
          issue_number: number
          title: string
          body: string | null
          created_at: string
          updated_at: string
          state: string
          labels: string[]
          github_created_at: string
        }
        Insert: {
          owner: string
          repo: string
          issue_number: number
          title: string
          body?: string | null
          state: string
          labels?: string[]
          github_created_at: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          owner?: string
          repo?: string
          issue_number?: number
          title?: string
          body?: string | null
          state?: string
          labels?: string[]
          github_created_at?: string
          updated_at?: string
        }
      }
      labels: {
        Row: {
          id: number
          owner: string
          repo: string
          name: string
          color: string
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          owner: string
          repo: string
          name: string
          color: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          owner?: string
          repo?: string
          name?: string
          color?: string
          description?: string | null
          updated_at?: string
        }
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
  }
} 