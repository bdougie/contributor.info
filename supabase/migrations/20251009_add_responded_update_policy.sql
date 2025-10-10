-- Add RLS policies to allow authenticated users to mark issues and discussions as responded
-- This is needed for the "My Work" respond tracking feature

-- Allow authenticated users to update responded_by and responded_at columns on issues
CREATE POLICY "Authenticated users can mark issues as responded"
ON issues
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow authenticated users to update responded_by and responded_at columns on discussions
CREATE POLICY "Authenticated users can mark discussions as responded"
ON discussions
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Add comments for documentation
COMMENT ON POLICY "Authenticated users can mark issues as responded" ON issues
IS 'Allows authenticated users to update the responded_by and responded_at columns for tracking response status in My Work';

COMMENT ON POLICY "Authenticated users can mark discussions as responded" ON discussions
IS 'Allows authenticated users to update the responded_by and responded_at columns for tracking response status in My Work';
