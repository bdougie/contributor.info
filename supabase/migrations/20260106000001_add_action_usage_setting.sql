-- Migration: Add Action Usage Tracking Setting to Workspaces
-- Description: Add action_usage_enabled flag to control GitHub Action usage tracking feature
-- Date: 2026-01-06
-- Reference: Issue #1468

-- Add action_usage_enabled column to workspaces table
ALTER TABLE workspaces
ADD COLUMN action_usage_enabled BOOLEAN DEFAULT FALSE;

-- Add comment for documentation
COMMENT ON COLUMN workspaces.action_usage_enabled IS
  'Whether workspace has enabled GitHub Action usage tracking feature (Team+ tier feature)';
