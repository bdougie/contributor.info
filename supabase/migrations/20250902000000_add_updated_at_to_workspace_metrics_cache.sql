-- Add updated_at column to workspace_metrics_cache table
ALTER TABLE workspace_metrics_cache 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create or replace the trigger to automatically update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the trigger if it exists and create it
DROP TRIGGER IF EXISTS update_workspace_metrics_cache_updated_at ON workspace_metrics_cache;

CREATE TRIGGER update_workspace_metrics_cache_updated_at
BEFORE UPDATE ON workspace_metrics_cache
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Update any existing rows to have the current timestamp
UPDATE workspace_metrics_cache 
SET updated_at = COALESCE(created_at, NOW())
WHERE updated_at IS NULL;