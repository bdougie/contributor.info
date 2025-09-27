#!/usr/bin/env node

/**
 * Script to create cohorts in PostHog based on our cohort definitions
 * Run with: node scripts/create-posthog-cohorts.js
 */

import dotenv from 'dotenv';
import fetch from 'node-fetch';

// Load environment variables
dotenv.config();

const POSTHOG_API_KEY = process.env.POSTHOG_PERSONAL_API_KEY;
const POSTHOG_PROJECT_ID =
  process.env.POSTHOG_PROJECT_ID || process.env.VITE_POSTHOG_PROJECT_ID || '173101'; // Use env project ID
const POSTHOG_HOST = process.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

if (!POSTHOG_API_KEY) {
  console.error('❌ POSTHOG_PERSONAL_API_KEY not found in environment variables');
  console.log('Please add it to your .env file');
  process.exit(1);
}

// Cohort definitions matching our local definitions
const COHORT_DEFINITIONS = [
  {
    name: 'Power Users',
    description: 'Highly engaged users with workspaces and multiple repositories',
    filters: {
      properties: {
        type: 'AND',
        values: [
          {
            type: 'behavioral',
            value: 'performed_event',
            event_type: 'events',
            key: 'workspace_created',
            time_value: 30,
            time_interval: 'day',
            value_property: null,
            operator: 'gte',
            operator_value: 1,
          },
          {
            type: 'behavioral',
            value: 'performed_event',
            event_type: 'events',
            key: 'repository_added_to_workspace',
            time_value: 30,
            time_interval: 'day',
            value_property: null,
            operator: 'gte',
            operator_value: 3,
          },
        ],
      },
    },
  },
  {
    name: 'New Users',
    description: 'Users in their first 30 days',
    filters: {
      properties: {
        type: 'AND',
        values: [
          {
            type: 'person',
            key: '$initial_timestamp',
            value: '30d',
            operator: 'is_date_after',
          },
        ],
      },
    },
  },
  {
    name: 'Active Searchers',
    description: 'Users who frequently search for repositories',
    filters: {
      properties: {
        type: 'AND',
        values: [
          {
            type: 'behavioral',
            value: 'performed_event',
            event_type: 'events',
            key: 'repository_searched',
            time_value: 7,
            time_interval: 'day',
            value_property: null,
            operator: 'gte',
            operator_value: 5,
          },
          {
            type: 'behavioral',
            value: 'performed_event',
            event_type: 'events',
            key: 'repository_selected_from_search',
            time_value: 7,
            time_interval: 'day',
            value_property: null,
            operator: 'gte',
            operator_value: 2,
          },
        ],
      },
    },
  },
  {
    name: 'Workspace Power Users',
    description: 'Users managing multiple workspaces with high activity',
    filters: {
      properties: {
        type: 'AND',
        values: [
          {
            type: 'behavioral',
            value: 'performed_event',
            event_type: 'events',
            key: 'workspace_created',
            time_value: null,
            time_interval: null,
            value_property: null,
            operator: 'gte',
            operator_value: 2,
          },
          {
            type: 'behavioral',
            value: 'performed_event',
            event_type: 'events',
            key: 'workspace_view',
            time_value: 7,
            time_interval: 'day',
            value_property: null,
            operator: 'gte',
            operator_value: 10,
          },
        ],
      },
    },
  },
  {
    name: 'Data Explorers',
    description: 'Users who analyze repository data in depth',
    filters: {
      properties: {
        type: 'AND',
        values: [
          {
            type: 'behavioral',
            value: 'performed_event',
            event_type: 'events',
            key: 'repository_analyzed',
            time_value: 7,
            time_interval: 'day',
            value_property: null,
            operator: 'gte',
            operator_value: 3,
          },
          {
            type: 'behavioral',
            value: 'performed_event',
            event_type: 'events',
            key: 'contributor_profile_viewed',
            time_value: 7,
            time_interval: 'day',
            value_property: null,
            operator: 'gte',
            operator_value: 10,
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
    console.error(`Error creating cohort ${cohortDef.name}:`, error);
    return null;
  }
}

async function main() {
  console.log('🚀 Starting PostHog cohort creation...');
  console.log(`📍 PostHog Host: ${POSTHOG_HOST}`);
  console.log(`📁 Project ID: ${POSTHOG_PROJECT_ID}`);
  console.log('');

  // Get existing cohorts
  console.log('📋 Fetching existing cohorts...');
  const existingCohorts = await getCohorts();
  const existingNames = new Set(existingCohorts.map((c) => c.name));
  console.log(`Found ${existingCohorts.length} existing cohorts`);
  console.log('');

  // Create cohorts
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
    } else {
      console.log(`   ❌ Failed to create`);
    }
    console.log('');
  }

  console.log('✨ Cohort creation complete!');
  console.log('');
  console.log('📝 Next steps:');
  console.log('1. Visit PostHog to verify cohorts were created correctly');
  console.log('2. Update the cohort-manager.ts to use PostHog cohort IDs if needed');
  console.log('3. Consider using PostHog feature flags with these cohorts');
}

// Run the script
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
