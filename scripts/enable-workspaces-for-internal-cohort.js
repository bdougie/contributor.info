#!/usr/bin/env node

/**
 * Script to enable workspace features at 100% for the Internal Team cohort
 * Run with: node scripts/enable-workspaces-for-internal-cohort.js
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

// Feature flag configurations for workspace features
const WORKSPACE_FEATURE_FLAGS = [
  {
    key: 'enable_workspaces',
    name: 'Enable Workspaces',
    description: 'Controls entire workspace feature visibility. Enabled at 100% for internal team.',
    active: true,
    ensure_experience_continuity: false,
  },
  {
    key: 'enable_workspace_creation',
    name: 'Enable Workspace Creation',
    description: 'Controls workspace creation functionality. Enabled at 100% for internal team.',
    active: true,
    ensure_experience_continuity: false,
  },
];

async function getCohorts() {
  try {
    const response = await fetch(`${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/cohorts/`, {
      headers: {
        Authorization: `Bearer ${POSTHOG_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch cohorts: ${response.statusText}`);
    }

    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error('Error fetching cohorts:', error);
    return [];
  }
}

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

async function createOrUpdateFeatureFlag(flagDef, cohortId, existingFlagId = null) {
  try {
    const method = existingFlagId ? 'PATCH' : 'POST';
    const url = existingFlagId
      ? `${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/feature_flags/${existingFlagId}/`
      : `${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/feature_flags/`;

    const body = {
      ...flagDef,
      filters: {
        groups: [
          {
            properties: [
              {
                key: 'id',
                type: 'cohort',
                value: parseInt(cohortId),
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

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${POSTHOG_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
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
  console.log('🚀 Enabling Workspace Features for Internal Team Cohort...');
  console.log(`📍 PostHog Host: ${POSTHOG_HOST}`);
  console.log(`📁 Project ID: ${POSTHOG_PROJECT_ID}`);
  console.log('');

  // Get Internal Team cohort
  console.log('🔍 Finding Internal Team cohort...');
  const cohorts = await getCohorts();
  const internalCohort = cohorts.find((c) => c.name === 'Internal Team');

  if (!internalCohort) {
    console.error('❌ Internal Team cohort not found!');
    console.log('');
    console.log('Please run the following command first:');
    console.log('  node scripts/create-internal-users-cohort.js');
    console.log('');
    process.exit(1);
  }

  console.log(`✅ Found Internal Team cohort (ID: ${internalCohort.id})`);
  console.log('');

  // Get existing feature flags
  console.log('📋 Checking existing feature flags...');
  const existingFlags = await getFeatureFlags();

  // Process each workspace feature flag
  for (const flagDef of WORKSPACE_FEATURE_FLAGS) {
    console.log(`\n🎛️  Processing: ${flagDef.key}`);
    console.log(`   Description: ${flagDef.description}`);

    const existingFlag = existingFlags.find((f) => f.key === flagDef.key);

    if (existingFlag) {
      console.log(`   📝 Found existing flag (ID: ${existingFlag.id})`);
      console.log('   Updating to 100% for Internal Team cohort...');

      const result = await createOrUpdateFeatureFlag(flagDef, internalCohort.id, existingFlag.id);
      if (result) {
        console.log(`   ✅ Updated successfully!`);
      } else {
        console.log(`   ❌ Failed to update`);
      }
    } else {
      console.log(`   📊 Creating new feature flag...`);

      const result = await createOrUpdateFeatureFlag(flagDef, internalCohort.id);
      if (result) {
        console.log(`   ✅ Created successfully with ID: ${result.id}`);
      } else {
        console.log(`   ❌ Failed to create`);
      }
    }
  }

  console.log('');
  console.log('✨ Complete!');
  console.log('');
  console.log('📝 Summary:');
  console.log('   - enable_workspaces: 100% enabled for Internal Team');
  console.log('   - enable_workspace_creation: 100% enabled for Internal Team');
  console.log('');
  console.log('👥 Internal Team members who will see workspaces:');
  console.log('   - bdougie (Brian Douglas)');
  console.log('   - babbley');
  console.log('   - Any user with internal_user=true property');
  console.log('');
  console.log('🔧 To add more team members:');
  console.log('   1. Edit INTERNAL_USERS in scripts/create-internal-users-cohort.js');
  console.log('   2. Run: node scripts/create-internal-users-cohort.js');
  console.log('   3. The feature flags will automatically apply to new cohort members');
  console.log('');
  console.log('🌐 To verify in the app:');
  console.log('   1. Make sure you are logged in as an internal team member');
  console.log('   2. Visit http://localhost:5173/');
  console.log('   3. You should see workspace features on the homepage');
  console.log('   4. You can access /i/demo and /workspaces/new routes');
}

// Run the script
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
