-- Minimal existing-table contracts; the real new schema comes from the migration.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE TABLE auth.identities(user_id uuid REFERENCES auth.users(id),provider text,provider_id text);
CREATE TABLE public.app_users(id uuid PRIMARY KEY,auth_user_id uuid UNIQUE REFERENCES auth.users(id));
CREATE TABLE public.workspaces(id uuid PRIMARY KEY,name text,owner_id uuid REFERENCES app_users(id),is_active boolean DEFAULT true,tier text);
CREATE TABLE public.workspace_members(id uuid DEFAULT gen_random_uuid(),workspace_id uuid REFERENCES workspaces(id),user_id uuid REFERENCES app_users(id),role text CHECK(role IN ('owner','admin','editor','viewer')),invited_by uuid REFERENCES app_users(id),accepted_at timestamptz,UNIQUE(workspace_id,user_id));
CREATE TABLE public.repositories(id uuid PRIMARY KEY,full_name text,is_private boolean DEFAULT false);
CREATE TABLE public.workspace_repositories(workspace_id uuid,repository_id uuid);
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE ON SCHEMA auth TO service_role;
