-- Add CODEOWNERS tables for storing and managing repository CODEOWNERS files
-- Migration: 20250928_add_codeowners_tables

-- Create codeowners table to store actual CODEOWNERS file content from repositories
CREATE TABLE IF NOT EXISTS codeowners (
    id BIGSERIAL PRIMARY KEY,
    repository_id TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    file_path TEXT NOT NULL, -- Path where CODEOWNERS file was found (.github/CODEOWNERS, CODEOWNERS, etc.)
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ensure only one CODEOWNERS file per repository (latest one)
    UNIQUE(repository_id)
);

-- Create codeowners_suggestions table to cache AI-generated CODEOWNERS suggestions
CREATE TABLE IF NOT EXISTS codeowners_suggestions (
    id BIGSERIAL PRIMARY KEY,
    repository_id TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    suggestions JSONB NOT NULL, -- Array of suggestion objects with pattern, owners, confidence, reasoning
    generated_content TEXT NOT NULL, -- Formatted CODEOWNERS file content
    total_contributors INTEGER NOT NULL DEFAULT 0,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL, -- When these suggestions expire and should be regenerated
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ensure only one set of suggestions per repository (cache)
    UNIQUE(repository_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_codeowners_repository_id ON codeowners(repository_id);
CREATE INDEX IF NOT EXISTS idx_codeowners_fetched_at ON codeowners(fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_codeowners_suggestions_repository_id ON codeowners_suggestions(repository_id);
CREATE INDEX IF NOT EXISTS idx_codeowners_suggestions_expires_at ON codeowners_suggestions(expires_at);

-- Add updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_codeowners_updated_at BEFORE UPDATE ON codeowners
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_codeowners_suggestions_updated_at BEFORE UPDATE ON codeowners_suggestions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add Row Level Security (RLS) policies
ALTER TABLE codeowners ENABLE ROW LEVEL SECURITY;
ALTER TABLE codeowners_suggestions ENABLE ROW LEVEL SECURITY;

-- Public read access for codeowners (same as repositories table)
CREATE POLICY "codeowners_public_read" ON codeowners
    FOR SELECT USING (true);

-- Only service role can insert/update/delete codeowners data
CREATE POLICY "codeowners_service_write" ON codeowners
    FOR ALL USING (auth.role() = 'service_role');

-- Public read access for codeowners_suggestions
CREATE POLICY "codeowners_suggestions_public_read" ON codeowners_suggestions
    FOR SELECT USING (true);

-- Only service role can insert/update/delete suggestions
CREATE POLICY "codeowners_suggestions_service_write" ON codeowners_suggestions
    FOR ALL USING (auth.role() = 'service_role');

-- Add comments for documentation
COMMENT ON TABLE codeowners IS 'Stores actual CODEOWNERS file content fetched from repositories';
COMMENT ON TABLE codeowners_suggestions IS 'Caches AI-generated CODEOWNERS suggestions with expiration';
COMMENT ON COLUMN codeowners.content IS 'Raw CODEOWNERS file content';
COMMENT ON COLUMN codeowners.file_path IS 'File path where CODEOWNERS was found in repo';
COMMENT ON COLUMN codeowners_suggestions.suggestions IS 'JSON array of suggestion objects';
COMMENT ON COLUMN codeowners_suggestions.generated_content IS 'Ready-to-use CODEOWNERS file content';
COMMENT ON COLUMN codeowners_suggestions.expires_at IS 'When to regenerate these suggestions';