-- Minimal isolated schema for testing this migration without a production connection.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
GRANT USAGE ON SCHEMA auth TO authenticated, anon;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated, anon;
CREATE TABLE public.app_users(id uuid PRIMARY KEY, auth_user_id uuid REFERENCES auth.users);
CREATE TABLE public.workspaces(id uuid PRIMARY KEY, name text, owner_id uuid, is_active boolean);
CREATE TABLE public.workspace_members(workspace_id uuid, user_id uuid, accepted_at timestamptz);
CREATE TABLE public.repositories(id uuid PRIMARY KEY, full_name text);
CREATE TABLE public.workspace_repositories(workspace_id uuid, repository_id uuid);
