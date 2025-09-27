-- Local-safe version of 20250104_add_chunk_sequence.sql
-- Generated: 2025-08-27T02:47:08.036Z
-- This migration has been modified to work without auth, roles, and extensions
-- Original migration may have different behavior in production

-- Transaction wrapper for safety
BEGIN;

-- Create a sequence for atomic chunk number generation
CREATE SEQUENCE IF NOT EXISTS backfill_chunk_number_seq;

-- Add a function to get the next chunk number atomically
CREATE OR REPLACE FUNCTION get_next_chunk_number(p_backfill_state_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_chunk_number INTEGER;
BEGIN
  -- Get the next value from the sequence
  v_chunk_number := nextval('backfill_chunk_number_seq');
  
  -- Optionally, we could also track per-backfill sequences in a table
  -- This would allow resetting sequences per backfill if needed
  
  RETURN v_chunk_number;
END;
$$ LANGUAGE plpgsql;

-- Add comment explaining the function
COMMENT ON FUNCTION get_next_chunk_number(UUID) IS 
'Returns an atomically incremented chunk number for backfill operations, preventing race conditions when multiple workers process chunks simultaneously';

COMMIT;
