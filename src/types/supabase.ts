export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '12.2.3 (519615d)';
  };
  public: {
    Tables: {
      _dlt_loads: {
        Row: {
          inserted_at: string;
          load_id: string;
          schema_name: string | null;
          schema_version_hash: string | null;
          status: number;
        };
        Insert: {
          inserted_at: string;
          load_id: string;
          schema_name?: string | null;
          schema_version_hash?: string | null;
          status: number;
        };
        Update: {
          inserted_at?: string;
          load_id?: string;
          schema_name?: string | null;
          schema_version_hash?: string | null;
          status?: number;
        };
        Relationships: [];
      };
      _dlt_pipeline_state: {
        Row: {
          _dlt_id: string;
          _dlt_load_id: string;
          created_at: string;
          engine_version: number;
          pipeline_name: string;
          state: string;
          version: number;
          version_hash: string | null;
        };
        Insert: {
          _dlt_id: string;
          _dlt_load_id: string;
          created_at: string;
          engine_version: number;
          pipeline_name: string;
          state: string;
          version: number;
          version_hash?: string | null;
        };
        Update: {
          _dlt_id?: string;
          _dlt_load_id?: string;
          created_at?: string;
          engine_version?: number;
          pipeline_name?: string;
          state?: string;
          version?: number;
          version_hash?: string | null;
        };
        Relationships: [];
      };
      _dlt_version: {
        Row: {
          engine_version: number;
          inserted_at: string;
          schema: string;
          schema_name: string;
          version: number;
          version_hash: string;
        };
        Insert: {
          engine_version: number;
          inserted_at: string;
          schema: string;
          schema_name: string;
          version: number;
          version_hash: string;
        };
        Update: {
          engine_version?: number;
          inserted_at?: string;
          schema?: string;
          schema_name?: string;
          version?: number;
          version_hash?: string;
        };
        Relationships: [];
      };
      app_enabled_repositories: {
        Row: {
          enabled_at: string | null;
          id: string;
          installation_id: string | null;
          repository_id: string | null;
        };
        Insert: {
          enabled_at?: string | null;
          id?: string;
          installation_id?: string | null;
          repository_id?: string | null;
        };
        Update: {
          enabled_at?: string | null;
          id?: string;
          installation_id?: string | null;
          repository_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'app_enabled_repositories_installation_id_fkey';
            columns: ['installation_id'];
            isOneToOne: false;
            referencedRelation: 'github_app_installations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'app_enabled_repositories_repository_id_fkey';
            columns: ['repository_id'];
            isOneToOne: false;
            referencedRelation: 'repositories';
            referencedColumns: ['id'];
          },
        ];
      };
      app_metrics: {
        Row: {
          created_at: string | null;
          event_data: Json | null;
          event_type: string;
          id: string;
        };
        Insert: {
          created_at?: string | null;
          event_data?: Json | null;
          event_type: string;
          id?: string;
        };
        Update: {
          created_at?: string | null;
          event_data?: Json | null;
          event_type?: string;
          id?: string;
        };
        Relationships: [];
      };
      app_users: {
        Row: {
          auth_user_id: string | null;
          avatar_url: string | null;
          created_at: string;
          display_name: string | null;
          email: string | null;
          first_login_at: string;
          github_user_id: number | null;
          github_username: string;
          id: string;
          is_active: boolean | null;
          is_admin: boolean | null;
          last_login_at: string;
          updated_at: string;
        };
        Insert: {
          auth_user_id?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          first_login_at?: string;
          github_user_id?: number | null;
          github_username: string;
          id?: string;
          is_active?: boolean | null;
          is_admin?: boolean | null;
          last_login_at?: string;
          updated_at?: string;
        };
        Update: {
          auth_user_id?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          first_login_at?: string;
          github_user_id?: number | null;
          github_username?: string;
          id?: string;
          is_active?: boolean | null;
          is_admin?: boolean | null;
          last_login_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      auth_errors: {
        Row: {
          auth_user_id: string | null;
          created_at: string | null;
          error_code: string | null;
          error_message: string | null;
          error_type: string;
          github_user_id: number | null;
          github_username: string | null;
          id: string;
          ip_address: unknown | null;
          resolved: boolean | null;
          resolved_at: string | null;
          resolved_by: string | null;
          user_agent: string | null;
        };
        Insert: {
          auth_user_id?: string | null;
          created_at?: string | null;
          error_code?: string | null;
          error_message?: string | null;
          error_type: string;
          github_user_id?: number | null;
          github_username?: string | null;
          id?: string;
          ip_address?: unknown | null;
          resolved?: boolean | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          user_agent?: string | null;
        };
        Update: {
          auth_user_id?: string | null;
          created_at?: string | null;
          error_code?: string | null;
          error_message?: string | null;
          error_type?: string;
          github_user_id?: number | null;
          github_username?: string | null;
          id?: string;
          ip_address?: unknown | null;
          resolved?: boolean | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          user_agent?: string | null;
        };
        Relationships: [];
      };
      backfill_chunks: {
        Row: {
          api_calls_made: number | null;
          backfill_state_id: string;
          chunk_number: number;
          completed_at: string | null;
          created_at: string | null;
          error: string | null;
          id: string;
          pr_count: number | null;
          pr_numbers: number[] | null;
          processing_time_ms: number | null;
          processor_type: string | null;
          rate_limit_remaining: number | null;
          repository_id: string;
          retry_count: number | null;
          started_at: string | null;
          status: string | null;
        };
        Insert: {
          api_calls_made?: number | null;
          backfill_state_id: string;
          chunk_number: number;
          completed_at?: string | null;
          created_at?: string | null;
          error?: string | null;
          id?: string;
          pr_count?: number | null;
          pr_numbers?: number[] | null;
          processing_time_ms?: number | null;
          processor_type?: string | null;
          rate_limit_remaining?: number | null;
          repository_id: string;
          retry_count?: number | null;
          started_at?: string | null;
          status?: string | null;
        };
        Update: {
          api_calls_made?: number | null;
          backfill_state_id?: string;
          chunk_number?: number;
          completed_at?: string | null;
          created_at?: string | null;
          error?: string | null;
          id?: string;
          pr_count?: number | null;
          pr_numbers?: number[] | null;
          processing_time_ms?: number | null;
          processor_type?: string | null;
          rate_limit_remaining?: number | null;
          repository_id?: string;
          retry_count?: number | null;
          started_at?: string | null;
          status?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'backfill_chunks_backfill_state_id_fkey';
            columns: ['backfill_state_id'];
            isOneToOne: false;
            referencedRelation: 'backfill_progress_summary';
            referencedColumns: ['backfill_id'];
          },
          {
            foreignKeyName: 'backfill_chunks_backfill_state_id_fkey';
            columns: ['backfill_state_id'];
            isOneToOne: false;
            referencedRelation: 'progressive_backfill_state';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'backfill_chunks_repository_id_fkey';
            columns: ['repository_id'];
            isOneToOne: false;
            referencedRelation: 'repositories';
            referencedColumns: ['id'];
          },
        ];
      };
      background_jobs: {
        Row: {
          affected_workspaces: number | null;
          completed_at: string | null;
          created_at: string | null;
          duration_ms: number | null;
          error: string | null;
          failed_at: string | null;
          id: string;
          inngest_event_id: string | null;
          inngest_run_id: string | null;
          max_retries: number | null;
          payload: Json | null;
          processing_mode: string | null;
          repository_id: string | null;
          response_time_ms: number | null;
          result: Json | null;
          retry_at: string | null;
          retry_count: number | null;
          started_at: string | null;
          status: string | null;
          type: string;
          webhook_event_type: string | null;
          webhook_source: string | null;
        };
        Insert: {
          affected_workspaces?: number | null;
          completed_at?: string | null;
          created_at?: string | null;
          duration_ms?: number | null;
          error?: string | null;
          failed_at?: string | null;
          id?: string;
          inngest_event_id?: string | null;
          inngest_run_id?: string | null;
          max_retries?: number | null;
          payload?: Json | null;
          processing_mode?: string | null;
          repository_id?: string | null;
          response_time_ms?: number | null;
          result?: Json | null;
          retry_at?: string | null;
          retry_count?: number | null;
          started_at?: string | null;
          status?: string | null;
          type: string;
          webhook_event_type?: string | null;
          webhook_source?: string | null;
        };
        Update: {
          affected_workspaces?: number | null;
          completed_at?: string | null;
          created_at?: string | null;
          duration_ms?: number | null;
          error?: string | null;
          failed_at?: string | null;
          id?: string;
          inngest_event_id?: string | null;
          inngest_run_id?: string | null;
          max_retries?: number | null;
          payload?: Json | null;
          processing_mode?: string | null;
          repository_id?: string | null;
          response_time_ms?: number | null;
          result?: Json | null;
          retry_at?: string | null;
          retry_count?: number | null;
          started_at?: string | null;
          status?: string | null;
          type?: string;
          webhook_event_type?: string | null;
          webhook_source?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'background_jobs_repository_id_fkey';
            columns: ['repository_id'];
            isOneToOne: false;
            referencedRelation: 'repositories';
            referencedColumns: ['id'];
          },
        ];
      };
      batch_progress: {
        Row: {
          id: string;
          last_pr_number: number | null;
          processed_count: number | null;
          repository_id: string | null;
          status: string | null;
          total_count: number | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          last_pr_number?: number | null;
          processed_count?: number | null;
          repository_id?: string | null;
          status?: string | null;
          total_count?: number | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          last_pr_number?: number | null;
          processed_count?: number | null;
          repository_id?: string | null;
          status?: string | null;
          total_count?: number | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'batch_progress_repository_id_fkey';
            columns: ['repository_id'];
            isOneToOne: true;
            referencedRelation: 'repositories';
            referencedColumns: ['id'];
          },
        ];
      };
      billing_history: {
        Row: {
          amount_cents: number;
          billing_date: string;
          billing_period_end: string | null;
          billing_period_start: string | null;
          currency: string;
          description: string | null;
          id: string;
          invoice_url: string | null;
          metadata: Json | null;
          paid_at: string | null;
          receipt_url: string | null;
          status: string;
          stripe_invoice_id: string | null;
          stripe_payment_intent_id: string | null;
          user_id: string;
        };
        Insert: {
          amount_cents: number;
          billing_date?: string;
          billing_period_end?: string | null;
          billing_period_start?: string | null;
          currency?: string;
          description?: string | null;
          id?: string;
          invoice_url?: string | null;
          metadata?: Json | null;
          paid_at?: string | null;
          receipt_url?: string | null;
          status: string;
          stripe_invoice_id?: string | null;
          stripe_payment_intent_id?: string | null;
          user_id: string;
        };
        Update: {
          amount_cents?: number;
          billing_date?: string;
          billing_period_end?: string | null;
          billing_period_start?: string | null;
          currency?: string;
          description?: string | null;
          id?: string;
          invoice_url?: string | null;
          metadata?: Json | null;
          paid_at?: string | null;
          receipt_url?: string | null;
          status?: string;
          stripe_invoice_id?: string | null;
          stripe_payment_intent_id?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      codeowners: {
        Row: {
          content: string;
          created_at: string | null;
          fetched_at: string | null;
          file_path: string;
          id: string;
          repository_id: string;
          rules: Json | null;
          sha: string | null;
          updated_at: string | null;
        };
        Insert: {
          content: string;
          created_at?: string | null;
          fetched_at?: string | null;
          file_path: string;
          id?: string;
          repository_id: string;
          rules?: Json | null;
          sha?: string | null;
          updated_at?: string | null;
        };
        Update: {
          content?: string;
          created_at?: string | null;
          fetched_at?: string | null;
          file_path?: string;
          id?: string;
          repository_id?: string;
          rules?: Json | null;
          sha?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'codeowners_repository_id_fkey';
            columns: ['repository_id'];
            isOneToOne: false;
            referencedRelation: 'repositories';
            referencedColumns: ['id'];
          },
        ];
      };
      codeowners_suggestions: {
        Row: {
          created_at: string | null;
          expires_at: string | null;
          generated_at: string | null;
          generated_content: string | null;
          id: string;
          repository_id: string;
          suggestions: Json;
          total_contributors: number | null;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          expires_at?: string | null;
          generated_at?: string | null;
          generated_content?: string | null;
          id?: string;
          repository_id: string;
          suggestions: Json;
          total_contributors?: number | null;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          expires_at?: string | null;
          generated_at?: string | null;
          generated_content?: string | null;
          id?: string;
          repository_id?: string;
          suggestions?: Json;
          total_contributors?: number | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'codeowners_suggestions_repository_id_fkey';
            columns: ['repository_id'];
            isOneToOne: true;
            referencedRelation: 'repositories';
            referencedColumns: ['id'];
          },
        ];
      };
      comments: {
        Row: {
          body: string;
          comment_type: string;
          commenter_id: string | null;
          commit_id: string | null;
          created_at: string;
          diff_hunk: string | null;
          github_id: number;
          id: string;
          in_reply_to_id: string | null;
          issue_id: string | null;
          original_commit_id: string | null;
          original_position: number | null;
          path: string | null;
          position: number | null;
          pull_request_id: string | null;
          repository_id: string;
          updated_at: string;
        };
        Insert: {
          body: string;
          comment_type: string;
          commenter_id?: string | null;
          commit_id?: string | null;
          created_at: string;
          diff_hunk?: string | null;
          github_id: number;
          id?: string;
          in_reply_to_id?: string | null;
          issue_id?: string | null;
          original_commit_id?: string | null;
          original_position?: number | null;
          path?: string | null;
          position?: number | null;
          pull_request_id?: string | null;
          repository_id: string;
          updated_at: string;
        };
        Update: {
          body?: string;
          comment_type?: string;
          commenter_id?: string | null;
          commit_id?: string | null;
          created_at?: string;
          diff_hunk?: string | null;
          github_id?: number;
          id?: string;
          in_reply_to_id?: string | null;
          issue_id?: string | null;
          original_commit_id?: string | null;
          original_position?: number | null;
          path?: string | null;
          position?: number | null;
          pull_request_id?: string | null;
          repository_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'comments_issue_id_fkey';
            columns: ['issue_id'];
            isOneToOne: false;
            referencedRelation: 'issues';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'comments_repository_id_fkey';
            columns: ['repository_id'];
            isOneToOne: false;
            referencedRelation: 'repositories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_comments_commenter';
            columns: ['commenter_id'];
            isOneToOne: false;
            referencedRelation: 'contributor_stats';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_comments_commenter';
            columns: ['commenter_id'];
            isOneToOne: false;
            referencedRelation: 'contributors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_comments_in_reply_to';
            columns: ['in_reply_to_id'];
            isOneToOne: false;
            referencedRelation: 'comments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_comments_in_reply_to';
            columns: ['in_reply_to_id'];
            isOneToOne: false;
            referencedRelation: 'issue_comments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_comments_in_reply_to';
            columns: ['in_reply_to_id'];
            isOneToOne: false;
            referencedRelation: 'pr_comments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_comments_pull_request';
            columns: ['pull_request_id'];
            isOneToOne: false;
            referencedRelation: 'pull_requests';
            referencedColumns: ['id'];
          },
        ];
      };
      commits: {
        Row: {
          author_id: string | null;
          authored_at: string | null;
          created_at: string | null;
          id: string;
          is_direct_commit: boolean | null;
          message: string | null;
          pull_request_id: string | null;
          repository_id: string;
          sha: string;
          updated_at: string | null;
        };
        Insert: {
          author_id?: string | null;
          authored_at?: string | null;
          created_at?: string | null;
          id?: string;
          is_direct_commit?: boolean | null;
          message?: string | null;
          pull_request_id?: string | null;
          repository_id: string;
          sha: string;
          updated_at?: string | null;
        };
        Update: {
          author_id?: string | null;
          authored_at?: string | null;
          created_at?: string | null;
          id?: string;
          is_direct_commit?: boolean | null;
          message?: string | null;
          pull_request_id?: string | null;
          repository_id?: string;
          sha?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'commits_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'contributor_stats';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'commits_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'contributors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'commits_pull_request_id_fkey';
            columns: ['pull_request_id'];
            isOneToOne: false;
            referencedRelation: 'pull_requests';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'commits_repository_id_fkey';
            columns: ['repository_id'];
            isOneToOne: false;
            referencedRelation: 'repositories';
            referencedColumns: ['id'];
          },
        ];
      };
      contributor_group_members: {
        Row: {
          added_at: string | null;
          added_by: string | null;
          contributor_username: string;
          group_id: string;
          id: string;
          workspace_id: string;
        };
        Insert: {
          added_at?: string | null;
          added_by?: string | null;
          contributor_username: string;
          group_id: string;
          id?: string;
          workspace_id: string;
        };
        Update: {
          added_at?: string | null;
          added_by?: string | null;
          contributor_username?: string;
          group_id?: string;
          id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'contributor_group_members_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'contributor_groups';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'contributor_group_members_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspace_preview_stats';
            referencedColumns: ['workspace_id'];
          },
          {
            foreignKeyName: 'contributor_group_members_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      contributor_groups: {
        Row: {
          created_at: string | null;
          created_by: string | null;
          description: string | null;
          id: string;
          is_system: boolean | null;
          name: string;
          updated_at: string | null;
          workspace_id: string;
        };
        Insert: {
          created_at?: string | null;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          is_system?: boolean | null;
          name: string;
          updated_at?: string | null;
          workspace_id: string;
        };
        Update: {
          created_at?: string | null;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          is_system?: boolean | null;
          name?: string;
          updated_at?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'contributor_groups_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspace_preview_stats';
            referencedColumns: ['workspace_id'];
          },
          {
            foreignKeyName: 'contributor_groups_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      contributor_notes: {
        Row: {
          contributor_username: string;
          created_at: string | null;
          created_by: string | null;
          id: string;
          note_content: string;
          updated_at: string | null;
          updated_by: string | null;
          workspace_id: string;
        };
        Insert: {
          contributor_username: string;
          created_at?: string | null;
          created_by?: string | null;
          id?: string;
          note_content: string;
          updated_at?: string | null;
          updated_by?: string | null;
          workspace_id: string;
        };
        Update: {
          contributor_username?: string;
          created_at?: string | null;
          created_by?: string | null;
          id?: string;
          note_content?: string;
          updated_at?: string | null;
          updated_by?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'contributor_notes_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspace_preview_stats';
            referencedColumns: ['workspace_id'];
          },
          {
            foreignKeyName: 'contributor_notes_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      contributor_role_history: {
        Row: {
          change_reason: string | null;
          changed_at: string;
          contributor_role_id: string;
          detection_methods: Json | null;
          id: string;
          new_confidence: number;
          new_role: string;
          previous_confidence: number | null;
          previous_role: string | null;
          repository_name: string;
          repository_owner: string;
          user_id: string;
        };
        Insert: {
          change_reason?: string | null;
          changed_at?: string;
          contributor_role_id: string;
          detection_methods?: Json | null;
          id?: string;
          new_confidence: number;
          new_role: string;
          previous_confidence?: number | null;
          previous_role?: string | null;
          repository_name: string;
          repository_owner: string;
          user_id: string;
        };
        Update: {
          change_reason?: string | null;
          changed_at?: string;
          contributor_role_id?: string;
          detection_methods?: Json | null;
          id?: string;
          new_confidence?: number;
          new_role?: string;
          previous_confidence?: number | null;
          previous_role?: string | null;
          repository_name?: string;
          repository_owner?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'contributor_role_history_contributor_role_id_fkey';
            columns: ['contributor_role_id'];
            isOneToOne: false;
            referencedRelation: 'contributor_roles';
            referencedColumns: ['id'];
          },
        ];
      };
      contributor_roles: {
        Row: {
          admin_override: boolean | null;
          admin_override_at: string | null;
          admin_override_by: number | null;
          confidence_score: number;
          created_at: string;
          detected_at: string;
          detection_methods: Json | null;
          id: string;
          last_verified: string;
          locked: boolean | null;
          override_reason: string | null;
          permission_events_count: number | null;
          repository_name: string;
          repository_owner: string;
          role: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          admin_override?: boolean | null;
          admin_override_at?: string | null;
          admin_override_by?: number | null;
          confidence_score: number;
          created_at?: string;
          detected_at?: string;
          detection_methods?: Json | null;
          id?: string;
          last_verified?: string;
          locked?: boolean | null;
          override_reason?: string | null;
          permission_events_count?: number | null;
          repository_name: string;
          repository_owner: string;
          role: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          admin_override?: boolean | null;
          admin_override_at?: string | null;
          admin_override_by?: number | null;
          confidence_score?: number;
          created_at?: string;
          detected_at?: string;
          detection_methods?: Json | null;
          id?: string;
          last_verified?: string;
          locked?: boolean | null;
          override_reason?: string | null;
          permission_events_count?: number | null;
          repository_name?: string;
          repository_owner?: string;
          role?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_admin_override_by';
            columns: ['admin_override_by'];
            isOneToOne: false;
            referencedRelation: 'app_users';
            referencedColumns: ['github_user_id'];
          },
        ];
      };
      contributors: {
        Row: {
          _dlt_id: string | null;
          _dlt_load_id: string | null;
          avatar_cache_expires_at: string | null;
          avatar_cached_at: string | null;
          avatar_url: string | null;
          bio: string | null;
          blog: string | null;
          company: string | null;
          created_at: string | null;
          discord_url: string | null;
          display_name: string | null;
          email: string | null;
          first_seen_at: string;
          followers: number | null;
          following: number | null;
          github_created_at: string | null;
          github_id: number;
          id: string;
          is_active: boolean | null;
          is_bot: boolean | null;
          last_updated_at: string;
          linkedin_url: string | null;
          location: string | null;
          profile_url: string | null;
          public_gists: number | null;
          public_repos: number | null;
          username: string;
        };
        Insert: {
          _dlt_id?: string | null;
          _dlt_load_id?: string | null;
          avatar_cache_expires_at?: string | null;
          avatar_cached_at?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          blog?: string | null;
          company?: string | null;
          created_at?: string | null;
          discord_url?: string | null;
          display_name?: string | null;
          email?: string | null;
          first_seen_at?: string;
          followers?: number | null;
          following?: number | null;
          github_created_at?: string | null;
          github_id: number;
          id?: string;
          is_active?: boolean | null;
          is_bot?: boolean | null;
          last_updated_at?: string;
          linkedin_url?: string | null;
          location?: string | null;
          profile_url?: string | null;
          public_gists?: number | null;
          public_repos?: number | null;
          username: string;
        };
        Update: {
          _dlt_id?: string | null;
          _dlt_load_id?: string | null;
          avatar_cache_expires_at?: string | null;
          avatar_cached_at?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          blog?: string | null;
          company?: string | null;
          created_at?: string | null;
          discord_url?: string | null;
          display_name?: string | null;
          email?: string | null;
          first_seen_at?: string;
          followers?: number | null;
          following?: number | null;
          github_created_at?: string | null;
          github_id?: number;
          id?: string;
          is_active?: boolean | null;
          is_bot?: boolean | null;
          last_updated_at?: string;
          linkedin_url?: string | null;
          location?: string | null;
          profile_url?: string | null;
          public_gists?: number | null;
          public_repos?: number | null;
          username?: string;
        };
        Relationships: [];
      };
      contributors_backup: {
        Row: {
          avatar_cache_expires_at: string | null;
          avatar_cached_at: string | null;
          avatar_url: string | null;
          bio: string | null;
          blog: string | null;
          company: string | null;
          created_at: string | null;
          display_name: string | null;
          email: string | null;
          first_seen_at: string | null;
          followers: number | null;
          following: number | null;
          github_created_at: string | null;
          github_id: number | null;
          id: string | null;
          is_active: boolean | null;
          is_bot: boolean | null;
          last_updated_at: string | null;
          location: string | null;
          profile_url: string | null;
          public_gists: number | null;
          public_repos: number | null;
          username: string | null;
        };
        Insert: {
          avatar_cache_expires_at?: string | null;
          avatar_cached_at?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          blog?: string | null;
          company?: string | null;
          created_at?: string | null;
          display_name?: string | null;
          email?: string | null;
          first_seen_at?: string | null;
          followers?: number | null;
          following?: number | null;
          github_created_at?: string | null;
          github_id?: number | null;
          id?: string | null;
          is_active?: boolean | null;
          is_bot?: boolean | null;
          last_updated_at?: string | null;
          location?: string | null;
          profile_url?: string | null;
          public_gists?: number | null;
          public_repos?: number | null;
          username?: string | null;
        };
        Update: {
          avatar_cache_expires_at?: string | null;
          avatar_cached_at?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          blog?: string | null;
          company?: string | null;
          created_at?: string | null;
          display_name?: string | null;
          email?: string | null;
          first_seen_at?: string | null;
          followers?: number | null;
          following?: number | null;
          github_created_at?: string | null;
          github_id?: number | null;
          id?: string | null;
          is_active?: boolean | null;
          is_bot?: boolean | null;
          last_updated_at?: string | null;
          location?: string | null;
          profile_url?: string | null;
          public_gists?: number | null;
          public_repos?: number | null;
          username?: string | null;
        };
        Relationships: [];
      };
      contributors_replica: {
        Row: {
          avatar_cache_expires_at: string | null;
          avatar_cached_at: string | null;
          avatar_url: string | null;
          bio: string | null;
          blog: string | null;
          company: string | null;
          created_at: string | null;
          display_name: string | null;
          email: string | null;
          first_seen_at: string | null;
          followers: number | null;
          following: number | null;
          github_created_at: string | null;
          github_id: number | null;
          id: string;
          is_active: boolean | null;
          is_bot: boolean | null;
          last_updated_at: string | null;
          location: string | null;
          profile_url: string | null;
          public_gists: number | null;
          public_repos: number | null;
          username: string | null;
        };
        Insert: {
          avatar_cache_expires_at?: string | null;
          avatar_cached_at?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          blog?: string | null;
          company?: string | null;
          created_at?: string | null;
          display_name?: string | null;
          email?: string | null;
          first_seen_at?: string | null;
          followers?: number | null;
          following?: number | null;
          github_created_at?: string | null;
          github_id?: number | null;
          id?: string;
          is_active?: boolean | null;
          is_bot?: boolean | null;
          last_updated_at?: string | null;
          location?: string | null;
          profile_url?: string | null;
          public_gists?: number | null;
          public_repos?: number | null;
          username?: string | null;
        };
        Update: {
          avatar_cache_expires_at?: string | null;
          avatar_cached_at?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          blog?: string | null;
          company?: string | null;
          created_at?: string | null;
          display_name?: string | null;
          email?: string | null;
          first_seen_at?: string | null;
          followers?: number | null;
          following?: number | null;
          github_created_at?: string | null;
          github_id?: number | null;
          id?: string;
          is_active?: boolean | null;
          is_bot?: boolean | null;
          last_updated_at?: string | null;
          location?: string | null;
          profile_url?: string | null;
          public_gists?: number | null;
          public_repos?: number | null;
          username?: string | null;
        };
        Relationships: [];
      };
      daily_activity_snapshots: {
        Row: {
          comments_made: number | null;
          contributor_id: string | null;
          created_at: string;
          date: string;
          id: string;
          lines_added: number | null;
          lines_removed: number | null;
          pull_requests_closed: number | null;
          pull_requests_merged: number | null;
          pull_requests_opened: number | null;
          repository_id: string | null;
          reviews_submitted: number | null;
        };
        Insert: {
          comments_made?: number | null;
          contributor_id?: string | null;
          created_at?: string;
          date: string;
          id?: string;
          lines_added?: number | null;
          lines_removed?: number | null;
          pull_requests_closed?: number | null;
          pull_requests_merged?: number | null;
          pull_requests_opened?: number | null;
          repository_id?: string | null;
          reviews_submitted?: number | null;
        };
        Update: {
          comments_made?: number | null;
          contributor_id?: string | null;
          created_at?: string;
          date?: string;
          id?: string;
          lines_added?: number | null;
          lines_removed?: number | null;
          pull_requests_closed?: number | null;
          pull_requests_merged?: number | null;
          pull_requests_opened?: number | null;
          repository_id?: string | null;
          reviews_submitted?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_daily_activity_snapshots_contributor';
            columns: ['contributor_id'];
            isOneToOne: false;
            referencedRelation: 'contributor_stats';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_daily_activity_snapshots_contributor';
            columns: ['contributor_id'];
            isOneToOne: false;
            referencedRelation: 'contributors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_daily_activity_snapshots_repository';
            columns: ['repository_id'];
            isOneToOne: false;
            referencedRelation: 'repositories';
            referencedColumns: ['id'];
          },
        ];
      };
      data_capture_queue: {
        Row: {
          attempts: number;
          completed_at: string | null;
          created_at: string;
          estimated_api_calls: number;
          id: string;
          last_error: string | null;
          max_attempts: number;
          metadata: Json | null;
          next_retry_at: string | null;
          priority: string;
          repository_id: string;
          resource_id: string | null;
          started_at: string | null;
          status: string;
          type: string;
        };
        Insert: {
          attempts?: number;
          completed_at?: string | null;
          created_at?: string;
          estimated_api_calls?: number;
          id?: string;
          last_error?: string | null;
          max_attempts?: number;
          metadata?: Json | null;
          next_retry_at?: string | null;
          priority: string;
          repository_id: string;
          resource_id?: string | null;
          started_at?: string | null;
          status?: string;
          type: string;
        };
        Update: {
          attempts?: number;
          completed_at?: string | null;
          created_at?: string;
          estimated_api_calls?: number;
          id?: string;
          last_error?: string | null;
          max_attempts?: number;
          metadata?: Json | null;
          next_retry_at?: string | null;
          priority?: string;
          repository_id?: string;
          resource_id?: string | null;
          started_at?: string | null;
          status?: string;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'data_capture_queue_repository_id_fkey';
            columns: ['repository_id'];
            isOneToOne: false;
            referencedRelation: 'repositories';
            referencedColumns: ['id'];
          },
        ];
      };
      data_consistency_checks: {
        Row: {
          check_type: string;
          checked_at: string;
          details: Json | null;
          fixed_at: string | null;
          id: string;
          repository_id: string | null;
          status: string;
        };
        Insert: {
          check_type: string;
          checked_at?: string;
          details?: Json | null;
          fixed_at?: string | null;
          id?: string;
          repository_id?: string | null;
          status: string;
        };
        Update: {
          check_type?: string;
          checked_at?: string;
          details?: Json | null;
          fixed_at?: string | null;
          id?: string;
          repository_id?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'data_consistency_checks_repository_id_fkey';
            columns: ['repository_id'];
            isOneToOne: false;
            referencedRelation: 'repositories';
            referencedColumns: ['id'];
          },
        ];
      };
      data_purge_log: {
        Row: {
          created_at: string | null;
          file_contributors_purged: number | null;
          file_embeddings_purged: number | null;
          id: string;
          pr_insights_purged: number | null;
          purge_date: string | null;
        };
        Insert: {
          created_at?: string | null;
          file_contributors_purged?: number | null;
          file_embeddings_purged?: number | null;
          id?: string;
          pr_insights_purged?: number | null;
          purge_date?: string | null;
        };
        Update: {
          created_at?: string | null;
          file_contributors_purged?: number | null;
          file_embeddings_purged?: number | null;
          id?: string;
          pr_insights_purged?: number | null;
          purge_date?: string | null;
        };
        Relationships: [];
      };
      dead_letter_queue: {
        Row: {
          error_history: Json[] | null;
          failure_count: number | null;
          first_failed_at: string | null;
          id: string;
          last_failed_at: string | null;
          moved_to_dlq_at: string | null;
          original_job_id: string | null;
          payload: Json | null;
          resolution_notes: string | null;
          resolution_status: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          type: string;
        };
        Insert: {
          error_history?: Json[] | null;
          failure_count?: number | null;
          first_failed_at?: string | null;
          id?: string;
          last_failed_at?: string | null;
          moved_to_dlq_at?: string | null;
          original_job_id?: string | null;
          payload?: Json | null;
          resolution_notes?: string | null;
          resolution_status?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          type: string;
        };
        Update: {
          error_history?: Json[] | null;
          failure_count?: number | null;
          first_failed_at?: string | null;
          id?: string;
          last_failed_at?: string | null;
          moved_to_dlq_at?: string | null;
          original_job_id?: string | null;
          payload?: Json | null;
          resolution_notes?: string | null;
          resolution_status?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'dead_letter_queue_original_job_id_fkey';
            columns: ['original_job_id'];
            isOneToOne: true;
            referencedRelation: 'background_jobs';
            referencedColumns: ['id'];
          },
        ];
      };
      discussion_comments: {
        Row: {
          author_id: number | null;
          author_login: string | null;
          body: string | null;
          created_at: string;
          discussion_id: string;
          discussion_number: number;
          github_id: number;
          id: string;
          is_answer: boolean | null;
          parent_comment_id: string | null;
          reply_count: number | null;
          synced_at: string | null;
          updated_at: string;
          upvote_count: number | null;
        };
        Insert: {
          author_id?: number | null;
          author_login?: string | null;
          body?: string | null;
          created_at: string;
          discussion_id: string;
          discussion_number: number;
          github_id: number;
          id: string;
          is_answer?: boolean | null;
          parent_comment_id?: string | null;
          reply_count?: number | null;
          synced_at?: string | null;
          updated_at: string;
          upvote_count?: number | null;
        };
        Update: {
          author_id?: number | null;
          author_login?: string | null;
          body?: string | null;
          created_at?: string;
          discussion_id?: string;
          discussion_number?: number;
          github_id?: number;
          id?: string;
          is_answer?: boolean | null;
          parent_comment_id?: string | null;
          reply_count?: number | null;
          synced_at?: string | null;
          updated_at?: string;
          upvote_count?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_discussion';
            columns: ['discussion_id'];
            isOneToOne: false;
            referencedRelation: 'discussions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_parent_comment';
            columns: ['parent_comment_id'];
            isOneToOne: false;
            referencedRelation: 'discussion_comments';
            referencedColumns: ['id'];
          },
        ];
      };
      discussions: {
        Row: {
          answer_chosen_at: string | null;
          answer_chosen_by: string | null;
          answer_id: string | null;
          author_id: number | null;
          author_login: string | null;
          body: string | null;
          category_description: string | null;
          category_emoji: string | null;
          category_id: string | null;
          category_name: string | null;
          comment_count: number | null;
          content_hash: string | null;
          created_at: string;
          embedding: string | null;
          embedding_generated_at: string | null;
          github_id: number;
          id: string;
          is_answered: boolean | null;
          locked: boolean | null;
          number: number;
          repository_id: string | null;
          responded_at: string | null;
          responded_by: string | null;
          summary: string | null;
          synced_at: string | null;
          title: string;
          updated_at: string;
          upvote_count: number | null;
          url: string;
        };
        Insert: {
          answer_chosen_at?: string | null;
          answer_chosen_by?: string | null;
          answer_id?: string | null;
          author_id?: number | null;
          author_login?: string | null;
          body?: string | null;
          category_description?: string | null;
          category_emoji?: string | null;
          category_id?: string | null;
          category_name?: string | null;
          comment_count?: number | null;
          content_hash?: string | null;
          created_at: string;
          embedding?: string | null;
          embedding_generated_at?: string | null;
          github_id: number;
          id: string;
          is_answered?: boolean | null;
          locked?: boolean | null;
          number: number;
          repository_id?: string | null;
          responded_at?: string | null;
          responded_by?: string | null;
          summary?: string | null;
          synced_at?: string | null;
          title: string;
          updated_at: string;
          upvote_count?: number | null;
          url: string;
        };
        Update: {
          answer_chosen_at?: string | null;
          answer_chosen_by?: string | null;
          answer_id?: string | null;
          author_id?: number | null;
          author_login?: string | null;
          body?: string | null;
          category_description?: string | null;
          category_emoji?: string | null;
          category_id?: string | null;
          category_name?: string | null;
          comment_count?: number | null;
          content_hash?: string | null;
          created_at?: string;
          embedding?: string | null;
          embedding_generated_at?: string | null;
          github_id?: number;
          id?: string;
          is_answered?: boolean | null;
          locked?: boolean | null;
          number?: number;
          repository_id?: string | null;
          responded_at?: string | null;
          responded_by?: string | null;
          summary?: string | null;
          synced_at?: string | null;
          title?: string;
          updated_at?: string;
          upvote_count?: number | null;
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'discussions_repository_id_fkey';
            columns: ['repository_id'];
            isOneToOne: false;
            referencedRelation: 'repositories';
            referencedColumns: ['id'];
          },
        ];
      };
      embedding_jobs: {
        Row: {
          completed_at: string | null;
          created_at: string | null;
          error_message: string | null;
          id: string;
          items_processed: number | null;
          items_total: number;
          repository_id: string | null;
          started_at: string | null;
          status: string;
          updated_at: string | null;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string | null;
          error_message?: string | null;
          id?: string;
          items_processed?: number | null;
          items_total: number;
          repository_id?: string | null;
          started_at?: string | null;
          status: string;
          updated_at?: string | null;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string | null;
          error_message?: string | null;
          id?: string;
          items_processed?: number | null;
          items_total?: number;
          repository_id?: string | null;
          started_at?: string | null;
          status?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'embedding_jobs_repository_id_fkey';
            columns: ['repository_id'];
            isOneToOne: false;
            referencedRelation: 'repositories';
            referencedColumns: ['id'];
          },
        ];
      };
      feature_usage: {
        Row: {
          current_value: number;
          id: string;
          last_updated: string | null;
          metric_type: string;
          user_id: string | null;
          workspace_id: string | null;
        };
        Insert: {
          current_value?: number;
          id?: string;
          last_updated?: string | null;
          metric_type: string;
          user_id?: string | null;
          workspace_id?: string | null;
        };
        Update: {
          current_value?: number;
          id?: string;
          last_updated?: string | null;
          metric_type?: string;
          user_id?: string | null;
          workspace_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'feature_usage_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'contributor_stats';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'feature_usage_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'contributors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'feature_usage_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspace_preview_stats';
            referencedColumns: ['workspace_id'];
          },
          {
            foreignKeyName: 'feature_usage_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      file_contributors: {
        Row: {
          additions: number | null;
          commit_count: number | null;
          contributor_id: string;
          created_at: string | null;
          deletions: number | null;
          file_path: string;
          first_commit_at: string | null;
          id: string;
          last_commit_at: string | null;
          purge_after: string | null;
          repository_id: string;
          updated_at: string | null;
        };
        Insert: {
          additions?: number | null;
          commit_count?: number | null;
          contributor_id: string;
          created_at?: string | null;
          deletions?: number | null;
          file_path: string;
          first_commit_at?: string | null;
          id?: string;
          last_commit_at?: string | null;
          purge_after?: string | null;
          repository_id: string;
          updated_at?: string | null;
        };
        Update: {
          additions?: number | null;
          commit_count?: number | null;
          contributor_id?: string;
          created_at?: string | null;
          deletions?: number | null;
          file_path?: string;
          first_commit_at?: string | null;
          id?: string;
          last_commit_at?: string | null;
          purge_after?: string | null;
          repository_id?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'file_contributors_contributor_id_fkey';
            columns: ['contributor_id'];
            isOneToOne: false;
            referencedRelation: 'contributor_stats';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'file_contributors_contributor_id_fkey';
            columns: ['contributor_id'];
            isOneToOne: false;
            referencedRelation: 'contributors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'file_contributors_repository_id_fkey';
            columns: ['repository_id'];
            isOneToOne: false;
            referencedRelation: 'repositories';
            referencedColumns: ['id'];
          },
        ];
      };
      file_embeddings: {
        Row: {
          content_hash: string | null;
          created_at: string | null;
          embedding: string | null;
          file_path: string;
          file_size: number | null;
          id: string;
          language: string | null;
          last_indexed_at: string | null;
          purge_after: string | null;
          repository_id: string;
          updated_at: string | null;
        };
        Insert: {
          content_hash?: string | null;
          created_at?: string | null;
          embedding?: string | null;
          file_path: string;
          file_size?: number | null;
          id?: string;
          language?: string | null;
          last_indexed_at?: string | null;
          purge_after?: string | null;
          repository_id: string;
          updated_at?: string | null;
        };
        Update: {
          content_hash?: string | null;
          created_at?: string | null;
          embedding?: string | null;
          file_path?: string;
          file_size?: number | null;
          id?: string;
          language?: string | null;
          last_indexed_at?: string | null;
          purge_after?: string | null;
          repository_id?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'file_embeddings_repository_id_fkey';
            columns: ['repository_id'];
            isOneToOne: false;
            referencedRelation: 'repositories';
            referencedColumns: ['id'];
          },
        ];
      };
      github_activities: {
        Row: {
          activity_data: Json;
          created_at: string | null;
          id: string;
          repo: string;
          updated_at: string | null;
        };
        Insert: {
          activity_data: Json;
          created_at?: string | null;
          id?: string;
          repo: string;
          updated_at?: string | null;
        };
        Update: {
          activity_data?: Json;
          created_at?: string | null;
          id?: string;
          repo?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      github_app_installation_settings: {
        Row: {
          comment_on_prs: boolean | null;
          comment_style: string | null;
          excluded_repos: string[] | null;
          excluded_users: string[] | null;
          id: string;
          include_issue_context: boolean | null;
          installation_id: number;
          max_issues_shown: number | null;
          max_reviewers_suggested: number | null;
          notification_email: string | null;
          updated_at: string | null;
        };
        Insert: {
          comment_on_prs?: boolean | null;
          comment_style?: string | null;
          excluded_repos?: string[] | null;
          excluded_users?: string[] | null;
          id?: string;
          include_issue_context?: boolean | null;
          installation_id: number;
          max_issues_shown?: number | null;
          max_reviewers_suggested?: number | null;
          notification_email?: string | null;
          updated_at?: string | null;
        };
        Update: {
          comment_on_prs?: boolean | null;
          comment_style?: string | null;
          excluded_repos?: string[] | null;
          excluded_users?: string[] | null;
          id?: string;
          include_issue_context?: boolean | null;
          installation_id?: number;
          max_issues_shown?: number | null;
          max_reviewers_suggested?: number | null;
          notification_email?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      github_app_installations: {
        Row: {
          account_id: number;
          account_name: string;
          account_type: string | null;
          deleted_at: string | null;
          id: string;
          installation_id: number;
          installed_at: string | null;
          repository_selection: string | null;
          settings: Json | null;
          suspended_at: string | null;
        };
        Insert: {
          account_id: number;
          account_name: string;
          account_type?: string | null;
          deleted_at?: string | null;
          id?: string;
          installation_id: number;
          installed_at?: string | null;
          repository_selection?: string | null;
          settings?: Json | null;
          suspended_at?: string | null;
        };
        Update: {
          account_id?: number;
          account_name?: string;
          account_type?: string | null;
          deleted_at?: string | null;
          id?: string;
          installation_id?: number;
          installed_at?: string | null;
          repository_selection?: string | null;
          settings?: Json | null;
          suspended_at?: string | null;
        };
        Relationships: [];
      };
      github_events_cache: {
        Row: {
          actor_login: string;
          created_at: string;
          event_id: string;
          event_type: string;
          id: string;
          is_privileged: boolean | null;
          payload: Json;
          processed: boolean | null;
          processed_at: string | null;
          processing_notes: string | null;
          repository_name: string;
          repository_owner: string;
        };
        Insert: {
          actor_login: string;
          created_at: string;
          event_id: string;
          event_type: string;
          id?: string;
          is_privileged?: boolean | null;
          payload: Json;
          processed?: boolean | null;
          processed_at?: string | null;
          processing_notes?: string | null;
          repository_name: string;
          repository_owner: string;
        };
        Update: {
          actor_login?: string;
          created_at?: string;
          event_id?: string;
          event_type?: string;
          id?: string;
          is_privileged?: boolean | null;
          payload?: Json;
          processed?: boolean | null;
          processed_at?: string | null;
          processing_notes?: string | null;
          repository_name?: string;
          repository_owner?: string;
        };
        Relationships: [];
      };
      github_events_cache_2025_01: {
        Row: {
          actor_login: string;
          created_at: string;
          event_id: string;
          event_type: string;
          id: string;
          is_privileged: boolean | null;
          payload: Json;
          processed: boolean | null;
          processed_at: string | null;
          processing_notes: string | null;
          repository_name: string;
          repository_owner: string;
        };
        Insert: {
          actor_login: string;
          created_at: string;
          event_id: string;
          event_type: string;
          id?: string;
          is_privileged?: boolean | null;
          payload: Json;
          processed?: boolean | null;
          processed_at?: string | null;
          processing_notes?: string | null;
          repository_name: string;
          repository_owner: string;
        };
        Update: {
          actor_login?: string;
          created_at?: string;
          event_id?: string;
          event_type?: string;
          id?: string;
          is_privileged?: boolean | null;
          payload?: Json;
          processed?: boolean | null;
          processed_at?: string | null;
          processing_notes?: string | null;
          repository_name?: string;
          repository_owner?: string;
        };
        Relationships: [];
      };
      github_events_cache_2025_02: {
        Row: {
          actor_login: string;
          created_at: string;
          event_id: string;
          event_type: string;
          id: string;
          is_privileged: boolean | null;
          payload: Json;
          processed: boolean | null;
          processed_at: string | null;
          processing_notes: string | null;
          repository_name: string;
          repository_owner: string;
        };
        Insert: {
          actor_login: string;
          created_at: string;
          event_id: string;
          event_type: string;
          id?: string;
          is_privileged?: boolean | null;
          payload: Json;
          processed?: boolean | null;
          processed_at?: string | null;
          processing_notes?: string | null;
          repository_name: string;
          repository_owner: string;
        };
        Update: {
          actor_login?: string;
          created_at?: string;
          event_id?: string;
          event_type?: string;
          id?: string;
          is_privileged?: boolean | null;
          payload?: Json;
          processed?: boolean | null;
          processed_at?: string | null;
          processing_notes?: string | null;
          repository_name?: string;
          repository_owner?: string;
        };
        Relationships: [];
      };
      github_events_cache_2025_03: {
        Row: {
          actor_login: string;
          created_at: string;
          event_id: string;
          event_type: string;
          id: string;
          is_privileged: boolean | null;
          payload: Json;
          processed: boolean | null;
          processed_at: string | null;
          processing_notes: string | null;
          repository_name: string;
          repository_owner: string;
        };
        Insert: {
          actor_login: string;
          created_at: string;
          event_id: string;
          event_type: string;
          id?: string;
          is_privileged?: boolean | null;
          payload: Json;
          processed?: boolean | null;
          processed_at?: string | null;
          processing_notes?: string | null;
          repository_name: string;
          repository_owner: string;
        };
        Update: {
          actor_login?: string;
          created_at?: string;
          event_id?: string;
          event_type?: string;
          id?: string;
          is_privileged?: boolean | null;
          payload?: Json;
          processed?: boolean | null;
          processed_at?: string | null;
          processing_notes?: string | null;
          repository_name?: string;
          repository_owner?: string;
        };
        Relationships: [];
      };
      github_events_cache_2025_06: {
        Row: {
          actor_login: string;
          created_at: string;
          event_id: string;
          event_type: string;
          id: string;
          is_privileged: boolean | null;
          payload: Json;
          processed: boolean | null;
          processed_at: string | null;
          processing_notes: string | null;
          repository_name: string;
          repository_owner: string;
        };
        Insert: {
          actor_login: string;
          created_at: string;
          event_id: string;
          event_type: string;
          id?: string;
          is_privileged?: boolean | null;
          payload: Json;
          processed?: boolean | null;
          processed_at?: string | null;
          processing_notes?: string | null;
          repository_name: string;
          repository_owner: string;
        };
        Update: {
          actor_login?: string;
          created_at?: string;
          event_id?: string;
          event_type?: string;
          id?: string;
          is_privileged?: boolean | null;
          payload?: Json;
          processed?: boolean | null;
          processed_at?: string | null;
          processing_notes?: string | null;
          repository_name?: string;
          repository_owner?: string;
        };
        Relationships: [];
      };
      github_events_cache_2025_09: {
        Row: {
          actor_login: string;
          created_at: string;
          event_id: string;
          event_type: string;
          id: string;
          is_privileged: boolean | null;
          payload: Json;
          processed: boolean | null;
          processed_at: string | null;
          processing_notes: string | null;
          repository_name: string;
          repository_owner: string;
        };
        Insert: {
          actor_login: string;
          created_at: string;
          event_id: string;
          event_type: string;
          id?: string;
          is_privileged?: boolean | null;
          payload: Json;
          processed?: boolean | null;
          processed_at?: string | null;
          processing_notes?: string | null;
          repository_name: string;
          repository_owner: string;
        };
        Update: {
          actor_login?: string;
          created_at?: string;
          event_id?: string;
          event_type?: string;
          id?: string;
          is_privileged?: boolean | null;
          payload?: Json;
          processed?: boolean | null;
          processed_at?: string | null;
          processing_notes?: string | null;
          repository_name?: string;
          repository_owner?: string;
        };
        Relationships: [];
      };
      github_issue_comments: {
        Row: {
          _dlt_id: string;
          _dlt_load_id: string;
          author_association: string | null;
          author_avatar_url: string | null;
          author_github_id: number | null;
          author_username: string | null;
          body: string | null;
          comment_type: string | null;
          created_at: string | null;
          github_id: number;
          html_url: string | null;
          is_edited: boolean | null;
          issue_github_id: number | null;
          repository_full_name: string | null;
          repository_github_id: number | null;
          updated_at: string | null;
        };
        Insert: {
          _dlt_id: string;
          _dlt_load_id: string;
          author_association?: string | null;
          author_avatar_url?: string | null;
          author_github_id?: number | null;
          author_username?: string | null;
          body?: string | null;
          comment_type?: string | null;
          created_at?: string | null;
          github_id: number;
          html_url?: string | null;
          is_edited?: boolean | null;
          issue_github_id?: number | null;
          repository_full_name?: string | null;
          repository_github_id?: number | null;
          updated_at?: string | null;
        };
        Update: {
          _dlt_id?: string;
          _dlt_load_id?: string;
          author_association?: string | null;
          author_avatar_url?: string | null;
          author_github_id?: number | null;
          author_username?: string | null;
          body?: string | null;
          comment_type?: string | null;
          created_at?: string | null;
          github_id?: number;
          html_url?: string | null;
          is_edited?: boolean | null;
          issue_github_id?: number | null;
          repository_full_name?: string | null;
          repository_github_id?: number | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      github_issues: {
        Row: {
          _dlt_id: string | null;
          _dlt_load_id: string | null;
          assignees: Json | null;
          author_id: string | null;
          body: string | null;
          closed_at: string | null;
          closed_by_id: string | null;
          comments_count: number | null;
          created_at: string;
          github_id: number;
          html_url: string | null;
          id: string;
          is_pull_request: boolean | null;
          labels: Json | null;
          linked_pr_id: string | null;
          milestone: Json | null;
          number: number;
          repository_id: string;
          responded_at: string | null;
          responded_by: string | null;
          state: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          _dlt_id?: string | null;
          _dlt_load_id?: string | null;
          assignees?: Json | null;
          author_id?: string | null;
          body?: string | null;
          closed_at?: string | null;
          closed_by_id?: string | null;
          comments_count?: number | null;
          created_at: string;
          github_id: number;
          html_url?: string | null;
          id?: string;
          is_pull_request?: boolean | null;
          labels?: Json | null;
          linked_pr_id?: string | null;
          milestone?: Json | null;
          number: number;
          repository_id: string;
          responded_at?: string | null;
          responded_by?: string | null;
          state: string;
          title: string;
          updated_at: string;
        };
        Update: {
          _dlt_id?: string | null;
          _dlt_load_id?: string | null;
          assignees?: Json | null;
          author_id?: string | null;
          body?: string | null;
          closed_at?: string | null;
          closed_by_id?: string | null;
          comments_count?: number | null;
          created_at?: string;
          github_id?: number;
          html_url?: string | null;
          id?: string;
          is_pull_request?: boolean | null;
          labels?: Json | null;
          linked_pr_id?: string | null;
          milestone?: Json | null;
          number?: number;
          repository_id?: string;
          responded_at?: string | null;
          responded_by?: string | null;
          state?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'github_issues_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'contributor_stats';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'github_issues_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'contributors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'github_issues_closed_by_id_fkey';
            columns: ['closed_by_id'];
            isOneToOne: false;
            referencedRelation: 'contributor_stats';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'github_issues_closed_by_id_fkey';
            columns: ['closed_by_id'];
            isOneToOne: false;
            referencedRelation: 'contributors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'github_issues_linked_pr_id_fkey';
            columns: ['linked_pr_id'];
            isOneToOne: false;
            referencedRelation: 'pull_requests';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'github_issues_repository_id_fkey';
            columns: ['repository_id'];
            isOneToOne: false;
            referencedRelation: 'repositories';
            referencedColumns: ['id'];
          },
        ];
      };
      github_pr_review_comments: {
        Row: {
          _dlt_id: string;
          _dlt_load_id: string;
          author_association: string | null;
          author_avatar_url: string | null;
          author_github_id: number | null;
          author_username: string | null;
          body: string | null;
          comment_type: string | null;
          commit_id: string | null;
          created_at: string | null;
          file_path: string | null;
          github_id: number;
          html_url: string | null;
          is_edited: boolean | null;
          line_number: number | null;
          position: number | null;
          pr_github_id: number | null;
          pr_number: number | null;
          repository_full_name: string | null;
          repository_github_id: number | null;
          review_github_id: number | null;
          side: string | null;
          updated_at: string | null;
        };
        Insert: {
          _dlt_id: string;
          _dlt_load_id: string;
          author_association?: string | null;
          author_avatar_url?: string | null;
          author_github_id?: number | null;
          author_username?: string | null;
          body?: string | null;
          comment_type?: string | null;
          commit_id?: string | null;
          created_at?: string | null;
          file_path?: string | null;
          github_id: number;
          html_url?: string | null;
          is_edited?: boolean | null;
          line_number?: number | null;
          position?: number | null;
          pr_github_id?: number | null;
          pr_number?: number | null;
          repository_full_name?: string | null;
          repository_github_id?: number | null;
          review_github_id?: number | null;
          side?: string | null;
          updated_at?: string | null;
        };
        Update: {
          _dlt_id?: string;
          _dlt_load_id?: string;
          author_association?: string | null;
          author_avatar_url?: string | null;
          author_github_id?: number | null;
          author_username?: string | null;
          body?: string | null;
          comment_type?: string | null;
          commit_id?: string | null;
          created_at?: string | null;
          file_path?: string | null;
          github_id?: number;
          html_url?: string | null;
          is_edited?: boolean | null;
          line_number?: number | null;
          position?: number | null;
          pr_github_id?: number | null;
          pr_number?: number | null;
          repository_full_name?: string | null;
          repository_github_id?: number | null;
          review_github_id?: number | null;
          side?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      github_sync_status: {
        Row: {
          created_at: string;
          error_message: string | null;
          events_processed: number | null;
          id: string;
          last_event_at: string | null;
          last_sync_at: string | null;
          repository_name: string;
          repository_owner: string;
          sync_status: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          error_message?: string | null;
          events_processed?: number | null;
          id?: string;
          last_event_at?: string | null;
          last_sync_at?: string | null;
          repository_name: string;
          repository_owner: string;
          sync_status?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          error_message?: string | null;
          events_processed?: number | null;
          id?: string;
          last_event_at?: string | null;
          last_sync_at?: string | null;
          repository_name?: string;
          repository_owner?: string;
          sync_status?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      idempotency_keys: {
        Row: {
          created_at: string;
          endpoint: string;
          expires_at: string;
          id: string | null;
          key: string;
          metadata: Json | null;
          request_hash: string;
          response: Json | null;
          status: string;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          endpoint: string;
          expires_at?: string;
          id?: string | null;
          key: string;
          metadata?: Json | null;
          request_hash: string;
          response?: Json | null;
          status: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          endpoint?: string;
          expires_at?: string;
          id?: string | null;
          key?: string;
          metadata?: Json | null;
          request_hash?: string;
          response?: Json | null;
          status?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      issue_similarities: {
        Row: {
          calculated_at: string | null;
          id: string;
          similarity_reasons: Json;
          similarity_score: number | null;
          source_id: string;
          source_type: string | null;
          target_issue_id: string | null;
        };
        Insert: {
          calculated_at?: string | null;
          id?: string;
          similarity_reasons: Json;
          similarity_score?: number | null;
          source_id: string;
          source_type?: string | null;
          target_issue_id?: string | null;
        };
        Update: {
          calculated_at?: string | null;
          id?: string;
          similarity_reasons?: Json;
          similarity_score?: number | null;
          source_id?: string;
          source_type?: string | null;
          target_issue_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'issue_similarities_target_issue_id_fkey';
            columns: ['target_issue_id'];
            isOneToOne: false;
            referencedRelation: 'issues';
            referencedColumns: ['id'];
          },
        ];
      };
      issues: {
        Row: {
          assignees: Json | null;
          author_id: string | null;
          body: string | null;
          closed_at: string | null;
          closed_by_id: string | null;
          comments_count: number | null;
          content_hash: string | null;
          created_at: string;
          embedding: string | null;
          embedding_generated_at: string | null;
          github_id: number;
          id: string;
          is_pull_request: boolean | null;
          labels: Json | null;
          last_synced_at: string | null;
          linked_pr_id: string | null;
          linked_prs: Json | null;
          milestone: Json | null;
          number: number;
          repository_id: string;
          responded_at: string | null;
          responded_by: string | null;
          state: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          assignees?: Json | null;
          author_id?: string | null;
          body?: string | null;
          closed_at?: string | null;
          closed_by_id?: string | null;
          comments_count?: number | null;
          content_hash?: string | null;
          created_at: string;
          embedding?: string | null;
          embedding_generated_at?: string | null;
          github_id: number;
          id?: string;
          is_pull_request?: boolean | null;
          labels?: Json | null;
          last_synced_at?: string | null;
          linked_pr_id?: string | null;
          linked_prs?: Json | null;
          milestone?: Json | null;
          number: number;
          repository_id: string;
          responded_at?: string | null;
          responded_by?: string | null;
          state?: string | null;
          title: string;
          updated_at: string;
        };
        Update: {
          assignees?: Json | null;
          author_id?: string | null;
          body?: string | null;
          closed_at?: string | null;
          closed_by_id?: string | null;
          comments_count?: number | null;
          content_hash?: string | null;
          created_at?: string;
          embedding?: string | null;
          embedding_generated_at?: string | null;
          github_id?: number;
          id?: string;
          is_pull_request?: boolean | null;
          labels?: Json | null;
          last_synced_at?: string | null;
          linked_pr_id?: string | null;
          linked_prs?: Json | null;
          milestone?: Json | null;
          number?: number;
          repository_id?: string;
          responded_at?: string | null;
          responded_by?: string | null;
          state?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'issues_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'contributor_stats';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'issues_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'contributors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'issues_closed_by_id_fkey';
            columns: ['closed_by_id'];
            isOneToOne: false;
            referencedRelation: 'contributor_stats';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'issues_closed_by_id_fkey';
            columns: ['closed_by_id'];
            isOneToOne: false;
            referencedRelation: 'contributors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'issues_linked_pr_id_fkey';
            columns: ['linked_pr_id'];
            isOneToOne: false;
            referencedRelation: 'pull_requests';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'issues_repository_id_fkey';
            columns: ['repository_id'];
            isOneToOne: false;
            referencedRelation: 'repositories';
            referencedColumns: ['id'];
          },
        ];
      };
      issues_backup: {
        Row: {
          assignees: Json | null;
          author_id: string | null;
          body: string | null;
          closed_at: string | null;
          closed_by_id: string | null;
          comments_count: number | null;
          content_hash: string | null;
          created_at: string | null;
          embedding: string | null;
          embedding_generated_at: string | null;
          github_id: number | null;
          id: string | null;
          is_pull_request: boolean | null;
          labels: Json | null;
          linked_pr_id: string | null;
          milestone: Json | null;
          number: number | null;
          repository_id: string | null;
          state: string | null;
          title: string | null;
          updated_at: string | null;
        };
        Insert: {
          assignees?: Json | null;
          author_id?: string | null;
          body?: string | null;
          closed_at?: string | null;
          closed_by_id?: string | null;
          comments_count?: number | null;
          content_hash?: string | null;
          created_at?: string | null;
          embedding?: string | null;
          embedding_generated_at?: string | null;
          github_id?: number | null;
          id?: string | null;
          is_pull_request?: boolean | null;
          labels?: Json | null;
          linked_pr_id?: string | null;
          milestone?: Json | null;
          number?: number | null;
          repository_id?: string | null;
          state?: string | null;
          title?: string | null;
          updated_at?: string | null;
        };
        Update: {
          assignees?: Json | null;
          author_id?: string | null;
          body?: string | null;
          closed_at?: string | null;
          closed_by_id?: string | null;
          comments_count?: number | null;
          content_hash?: string | null;
          created_at?: string | null;
          embedding?: string | null;
          embedding_generated_at?: string | null;
          github_id?: number | null;
          id?: string | null;
          is_pull_request?: boolean | null;
          labels?: Json | null;
          linked_pr_id?: string | null;
          milestone?: Json | null;
          number?: number | null;
          repository_id?: string | null;
          state?: string | null;
          title?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      issues_replica: {
        Row: {
          assignees: Json | null;
          author_id: string | null;
          body: string | null;
          closed_at: string | null;
          closed_by_id: string | null;
          comments_count: number | null;
          content_hash: string | null;
          created_at: string | null;
          embedding: string | null;
          embedding_generated_at: string | null;
          github_id: number | null;
          id: string;
          is_pull_request: boolean | null;
          labels: Json | null;
          linked_pr_id: string | null;
          milestone: Json | null;
          number: number | null;
          repository_id: string | null;
          state: string | null;
          title: string | null;
          updated_at: string | null;
        };
        Insert: {
          assignees?: Json | null;
          author_id?: string | null;
          body?: string | null;
          closed_at?: string | null;
          closed_by_id?: string | null;
          comments_count?: number | null;
          content_hash?: string | null;
          created_at?: string | null;
          embedding?: string | null;
          embedding_generated_at?: string | null;
          github_id?: number | null;
          id: string;
          is_pull_request?: boolean | null;
          labels?: Json | null;
          linked_pr_id?: string | null;
          milestone?: Json | null;
          number?: number | null;
          repository_id?: string | null;
          state?: string | null;
          title?: string | null;
          updated_at?: string | null;
        };
        Update: {
          assignees?: Json | null;
          author_id?: string | null;
          body?: string | null;
          closed_at?: string | null;
          closed_by_id?: string | null;
          comments_count?: number | null;
          content_hash?: string | null;
          created_at?: string | null;
          embedding?: string | null;
          embedding_generated_at?: string | null;
          github_id?: number | null;
          id?: string;
          is_pull_request?: boolean | null;
          labels?: Json | null;
          linked_pr_id?: string | null;
          milestone?: Json | null;
          number?: number | null;
          repository_id?: string | null;
          state?: string | null;
          title?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      monthly_rankings: {
        Row: {
          calculated_at: string;
          comments_count: number;
          contributor_id: string | null;
          first_contribution_at: string | null;
          id: string;
          is_winner: boolean | null;
          last_contribution_at: string | null;
          lines_added: number;
          lines_removed: number;
          month: number;
          pull_requests_count: number;
          rank: number;
          repositories_contributed: number;
          repository_id: string | null;
          reviews_count: number;
          weighted_score: number;
          year: number;
        };
        Insert: {
          calculated_at?: string;
          comments_count?: number;
          contributor_id?: string | null;
          first_contribution_at?: string | null;
          id?: string;
          is_winner?: boolean | null;
          last_contribution_at?: string | null;
          lines_added?: number;
          lines_removed?: number;
          month: number;
          pull_requests_count?: number;
          rank: number;
          repositories_contributed?: number;
          repository_id?: string | null;
          reviews_count?: number;
          weighted_score?: number;
          year: number;
        };
        Update: {
          calculated_at?: string;
          comments_count?: number;
          contributor_id?: string | null;
          first_contribution_at?: string | null;
          id?: string;
          is_winner?: boolean | null;
          last_contribution_at?: string | null;
          lines_added?: number;
          lines_removed?: number;
          month?: number;
          pull_requests_count?: number;
          rank?: number;
          repositories_contributed?: number;
          repository_id?: string | null;
          reviews_count?: number;
          weighted_score?: number;
          year?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_monthly_rankings_contributor';
            columns: ['contributor_id'];
            isOneToOne: false;
            referencedRelation: 'contributor_stats';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_monthly_rankings_contributor';
            columns: ['contributor_id'];
            isOneToOne: false;
            referencedRelation: 'contributors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_monthly_rankings_repository';
            columns: ['repository_id'];
            isOneToOne: false;
            referencedRelation: 'repositories';
            referencedColumns: ['id'];
          },
        ];
      };
      notifications: {
        Row: {
          created_at: string | null;
          id: string;
          message: string | null;
          metadata: Json | null;
          operation_id: string;
          operation_type: string;
          read: boolean | null;
          repository: string | null;
          status: string;
          title: string;
          updated_at: string | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          message?: string | null;
          metadata?: Json | null;
          operation_id: string;
          operation_type: string;
          read?: boolean | null;
          repository?: string | null;
          status: string;
          title: string;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          message?: string | null;
          metadata?: Json | null;
          operation_id?: string;
          operation_type?: string;
          read?: boolean | null;
          repository?: string | null;
          status?: string;
          title?: string;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      organizations: {
        Row: {
          avatar_url: string | null;
          blog: string | null;
          company: string | null;
          description: string | null;
          email: string | null;
          first_seen_at: string;
          followers: number | null;
          following: number | null;
          github_created_at: string | null;
          github_id: number;
          id: string;
          is_active: boolean | null;
          last_updated_at: string;
          location: string | null;
          login: string;
          public_gists: number | null;
          public_repos: number | null;
        };
        Insert: {
          avatar_url?: string | null;
          blog?: string | null;
          company?: string | null;
          description?: string | null;
          email?: string | null;
          first_seen_at?: string;
          followers?: number | null;
          following?: number | null;
          github_created_at?: string | null;
          github_id: number;
          id?: string;
          is_active?: boolean | null;
          last_updated_at?: string;
          location?: string | null;
          login: string;
          public_gists?: number | null;
          public_repos?: number | null;
        };
        Update: {
          avatar_url?: string | null;
          blog?: string | null;
          company?: string | null;
          description?: string | null;
          email?: string | null;
          first_seen_at?: string;
          followers?: number | null;
          following?: number | null;
          github_created_at?: string | null;
          github_id?: number;
          id?: string;
          is_active?: boolean | null;
          last_updated_at?: string;
          location?: string | null;
          login?: string;
          public_gists?: number | null;
          public_repos?: number | null;
        };
        Relationships: [];
      };
      performance_alerts: {
        Row: {
          actual_value: number;
          created_at: string;
          id: string;
          metric_name: string;
          page_url: string;
          resolved_at: string | null;
          severity: string;
          threshold: number;
          timestamp: string;
        };
        Insert: {
          actual_value: number;
          created_at?: string;
          id?: string;
          metric_name: string;
          page_url: string;
          resolved_at?: string | null;
          severity: string;
          threshold: number;
          timestamp: string;
        };
        Update: {
          actual_value?: number;
          created_at?: string;
          id?: string;
          metric_name?: string;
          page_url?: string;
          resolved_at?: string | null;
          severity?: string;
          threshold?: number;
          timestamp?: string;
        };
        Relationships: [];
      };
      pr_insights: {
        Row: {
          comment_id: number | null;
          comment_posted: boolean | null;
          contributor_stats: Json;
          generated_at: string | null;
          github_pr_id: number | null;
          id: string;
          pull_request_id: string | null;
          similar_issues: Json | null;
          suggested_reviewers: Json;
        };
        Insert: {
          comment_id?: number | null;
          comment_posted?: boolean | null;
          contributor_stats: Json;
          generated_at?: string | null;
          github_pr_id?: number | null;
          id?: string;
          pull_request_id?: string | null;
          similar_issues?: Json | null;
          suggested_reviewers: Json;
        };
        Update: {
          comment_id?: number | null;
          comment_posted?: boolean | null;
          contributor_stats?: Json;
          generated_at?: string | null;
          github_pr_id?: number | null;
          id?: string;
          pull_request_id?: string | null;
          similar_issues?: Json | null;
          suggested_reviewers?: Json;
        };
        Relationships: [
          {
            foreignKeyName: 'pr_insights_pull_request_id_fkey';
            columns: ['pull_request_id'];
            isOneToOne: true;
            referencedRelation: 'pull_requests';
            referencedColumns: ['id'];
          },
        ];
      };
      priority_queue: {
        Row: {
          attempts: number;
          capture_window_hours: number;
          completed_at: string | null;
          created_at: string;
          error_message: string | null;
          id: string;
          last_attempt_at: string | null;
          last_captured_at: string | null;
          metadata: Json | null;
          priority: number;
          repository_id: string;
          status: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          attempts?: number;
          capture_window_hours?: number;
          completed_at?: string | null;
          created_at?: string;
          error_message?: string | null;
          id?: string;
          last_attempt_at?: string | null;
          last_captured_at?: string | null;
          metadata?: Json | null;
          priority?: number;
          repository_id: string;
          status?: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          attempts?: number;
          capture_window_hours?: number;
          completed_at?: string | null;
          created_at?: string;
          error_message?: string | null;
          id?: string;
          last_attempt_at?: string | null;
          last_captured_at?: string | null;
          metadata?: Json | null;
          priority?: number;
          repository_id?: string;
          status?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'priority_queue_repository_id_fkey';
            columns: ['repository_id'];
            isOneToOne: false;
            referencedRelation: 'repositories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'priority_queue_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspace_preview_stats';
            referencedColumns: ['workspace_id'];
          },
          {
            foreignKeyName: 'priority_queue_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      progressive_backfill_state: {
        Row: {
          chunk_size: number | null;
          consecutive_errors: number | null;
          created_at: string | null;
          error_count: number | null;
          id: string;
          last_error: string | null;
          last_error_at: string | null;
          last_processed_at: string | null;
          last_processed_cursor: string | null;
          last_processed_pr_number: number | null;
          metadata: Json | null;
          processed_prs: number | null;
          repository_id: string;
          status: string | null;
          total_prs: number;
          updated_at: string | null;
        };
        Insert: {
          chunk_size?: number | null;
          consecutive_errors?: number | null;
          created_at?: string | null;
          error_count?: number | null;
          id?: string;
          last_error?: string | null;
          last_error_at?: string | null;
          last_processed_at?: string | null;
          last_processed_cursor?: string | null;
          last_processed_pr_number?: number | null;
          metadata?: Json | null;
          processed_prs?: number | null;
          repository_id: string;
          status?: string | null;
          total_prs: number;
          updated_at?: string | null;
        };
        Update: {
          chunk_size?: number | null;
          consecutive_errors?: number | null;
          created_at?: string | null;
          error_count?: number | null;
          id?: string;
          last_error?: string | null;
          last_error_at?: string | null;
          last_processed_at?: string | null;
          last_processed_cursor?: string | null;
          last_processed_pr_number?: number | null;
          metadata?: Json | null;
          processed_prs?: number | null;
          repository_id?: string;
          status?: string | null;
          total_prs?: number;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'progressive_backfill_state_repository_id_fkey';
            columns: ['repository_id'];
            isOneToOne: true;
            referencedRelation: 'repositories';
            referencedColumns: ['id'];
          },
        ];
      };
      progressive_capture_jobs: {
        Row: {
          completed_at: string | null;
          created_at: string | null;
          error: string | null;
          id: string;
          job_type: string;
          metadata: Json | null;
          processor_type: string;
          repository_id: string | null;
          started_at: string | null;
          status: string | null;
          time_range_days: number | null;
          workflow_run_id: number | null;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string | null;
          error?: string | null;
          id?: string;
          job_type: string;
          metadata?: Json | null;
          processor_type?: string;
          repository_id?: string | null;
          started_at?: string | null;
          status?: string | null;
          time_range_days?: number | null;
          workflow_run_id?: number | null;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string | null;
          error?: string | null;
          id?: string;
          job_type?: string;
          metadata?: Json | null;
          processor_type?: string;
          repository_id?: string | null;
          started_at?: string | null;
          status?: string | null;
          time_range_days?: number | null;
          workflow_run_id?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'progressive_capture_jobs_repository_id_fkey';
            columns: ['repository_id'];
            isOneToOne: false;
            referencedRelation: 'repositories';
            referencedColumns: ['id'];
          },
        ];
      };
      progressive_capture_progress: {
        Row: {
          current_item: string | null;
          errors: Json | null;
          failed_items: number | null;
          id: string;
          job_id: string | null;
          processed_items: number | null;
          total_items: number | null;
          updated_at: string | null;
        };
        Insert: {
          current_item?: string | null;
          errors?: Json | null;
          failed_items?: number | null;
          id?: string;
          job_id?: string | null;
          processed_items?: number | null;
          total_items?: number | null;
          updated_at?: string | null;
        };
        Update: {
          current_item?: string | null;
          errors?: Json | null;
          failed_items?: number | null;
          id?: string;
          job_id?: string | null;
          processed_items?: number | null;
          total_items?: number | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'progressive_capture_progress_job_id_fkey';
            columns: ['job_id'];
            isOneToOne: false;
            referencedRelation: 'progressive_capture_jobs';
            referencedColumns: ['id'];
          },
        ];
      };
      pull_requests: {
        Row: {
          _dlt_id: string;
          _dlt_load_id: string;
          additions: number | null;
          assignee_id: string | null;
          author_github_id: number | null;
          author_id: string | null;
          author_login: string | null;
          base_branch: string;
          base_ref: string | null;
          body: string | null;
          changed_files: number | null;
          closed_at: string | null;
          commits: number | null;
          content_hash: string | null;
          created_at: string;
          deletions: number | null;
          diff_url: string | null;
          draft: boolean | null;
          embedding: string | null;
          embedding_generated_at: string | null;
          github_id: number;
          head_branch: string;
          head_ref: string | null;
          html_url: string | null;
          id: string;
          is_spam: boolean | null;
          last_synced_at: string | null;
          last_updated: string | null;
          mergeable: boolean | null;
          mergeable_state: string | null;
          merged: boolean | null;
          merged_at: string | null;
          merged_by_id: string | null;
          number: number;
          patch_url: string | null;
          repository_full_name: string;
          repository_github_id: number | null;
          repository_id: string | null;
          reviewed_by_admin: boolean | null;
          reviewer_data: Json | null;
          spam_detected_at: string | null;
          spam_flags: Json | null;
          spam_review_notes: string | null;
          spam_score: number | null;
          state: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          _dlt_id?: string;
          _dlt_load_id?: string;
          additions?: number | null;
          assignee_id?: string | null;
          author_github_id?: number | null;
          author_id?: string | null;
          author_login?: string | null;
          base_branch?: string;
          base_ref?: string | null;
          body?: string | null;
          changed_files?: number | null;
          closed_at?: string | null;
          commits?: number | null;
          content_hash?: string | null;
          created_at: string;
          deletions?: number | null;
          diff_url?: string | null;
          draft?: boolean | null;
          embedding?: string | null;
          embedding_generated_at?: string | null;
          github_id: number;
          head_branch: string;
          head_ref?: string | null;
          html_url?: string | null;
          id?: string;
          is_spam?: boolean | null;
          last_synced_at?: string | null;
          last_updated?: string | null;
          mergeable?: boolean | null;
          mergeable_state?: string | null;
          merged?: boolean | null;
          merged_at?: string | null;
          merged_by_id?: string | null;
          number: number;
          patch_url?: string | null;
          repository_full_name: string;
          repository_github_id?: number | null;
          repository_id?: string | null;
          reviewed_by_admin?: boolean | null;
          reviewer_data?: Json | null;
          spam_detected_at?: string | null;
          spam_flags?: Json | null;
          spam_review_notes?: string | null;
          spam_score?: number | null;
          state: string;
          title: string;
          updated_at: string;
        };
        Update: {
          _dlt_id?: string;
          _dlt_load_id?: string;
          additions?: number | null;
          assignee_id?: string | null;
          author_github_id?: number | null;
          author_id?: string | null;
          author_login?: string | null;
          base_branch?: string;
          base_ref?: string | null;
          body?: string | null;
          changed_files?: number | null;
          closed_at?: string | null;
          commits?: number | null;
          content_hash?: string | null;
          created_at?: string;
          deletions?: number | null;
          diff_url?: string | null;
          draft?: boolean | null;
          embedding?: string | null;
          embedding_generated_at?: string | null;
          github_id?: number;
          head_branch?: string;
          head_ref?: string | null;
          html_url?: string | null;
          id?: string;
          is_spam?: boolean | null;
          last_synced_at?: string | null;
          last_updated?: string | null;
          mergeable?: boolean | null;
          mergeable_state?: string | null;
          merged?: boolean | null;
          merged_at?: string | null;
          merged_by_id?: string | null;
          number?: number;
          patch_url?: string | null;
          repository_full_name?: string;
          repository_github_id?: number | null;
          repository_id?: string | null;
          reviewed_by_admin?: boolean | null;
          reviewer_data?: Json | null;
          spam_detected_at?: string | null;
          spam_flags?: Json | null;
          spam_review_notes?: string | null;
          spam_score?: number | null;
          state?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_pull_requests_assignee';
            columns: ['assignee_id'];
            isOneToOne: false;
            referencedRelation: 'contributor_stats';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_pull_requests_assignee';
            columns: ['assignee_id'];
            isOneToOne: false;
            referencedRelation: 'contributors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_pull_requests_merged_by';
            columns: ['merged_by_id'];
            isOneToOne: false;
            referencedRelation: 'contributor_stats';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_pull_requests_merged_by';
            columns: ['merged_by_id'];
            isOneToOne: false;
            referencedRelation: 'contributors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pull_requests_contributor_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'contributor_stats';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pull_requests_contributor_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'contributors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pull_requests_repository_id_fkey';
            columns: ['repository_id'];
            isOneToOne: false;
            referencedRelation: 'repositories';
            referencedColumns: ['id'];
          },
        ];
      };
      pull_requests_backup: {
        Row: {
          additions: number | null;
          assignee_id: string | null;
          author_id: string | null;
          base_branch: string | null;
          base_ref: string | null;
          body: string | null;
          changed_files: number | null;
          closed_at: string | null;
          commits: number | null;
          content_hash: string | null;
          created_at: string | null;
          deletions: number | null;
          diff_url: string | null;
          draft: boolean | null;
          embedding: string | null;
          embedding_generated_at: string | null;
          github_id: number | null;
          head_branch: string | null;
          head_ref: string | null;
          html_url: string | null;
          id: string | null;
          is_spam: boolean | null;
          last_synced_at: string | null;
          last_updated: string | null;
          mergeable: boolean | null;
          mergeable_state: string | null;
          merged: boolean | null;
          merged_at: string | null;
          merged_by_id: string | null;
          number: number | null;
          patch_url: string | null;
          repository_id: string | null;
          reviewed_by_admin: boolean | null;
          spam_detected_at: string | null;
          spam_flags: Json | null;
          spam_review_notes: string | null;
          spam_score: number | null;
          state: string | null;
          title: string | null;
          updated_at: string | null;
        };
        Insert: {
          additions?: number | null;
          assignee_id?: string | null;
          author_id?: string | null;
          base_branch?: string | null;
          base_ref?: string | null;
          body?: string | null;
          changed_files?: number | null;
          closed_at?: string | null;
          commits?: number | null;
          content_hash?: string | null;
          created_at?: string | null;
          deletions?: number | null;
          diff_url?: string | null;
          draft?: boolean | null;
          embedding?: string | null;
          embedding_generated_at?: string | null;
          github_id?: number | null;
          head_branch?: string | null;
          head_ref?: string | null;
          html_url?: string | null;
          id?: string | null;
          is_spam?: boolean | null;
          last_synced_at?: string | null;
          last_updated?: string | null;
          mergeable?: boolean | null;
          mergeable_state?: string | null;
          merged?: boolean | null;
          merged_at?: string | null;
          merged_by_id?: string | null;
          number?: number | null;
          patch_url?: string | null;
          repository_id?: string | null;
          reviewed_by_admin?: boolean | null;
          spam_detected_at?: string | null;
          spam_flags?: Json | null;
          spam_review_notes?: string | null;
          spam_score?: number | null;
          state?: string | null;
          title?: string | null;
          updated_at?: string | null;
        };
        Update: {
          additions?: number | null;
          assignee_id?: string | null;
          author_id?: string | null;
          base_branch?: string | null;
          base_ref?: string | null;
          body?: string | null;
          changed_files?: number | null;
          closed_at?: string | null;
          commits?: number | null;
          content_hash?: string | null;
          created_at?: string | null;
          deletions?: number | null;
          diff_url?: string | null;
          draft?: boolean | null;
          embedding?: string | null;
          embedding_generated_at?: string | null;
          github_id?: number | null;
          head_branch?: string | null;
          head_ref?: string | null;
          html_url?: string | null;
          id?: string | null;
          is_spam?: boolean | null;
          last_synced_at?: string | null;
          last_updated?: string | null;
          mergeable?: boolean | null;
          mergeable_state?: string | null;
          merged?: boolean | null;
          merged_at?: string | null;
          merged_by_id?: string | null;
          number?: number | null;
          patch_url?: string | null;
          repository_id?: string | null;
          reviewed_by_admin?: boolean | null;
          spam_detected_at?: string | null;
          spam_flags?: Json | null;
          spam_review_notes?: string | null;
          spam_score?: number | null;
          state?: string | null;
          title?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      pull_requests_replica: {
        Row: {
          additions: number | null;
          assignee_id: string | null;
          author_id: string | null;
          base_branch: string | null;
          base_ref: string | null;
          body: string | null;
          changed_files: number | null;
          closed_at: string | null;
          commits: number | null;
          content_hash: string | null;
          created_at: string | null;
          deletions: number | null;
          diff_url: string | null;
          draft: boolean | null;
          embedding: string | null;
          embedding_generated_at: string | null;
          github_id: number | null;
          head_branch: string | null;
          head_ref: string | null;
          html_url: string | null;
          id: string;
          is_spam: boolean | null;
          last_synced_at: string | null;
          last_updated: string | null;
          mergeable: boolean | null;
          mergeable_state: string | null;
          merged: boolean | null;
          merged_at: string | null;
          merged_by_id: string | null;
          number: number | null;
          patch_url: string | null;
          repository_id: string | null;
          reviewed_by_admin: boolean | null;
          spam_detected_at: string | null;
          spam_flags: Json | null;
          spam_review_notes: string | null;
          spam_score: number | null;
          state: string | null;
          title: string | null;
          updated_at: string | null;
        };
        Insert: {
          additions?: number | null;
          assignee_id?: string | null;
          author_id?: string | null;
          base_branch?: string | null;
          base_ref?: string | null;
          body?: string | null;
          changed_files?: number | null;
          closed_at?: string | null;
          commits?: number | null;
          content_hash?: string | null;
          created_at?: string | null;
          deletions?: number | null;
          diff_url?: string | null;
          draft?: boolean | null;
          embedding?: string | null;
          embedding_generated_at?: string | null;
          github_id?: number | null;
          head_branch?: string | null;
          head_ref?: string | null;
          html_url?: string | null;
          id: string;
          is_spam?: boolean | null;
          last_synced_at?: string | null;
          last_updated?: string | null;
          mergeable?: boolean | null;
          mergeable_state?: string | null;
          merged?: boolean | null;
          merged_at?: string | null;
          merged_by_id?: string | null;
          number?: number | null;
          patch_url?: string | null;
          repository_id?: string | null;
          reviewed_by_admin?: boolean | null;
          spam_detected_at?: string | null;
          spam_flags?: Json | null;
          spam_review_notes?: string | null;
          spam_score?: number | null;
          state?: string | null;
          title?: string | null;
          updated_at?: string | null;
        };
        Update: {
          additions?: number | null;
          assignee_id?: string | null;
          author_id?: string | null;
          base_branch?: string | null;
          base_ref?: string | null;
          body?: string | null;
          changed_files?: number | null;
          closed_at?: string | null;
          commits?: number | null;
          content_hash?: string | null;
          created_at?: string | null;
          deletions?: number | null;
          diff_url?: string | null;
          draft?: boolean | null;
          embedding?: string | null;
          embedding_generated_at?: string | null;
          github_id?: number | null;
          head_branch?: string | null;
          head_ref?: string | null;
          html_url?: string | null;
          id?: string;
          is_spam?: boolean | null;
          last_synced_at?: string | null;
          last_updated?: string | null;
          mergeable?: boolean | null;
          mergeable_state?: string | null;
          merged?: boolean | null;
          merged_at?: string | null;
          merged_by_id?: string | null;
          number?: number | null;
          patch_url?: string | null;
          repository_id?: string | null;
          reviewed_by_admin?: boolean | null;
          spam_detected_at?: string | null;
          spam_flags?: Json | null;
          spam_review_notes?: string | null;
          spam_score?: number | null;
          state?: string | null;
          title?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      query_patterns: {
        Row: {
          ai_platforms: string[] | null;
          created_at: string;
          example_queries: string[] | null;
          frequency_count: number | null;
          id: string;
          last_seen_at: string;
          pattern_text: string;
          pattern_type: string | null;
          updated_at: string;
        };
        Insert: {
          ai_platforms?: string[] | null;
          created_at?: string;
          example_queries?: string[] | null;
          frequency_count?: number | null;
          id?: string;
          last_seen_at?: string;
          pattern_text: string;
          pattern_type?: string | null;
          updated_at?: string;
        };
        Update: {
          ai_platforms?: string[] | null;
          created_at?: string;
          example_queries?: string[] | null;
          frequency_count?: number | null;
          id?: string;
          last_seen_at?: string;
          pattern_text?: string;
          pattern_type?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      queue_metrics: {
        Row: {
          created_at: string | null;
          duration_ms: number | null;
          error_message: string | null;
          id: string;
          job_id: string | null;
          job_type: string;
          repository_id: string | null;
          retry_count: number | null;
          status: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          duration_ms?: number | null;
          error_message?: string | null;
          id?: string;
          job_id?: string | null;
          job_type: string;
          repository_id?: string | null;
          retry_count?: number | null;
          status: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          duration_ms?: number | null;
          error_message?: string | null;
          id?: string;
          job_id?: string | null;
          job_type?: string;
          repository_id?: string | null;
          retry_count?: number | null;
          status?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'queue_metrics_repository_id_fkey';
            columns: ['repository_id'];
            isOneToOne: false;
            referencedRelation: 'repositories';
            referencedColumns: ['id'];
          },
        ];
      };
      rate_limit_tracking: {
        Row: {
          calls_made: number;
          calls_remaining: number | null;
          created_at: string;
          hour_bucket: string;
          id: string;
          reset_at: string | null;
        };
        Insert: {
          calls_made?: number;
          calls_remaining?: number | null;
          created_at?: string;
          hour_bucket: string;
          id?: string;
          reset_at?: string | null;
        };
        Update: {
          calls_made?: number;
          calls_remaining?: number | null;
          created_at?: string;
          hour_bucket?: string;
          id?: string;
          reset_at?: string | null;
        };
        Relationships: [];
      };
      rate_limits: {
        Row: {
          created_at: string | null;
          key: string;
          last_request: string;
          request_count: number;
          updated_at: string | null;
          window_start: string;
        };
        Insert: {
          created_at?: string | null;
          key: string;
          last_request?: string;
          request_count?: number;
          updated_at?: string | null;
          window_start?: string;
        };
        Update: {
          created_at?: string | null;
          key?: string;
          last_request?: string;
          request_count?: number;
          updated_at?: string | null;
          window_start?: string;
        };
        Relationships: [];
      };
      referral_traffic: {
        Row: {
          ai_platform: string | null;
          citation_confidence: number | null;
          country_code: string | null;
          created_at: string;
          id: string;
          landing_page: string;
          query_pattern: string | null;
          referrer_domain: string | null;
          referrer_type: string | null;
          referrer_url: string | null;
          repository: string | null;
          session_id: string;
          timestamp: string;
          user_agent: string | null;
        };
        Insert: {
          ai_platform?: string | null;
          citation_confidence?: number | null;
          country_code?: string | null;
          created_at?: string;
          id?: string;
          landing_page: string;
          query_pattern?: string | null;
          referrer_domain?: string | null;
          referrer_type?: string | null;
          referrer_url?: string | null;
          repository?: string | null;
          session_id: string;
          timestamp?: string;
          user_agent?: string | null;
        };
        Update: {
          ai_platform?: string | null;
          citation_confidence?: number | null;
          country_code?: string | null;
          created_at?: string;
          id?: string;
          landing_page?: string;
          query_pattern?: string | null;
          referrer_domain?: string | null;
          referrer_type?: string | null;
          referrer_url?: string | null;
          repository?: string | null;
          session_id?: string;
          timestamp?: string;
          user_agent?: string | null;
        };
        Relationships: [];
      };
      repositories: {
        Row: {
          _dlt_id: string | null;
          _dlt_load_id: string | null;
          ai_summary: string | null;
          avatar_url: string | null;
          commit_capture_status: string | null;
          default_branch: string | null;
          description: string | null;
          embedding: string | null;
          first_tracked_at: string;
          forks_count: number | null;
          full_name: string;
          github_created_at: string | null;
          github_id: number;
          github_pushed_at: string | null;
          github_updated_at: string | null;
          has_discussions: boolean | null;
          has_downloads: boolean | null;
          has_issues: boolean | null;
          has_pages: boolean | null;
          has_projects: boolean | null;
          has_wiki: boolean | null;
          homepage: string | null;
          homepage_url: string | null;
          id: string;
          is_active: boolean | null;
          is_archived: boolean | null;
          is_disabled: boolean | null;
          is_fork: boolean | null;
          is_private: boolean | null;
          is_template: boolean | null;
          language: string | null;
          last_commit_capture_at: string | null;
          last_synced_at: string | null;
          last_updated_at: string;
          last_webhook_event_at: string | null;
          license: string | null;
          name: string;
          open_issues_count: number | null;
          owner: string;
          parent_repository_id: string | null;
          pr_template_content: string | null;
          pr_template_fetched_at: string | null;
          pr_template_hash: string | null;
          pr_template_url: string | null;
          pull_request_count: number | null;
          recent_activity_hash: string | null;
          size: number | null;
          stargazers_count: number | null;
          summary_generated_at: string | null;
          sync_status: string | null;
          topics: string[] | null;
          total_pull_requests: number | null;
          watchers_count: number | null;
          webhook_enabled_at: string | null;
          webhook_priority: boolean | null;
        };
        Insert: {
          _dlt_id?: string | null;
          _dlt_load_id?: string | null;
          ai_summary?: string | null;
          avatar_url?: string | null;
          commit_capture_status?: string | null;
          default_branch?: string | null;
          description?: string | null;
          embedding?: string | null;
          first_tracked_at?: string;
          forks_count?: number | null;
          full_name: string;
          github_created_at?: string | null;
          github_id: number;
          github_pushed_at?: string | null;
          github_updated_at?: string | null;
          has_discussions?: boolean | null;
          has_downloads?: boolean | null;
          has_issues?: boolean | null;
          has_pages?: boolean | null;
          has_projects?: boolean | null;
          has_wiki?: boolean | null;
          homepage?: string | null;
          homepage_url?: string | null;
          id?: string;
          is_active?: boolean | null;
          is_archived?: boolean | null;
          is_disabled?: boolean | null;
          is_fork?: boolean | null;
          is_private?: boolean | null;
          is_template?: boolean | null;
          language?: string | null;
          last_commit_capture_at?: string | null;
          last_synced_at?: string | null;
          last_updated_at?: string;
          last_webhook_event_at?: string | null;
          license?: string | null;
          name: string;
          open_issues_count?: number | null;
          owner: string;
          parent_repository_id?: string | null;
          pr_template_content?: string | null;
          pr_template_fetched_at?: string | null;
          pr_template_hash?: string | null;
          pr_template_url?: string | null;
          pull_request_count?: number | null;
          recent_activity_hash?: string | null;
          size?: number | null;
          stargazers_count?: number | null;
          summary_generated_at?: string | null;
          sync_status?: string | null;
          topics?: string[] | null;
          total_pull_requests?: number | null;
          watchers_count?: number | null;
          webhook_enabled_at?: string | null;
          webhook_priority?: boolean | null;
        };
        Update: {
          _dlt_id?: string | null;
          _dlt_load_id?: string | null;
          ai_summary?: string | null;
          avatar_url?: string | null;
          commit_capture_status?: string | null;
          default_branch?: string | null;
          description?: string | null;
          embedding?: string | null;
          first_tracked_at?: string;
          forks_count?: number | null;
          full_name?: string;
          github_created_at?: string | null;
          github_id?: number;
          github_pushed_at?: string | null;
          github_updated_at?: string | null;
          has_discussions?: boolean | null;
          has_downloads?: boolean | null;
          has_issues?: boolean | null;
          has_pages?: boolean | null;
          has_projects?: boolean | null;
          has_wiki?: boolean | null;
          homepage?: string | null;
          homepage_url?: string | null;
          id?: string;
          is_active?: boolean | null;
          is_archived?: boolean | null;
          is_disabled?: boolean | null;
          is_fork?: boolean | null;
          is_private?: boolean | null;
          is_template?: boolean | null;
          language?: string | null;
          last_commit_capture_at?: string | null;
          last_synced_at?: string | null;
          last_updated_at?: string;
          last_webhook_event_at?: string | null;
          license?: string | null;
          name?: string;
          open_issues_count?: number | null;
          owner?: string;
          parent_repository_id?: string | null;
          pr_template_content?: string | null;
          pr_template_fetched_at?: string | null;
          pr_template_hash?: string | null;
          pr_template_url?: string | null;
          pull_request_count?: number | null;
          recent_activity_hash?: string | null;
          size?: number | null;
          stargazers_count?: number | null;
          summary_generated_at?: string | null;
          sync_status?: string | null;
          topics?: string[] | null;
          total_pull_requests?: number | null;
          watchers_count?: number | null;
          webhook_enabled_at?: string | null;
          webhook_priority?: boolean | null;
        };
        Relationships: [
          {
            foreignKeyName: 'repositories_parent_repository_id_fkey';
            columns: ['parent_repository_id'];
            isOneToOne: false;
            referencedRelation: 'repositories';
            referencedColumns: ['id'];
          },
        ];
      };
      repository_categories: {
        Row: {
          category: string;
          contributor_count: number | null;
          created_at: string | null;
          id: string;
          is_test_repository: boolean | null;
          last_categorized_at: string | null;
          monthly_activity_score: number | null;
          pr_count: number | null;
          priority_level: number | null;
          repository_id: string | null;
          star_count: number | null;
          updated_at: string | null;
        };
        Insert: {
          category: string;
          contributor_count?: number | null;
          created_at?: string | null;
          id?: string;
          is_test_repository?: boolean | null;
          last_categorized_at?: string | null;
          monthly_activity_score?: number | null;
          pr_count?: number | null;
          priority_level?: number | null;
          repository_id?: string | null;
          star_count?: number | null;
          updated_at?: string | null;
        };
        Update: {
          category?: string;
          contributor_count?: number | null;
          created_at?: string | null;
          id?: string;
          is_test_repository?: boolean | null;
          last_categorized_at?: string | null;
          monthly_activity_score?: number | null;
          pr_count?: number | null;
          priority_level?: number | null;
          repository_id?: string | null;
          star_count?: number | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'repository_categories_repository_id_fkey';
            columns: ['repository_id'];
            isOneToOne: true;
            referencedRelation: 'repositories';
            referencedColumns: ['id'];
          },
        ];
      };
      repository_changelogs: {
        Row: {
          change_type: string;
          created_at: string | null;
          description: string | null;
          id: string;
          importance_score: number | null;
          metadata: Json | null;
          repository_id: string;
          title: string;
        };
        Insert: {
          change_type: string;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          importance_score?: number | null;
          metadata?: Json | null;
          repository_id: string;
          title: string;
        };
        Update: {
          change_type?: string;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          importance_score?: number | null;
          metadata?: Json | null;
          repository_id?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'repository_changelogs_repository_id_fkey';
            columns: ['repository_id'];
            isOneToOne: false;
            referencedRelation: 'repositories';
            referencedColumns: ['id'];
          },
        ];
      };
      repository_confidence_cache: {
        Row: {
          calculated_at: string;
          calculation_time_ms: number | null;
          confidence_score: number;
          created_at: string;
          data_version: number | null;
          expires_at: string;
          id: string;
          last_sync_at: string | null;
          repository_name: string;
          repository_owner: string;
          time_range_days: number;
          updated_at: string;
        };
        Insert: {
          calculated_at?: string;
          calculation_time_ms?: number | null;
          confidence_score: number;
          created_at?: string;
          data_version?: number | null;
          expires_at: string;
          id?: string;
          last_sync_at?: string | null;
          repository_name: string;
          repository_owner: string;
          time_range_days: number;
          updated_at?: string;
        };
        Update: {
          calculated_at?: string;
          calculation_time_ms?: number | null;
          confidence_score?: number;
          created_at?: string;
          data_version?: number | null;
          expires_at?: string;
          id?: string;
          last_sync_at?: string | null;
          repository_name?: string;
          repository_owner?: string;
          time_range_days?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      repository_file_trees: {
        Row: {
          branch: string;
          created_at: string | null;
          fetched_at: string | null;
          id: string;
          repository_id: string;
          sha: string | null;
          total_directories: number | null;
          total_files: number | null;
          total_size: number | null;
          tree_data: Json;
          truncated: boolean | null;
          updated_at: string | null;
        };
        Insert: {
          branch?: string;
          created_at?: string | null;
          fetched_at?: string | null;
          id?: string;
          repository_id: string;
          sha?: string | null;
          total_directories?: number | null;
          total_files?: number | null;
          total_size?: number | null;
          tree_data: Json;
          truncated?: boolean | null;
          updated_at?: string | null;
        };
        Update: {
          branch?: string;
          created_at?: string | null;
          fetched_at?: string | null;
          id?: string;
          repository_id?: string;
          sha?: string | null;
          total_directories?: number | null;
          total_files?: number | null;
          total_size?: number | null;
          tree_data?: Json;
          truncated?: boolean | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'repository_file_trees_repository_id_fkey';
            columns: ['repository_id'];
            isOneToOne: false;
            referencedRelation: 'repositories';
            referencedColumns: ['id'];
          },
        ];
      };
      repository_metrics_history: {
        Row: {
          captured_at: string | null;
          change_amount: number | null;
          change_percentage: number | null;
          created_at: string | null;
          current_value: number;
          id: string;
          is_significant: boolean | null;
          metric_type: string;
          previous_value: number | null;
          repository_id: string;
        };
        Insert: {
          captured_at?: string | null;
          change_amount?: number | null;
          change_percentage?: number | null;
          created_at?: string | null;
          current_value: number;
          id?: string;
          is_significant?: boolean | null;
          metric_type: string;
          previous_value?: number | null;
          repository_id: string;
        };
        Update: {
          captured_at?: string | null;
          change_amount?: number | null;
          change_percentage?: number | null;
          created_at?: string | null;
          current_value?: number;
          id?: string;
          is_significant?: boolean | null;
          metric_type?: string;
          previous_value?: number | null;
          repository_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'repository_metrics_history_repository_id_fkey';
            columns: ['repository_id'];
            isOneToOne: false;
            referencedRelation: 'repositories';
            referencedColumns: ['id'];
          },
        ];
      };
      requested_reviewers: {
        Row: {
          avatar_url: string | null;
          created_at: string | null;
          id: string;
          pull_request_id: string;
          requested_at: string | null;
          updated_at: string | null;
          username: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string | null;
          id?: string;
          pull_request_id: string;
          requested_at?: string | null;
          updated_at?: string | null;
          username: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string | null;
          id?: string;
          pull_request_id?: string;
          requested_at?: string | null;
          updated_at?: string | null;
          username?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'requested_reviewers_pull_request_id_fkey';
            columns: ['pull_request_id'];
            isOneToOne: false;
            referencedRelation: 'pull_requests';
            referencedColumns: ['id'];
          },
        ];
      };
      reviewer_suggestions_cache: {
        Row: {
          created_at: string;
          expires_at: string;
          file_hash: string;
          id: string;
          repository_id: string;
          suggestions: Json;
        };
        Insert: {
          created_at?: string;
          expires_at: string;
          file_hash: string;
          id?: string;
          repository_id: string;
          suggestions: Json;
        };
        Update: {
          created_at?: string;
          expires_at?: string;
          file_hash?: string;
          id?: string;
          repository_id?: string;
          suggestions?: Json;
        };
        Relationships: [
          {
            foreignKeyName: 'reviewer_suggestions_cache_repository_id_fkey';
            columns: ['repository_id'];
            isOneToOne: false;
            referencedRelation: 'repositories';
            referencedColumns: ['id'];
          },
        ];
      };
      reviews: {
        Row: {
          author_id: string;
          body: string | null;
          commit_id: string | null;
          github_id: number;
          id: string;
          pull_request_id: string;
          repository_id: string;
          reviewer_id: string | null;
          state: string;
          submitted_at: string;
        };
        Insert: {
          author_id: string;
          body?: string | null;
          commit_id?: string | null;
          github_id: number;
          id?: string;
          pull_request_id: string;
          repository_id: string;
          reviewer_id?: string | null;
          state: string;
          submitted_at: string;
        };
        Update: {
          author_id?: string;
          body?: string | null;
          commit_id?: string | null;
          github_id?: number;
          id?: string;
          pull_request_id?: string;
          repository_id?: string;
          reviewer_id?: string | null;
          state?: string;
          submitted_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_reviews_pull_request';
            columns: ['pull_request_id'];
            isOneToOne: false;
            referencedRelation: 'pull_requests';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_reviews_repository';
            columns: ['repository_id'];
            isOneToOne: false;
            referencedRelation: 'repositories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_reviews_reviewer';
            columns: ['reviewer_id'];
            isOneToOne: false;
            referencedRelation: 'contributor_stats';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_reviews_reviewer';
            columns: ['reviewer_id'];
            isOneToOne: false;
            referencedRelation: 'contributors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reviews_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'contributor_stats';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reviews_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'contributors';
            referencedColumns: ['id'];
          },
        ];
      };
      rollout_configuration: {
        Row: {
          auto_rollback_enabled: boolean | null;
          created_at: string | null;
          emergency_stop: boolean | null;
          excluded_repositories: string[] | null;
          feature_name: string;
          id: string;
          is_active: boolean | null;
          max_error_rate: number | null;
          metadata: Json | null;
          monitoring_window_hours: number | null;
          rollout_percentage: number | null;
          rollout_strategy: string | null;
          target_repositories: string[] | null;
          updated_at: string | null;
        };
        Insert: {
          auto_rollback_enabled?: boolean | null;
          created_at?: string | null;
          emergency_stop?: boolean | null;
          excluded_repositories?: string[] | null;
          feature_name: string;
          id?: string;
          is_active?: boolean | null;
          max_error_rate?: number | null;
          metadata?: Json | null;
          monitoring_window_hours?: number | null;
          rollout_percentage?: number | null;
          rollout_strategy?: string | null;
          target_repositories?: string[] | null;
          updated_at?: string | null;
        };
        Update: {
          auto_rollback_enabled?: boolean | null;
          created_at?: string | null;
          emergency_stop?: boolean | null;
          excluded_repositories?: string[] | null;
          feature_name?: string;
          id?: string;
          is_active?: boolean | null;
          max_error_rate?: number | null;
          metadata?: Json | null;
          monitoring_window_hours?: number | null;
          rollout_percentage?: number | null;
          rollout_strategy?: string | null;
          target_repositories?: string[] | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      rollout_history: {
        Row: {
          action: string;
          created_at: string | null;
          id: string;
          metadata: Json | null;
          new_percentage: number | null;
          previous_percentage: number | null;
          reason: string | null;
          rollout_config_id: string | null;
          triggered_by: string | null;
        };
        Insert: {
          action: string;
          created_at?: string | null;
          id?: string;
          metadata?: Json | null;
          new_percentage?: number | null;
          previous_percentage?: number | null;
          reason?: string | null;
          rollout_config_id?: string | null;
          triggered_by?: string | null;
        };
        Update: {
          action?: string;
          created_at?: string | null;
          id?: string;
          metadata?: Json | null;
          new_percentage?: number | null;
          previous_percentage?: number | null;
          reason?: string | null;
          rollout_config_id?: string | null;
          triggered_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'rollout_history_rollout_config_id_fkey';
            columns: ['rollout_config_id'];
            isOneToOne: false;
            referencedRelation: 'rollout_configuration';
            referencedColumns: ['id'];
          },
        ];
      };
      rollout_metrics: {
        Row: {
          average_processing_time: number | null;
          created_at: string | null;
          error_count: number | null;
          id: string;
          last_error_at: string | null;
          last_error_message: string | null;
          metrics_window_end: string | null;
          metrics_window_start: string | null;
          processor_type: string;
          repository_id: string | null;
          rollout_config_id: string | null;
          success_count: number | null;
          total_jobs: number | null;
          updated_at: string | null;
        };
        Insert: {
          average_processing_time?: number | null;
          created_at?: string | null;
          error_count?: number | null;
          id?: string;
          last_error_at?: string | null;
          last_error_message?: string | null;
          metrics_window_end?: string | null;
          metrics_window_start?: string | null;
          processor_type: string;
          repository_id?: string | null;
          rollout_config_id?: string | null;
          success_count?: number | null;
          total_jobs?: number | null;
          updated_at?: string | null;
        };
        Update: {
          average_processing_time?: number | null;
          created_at?: string | null;
          error_count?: number | null;
          id?: string;
          last_error_at?: string | null;
          last_error_message?: string | null;
          metrics_window_end?: string | null;
          metrics_window_start?: string | null;
          processor_type?: string;
          repository_id?: string | null;
          rollout_config_id?: string | null;
          success_count?: number | null;
          total_jobs?: number | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'rollout_metrics_repository_id_fkey';
            columns: ['repository_id'];
            isOneToOne: false;
            referencedRelation: 'repositories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'rollout_metrics_rollout_config_id_fkey';
            columns: ['rollout_config_id'];
            isOneToOne: false;
            referencedRelation: 'rollout_configuration';
            referencedColumns: ['id'];
          },
        ];
      };
      share_click_analytics: {
        Row: {
          click_data: Json | null;
          created_at: string | null;
          dub_link_id: string;
          id: string;
          period_end: string;
          period_start: string;
          share_event_id: string | null;
          total_clicks: number | null;
          unique_clicks: number | null;
          updated_at: string | null;
        };
        Insert: {
          click_data?: Json | null;
          created_at?: string | null;
          dub_link_id: string;
          id?: string;
          period_end: string;
          period_start: string;
          share_event_id?: string | null;
          total_clicks?: number | null;
          unique_clicks?: number | null;
          updated_at?: string | null;
        };
        Update: {
          click_data?: Json | null;
          created_at?: string | null;
          dub_link_id?: string;
          id?: string;
          period_end?: string;
          period_start?: string;
          share_event_id?: string | null;
          total_clicks?: number | null;
          unique_clicks?: number | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'share_click_analytics_share_event_id_fkey';
            columns: ['share_event_id'];
            isOneToOne: false;
            referencedRelation: 'share_analytics_summary';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'share_click_analytics_share_event_id_fkey';
            columns: ['share_event_id'];
            isOneToOne: false;
            referencedRelation: 'share_events';
            referencedColumns: ['id'];
          },
        ];
      };
      share_events: {
        Row: {
          action: string;
          chart_type: string;
          created_at: string | null;
          domain: string | null;
          dub_link_id: string | null;
          id: string;
          metadata: Json | null;
          original_url: string;
          page_path: string | null;
          platform: string | null;
          referrer: string | null;
          repository: string | null;
          session_id: string | null;
          share_type: string | null;
          short_url: string | null;
          updated_at: string | null;
          user_agent: string | null;
          user_id: string | null;
        };
        Insert: {
          action: string;
          chart_type: string;
          created_at?: string | null;
          domain?: string | null;
          dub_link_id?: string | null;
          id?: string;
          metadata?: Json | null;
          original_url: string;
          page_path?: string | null;
          platform?: string | null;
          referrer?: string | null;
          repository?: string | null;
          session_id?: string | null;
          share_type?: string | null;
          short_url?: string | null;
          updated_at?: string | null;
          user_agent?: string | null;
          user_id?: string | null;
        };
        Update: {
          action?: string;
          chart_type?: string;
          created_at?: string | null;
          domain?: string | null;
          dub_link_id?: string | null;
          id?: string;
          metadata?: Json | null;
          original_url?: string;
          page_path?: string | null;
          platform?: string | null;
          referrer?: string | null;
          repository?: string | null;
          session_id?: string | null;
          share_type?: string | null;
          short_url?: string | null;
          updated_at?: string | null;
          user_agent?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      short_urls: {
        Row: {
          clicks: number | null;
          created_at: string | null;
          description: string | null;
          domain: string;
          dub_id: string;
          id: number;
          key: string | null;
          original_url: string;
          short_url: string;
          title: string | null;
          updated_at: string | null;
          utm_campaign: string | null;
          utm_medium: string | null;
          utm_source: string | null;
        };
        Insert: {
          clicks?: number | null;
          created_at?: string | null;
          description?: string | null;
          domain: string;
          dub_id: string;
          id?: number;
          key?: string | null;
          original_url: string;
          short_url: string;
          title?: string | null;
          updated_at?: string | null;
          utm_campaign?: string | null;
          utm_medium?: string | null;
          utm_source?: string | null;
        };
        Update: {
          clicks?: number | null;
          created_at?: string | null;
          description?: string | null;
          domain?: string;
          dub_id?: string;
          id?: number;
          key?: string | null;
          original_url?: string;
          short_url?: string;
          title?: string | null;
          updated_at?: string | null;
          utm_campaign?: string | null;
          utm_medium?: string | null;
          utm_source?: string | null;
        };
        Relationships: [];
      };
      similarity_cache: {
        Row: {
          access_count: number | null;
          accessed_at: string | null;
          content_hash: string;
          created_at: string | null;
          embedding: string;
          id: string;
          item_id: string;
          item_type: string;
          repository_id: string;
          ttl_hours: number | null;
        };
        Insert: {
          access_count?: number | null;
          accessed_at?: string | null;
          content_hash: string;
          created_at?: string | null;
          embedding: string;
          id?: string;
          item_id: string;
          item_type: string;
          repository_id: string;
          ttl_hours?: number | null;
        };
        Update: {
          access_count?: number | null;
          accessed_at?: string | null;
          content_hash?: string;
          created_at?: string | null;
          embedding?: string;
          id?: string;
          item_id?: string;
          item_type?: string;
          repository_id?: string;
          ttl_hours?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'similarity_cache_repository_id_fkey';
            columns: ['repository_id'];
            isOneToOne: false;
            referencedRelation: 'repositories';
            referencedColumns: ['id'];
          },
        ];
      };
      spam_detections: {
        Row: {
          admin_reviewed_at: string | null;
          admin_reviewed_by: number | null;
          contributor_id: string;
          created_at: string;
          detected_at: string;
          detection_reasons: string[];
          id: string;
          pr_id: string;
          spam_score: number;
          status: string;
          updated_at: string;
        };
        Insert: {
          admin_reviewed_at?: string | null;
          admin_reviewed_by?: number | null;
          contributor_id: string;
          created_at?: string;
          detected_at?: string;
          detection_reasons?: string[];
          id?: string;
          pr_id: string;
          spam_score: number;
          status?: string;
          updated_at?: string;
        };
        Update: {
          admin_reviewed_at?: string | null;
          admin_reviewed_by?: number | null;
          contributor_id?: string;
          created_at?: string;
          detected_at?: string;
          detection_reasons?: string[];
          id?: string;
          pr_id?: string;
          spam_score?: number;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_spam_detections_contributor';
            columns: ['contributor_id'];
            isOneToOne: false;
            referencedRelation: 'contributor_stats';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_spam_detections_contributor';
            columns: ['contributor_id'];
            isOneToOne: false;
            referencedRelation: 'contributors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_spam_detections_pull_request';
            columns: ['pr_id'];
            isOneToOne: false;
            referencedRelation: 'pull_requests';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'spam_detections_admin_reviewed_by_fkey';
            columns: ['admin_reviewed_by'];
            isOneToOne: false;
            referencedRelation: 'app_users';
            referencedColumns: ['github_user_id'];
          },
        ];
      };
      subscription_addons: {
        Row: {
          addon_type: string;
          created_at: string | null;
          id: string;
          price_per_unit: number;
          quantity: number;
          subscription_id: string | null;
          updated_at: string | null;
        };
        Insert: {
          addon_type: string;
          created_at?: string | null;
          id?: string;
          price_per_unit: number;
          quantity?: number;
          subscription_id?: string | null;
          updated_at?: string | null;
        };
        Update: {
          addon_type?: string;
          created_at?: string | null;
          id?: string;
          price_per_unit?: number;
          quantity?: number;
          subscription_id?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'subscription_addons_subscription_id_fkey';
            columns: ['subscription_id'];
            isOneToOne: false;
            referencedRelation: 'subscriptions';
            referencedColumns: ['id'];
          },
        ];
      };
      subscription_features: {
        Row: {
          created_at: string | null;
          feature_name: string;
          feature_value: Json;
          id: string;
          tier: string;
        };
        Insert: {
          created_at?: string | null;
          feature_name: string;
          feature_value: Json;
          id?: string;
          tier: string;
        };
        Update: {
          created_at?: string | null;
          feature_name?: string;
          feature_value?: Json;
          id?: string;
          tier?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          billing_cycle: string | null;
          cancel_at_period_end: boolean | null;
          canceled_at: string | null;
          created_at: string;
          current_period_end: string | null;
          current_period_start: string | null;
          id: string;
          max_repos_per_workspace: number | null;
          max_workspaces: number | null;
          polar_customer_id: string | null;
          polar_subscription_id: string | null;
          status: string;
          stripe_customer_id: string | null;
          stripe_price_id: string | null;
          stripe_subscription_id: string | null;
          tier: string;
          trial_end: string | null;
          trial_start: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          billing_cycle?: string | null;
          cancel_at_period_end?: boolean | null;
          canceled_at?: string | null;
          created_at?: string;
          current_period_end?: string | null;
          current_period_start?: string | null;
          id?: string;
          max_repos_per_workspace?: number | null;
          max_workspaces?: number | null;
          polar_customer_id?: string | null;
          polar_subscription_id?: string | null;
          status?: string;
          stripe_customer_id?: string | null;
          stripe_price_id?: string | null;
          stripe_subscription_id?: string | null;
          tier?: string;
          trial_end?: string | null;
          trial_start?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          billing_cycle?: string | null;
          cancel_at_period_end?: boolean | null;
          canceled_at?: string | null;
          created_at?: string;
          current_period_end?: string | null;
          current_period_start?: string | null;
          id?: string;
          max_repos_per_workspace?: number | null;
          max_workspaces?: number | null;
          polar_customer_id?: string | null;
          polar_subscription_id?: string | null;
          status?: string;
          stripe_customer_id?: string | null;
          stripe_price_id?: string | null;
          stripe_subscription_id?: string | null;
          tier?: string;
          trial_end?: string | null;
          trial_start?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      sync_logs: {
        Row: {
          completed_at: string | null;
          error_message: string | null;
          github_api_calls_used: number | null;
          id: string;
          metadata: Json | null;
          rate_limit_remaining: number | null;
          records_failed: number | null;
          records_inserted: number | null;
          records_processed: number | null;
          records_updated: number | null;
          repository_id: string | null;
          started_at: string;
          status: string;
          sync_type: string;
        };
        Insert: {
          completed_at?: string | null;
          error_message?: string | null;
          github_api_calls_used?: number | null;
          id?: string;
          metadata?: Json | null;
          rate_limit_remaining?: number | null;
          records_failed?: number | null;
          records_inserted?: number | null;
          records_processed?: number | null;
          records_updated?: number | null;
          repository_id?: string | null;
          started_at?: string;
          status: string;
          sync_type: string;
        };
        Update: {
          completed_at?: string | null;
          error_message?: string | null;
          github_api_calls_used?: number | null;
          id?: string;
          metadata?: Json | null;
          rate_limit_remaining?: number | null;
          records_failed?: number | null;
          records_inserted?: number | null;
          records_processed?: number | null;
          records_updated?: number | null;
          repository_id?: string | null;
          started_at?: string;
          status?: string;
          sync_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_sync_logs_repository';
            columns: ['repository_id'];
            isOneToOne: false;
            referencedRelation: 'repositories';
            referencedColumns: ['id'];
          },
        ];
      };
      sync_metrics: {
        Row: {
          created_at: string | null;
          error_details: Json | null;
          errors: number | null;
          execution_time: number;
          function_name: string;
          id: string;
          processed: number | null;
          repository: string;
          router: string | null;
          success: boolean | null;
          timed_out: boolean | null;
        };
        Insert: {
          created_at?: string | null;
          error_details?: Json | null;
          errors?: number | null;
          execution_time: number;
          function_name: string;
          id?: string;
          processed?: number | null;
          repository: string;
          router?: string | null;
          success?: boolean | null;
          timed_out?: boolean | null;
        };
        Update: {
          created_at?: string | null;
          error_details?: Json | null;
          errors?: number | null;
          execution_time?: number;
          function_name?: string;
          id?: string;
          processed?: number | null;
          repository?: string;
          router?: string | null;
          success?: boolean | null;
          timed_out?: boolean | null;
        };
        Relationships: [];
      };
      sync_progress: {
        Row: {
          created_at: string | null;
          error_message: string | null;
          id: string;
          last_cursor: string | null;
          last_sync_at: string | null;
          prs_processed: number | null;
          repository_id: string | null;
          status: string | null;
          total_prs: number | null;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          error_message?: string | null;
          id?: string;
          last_cursor?: string | null;
          last_sync_at?: string | null;
          prs_processed?: number | null;
          repository_id?: string | null;
          status?: string | null;
          total_prs?: number | null;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          error_message?: string | null;
          id?: string;
          last_cursor?: string | null;
          last_sync_at?: string | null;
          prs_processed?: number | null;
          repository_id?: string | null;
          status?: string | null;
          total_prs?: number | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'sync_progress_repository_id_fkey';
            columns: ['repository_id'];
            isOneToOne: true;
            referencedRelation: 'repositories';
            referencedColumns: ['id'];
          },
        ];
      };
      tier_limits: {
        Row: {
          additional_workspace_yearly: number;
          advanced_analytics: boolean;
          allows_private_repos: boolean;
          api_access_enabled: boolean;
          custom_branding_enabled: boolean;
          data_export_enabled: boolean;
          data_retention_days: number;
          max_members_per_workspace: number | null;
          max_repos_per_workspace: number;
          max_workspaces: number;
          monthly_price: number;
          priority_queue_enabled: boolean;
          tier: string;
          yearly_price: number;
        };
        Insert: {
          additional_workspace_yearly?: number;
          advanced_analytics?: boolean;
          allows_private_repos?: boolean;
          api_access_enabled?: boolean;
          custom_branding_enabled?: boolean;
          data_export_enabled?: boolean;
          data_retention_days: number;
          max_members_per_workspace?: number | null;
          max_repos_per_workspace: number;
          max_workspaces: number;
          monthly_price: number;
          priority_queue_enabled?: boolean;
          tier: string;
          yearly_price: number;
        };
        Update: {
          additional_workspace_yearly?: number;
          advanced_analytics?: boolean;
          allows_private_repos?: boolean;
          api_access_enabled?: boolean;
          custom_branding_enabled?: boolean;
          data_export_enabled?: boolean;
          data_retention_days?: number;
          max_members_per_workspace?: number | null;
          max_repos_per_workspace?: number;
          max_workspaces?: number;
          monthly_price?: number;
          priority_queue_enabled?: boolean;
          tier?: string;
          yearly_price?: number;
        };
        Relationships: [];
      };
      tracked_repositories: {
        Row: {
          added_by_user_id: string | null;
          created_at: string;
          id: string;
          include_bots: boolean | null;
          include_forks: boolean | null;
          is_workspace_repo: boolean | null;
          last_sync_at: string | null;
          last_updated_at: string | null;
          metrics: Json | null;
          organization_name: string | null;
          priority: Database['public']['Enums']['repository_priority'] | null;
          repository_id: string;
          repository_name: string | null;
          size: Database['public']['Enums']['repository_size'] | null;
          size_calculated_at: string | null;
          sync_frequency_hours: number | null;
          tracking_enabled: boolean | null;
          updated_at: string;
          workspace_count: number | null;
        };
        Insert: {
          added_by_user_id?: string | null;
          created_at?: string;
          id?: string;
          include_bots?: boolean | null;
          include_forks?: boolean | null;
          is_workspace_repo?: boolean | null;
          last_sync_at?: string | null;
          last_updated_at?: string | null;
          metrics?: Json | null;
          organization_name?: string | null;
          priority?: Database['public']['Enums']['repository_priority'] | null;
          repository_id: string;
          repository_name?: string | null;
          size?: Database['public']['Enums']['repository_size'] | null;
          size_calculated_at?: string | null;
          sync_frequency_hours?: number | null;
          tracking_enabled?: boolean | null;
          updated_at?: string;
          workspace_count?: number | null;
        };
        Update: {
          added_by_user_id?: string | null;
          created_at?: string;
          id?: string;
          include_bots?: boolean | null;
          include_forks?: boolean | null;
          is_workspace_repo?: boolean | null;
          last_sync_at?: string | null;
          last_updated_at?: string | null;
          metrics?: Json | null;
          organization_name?: string | null;
          priority?: Database['public']['Enums']['repository_priority'] | null;
          repository_id?: string;
          repository_name?: string | null;
          size?: Database['public']['Enums']['repository_size'] | null;
          size_calculated_at?: string | null;
          sync_frequency_hours?: number | null;
          tracking_enabled?: boolean | null;
          updated_at?: string;
          workspace_count?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_tracked_repositories_added_by_user';
            columns: ['added_by_user_id'];
            isOneToOne: false;
            referencedRelation: 'app_users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_tracked_repositories_repository';
            columns: ['repository_id'];
            isOneToOne: true;
            referencedRelation: 'repositories';
            referencedColumns: ['id'];
          },
        ];
      };
      usage_stats: {
        Row: {
          analytics_level: string | null;
          data_retention_days: number | null;
          id: string;
          last_updated: string | null;
          user_id: string;
          workspace_count: number | null;
        };
        Insert: {
          analytics_level?: string | null;
          data_retention_days?: number | null;
          id?: string;
          last_updated?: string | null;
          user_id: string;
          workspace_count?: number | null;
        };
        Update: {
          analytics_level?: string | null;
          data_retention_days?: number | null;
          id?: string;
          last_updated?: string | null;
          user_id?: string;
          workspace_count?: number | null;
        };
        Relationships: [];
      };
      usage_tracking: {
        Row: {
          api_calls: number;
          created_at: string;
          data_ingestion_requests: number;
          id: string;
          overage_charges: number | null;
          period_end: string;
          period_start: string;
          repositories_added: number;
          storage_bytes_used: number;
          team_members_added: number;
          user_id: string;
          workspace_id: string | null;
          workspaces_created: number;
        };
        Insert: {
          api_calls?: number;
          created_at?: string;
          data_ingestion_requests?: number;
          id?: string;
          overage_charges?: number | null;
          period_end: string;
          period_start: string;
          repositories_added?: number;
          storage_bytes_used?: number;
          team_members_added?: number;
          user_id: string;
          workspace_id?: string | null;
          workspaces_created?: number;
        };
        Update: {
          api_calls?: number;
          created_at?: string;
          data_ingestion_requests?: number;
          id?: string;
          overage_charges?: number | null;
          period_end?: string;
          period_start?: string;
          repositories_added?: number;
          storage_bytes_used?: number;
          team_members_added?: number;
          user_id?: string;
          workspace_id?: string | null;
          workspaces_created?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'usage_tracking_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspace_preview_stats';
            referencedColumns: ['workspace_id'];
          },
          {
            foreignKeyName: 'usage_tracking_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      user_email_preferences: {
        Row: {
          consent_given_at: string | null;
          consent_method: string | null;
          consent_withdrawn_at: string | null;
          created_at: string | null;
          data_retention_days: number | null;
          id: string;
          ip_address: unknown | null;
          marketing_emails: boolean | null;
          notification_emails: boolean | null;
          privacy_policy_version: string | null;
          terms_accepted_at: string | null;
          transactional_emails: boolean | null;
          updated_at: string | null;
          user_agent: string | null;
          user_id: string | null;
          welcome_emails: boolean | null;
        };
        Insert: {
          consent_given_at?: string | null;
          consent_method?: string | null;
          consent_withdrawn_at?: string | null;
          created_at?: string | null;
          data_retention_days?: number | null;
          id?: string;
          ip_address?: unknown | null;
          marketing_emails?: boolean | null;
          notification_emails?: boolean | null;
          privacy_policy_version?: string | null;
          terms_accepted_at?: string | null;
          transactional_emails?: boolean | null;
          updated_at?: string | null;
          user_agent?: string | null;
          user_id?: string | null;
          welcome_emails?: boolean | null;
        };
        Update: {
          consent_given_at?: string | null;
          consent_method?: string | null;
          consent_withdrawn_at?: string | null;
          created_at?: string | null;
          data_retention_days?: number | null;
          id?: string;
          ip_address?: unknown | null;
          marketing_emails?: boolean | null;
          notification_emails?: boolean | null;
          privacy_policy_version?: string | null;
          terms_accepted_at?: string | null;
          transactional_emails?: boolean | null;
          updated_at?: string | null;
          user_agent?: string | null;
          user_id?: string | null;
          welcome_emails?: boolean | null;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          granted_at: string;
          granted_by: string | null;
          id: string;
          is_active: boolean | null;
          revoked_at: string | null;
          revoked_by: string | null;
          role: string;
          user_id: string;
        };
        Insert: {
          granted_at?: string;
          granted_by?: string | null;
          id?: string;
          is_active?: boolean | null;
          revoked_at?: string | null;
          revoked_by?: string | null;
          role: string;
          user_id: string;
        };
        Update: {
          granted_at?: string;
          granted_by?: string | null;
          id?: string;
          is_active?: boolean | null;
          revoked_at?: string | null;
          revoked_by?: string | null;
          role?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_roles_granted_by_fkey';
            columns: ['granted_by'];
            isOneToOne: false;
            referencedRelation: 'app_users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'user_roles_revoked_by_fkey';
            columns: ['revoked_by'];
            isOneToOne: false;
            referencedRelation: 'app_users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'user_roles_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'app_users';
            referencedColumns: ['id'];
          },
        ];
      };
      web_vitals_events: {
        Row: {
          connection_type: string | null;
          created_at: string;
          device_memory: number | null;
          hardware_concurrency: number | null;
          id: string;
          metric_delta: number | null;
          metric_name: string;
          metric_rating: string;
          metric_value: number;
          navigation_type: string;
          page_path: string;
          page_url: string;
          repository: string | null;
          screen_height: number | null;
          screen_width: number | null;
          session_id: string;
          timestamp: string;
          user_agent: string | null;
          viewport_height: number | null;
          viewport_width: number | null;
        };
        Insert: {
          connection_type?: string | null;
          created_at?: string;
          device_memory?: number | null;
          hardware_concurrency?: number | null;
          id?: string;
          metric_delta?: number | null;
          metric_name: string;
          metric_rating: string;
          metric_value: number;
          navigation_type: string;
          page_path: string;
          page_url: string;
          repository?: string | null;
          screen_height?: number | null;
          screen_width?: number | null;
          session_id: string;
          timestamp?: string;
          user_agent?: string | null;
          viewport_height?: number | null;
          viewport_width?: number | null;
        };
        Update: {
          connection_type?: string | null;
          created_at?: string;
          device_memory?: number | null;
          hardware_concurrency?: number | null;
          id?: string;
          metric_delta?: number | null;
          metric_name?: string;
          metric_rating?: string;
          metric_value?: number;
          navigation_type?: string;
          page_path?: string;
          page_url?: string;
          repository?: string | null;
          screen_height?: number | null;
          screen_width?: number | null;
          session_id?: string;
          timestamp?: string;
          user_agent?: string | null;
          viewport_height?: number | null;
          viewport_width?: number | null;
        };
        Relationships: [];
      };
      workspace_activity: {
        Row: {
          action: string;
          created_at: string;
          details: Json | null;
          id: string;
          target_id: string | null;
          target_type: string | null;
          user_id: string | null;
          workspace_id: string;
        };
        Insert: {
          action: string;
          created_at?: string;
          details?: Json | null;
          id?: string;
          target_id?: string | null;
          target_type?: string | null;
          user_id?: string | null;
          workspace_id: string;
        };
        Update: {
          action?: string;
          created_at?: string;
          details?: Json | null;
          id?: string;
          target_id?: string | null;
          target_type?: string | null;
          user_id?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workspace_activity_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspace_preview_stats';
            referencedColumns: ['workspace_id'];
          },
          {
            foreignKeyName: 'workspace_activity_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      workspace_aggregation_queue: {
        Row: {
          completed_at: string | null;
          created_at: string | null;
          error_details: Json | null;
          error_message: string | null;
          failed_at: string | null;
          id: string;
          max_retries: number | null;
          priority: number | null;
          retry_count: number | null;
          scheduled_for: string;
          started_at: string | null;
          status: string;
          time_range: string;
          trigger_metadata: Json | null;
          triggered_by: string | null;
          updated_at: string | null;
          workspace_id: string;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string | null;
          error_details?: Json | null;
          error_message?: string | null;
          failed_at?: string | null;
          id?: string;
          max_retries?: number | null;
          priority?: number | null;
          retry_count?: number | null;
          scheduled_for?: string;
          started_at?: string | null;
          status?: string;
          time_range: string;
          trigger_metadata?: Json | null;
          triggered_by?: string | null;
          updated_at?: string | null;
          workspace_id: string;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string | null;
          error_details?: Json | null;
          error_message?: string | null;
          failed_at?: string | null;
          id?: string;
          max_retries?: number | null;
          priority?: number | null;
          retry_count?: number | null;
          scheduled_for?: string;
          started_at?: string | null;
          status?: string;
          time_range?: string;
          trigger_metadata?: Json | null;
          triggered_by?: string | null;
          updated_at?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workspace_aggregation_queue_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspace_preview_stats';
            referencedColumns: ['workspace_id'];
          },
          {
            foreignKeyName: 'workspace_aggregation_queue_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      workspace_contributors: {
        Row: {
          added_at: string;
          added_by: string;
          contributor_id: string;
          id: string;
          is_pinned: boolean | null;
          notes: string | null;
          workspace_id: string;
        };
        Insert: {
          added_at?: string;
          added_by: string;
          contributor_id: string;
          id?: string;
          is_pinned?: boolean | null;
          notes?: string | null;
          workspace_id: string;
        };
        Update: {
          added_at?: string;
          added_by?: string;
          contributor_id?: string;
          id?: string;
          is_pinned?: boolean | null;
          notes?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workspace_contributors_contributor_id_fkey';
            columns: ['contributor_id'];
            isOneToOne: false;
            referencedRelation: 'contributor_stats';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workspace_contributors_contributor_id_fkey';
            columns: ['contributor_id'];
            isOneToOne: false;
            referencedRelation: 'contributors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workspace_contributors_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspace_preview_stats';
            referencedColumns: ['workspace_id'];
          },
          {
            foreignKeyName: 'workspace_contributors_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      workspace_invitations: {
        Row: {
          accepted_at: string | null;
          email: string;
          expires_at: string;
          id: string;
          invitation_token: string;
          invited_at: string;
          invited_by: string;
          rejected_at: string | null;
          role: string;
          status: string;
          workspace_id: string;
        };
        Insert: {
          accepted_at?: string | null;
          email: string;
          expires_at?: string;
          id?: string;
          invitation_token?: string;
          invited_at?: string;
          invited_by: string;
          rejected_at?: string | null;
          role: string;
          status?: string;
          workspace_id: string;
        };
        Update: {
          accepted_at?: string | null;
          email?: string;
          expires_at?: string;
          id?: string;
          invitation_token?: string;
          invited_at?: string;
          invited_by?: string;
          rejected_at?: string | null;
          role?: string;
          status?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workspace_invitations_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspace_preview_stats';
            referencedColumns: ['workspace_id'];
          },
          {
            foreignKeyName: 'workspace_invitations_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      workspace_members: {
        Row: {
          accepted_at: string | null;
          created_at: string;
          id: string;
          invited_at: string | null;
          invited_by: string | null;
          last_active_at: string | null;
          notifications_enabled: boolean | null;
          role: string;
          updated_at: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          accepted_at?: string | null;
          created_at?: string;
          id?: string;
          invited_at?: string | null;
          invited_by?: string | null;
          last_active_at?: string | null;
          notifications_enabled?: boolean | null;
          role: string;
          updated_at?: string;
          user_id: string;
          workspace_id: string;
        };
        Update: {
          accepted_at?: string | null;
          created_at?: string;
          id?: string;
          invited_at?: string | null;
          invited_by?: string | null;
          last_active_at?: string | null;
          notifications_enabled?: boolean | null;
          role?: string;
          updated_at?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workspace_members_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspace_preview_stats';
            referencedColumns: ['workspace_id'];
          },
          {
            foreignKeyName: 'workspace_members_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      workspace_metrics_cache: {
        Row: {
          calculated_at: string;
          expires_at: string;
          id: string;
          is_stale: boolean | null;
          metrics: Json;
          period_end: string;
          period_start: string;
          time_range: string;
          updated_at: string | null;
          workspace_id: string;
        };
        Insert: {
          calculated_at?: string;
          expires_at?: string;
          id?: string;
          is_stale?: boolean | null;
          metrics?: Json;
          period_end: string;
          period_start: string;
          time_range: string;
          updated_at?: string | null;
          workspace_id: string;
        };
        Update: {
          calculated_at?: string;
          expires_at?: string;
          id?: string;
          is_stale?: boolean | null;
          metrics?: Json;
          period_end?: string;
          period_start?: string;
          time_range?: string;
          updated_at?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workspace_metrics_cache_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspace_preview_stats';
            referencedColumns: ['workspace_id'];
          },
          {
            foreignKeyName: 'workspace_metrics_cache_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      workspace_metrics_history: {
        Row: {
          created_at: string | null;
          daily_active_contributors: number | null;
          daily_closed_issues: number | null;
          daily_commits: number | null;
          daily_issues: number | null;
          daily_merged_prs: number | null;
          daily_prs: number | null;
          id: string;
          metric_date: string;
          total_contributors: number | null;
          total_forks: number | null;
          total_stars: number | null;
          workspace_id: string;
        };
        Insert: {
          created_at?: string | null;
          daily_active_contributors?: number | null;
          daily_closed_issues?: number | null;
          daily_commits?: number | null;
          daily_issues?: number | null;
          daily_merged_prs?: number | null;
          daily_prs?: number | null;
          id?: string;
          metric_date: string;
          total_contributors?: number | null;
          total_forks?: number | null;
          total_stars?: number | null;
          workspace_id: string;
        };
        Update: {
          created_at?: string | null;
          daily_active_contributors?: number | null;
          daily_closed_issues?: number | null;
          daily_commits?: number | null;
          daily_issues?: number | null;
          daily_merged_prs?: number | null;
          daily_prs?: number | null;
          id?: string;
          metric_date?: string;
          total_contributors?: number | null;
          total_forks?: number | null;
          total_stars?: number | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workspace_metrics_history_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspace_preview_stats';
            referencedColumns: ['workspace_id'];
          },
          {
            foreignKeyName: 'workspace_metrics_history_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      workspace_repositories: {
        Row: {
          added_at: string;
          added_by: string;
          id: string;
          is_pinned: boolean | null;
          notes: string | null;
          repository_id: string;
          tags: string[] | null;
          workspace_id: string;
        };
        Insert: {
          added_at?: string;
          added_by: string;
          id?: string;
          is_pinned?: boolean | null;
          notes?: string | null;
          repository_id: string;
          tags?: string[] | null;
          workspace_id: string;
        };
        Update: {
          added_at?: string;
          added_by?: string;
          id?: string;
          is_pinned?: boolean | null;
          notes?: string | null;
          repository_id?: string;
          tags?: string[] | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workspace_repositories_repository_id_fkey';
            columns: ['repository_id'];
            isOneToOne: false;
            referencedRelation: 'repositories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workspace_repositories_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspace_preview_stats';
            referencedColumns: ['workspace_id'];
          },
          {
            foreignKeyName: 'workspace_repositories_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      workspace_tracked_repositories: {
        Row: {
          added_at: string;
          added_by: string;
          data_retention_days: number | null;
          fetch_comments: boolean | null;
          fetch_commits: boolean | null;
          fetch_issues: boolean | null;
          fetch_reviews: boolean | null;
          id: string;
          is_active: boolean | null;
          last_sync_at: string | null;
          last_sync_error: string | null;
          last_sync_status: string | null;
          next_sync_at: string | null;
          notes: string | null;
          priority_score: number | null;
          sync_attempts: number | null;
          sync_frequency_hours: number | null;
          total_commits_fetched: number | null;
          total_issues_fetched: number | null;
          total_reviews_fetched: number | null;
          tracked_repository_id: string;
          workspace_id: string;
        };
        Insert: {
          added_at?: string;
          added_by: string;
          data_retention_days?: number | null;
          fetch_comments?: boolean | null;
          fetch_commits?: boolean | null;
          fetch_issues?: boolean | null;
          fetch_reviews?: boolean | null;
          id?: string;
          is_active?: boolean | null;
          last_sync_at?: string | null;
          last_sync_error?: string | null;
          last_sync_status?: string | null;
          next_sync_at?: string | null;
          notes?: string | null;
          priority_score?: number | null;
          sync_attempts?: number | null;
          sync_frequency_hours?: number | null;
          total_commits_fetched?: number | null;
          total_issues_fetched?: number | null;
          total_reviews_fetched?: number | null;
          tracked_repository_id: string;
          workspace_id: string;
        };
        Update: {
          added_at?: string;
          added_by?: string;
          data_retention_days?: number | null;
          fetch_comments?: boolean | null;
          fetch_commits?: boolean | null;
          fetch_issues?: boolean | null;
          fetch_reviews?: boolean | null;
          id?: string;
          is_active?: boolean | null;
          last_sync_at?: string | null;
          last_sync_error?: string | null;
          last_sync_status?: string | null;
          next_sync_at?: string | null;
          notes?: string | null;
          priority_score?: number | null;
          sync_attempts?: number | null;
          sync_frequency_hours?: number | null;
          total_commits_fetched?: number | null;
          total_issues_fetched?: number | null;
          total_reviews_fetched?: number | null;
          tracked_repository_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workspace_tracked_repositories_tracked_repository_id_fkey';
            columns: ['tracked_repository_id'];
            isOneToOne: false;
            referencedRelation: 'tracked_repositories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workspace_tracked_repositories_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspace_preview_stats';
            referencedColumns: ['workspace_id'];
          },
          {
            foreignKeyName: 'workspace_tracked_repositories_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      workspaces: {
        Row: {
          created_at: string;
          current_repository_count: number | null;
          data_retention_days: number | null;
          description: string | null;
          id: string;
          is_active: boolean | null;
          last_activity_at: string | null;
          max_repositories: number | null;
          name: string;
          owner_id: string;
          settings: Json | null;
          slug: string;
          subscription_id: string | null;
          tier: string;
          updated_at: string;
          visibility: string;
        };
        Insert: {
          created_at?: string;
          current_repository_count?: number | null;
          data_retention_days?: number | null;
          description?: string | null;
          id?: string;
          is_active?: boolean | null;
          last_activity_at?: string | null;
          max_repositories?: number | null;
          name: string;
          owner_id: string;
          settings?: Json | null;
          slug: string;
          subscription_id?: string | null;
          tier?: string;
          updated_at?: string;
          visibility?: string;
        };
        Update: {
          created_at?: string;
          current_repository_count?: number | null;
          data_retention_days?: number | null;
          description?: string | null;
          id?: string;
          is_active?: boolean | null;
          last_activity_at?: string | null;
          max_repositories?: number | null;
          name?: string;
          owner_id?: string;
          settings?: Json | null;
          slug?: string;
          subscription_id?: string | null;
          tier?: string;
          updated_at?: string;
          visibility?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workspaces_subscription_id_fkey';
            columns: ['subscription_id'];
            isOneToOne: false;
            referencedRelation: 'subscriptions';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      admin_check: {
        Row: {
          auth_user_id: string | null;
          is_admin: boolean | null;
        };
        Insert: {
          auth_user_id?: string | null;
          is_admin?: boolean | null;
        };
        Update: {
          auth_user_id?: string | null;
          is_admin?: boolean | null;
        };
        Relationships: [];
      };
      backfill_progress_summary: {
        Row: {
          avg_chunk_processing_time_ms: number | null;
          backfill_id: string | null;
          chunk_size: number | null;
          completed_chunks: number | null;
          created_at: string | null;
          error_count: number | null;
          failed_chunks: number | null;
          last_processed_at: string | null;
          name: string | null;
          owner: string | null;
          processed_prs: number | null;
          progress_percentage: number | null;
          status: string | null;
          total_prs: number | null;
          updated_at: string | null;
        };
        Relationships: [];
      };
      codeowners_with_repository: {
        Row: {
          content: string | null;
          created_at: string | null;
          fetched_at: string | null;
          file_path: string | null;
          id: string | null;
          repository_id: string | null;
          repository_name: string | null;
          repository_owner: string | null;
          repository_repo: string | null;
          rules: Json | null;
          sha: string | null;
          updated_at: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'codeowners_repository_id_fkey';
            columns: ['repository_id'];
            isOneToOne: false;
            referencedRelation: 'repositories';
            referencedColumns: ['id'];
          },
        ];
      };
      contributor_stats: {
        Row: {
          avatar_url: string | null;
          display_name: string | null;
          first_contribution: string | null;
          first_seen_at: string | null;
          github_id: number | null;
          id: string | null;
          is_active: boolean | null;
          last_contribution: string | null;
          last_updated_at: string | null;
          merged_pull_requests: number | null;
          repositories_contributed: number | null;
          total_comments: number | null;
          total_lines_added: number | null;
          total_lines_removed: number | null;
          total_pull_requests: number | null;
          total_reviews: number | null;
          username: string | null;
        };
        Relationships: [];
      };
      daily_citation_summary: {
        Row: {
          ai_referrals: number | null;
          avg_confidence: number | null;
          citation_date: string | null;
          total_referrals: number | null;
          unique_platforms: number | null;
          unique_repositories: number | null;
          unique_sessions: number | null;
        };
        Relationships: [];
      };
      issue_comments: {
        Row: {
          body: string | null;
          commenter_avatar_url: string | null;
          commenter_display_name: string | null;
          commenter_id: string | null;
          commenter_username: string | null;
          created_at: string | null;
          github_id: number | null;
          id: string | null;
          in_reply_to_id: string | null;
          issue_id: string | null;
          issue_number: number | null;
          issue_state: string | null;
          issue_title: string | null;
          repository_id: string | null;
          updated_at: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'comments_issue_id_fkey';
            columns: ['issue_id'];
            isOneToOne: false;
            referencedRelation: 'issues';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_comments_commenter';
            columns: ['commenter_id'];
            isOneToOne: false;
            referencedRelation: 'contributor_stats';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_comments_commenter';
            columns: ['commenter_id'];
            isOneToOne: false;
            referencedRelation: 'contributors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_comments_in_reply_to';
            columns: ['in_reply_to_id'];
            isOneToOne: false;
            referencedRelation: 'comments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_comments_in_reply_to';
            columns: ['in_reply_to_id'];
            isOneToOne: false;
            referencedRelation: 'issue_comments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_comments_in_reply_to';
            columns: ['in_reply_to_id'];
            isOneToOne: false;
            referencedRelation: 'pr_comments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'issues_repository_id_fkey';
            columns: ['repository_id'];
            isOneToOne: false;
            referencedRelation: 'repositories';
            referencedColumns: ['id'];
          },
        ];
      };
      items_needing_embeddings: {
        Row: {
          body: string | null;
          content_hash: string | null;
          created_at: string | null;
          embedding_generated_at: string | null;
          id: string | null;
          item_type: string | null;
          priority: number | null;
          repository_id: string | null;
          title: string | null;
        };
        Relationships: [];
      };
      items_needing_embeddings_priority: {
        Row: {
          body: string | null;
          content_hash: string | null;
          created_at: string | null;
          embedding_generated_at: string | null;
          id: string | null;
          item_type: string | null;
          priority_score: number | null;
          repository_id: string | null;
          title: string | null;
          updated_at: string | null;
        };
        Relationships: [];
      };
      pr_comments: {
        Row: {
          body: string | null;
          comment_type: string | null;
          commenter_avatar_url: string | null;
          commenter_display_name: string | null;
          commenter_id: string | null;
          commenter_username: string | null;
          commit_id: string | null;
          created_at: string | null;
          diff_hunk: string | null;
          github_id: number | null;
          id: string | null;
          in_reply_to_id: string | null;
          original_position: number | null;
          path: string | null;
          position: number | null;
          pr_number: number | null;
          pr_state: string | null;
          pr_title: string | null;
          pull_request_id: string | null;
          repository_id: string | null;
          updated_at: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_comments_commenter';
            columns: ['commenter_id'];
            isOneToOne: false;
            referencedRelation: 'contributor_stats';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_comments_commenter';
            columns: ['commenter_id'];
            isOneToOne: false;
            referencedRelation: 'contributors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_comments_in_reply_to';
            columns: ['in_reply_to_id'];
            isOneToOne: false;
            referencedRelation: 'comments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_comments_in_reply_to';
            columns: ['in_reply_to_id'];
            isOneToOne: false;
            referencedRelation: 'issue_comments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_comments_in_reply_to';
            columns: ['in_reply_to_id'];
            isOneToOne: false;
            referencedRelation: 'pr_comments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_comments_pull_request';
            columns: ['pull_request_id'];
            isOneToOne: false;
            referencedRelation: 'pull_requests';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pull_requests_repository_id_fkey';
            columns: ['repository_id'];
            isOneToOne: false;
            referencedRelation: 'repositories';
            referencedColumns: ['id'];
          },
        ];
      };
      progressive_capture_stats: {
        Row: {
          avg_duration_minutes: number | null;
          count: number | null;
          newest_job: string | null;
          oldest_job: string | null;
          processor_type: string | null;
          status: string | null;
        };
        Relationships: [];
      };
      recent_activity: {
        Row: {
          activity_date: string | null;
          activity_type: string | null;
          avatar_url: string | null;
          contributor_id: string | null;
          description: string | null;
          id: string | null;
          merged: boolean | null;
          repository_id: string | null;
          repository_name: string | null;
          state: string | null;
          url: string | null;
          username: string | null;
        };
        Relationships: [];
      };
      repository_contribution_stats: {
        Row: {
          contribution_month: string | null;
          external_contribution_rate: number | null;
          external_contributors: number | null;
          external_prs: number | null;
          internal_contribution_rate: number | null;
          internal_contributors: number | null;
          internal_prs: number | null;
          repository_name: string | null;
          repository_owner: string | null;
          total_contributors: number | null;
          total_prs: number | null;
        };
        Relationships: [];
      };
      repository_performance_summary: {
        Row: {
          avg_cls: number | null;
          avg_inp: number | null;
          avg_lcp: number | null;
          good_measurements: number | null;
          performance_score: number | null;
          repository: string | null;
          total_measurements: number | null;
          unique_sessions: number | null;
        };
        Relationships: [];
      };
      share_analytics_summary: {
        Row: {
          action: string | null;
          chart_type: string | null;
          created_at: string | null;
          domain: string | null;
          id: string | null;
          is_shortened: boolean | null;
          repository: string | null;
          share_type: string | null;
          short_url: string | null;
          total_clicks: number | null;
          unique_clicks: number | null;
        };
        Relationships: [];
      };
      stuck_jobs_monitor: {
        Row: {
          affected_repositories: string[] | null;
          job_type: string | null;
          oldest_age_minutes: number | null;
          oldest_stuck_job: string | null;
          stuck_count: number | null;
        };
        Relationships: [];
      };
      web_vitals_summary: {
        Row: {
          avg_value: number | null;
          good_count: number | null;
          good_percentage: number | null;
          metric_name: string | null;
          needs_improvement_count: number | null;
          p50: number | null;
          p75: number | null;
          p95: number | null;
          poor_count: number | null;
          total_measurements: number | null;
        };
        Relationships: [];
      };
      workspace_preview_stats: {
        Row: {
          last_updated: string | null;
          member_count: number | null;
          pinned_repository_count: number | null;
          repository_count: number | null;
          workspace_id: string | null;
          workspace_name: string | null;
          workspace_slug: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      batch_capture_metrics: {
        Args: { metrics_data: Json };
        Returns: number;
      };
      binary_quantize: {
        Args: { '': string } | { '': unknown };
        Returns: unknown;
      };
      bytea_to_text: {
        Args: { data: string };
        Returns: string;
      };
      calculate_citation_confidence: {
        Args: {
          landing_page?: string;
          referrer_url: string;
          user_agent?: string;
        };
        Returns: number;
      };
      calculate_metric_trend: {
        Args: { current_value: number; previous_value: number };
        Returns: number;
      };
      calculate_overage_charges: {
        Args: {
          period_end_date: string;
          period_start_date: string;
          user_uuid: string;
        };
        Returns: number;
      };
      calculate_self_selection_rate: {
        Args: {
          p_days_back?: number;
          p_repository_name: string;
          p_repository_owner: string;
        };
        Returns: {
          analysis_end_date: string;
          analysis_period_days: number;
          analysis_start_date: string;
          external_contribution_rate: number;
          external_contributors: number;
          external_prs: number;
          internal_contribution_rate: number;
          internal_contributors: number;
          internal_prs: number;
          repository_name: string;
          repository_owner: string;
          total_contributors: number;
          total_prs: number;
        }[];
      };
      calculate_weighted_score: {
        Args: {
          comments_count: number;
          lines_added?: number;
          lines_removed?: number;
          pull_requests_count: number;
          repositories_count: number;
          reviews_count: number;
        };
        Returns: number;
      };
      calculate_workspace_repo_priority: {
        Args: { p_tracked_repository_id: string; p_workspace_id: string };
        Returns: number;
      };
      can_add_repository: {
        Args: { workspace_uuid: string };
        Returns: boolean;
      };
      can_create_workspace: {
        Args: { user_uuid: string };
        Returns: boolean;
      };
      capture_repository_metrics: {
        Args: {
          p_current_value: number;
          p_metric_type: string;
          p_repository_id: string;
        };
        Returns: boolean;
      };
      categorize_repository: {
        Args: { repo_id: string };
        Returns: string;
      };
      check_email_rate_limit: {
        Args: {
          p_email_type: string;
          p_max_emails?: number;
          p_time_window?: unknown;
          p_user_id: string;
        };
        Returns: boolean;
      };
      check_feature_limit: {
        Args: { p_feature_name: string; p_user_id: string };
        Returns: Json;
      };
      check_repository_pr_count_consistency: {
        Args: Record<PropertyKey, never>;
        Returns: {
          actual_pr_count: number;
          consistency_status: string;
          count_difference: number;
          repository_name: string;
          stored_pull_request_count: number;
          stored_total_pull_requests: number;
        }[];
      };
      clean_expired_reviewer_cache: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      cleanup_expired_cache: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      cleanup_expired_confidence_cache: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      cleanup_expired_idempotency_keys: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      cleanup_expired_workspace_cache: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      cleanup_old_github_activities: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      cleanup_orphaned_cache_entries: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      create_performance_snapshot: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      current_user_is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      detect_ai_platform: {
        Args: { referrer_url: string; user_agent?: string };
        Returns: string;
      };
      determine_role_with_improved_thresholds: {
        Args: {
          confidence_score: number;
          detection_methods: Json;
          privileged_events_count: number;
          user_id: string;
        };
        Returns: string;
      };
      extract_repository_from_path: {
        Args: { path: string };
        Returns: string;
      };
      find_codeowners_for_file: {
        Args: { p_file_path: string; p_repository_id: string };
        Returns: Json;
      };
      find_most_similar_issue: {
        Args: {
          exclude_issue_id?: string;
          query_embedding: string;
          repo_id: string;
        };
        Returns: {
          github_id: number;
          html_url: string;
          id: string;
          is_duplicate_likely: boolean;
          number: number;
          similarity: number;
          title: string;
        }[];
      };
      find_similar_discussions_in_workspace: {
        Args: {
          exclude_discussion_id?: string;
          match_count: number;
          query_embedding: string;
          repo_ids: string[];
        };
        Returns: {
          html_url: string;
          id: string;
          is_answered: boolean;
          number: number;
          repository_name: string;
          similarity: number;
          title: string;
        }[];
      };
      find_similar_files: {
        Args: {
          p_file_path: string;
          p_limit?: number;
          p_repository_id: string;
          p_threshold?: number;
        };
        Returns: {
          contributor_count: number;
          file_path: string;
          language: string;
          similarity: number;
        }[];
      };
      find_similar_issues: {
        Args:
          | {
              exclude_issue_id?: string;
              match_count?: number;
              query_embedding: string;
              repo_id?: string;
              similarity_threshold?: number;
            }
          | { limit_count?: number; target_issue_id: string }
          | { match_count: number; query_embedding: string; repo_id: string };
        Returns: {
          issue_id: string;
          number: number;
          similarity_score: number;
          state: string;
          title: string;
        }[];
      };
      find_similar_issues_cross_repo: {
        Args: {
          exclude_issue_id?: string;
          match_count?: number;
          organization_name: string;
          query_embedding: string;
          similarity_threshold?: number;
        };
        Returns: {
          author_login: string;
          body_snippet: string;
          created_at: string;
          github_id: number;
          html_url: string;
          id: string;
          number: number;
          repository_full_name: string;
          repository_name: string;
          similarity: number;
          state: string;
          title: string;
          updated_at: string;
        }[];
      };
      find_similar_issues_in_workspace: {
        Args: {
          exclude_issue_id?: string;
          match_count?: number;
          query_embedding: string;
          repo_ids: string[];
        };
        Returns: {
          html_url: string;
          id: string;
          number: number;
          repository_name: string;
          similarity: number;
          state: string;
          title: string;
        }[];
      };
      find_similar_pull_requests: {
        Args: {
          exclude_pr_id?: string;
          match_count?: number;
          query_embedding: string;
          repo_id?: string;
        };
        Returns: {
          created_at: string;
          github_id: number;
          html_url: string;
          id: string;
          merged_at: string;
          number: number;
          similarity: number;
          state: string;
          title: string;
        }[];
      };
      find_similar_pull_requests_in_workspace: {
        Args: {
          exclude_pr_id?: string;
          match_count: number;
          query_embedding: string;
          repo_ids: string[];
        };
        Returns: {
          html_url: string;
          id: string;
          merged_at: string;
          number: number;
          repository_name: string;
          similarity: number;
          state: string;
          title: string;
        }[];
      };
      fix_repository_pr_count_inconsistencies: {
        Args: Record<PropertyKey, never>;
        Returns: {
          fixed: boolean;
          new_count: number;
          old_pull_request_count: number;
          old_total_pull_requests: number;
          repository_name: string;
        }[];
      };
      generate_workspace_slug: {
        Args: { workspace_name: string };
        Returns: string;
      };
      get_cache_statistics: {
        Args: Record<PropertyKey, never>;
        Returns: {
          avg_access_count: number;
          expired_entries: number;
          newest_entry: string;
          oldest_entry: string;
          total_entries: number;
          total_repositories: number;
        }[];
      };
      get_cache_ttl: {
        Args: { p_time_range: string };
        Returns: unknown;
      };
      get_cached_avatar_url: {
        Args: { contributor_github_id: number };
        Returns: string;
      };
      get_confidence_analytics_summary: {
        Args: Record<PropertyKey, never>;
        Returns: {
          avg_confidence_score: number;
          low_confidence_repos: number;
          score_distribution: Json;
          total_contributors: number;
          total_repositories: number;
        }[];
      };
      get_confidence_analytics_summary_simple: {
        Args: Record<PropertyKey, never>;
        Returns: {
          avg_confidence_score: number;
          low_confidence_repos: number;
          score_distribution: Json;
          total_contributors: number;
          total_repositories: number;
        }[];
      };
      get_contributor_rank: {
        Args: {
          contributor_uuid: string;
          rank_month: number;
          rank_year: number;
          repository_uuid?: string;
        };
        Returns: number;
      };
      get_job_metrics_windowed: {
        Args: { window_hours?: number };
        Returns: {
          avg_duration_ms: number;
          completed_jobs: number;
          failed_jobs: number;
          hour_bucket: string;
          job_type: string;
          success_rate: number;
          total_jobs: number;
        }[];
      };
      get_next_chunk_number: {
        Args: { p_backfill_state_id: string };
        Returns: number;
      };
      get_next_job: {
        Args: Record<PropertyKey, never>;
        Returns: {
          id: string;
          payload: Json;
          type: string;
        }[];
      };
      get_progressive_capture_metrics: {
        Args: { days_back?: number };
        Returns: {
          avg_completion_time_minutes: number;
          completed_jobs: number;
          failed_jobs: number;
          github_actions_jobs: number;
          inngest_jobs: number;
          pending_jobs: number;
          processing_jobs: number;
          total_jobs: number;
        }[];
      };
      get_queue_depth: {
        Args: Record<PropertyKey, never>;
        Returns: {
          job_type: string;
          oldest_queued_minutes: number;
          processing_count: number;
          queued_count: number;
        }[];
      };
      get_recent_auth_errors: {
        Args: { p_limit?: number; p_unresolved_only?: boolean };
        Returns: {
          auth_user_id: string;
          created_at: string;
          error_code: string;
          error_message: string;
          error_type: string;
          github_user_id: number;
          github_username: string;
          id: string;
          resolved: boolean;
        }[];
      };
      get_repositories_by_size: {
        Args: {
          min_priority?: Database['public']['Enums']['repository_priority'];
          target_size?: Database['public']['Enums']['repository_size'];
        };
        Returns: {
          added_by_user_id: string | null;
          created_at: string;
          id: string;
          include_bots: boolean | null;
          include_forks: boolean | null;
          is_workspace_repo: boolean | null;
          last_sync_at: string | null;
          last_updated_at: string | null;
          metrics: Json | null;
          organization_name: string | null;
          priority: Database['public']['Enums']['repository_priority'] | null;
          repository_id: string;
          repository_name: string | null;
          size: Database['public']['Enums']['repository_size'] | null;
          size_calculated_at: string | null;
          sync_frequency_hours: number | null;
          tracking_enabled: boolean | null;
          updated_at: string;
          workspace_count: number | null;
        }[];
      };
      get_repository_confidence_breakdown: {
        Args: { p_repository_name: string; p_repository_owner: string };
        Returns: {
          algorithm_weights: Json;
          contributor_breakdown: Json;
          insights: Json;
          overall_avg_confidence: number;
          repository_name: string;
          repository_owner: string;
        }[];
      };
      get_repository_confidence_summary: {
        Args: Record<PropertyKey, never>;
        Returns: {
          avg_confidence_score: number;
          contributor_count: number;
          external_contributor_count: number;
          last_analysis: string;
          maintainer_count: number;
          repository_name: string;
          repository_owner: string;
          self_selection_rate: number;
        }[];
      };
      get_repository_confidence_summary_simple: {
        Args: Record<PropertyKey, never>;
        Returns: {
          avg_confidence_score: number;
          contributor_count: number;
          external_contributor_count: number;
          last_analysis: string;
          maintainer_count: number;
          repository_name: string;
          repository_owner: string;
          self_selection_rate: number;
        }[];
      };
      get_repository_freshness: {
        Args: { p_repository_id: string };
        Returns: {
          freshness_status: string;
          has_recent_activity: boolean;
          hours_since_update: number;
          last_data_update: string;
        }[];
      };
      get_stuck_job_summary: {
        Args: Record<PropertyKey, never>;
        Returns: {
          needs_attention: boolean;
          oldest_age_minutes: number;
          total_stuck: number;
        }[];
      };
      get_subscription_issues: {
        Args: Record<PropertyKey, never>;
        Returns: {
          email: string;
          subscription_status: string;
          subscription_tier: string;
          user_id: string;
          workspace_id: string;
          workspace_name: string;
          workspace_tier: string;
        }[];
      };
      get_sync_statistics: {
        Args: { days_back?: number; repo_name?: string };
        Returns: {
          avg_execution_time: number;
          failed_syncs: number;
          max_execution_time: number;
          netlify_usage: number;
          successful_syncs: number;
          supabase_usage: number;
          timeouts: number;
          total_syncs: number;
        }[];
      };
      get_trending_repositories: {
        Args: {
          p_language?: string;
          p_limit?: number;
          p_min_stars?: number;
          p_time_period?: unknown;
        };
        Returns: {
          avatar_url: string;
          contributor_change: number;
          description: string;
          html_url: string;
          language: string;
          last_activity: string;
          name: string;
          owner: string;
          pr_change: number;
          repository_id: string;
          star_change: number;
          stars: number;
          trending_score: number;
        }[];
      };
      get_trending_repositories_with_fallback: {
        Args: {
          p_language?: string;
          p_limit?: number;
          p_min_stars?: number;
          p_time_period?: unknown;
        };
        Returns: {
          avatar_url: string;
          contributor_change: number;
          description: string;
          html_url: string;
          language: string;
          last_activity: string;
          name: string;
          owner: string;
          pr_change: number;
          repository_id: string;
          star_change: number;
          stars: number;
          trending_score: number;
        }[];
      };
      get_trending_statistics: {
        Args: { p_time_period?: unknown };
        Returns: {
          avg_trending_score: number;
          top_language: string;
          total_new_contributors: number;
          total_star_growth: number;
          total_trending_repos: number;
        }[];
      };
      get_user_by_github_id: {
        Args: { user_github_id: number };
        Returns: {
          auth_user_id: string;
          avatar_url: string;
          created_at: string;
          display_name: string;
          email: string;
          first_login_at: string;
          github_user_id: number;
          github_username: string;
          id: string;
          is_active: boolean;
          is_admin: boolean;
          last_login_at: string;
          updated_at: string;
        }[];
      };
      get_user_subscription: {
        Args: { p_user_id: string };
        Returns: {
          current_period_end: string;
          status: string;
          subscription_id: string;
          tier: string;
        }[];
      };
      get_user_tier: {
        Args: { user_uuid: string };
        Returns: string;
      };
      get_user_workspace_count: {
        Args: { p_user_id: string };
        Returns: number;
      };
      get_webhook_performance: {
        Args: { p_hours?: number };
        Returns: {
          avg_duration_seconds: number;
          avg_workspaces: number;
          event_type: string;
          p95_duration_seconds: number;
          source: string;
          success_rate: number;
          total_count: number;
        }[];
      };
      get_workspace_activity_velocity: {
        Args: { p_days?: number; p_workspace_id: string };
        Returns: {
          daily_average: number;
          fork_velocity: number;
          growth_trend: string;
          peak_activity_count: number;
          peak_activity_date: string;
          period_end: string;
          period_start: string;
          star_velocity: number;
          total_events: number;
        }[];
      };
      get_workspace_event_metrics_aggregated: {
        Args: {
          p_end_date: string;
          p_start_date: string;
          p_workspace_id: string;
        };
        Returns: {
          daily_timeline: Json;
          most_active_repo_events: number;
          most_active_repo_name: string;
          most_active_repo_owner: string;
          total_fork_events: number;
          total_issue_events: number;
          total_pr_events: number;
          total_star_events: number;
          unique_actors: number;
        }[];
      };
      get_workspace_repos_for_sync: {
        Args: { p_limit?: number };
        Returns: {
          last_sync_at: string;
          priority_score: number;
          repository_id: string;
          repository_name: string;
          tracked_repository_id: string;
          workspace_id: string;
        }[];
      };
      get_workspace_repository_event_summaries: {
        Args: {
          p_end_date: string;
          p_start_date: string;
          p_workspace_id: string;
        };
        Returns: {
          fork_events: number;
          last_activity: string;
          repository_name: string;
          repository_owner: string;
          star_events: number;
          total_events: number;
          unique_actors: number;
        }[];
      };
      get_workspace_role: {
        Args: { user_uuid: string; workspace_uuid: string };
        Returns: string;
      };
      get_workspace_stats_freshness: {
        Args: Record<PropertyKey, never>;
        Returns: {
          last_refresh: string;
          staleness_seconds: number;
          total_workspaces: number;
        }[];
      };
      grant_user_role: {
        Args: {
          granted_by_username: string;
          role_name: string;
          target_username: string;
        };
        Returns: boolean;
      };
      halfvec_avg: {
        Args: { '': number[] };
        Returns: unknown;
      };
      halfvec_out: {
        Args: { '': unknown };
        Returns: unknown;
      };
      halfvec_send: {
        Args: { '': unknown };
        Returns: string;
      };
      halfvec_typmod_in: {
        Args: { '': unknown[] };
        Returns: number;
      };
      hnsw_bit_support: {
        Args: { '': unknown };
        Returns: unknown;
      };
      hnsw_halfvec_support: {
        Args: { '': unknown };
        Returns: unknown;
      };
      hnsw_sparsevec_support: {
        Args: { '': unknown };
        Returns: unknown;
      };
      hnswhandler: {
        Args: { '': unknown };
        Returns: unknown;
      };
      http: {
        Args: { request: Database['public']['CompositeTypes']['http_request'] };
        Returns: Database['public']['CompositeTypes']['http_response'];
      };
      http_delete: {
        Args: { content: string; content_type: string; uri: string } | { uri: string };
        Returns: Database['public']['CompositeTypes']['http_response'];
      };
      http_get: {
        Args: { data: Json; uri: string } | { uri: string };
        Returns: Database['public']['CompositeTypes']['http_response'];
      };
      http_head: {
        Args: { uri: string };
        Returns: Database['public']['CompositeTypes']['http_response'];
      };
      http_header: {
        Args: { field: string; value: string };
        Returns: Database['public']['CompositeTypes']['http_header'];
      };
      http_list_curlopt: {
        Args: Record<PropertyKey, never>;
        Returns: {
          curlopt: string;
          value: string;
        }[];
      };
      http_patch: {
        Args: { content: string; content_type: string; uri: string };
        Returns: Database['public']['CompositeTypes']['http_response'];
      };
      http_post: {
        Args: { content: string; content_type: string; uri: string } | { data: Json; uri: string };
        Returns: Database['public']['CompositeTypes']['http_response'];
      };
      http_put: {
        Args: { content: string; content_type: string; uri: string };
        Returns: Database['public']['CompositeTypes']['http_response'];
      };
      http_reset_curlopt: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      http_set_curlopt: {
        Args: { curlopt: string; value: string };
        Returns: boolean;
      };
      increment_cache_access: {
        Args: { cache_id: string };
        Returns: undefined;
      };
      increment_embedding_job_progress: {
        Args: { increment_count: number; job_id: string };
        Returns: undefined;
      };
      is_avatar_cache_valid: {
        Args: { cached_at: string; expires_at: string };
        Returns: boolean;
      };
      is_bot_user: {
        Args: { user_id: string };
        Returns: boolean;
      };
      is_pr_data_stale: {
        Args: { last_sync: string; max_age_minutes?: number };
        Returns: boolean;
      };
      is_repository_eligible_for_rollout: {
        Args: { feature_name?: string; repo_id: string };
        Returns: boolean;
      };
      is_user_admin: {
        Args: { user_github_id: number } | { user_github_username: string };
        Returns: boolean;
      };
      is_workspace_admin_or_owner: {
        Args: { user_uuid: string; workspace_uuid: string };
        Returns: boolean;
      };
      is_workspace_member: {
        Args: { user_uuid: string; workspace_uuid: string };
        Returns: boolean;
      };
      ivfflat_bit_support: {
        Args: { '': unknown };
        Returns: unknown;
      };
      ivfflat_halfvec_support: {
        Args: { '': unknown };
        Returns: unknown;
      };
      ivfflathandler: {
        Args: { '': unknown };
        Returns: unknown;
      };
      l2_norm: {
        Args: { '': unknown } | { '': unknown };
        Returns: number;
      };
      l2_normalize: {
        Args: { '': string } | { '': unknown } | { '': unknown };
        Returns: string;
      };
      log_admin_action: {
        Args: {
          p_action_type: string;
          p_admin_github_id: number;
          p_details?: Json;
          p_ip_address?: unknown;
          p_target_id?: string;
          p_target_type?: string;
          p_user_agent?: string;
        };
        Returns: string;
      };
      log_auth_error: {
        Args: {
          p_auth_user_id?: string;
          p_error_code?: string;
          p_error_message?: string;
          p_error_type?: string;
          p_github_user_id?: number;
          p_github_username?: string;
          p_ip_address?: unknown;
          p_user_agent?: string;
        };
        Returns: string;
      };
      log_gdpr_processing: {
        Args: {
          p_data_categories: string[];
          p_legal_basis: string;
          p_notes?: string;
          p_purpose: string;
          p_user_id: string;
        };
        Returns: string;
      };
      mark_workspace_cache_stale: {
        Args: { p_workspace_id: string };
        Returns: undefined;
      };
      move_to_dead_letter_queue: {
        Args: { job_id: string };
        Returns: undefined;
      };
      override_contributor_role: {
        Args: {
          p_admin_github_id: number;
          p_lock?: boolean;
          p_new_role: string;
          p_reason?: string;
          p_repository_name: string;
          p_repository_owner: string;
          p_user_id: string;
        };
        Returns: undefined;
      };
      parse_codeowners_rules: {
        Args: { content: string };
        Returns: Json;
      };
      purge_old_file_data: {
        Args: Record<PropertyKey, never>;
        Returns: {
          purged_contributors: number;
          purged_embeddings: number;
          purged_insights: number;
        }[];
      };
      refresh_all_repository_pull_request_counts: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      refresh_all_workspace_preview_stats: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      refresh_contribution_stats: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      refresh_contributor_stats: {
        Args: { contributor_uuid?: string };
        Returns: undefined;
      };
      refresh_workspace_preview_stats: {
        Args: { p_workspace_id: string };
        Returns: undefined;
      };
      resolve_auth_error: {
        Args: { p_error_id: string; p_resolved_by?: string };
        Returns: boolean;
      };
      retry_failed_job: {
        Args: { job_id: string };
        Returns: boolean;
      };
      run_data_consistency_checks: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      should_use_supabase: {
        Args: { repo_name: string };
        Returns: boolean;
      };
      sparsevec_out: {
        Args: { '': unknown };
        Returns: unknown;
      };
      sparsevec_send: {
        Args: { '': unknown };
        Returns: string;
      };
      sparsevec_typmod_in: {
        Args: { '': unknown[] };
        Returns: number;
      };
      text_to_bytea: {
        Args: { data: string };
        Returns: string;
      };
      trigger_workspace_invitation_email: {
        Args: { invitation_id_param: string };
        Returns: Json;
      };
      update_avatar_cache: {
        Args: {
          cache_duration_days?: number;
          contributor_github_id: number;
          new_avatar_url: string;
        };
        Returns: undefined;
      };
      update_embedding_job_progress: {
        Args: { job_id: string; processed_count: number };
        Returns: undefined;
      };
      update_repository_pull_request_count: {
        Args: { repository_uuid: string };
        Returns: undefined;
      };
      update_workspace_sync_status: {
        Args: {
          p_error?: string;
          p_status: string;
          p_tracked_repository_id: string;
          p_workspace_id: string;
        };
        Returns: undefined;
      };
      upsert_app_user: {
        Args: {
          p_auth_user_id: string;
          p_avatar_url?: string;
          p_display_name?: string;
          p_email?: string;
          p_github_user_id: number;
          p_github_username: string;
        };
        Returns: string;
      };
      urlencode: {
        Args: { data: Json } | { string: string } | { string: string };
        Returns: string;
      };
      user_has_email_consent: {
        Args: { p_email_type: string; p_user_id: string };
        Returns: boolean;
      };
      user_has_role: {
        Args: { role_name: string; user_github_username: string };
        Returns: boolean;
      };
      vector_avg: {
        Args: { '': number[] };
        Returns: string;
      };
      vector_dims: {
        Args: { '': string } | { '': unknown };
        Returns: number;
      };
      vector_norm: {
        Args: { '': string };
        Returns: number;
      };
      vector_out: {
        Args: { '': string };
        Returns: unknown;
      };
      vector_send: {
        Args: { '': string };
        Returns: string;
      };
      vector_typmod_in: {
        Args: { '': unknown[] };
        Returns: number;
      };
      withdraw_email_consent: {
        Args: { p_user_id: string };
        Returns: boolean;
      };
    };
    Enums: {
      repository_priority: 'high' | 'medium' | 'low';
      repository_size: 'small' | 'medium' | 'large' | 'xl';
    };
    CompositeTypes: {
      http_header: {
        field: string | null;
        value: string | null;
      };
      http_request: {
        method: unknown | null;
        uri: string | null;
        headers: Database['public']['CompositeTypes']['http_header'][] | null;
        content_type: string | null;
        content: string | null;
      };
      http_response: {
        status: number | null;
        content_type: string | null;
        headers: Database['public']['CompositeTypes']['http_header'][] | null;
        content: string | null;
      };
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      repository_priority: ['high', 'medium', 'low'],
      repository_size: ['small', 'medium', 'large', 'xl'],
    },
  },
} as const;
