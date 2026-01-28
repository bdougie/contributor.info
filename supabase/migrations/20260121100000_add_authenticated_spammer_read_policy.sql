-- Migration: Add RLS policy for authenticated users to read all known_spammers
-- Issue: #1622 - Known Spammer Community Database
--
-- Current state: Only verified spammers are readable by anyone
-- New state: Authenticated users can read ALL spammers (for admin panel)
--           Anonymous users can only read verified spammers (public leaderboard)
--
-- Note: The UI additionally gates the public leaderboard to show only #1 spammer
-- for non-logged-in users, requiring login to see the full list.

-- Add policy for authenticated users to read all spammers
CREATE POLICY "Authenticated users can read all spammers"
  ON public.known_spammers
  FOR SELECT
  TO authenticated
  USING (true);

-- Add comment documenting the policy
COMMENT ON POLICY "Authenticated users can read all spammers" ON public.known_spammers IS
  'Allows authenticated users to see all spammers including unverified (for admin review). Anonymous users are limited to verified spammers only via separate policy.';
