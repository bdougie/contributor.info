-- Create function for atomic increment of repository count
CREATE OR REPLACE FUNCTION increment_repository_count(workspace_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
  new_count INTEGER;
BEGIN
  UPDATE workspaces 
  SET current_repository_count = COALESCE(current_repository_count, 0) + 1,
      updated_at = NOW()
  WHERE id = workspace_uuid
  RETURNING current_repository_count INTO new_count;
  
  RETURN new_count;
END;
$$ LANGUAGE plpgsql;

-- Create function for atomic decrement of repository count
CREATE OR REPLACE FUNCTION decrement_repository_count(workspace_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
  new_count INTEGER;
BEGIN
  UPDATE workspaces 
  SET current_repository_count = GREATEST(COALESCE(current_repository_count, 0) - 1, 0),
      updated_at = NOW()
  WHERE id = workspace_uuid
  RETURNING current_repository_count INTO new_count;
  
  RETURN new_count;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update counts on workspace_repositories changes
CREATE OR REPLACE FUNCTION update_workspace_repo_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM increment_repository_count(NEW.workspace_id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM decrement_repository_count(OLD.workspace_id);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS workspace_repo_count_trigger ON workspace_repositories;

-- Create trigger
CREATE TRIGGER workspace_repo_count_trigger
AFTER INSERT OR DELETE ON workspace_repositories
FOR EACH ROW
EXECUTE FUNCTION update_workspace_repo_count();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION increment_repository_count(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION decrement_repository_count(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION update_workspace_repo_count() TO service_role;