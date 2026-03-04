-- Migration: Tapes session storage for StarSearch memory
-- Stores raw session summaries captured from tapes proxy for session recall

CREATE TABLE IF NOT EXISTS public.tapes_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project text NOT NULL,              -- "{owner}/{repo}" from X-Tapes-Session
  app text NOT NULL DEFAULT 'contributor-info',  -- X-Tapes-App
  session_hash text,                  -- tapes node hash for traceability
  role text NOT NULL,                 -- "user" or "assistant"
  content text NOT NULL,              -- message content (plain text summary)
  model text,                         -- LLM model used
  token_count integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for recall queries
CREATE INDEX IF NOT EXISTS idx_tapes_sessions_project ON public.tapes_sessions (project);
CREATE INDEX IF NOT EXISTS idx_tapes_sessions_project_created ON public.tapes_sessions (project, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tapes_sessions_app ON public.tapes_sessions (app);

-- Admin-only RLS: service_role can read/write, no public access
ALTER TABLE public.tapes_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access" ON public.tapes_sessions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE public.tapes_sessions IS 'Raw session messages captured from tapes proxy for StarSearch memory';
COMMENT ON COLUMN public.tapes_sessions.project IS 'Repository identifier in owner/repo format from X-Tapes-Session header';
