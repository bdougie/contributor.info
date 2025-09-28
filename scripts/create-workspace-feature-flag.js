#!/usr/bin/env node

/**
 * Script to create a feature flag for workspace creation tied to the Internal Team cohort
 * Run with: node scripts/create-workspace-feature-flag.js
 */

import dotenv from 'dotenv';
import fetch from 'node-fetch';

// Load environment variables
dotenv.config();

const POSTHOG_API_KEY = process.env.POSTHOG_PERSONAL_API_KEY;
const POSTHOG_PROJECT_ID =
  process.env.POSTHOG_PROJECT_ID || process.env.VITE_POSTHOG_PROJECT_ID || '173101';
const POSTHOG_HOST = process.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

if (!POSTHOG_API_KEY) {
  console.error('❌ POSTHOG_PERSONAL_API_KEY not found in environment variables');
  console.log('Please add it to your .env file');
  process.exit(1);
}

// Get cohort ID from environment or use a placeholder
const INTERNAL_TEAM_COHORT_ID =
  process.env.POSTHOG_INTERNAL_TEAM_COHORT_ID || 'REPLACE_WITH_COHORT_ID';

if (INTERNAL_TEAM_COHORT_ID === 'REPLACE_WITH_COHORT_ID') {
  console.warn('⚠️  Warning: POSTHOG_INTERNAL_TEAM_COHORT_ID not set in environment');
  console.log('   You need to:');
  console.log('   1. Run scripts/create-internal-users-cohort.js first to create the cohort');
  console.log('   2. Note the cohort ID from the output');
  console.log('   3. Set POSTHOG_INTERNAL_TEAM_COHORT_ID in your .env file');
  console.log('');
}

// Feature flag configuration
const FEATURE_FLAG = {
  key: 'enable_workspace_creation',
  name: 'Enable Workspace Creation',
  description:
    'Allows users to create and manage workspaces. Currently enabled for internal team only.',
  active: true,
  ensure_experience_continuity: false, // Users can move in/out of the flag as conditions change
  rollout_percentage: null, // Not using percentage rollout, using cohort targeting
  filters: {
    groups: [
      {
        properties: [
          {
            key: 'id',
            type: 'cohort',
            value: parseInt(INTERNAL_TEAM_COHORT_ID) || 0, // Internal Team cohort ID from env
            operator: null,
          },
        ],
        rollout_percentage: 100, // 100% of users in the cohort get the feature
      },
    ],
    multivariate: null,
    payloads: {},
  },
};

async function getFeatureFlags() {
  try {
    const response = await fetch(
      `${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/feature_flags/`,
      {
        headers: {
          Authorization: `Bearer ${POSTHOG_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch feature flags: ${response.statusText}`);
    }

    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error('Error fetching feature flags:', error);
    return [];
  }
}

async function createOrUpdateFeatureFlag(flagDef, existingFlagId = null) {
  try {
    const method = existingFlagId ? 'PATCH' : 'POST';
    const url = existingFlagId
      ? `${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/feature_flags/${existingFlagId}/`
      : `${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/feature_flags/`;

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${POSTHOG_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(flagDef),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to ${existingFlagId ? 'update' : 'create'} feature flag: ${response.statusText} - ${errorText}`
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error ${existingFlagId ? 'updating' : 'creating'} feature flag:`, error.message);
    return null;
  }
}

async function main() {
  console.log('🚀 Creating Workspace Creation Feature Flag...');
  console.log(`📍 PostHog Host: ${POSTHOG_HOST}`);
  console.log(`📁 Project ID: ${POSTHOG_PROJECT_ID}`);
  console.log('');

  console.log('🎛️  Feature Flag Configuration:');
  console.log(`   Key: ${FEATURE_FLAG.key}`);
  console.log(`   Name: ${FEATURE_FLAG.name}`);
  console.log(`   Target: Internal Team cohort (ID: ${INTERNAL_TEAM_COHORT_ID})`);
  console.log('');

  // Get existing feature flags
  console.log('📋 Checking for existing feature flags...');
  const existingFlags = await getFeatureFlags();
  const existingFlag = existingFlags.find((f) => f.key === FEATURE_FLAG.key);

  if (existingFlag) {
    console.log(`📝 Found existing "${FEATURE_FLAG.key}" flag (ID: ${existingFlag.id})`);
    console.log('   Updating with latest configuration...');

    const result = await createOrUpdateFeatureFlag(FEATURE_FLAG, existingFlag.id);
    if (result) {
      console.log(`   ✅ Updated successfully!`);
    } else {
      console.log(`   ❌ Failed to update`);
    }
  } else {
    console.log(`📊 Creating new "${FEATURE_FLAG.key}" feature flag...`);

    const result = await createOrUpdateFeatureFlag(FEATURE_FLAG);
    if (result) {
      console.log(`   ✅ Created successfully with ID: ${result.id}`);
    } else {
      console.log(`   ❌ Failed to create`);
    }
  }

  console.log('');
  console.log('✨ Complete!');
  console.log('');
  console.log('📝 Implementation in your React app:');
  console.log('');
  console.log('```typescript');
  console.log('// In your component or hook:');
  console.log('import { useFeatureFlag } from "@/hooks/use-feature-flag";');
  console.log('');
  console.log('function WorkspaceSection() {');
  console.log('  const canCreateWorkspace = useFeatureFlag("enable_workspace_creation");');
  console.log('');
  console.log('  return (');
  console.log('    <div>');
  console.log('      {canCreateWorkspace && (');
  console.log('        <Button onClick={handleCreateWorkspace}>');
  console.log('          Create New Workspace');
  console.log('        </Button>');
  console.log('      )}');
  console.log('    </div>');
  console.log('  );');
  console.log('}');
  console.log('```');
  console.log('');
  console.log('🔧 To modify who gets this feature:');
  console.log('   1. Visit PostHog > Feature Flags > enable_workspace_creation');
  console.log('   2. Add more conditions or cohorts');
  console.log('   3. Or run this script again after modifying the configuration');
}

// Run the script
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
