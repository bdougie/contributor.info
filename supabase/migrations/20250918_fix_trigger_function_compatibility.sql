-- Fix the update_last_updated_column function to handle both field names
-- This ensures compatibility with tables that use either last_updated or last_updated_at

CREATE OR REPLACE FUNCTION update_last_updated_column()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if the table has last_updated_at column
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = TG_TABLE_NAME
      AND column_name = 'last_updated_at'
      AND table_schema = TG_TABLE_SCHEMA
  ) THEN
    NEW.last_updated_at = NOW();
  -- Otherwise check for last_updated column
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = TG_TABLE_NAME
      AND column_name = 'last_updated'
      AND table_schema = TG_TABLE_SCHEMA
  ) THEN
    NEW.last_updated = NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- This function is now compatible with both naming conventions used in the database