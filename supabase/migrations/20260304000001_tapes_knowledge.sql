-- Migration: Distilled knowledge from StarSearch sessions
-- Background job summarizes raw sessions into structured insights for faster recall

CREATE TABLE IF NOT EXISTS public.tapes_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project text NOT NULL,              -- "{owner}/{repo}"
  insight_type text NOT NULL CHECK (insight_type IN ('trend', 'recommendation', 'fact', 'observation')),
  content text NOT NULL,              -- Natural language insight
  metadata jsonb DEFAULT '{}'::jsonb, -- Supporting data (scores, dates, sources)
  source_sessions uuid[] DEFAULT '{}',-- Session IDs this was distilled from
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz              -- TTL for stale knowledge
);

-- Indexes for knowledge queries
CREATE INDEX IF NOT EXISTS idx_tapes_knowledge_project ON public.tapes_knowledge (project);
CREATE INDEX IF NOT EXISTS idx_tapes_knowledge_project_type ON public.tapes_knowledge (project, insight_type);
CREATE INDEX IF NOT EXISTS idx_tapes_knowledge_expires ON public.tapes_knowledge (expires_at) WHERE expires_at IS NOT NULL;

-- Admin-only RLS: service_role can read/write, no public access
ALTER TABLE public.tapes_knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access" ON public.tapes_knowledge
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE public.tapes_knowledge IS 'Distilled knowledge insights from StarSearch session history';
COMMENT ON COLUMN public.tapes_knowledge.insight_type IS 'Category: trend, recommendation, fact, or observation';
COMMENT ON COLUMN public.tapes_knowledge.source_sessions IS 'References to tapes_sessions.id rows this insight was derived from';
