-- Enable the update_last_updated trigger that was previously disabled
-- This fixes the issue where PR updates weren't updating the last_updated timestamp

-- Enable the trigger for pull_requests table
ALTER TABLE pull_requests
ENABLE TRIGGER update_last_updated;

-- Verify the trigger is working by updating the last_updated field for all existing records
-- This ensures consistency and tests the trigger
UPDATE pull_requests
SET last_updated = COALESCE(updated_at, created_at, NOW())
WHERE last_updated IS NULL;

-- Add comment explaining the trigger's purpose
COMMENT ON TRIGGER update_last_updated ON pull_requests IS 'Automatically updates last_updated timestamp on row updates';