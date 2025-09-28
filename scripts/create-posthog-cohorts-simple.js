#!/usr/bin/env node

/**
 * Script to create simple cohorts in PostHog based on user properties
 * Run with: node scripts/create-posthog-cohorts-simple.js
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

// Simplified cohort definitions using user properties
const COHORT_DEFINITIONS = [
  {
    name: 'Users with Workspaces',
    description: 'Users who have created at least one workspace',
    filters: {
      properties: {
        type: 'AND',
        values: [
          {
            type: 'person',
            key: 'has_workspace',
            value: true,
            operator: 'exact',
          },
        ],
      },
    },
  },
  {
    name: 'Users with Multiple Repos',
    description: 'Users tracking multiple repositories',
    filters: {
      properties: {
        type: 'AND',
        values: [
          {
            type: 'person',
            key: 'tracked_repos_count',
            value: 3,
            operator: 'gte',
          },
        ],
      },
    },
  },
  {
    name: 'Active Users Last 7 Days',
    description: 'Users who have been active in the last 7 days',
    filters: {
      properties: {
        type: 'AND',
        values: [
          {
            type: 'person',
            key: '$last_seen',
            value: '7d',
            operator: 'is_date_after',
          },
        ],
      },
    },
  },
  {
    name: 'High Engagement Users',
    description: 'Users with high cohort count indicating multiple behaviors',
    filters: {
      properties: {
        type: 'AND',
        values: [
          {
            type: 'person',
            key: 'cohort_count',
            value: 2,
            operator: 'gte',
          },
        ],
      },
    },
  },
  {
    name: 'Users with Primary Cohort',
    description: 'Users who have been assigned a primary cohort',
    filters: {
      properties: {
        type: 'AND',
        values: [
          {
            type: 'person',
            key: 'primary_cohort',
            value: 'null',
            operator: 'is_not',
          },
        ],
      },
    },
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

async function createCohort(cohortDef) {
  try {
    const response = await fetch(`${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/cohorts/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${POSTHOG_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: cohortDef.name,
        description: cohortDef.description,
        filters: cohortDef.filters,
        is_static: false, // Dynamic cohort that updates automatically
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create cohort: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error creating cohort ${cohortDef.name}:`, error.message);
    return null;
  }
}

async function main() {
  console.log('🚀 Starting PostHog cohort creation (simplified version)...');
  console.log(`📍 PostHog Host: ${POSTHOG_HOST}`);
  console.log(`📁 Project ID: ${POSTHOG_PROJECT_ID}`);
  console.log('');

  // Get existing cohorts
  console.log('📋 Fetching existing cohorts...');
  const existingCohorts = await getCohorts();
  const existingNames = new Set(existingCohorts.map((c) => c.name));
  console.log(`Found ${existingCohorts.length} existing cohorts`);
  if (existingCohorts.length > 0) {
    console.log('Existing cohorts:');
    existingCohorts.forEach((c) => {
      console.log(`  - ${c.name} (ID: ${c.id})`);
    });
  }
  console.log('');

  // Create cohorts
  const createdCohorts = [];
  for (const cohortDef of COHORT_DEFINITIONS) {
    if (existingNames.has(cohortDef.name)) {
      console.log(`⏭️  Skipping "${cohortDef.name}" - already exists`);
      continue;
    }

    console.log(`📊 Creating cohort: ${cohortDef.name}`);
    console.log(`   ${cohortDef.description}`);

    const result = await createCohort(cohortDef);
    if (result) {
      console.log(`   ✅ Created successfully with ID: ${result.id}`);
      createdCohorts.push(result);
    } else {
      console.log(`   ❌ Failed to create`);
    }
    console.log('');
  }

  console.log('✨ Cohort creation complete!');
  console.log('');

  if (createdCohorts.length > 0) {
    console.log('📝 Successfully created cohorts:');
    createdCohorts.forEach((c) => {
      console.log(`  - ${c.name} (ID: ${c.id})`);
    });
    console.log('');
  }

  console.log('💡 Note: These cohorts are based on user properties that your app sets.');
  console.log('   Make sure your application is tracking these properties:');
  console.log('   - has_workspace');
  console.log('   - tracked_repos_count');
  console.log('   - cohort_count');
  console.log('   - primary_cohort');
  console.log('');
  console.log('📚 Next steps:');
  console.log('1. Visit PostHog to verify cohorts were created correctly');
  console.log('2. Use these cohorts in feature flags and experiments');
  console.log('3. Track the user properties mentioned above in your app');
}

// Run the script
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
