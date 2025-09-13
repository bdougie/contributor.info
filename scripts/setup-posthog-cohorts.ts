#!/usr/bin/env tsx
/**
 * Script to set up cohorts in PostHog using the API
 * Run with: npm run setup-cohorts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// PostHog API configuration
const POSTHOG_API_KEY = process.env.POSTHOG_PERSONAL_API_KEY || process.env.POSTHOG_API_KEY;
const POSTHOG_PROJECT_ID = process.env.POSTHOG_PROJECT_ID;
const POSTHOG_HOST = process.env.POSTHOG_HOST || 'https://app.posthog.com';

if (!POSTHOG_API_KEY || !POSTHOG_PROJECT_ID) {
  console.error('❌ Missing POSTHOG_API_KEY or POSTHOG_PROJECT_ID');
  console.error('Please set these environment variables:');
  console.error('  POSTHOG_PERSONAL_API_KEY=your-personal-api-key');
  console.error('  POSTHOG_PROJECT_ID=your-project-id');
  console.error('\nYou can find these at: https://app.posthog.com/project/settings');
  process.exit(1);
}

interface CohortDefinition {
  name: string;
  description: string;
  filters: {
    properties?: {
      type: 'person' | 'event' | 'cohort';
      key: string;
      value: string | number | boolean;
      operator: string;
      time_value?: number;
      time_interval?: 'day' | 'week' | 'month' | 'year';
    }[];
    events?: {
      id: string;
      name: string;
      type: 'events';
      properties?: Array<{
        key: string;
        value: string | number | boolean;
        operator: string;
      }>;
      time_value?: number;
      time_interval?: 'day' | 'week' | 'month' | 'year';
      operator?: 'gte' | 'lte' | 'gt' | 'lt' | 'exact';
      operator_value?: number;
    }[];
  };
}

// Define all cohorts to create
const COHORTS: CohortDefinition[] = [
  {
    name: '🔥 Power Users',
    description: 'Users who have created workspaces and added multiple repositories',
    filters: {
      events: [
        {
          id: 'workspace_created',
          name: 'workspace_created',
          type: 'events',
          operator: 'gte',
          operator_value: 1,
        },
        {
          id: 'repository_added_to_workspace',
          name: 'repository_added_to_workspace',
          type: 'events',
          operator: 'gte',
          operator_value: 3,
          time_value: 30,
          time_interval: 'day',
        },
      ],
    },
  },
  {
    name: '🆕 New Users (First 30 Days)',
    description: 'Users who signed up in the last 30 days',
    filters: {
      properties: [
        {
          type: 'person',
          key: '$initial_referrer',
          value: 'is_set',
          operator: 'is_set',
          time_value: 30,
          time_interval: 'day',
        },
      ],
      events: [
        {
          id: 'login_successful',
          name: 'login_successful',
          type: 'events',
          properties: [
            {
              key: 'is_first_time',
              value: true,
              operator: 'exact',
            },
          ],
          time_value: 30,
          time_interval: 'day',
        },
      ],
    },
  },
  {
    name: '🔍 Active Searchers',
    description: 'Users who frequently search for repositories',
    filters: {
      events: [
        {
          id: 'repository_searched',
          name: 'repository_searched',
          type: 'events',
          operator: 'gte',
          operator_value: 5,
          time_value: 7,
          time_interval: 'day',
        },
        {
          id: 'repository_selected_from_search',
          name: 'repository_selected_from_search',
          type: 'events',
          operator: 'gte',
          operator_value: 2,
          time_value: 7,
          time_interval: 'day',
        },
      ],
    },
  },
  {
    name: '📊 Workspace Power Users',
    description: 'Users actively managing multiple repositories in workspaces',
    filters: {
      events: [
        {
          id: 'workspace_created',
          name: 'workspace_created',
          type: 'events',
          operator: 'gte',
          operator_value: 1,
        },
        {
          id: 'repository_added_to_workspace',
          name: 'repository_added_to_workspace',
          type: 'events',
          operator: 'gte',
          operator_value: 5,
        },
        {
          id: 'workspace_settings_modified',
          name: 'workspace_settings_modified',
          type: 'events',
          operator: 'gte',
          operator_value: 1,
        },
      ],
    },
  },
  {
    name: '👀 Repository Browsers (No Workspace)',
    description: "Users who browse repositories but haven't created workspaces",
    filters: {
      events: [
        {
          id: 'repository_page_viewed',
          name: 'repository_page_viewed',
          type: 'events',
          operator: 'gte',
          operator_value: 3,
          time_value: 30,
          time_interval: 'day',
        },
        {
          id: 'workspace_created',
          name: 'workspace_created',
          type: 'events',
          operator: 'exact',
          operator_value: 0,
        },
      ],
    },
  },
  {
    name: '📈 Trending Discovery Users',
    description: 'Users who discover repositories through trending page',
    filters: {
      events: [
        {
          id: 'trending_page_interaction',
          name: 'trending_page_interaction',
          type: 'events',
          properties: [
            {
              key: 'action',
              value: 'repository_clicked',
              operator: 'exact',
            },
          ],
          operator: 'gte',
          operator_value: 2,
          time_value: 7,
          time_interval: 'day',
        },
      ],
    },
  },
  {
    name: '🔄 Manual Data Refreshers',
    description: 'Users who manually refresh repository data',
    filters: {
      events: [
        {
          id: 'data_refresh_triggered',
          name: 'data_refresh_triggered',
          type: 'events',
          properties: [
            {
              key: 'trigger_type',
              value: 'manual',
              operator: 'exact',
            },
          ],
          operator: 'gte',
          operator_value: 3,
          time_value: 30,
          time_interval: 'day',
        },
      ],
    },
  },
  {
    name: '📤 Content Sharers',
    description: 'Users who share content (potential advocates)',
    filters: {
      events: [
        {
          id: 'share_action',
          name: 'share_action',
          type: 'events',
          operator: 'gte',
          operator_value: 2,
        },
      ],
    },
  },
  {
    name: '🎯 High Intent (No Workspace)',
    description: "Highly engaged users who haven't created workspaces",
    filters: {
      events: [
        {
          id: 'repository_page_viewed',
          name: 'repository_page_viewed',
          type: 'events',
          operator: 'gte',
          operator_value: 10,
          time_value: 30,
          time_interval: 'day',
        },
        {
          id: 'repository_tab_switched',
          name: 'repository_tab_switched',
          type: 'events',
          operator: 'gte',
          operator_value: 5,
          time_value: 30,
          time_interval: 'day',
        },
        {
          id: 'workspace_created',
          name: 'workspace_created',
          type: 'events',
          operator: 'exact',
          operator_value: 0,
        },
      ],
    },
  },
  {
    name: '⚠️ Error Experiencers',
    description: 'Users who have encountered errors',
    filters: {
      events: [
        {
          id: 'error_boundary_triggered',
          name: 'error_boundary_triggered',
          type: 'events',
          operator: 'gte',
          operator_value: 1,
          time_value: 7,
          time_interval: 'day',
        },
      ],
    },
  },
  {
    name: '🔐 Authenticated Users',
    description: 'Users who have successfully logged in',
    filters: {
      events: [
        {
          id: 'login_successful',
          name: 'login_successful',
          type: 'events',
          operator: 'gte',
          operator_value: 1,
        },
      ],
    },
  },
  {
    name: '💤 Dormant Users',
    description: "Users who haven't been active in the last 30 days",
    filters: {
      properties: [
        {
          type: 'person',
          key: '$last_seen',
          value: 30,
          operator: 'gt',
          time_value: 30,
          time_interval: 'day',
        },
      ],
    },
  },
];

/**
 * Create a cohort in PostHog
 */
async function createCohort(cohort: CohortDefinition): Promise<void> {
  const url = `${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/cohorts/`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${POSTHOG_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: cohort.name,
        description: cohort.description,
        filters: cohort.filters,
        is_static: false, // Dynamic cohort that updates automatically
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create cohort: ${error}`);
    }

    const result = await response.json();
    console.log(`✅ Created cohort: ${cohort.name} (ID: ${result.id})`);
  } catch (error) {
    console.error(`❌ Failed to create cohort ${cohort.name}:`, error);
  }
}

/**
 * List existing cohorts
 */
async function listExistingCohorts(): Promise<Set<string>> {
  const url = `${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/cohorts/`;

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${POSTHOG_API_KEY}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to list cohorts: ${response.statusText}`);
    }

    const data = await response.json();
    const existingNames = new Set(data.results.map((c: { name: string }) => c.name));

    console.log(`\n📊 Found ${existingNames.size} existing cohorts:`);
    existingNames.forEach((name) => console.log(`  - ${name}`));
    console.log('');

    return existingNames;
  } catch (error) {
    console.error('❌ Failed to list existing cohorts:', error);
    return new Set();
  }
}

/**
 * Main function to set up all cohorts
 */
async function setupCohorts() {
  console.log('🚀 Setting up PostHog cohorts for contributor.info\n');
  console.log(`📍 PostHog Host: ${POSTHOG_HOST}`);
  console.log(`📍 Project ID: ${POSTHOG_PROJECT_ID}\n`);

  // List existing cohorts
  const existingCohorts = await listExistingCohorts();

  // Create cohorts
  console.log('📝 Creating cohorts...\n');

  for (const cohort of COHORTS) {
    if (existingCohorts.has(cohort.name)) {
      console.log(`⏭️  Skipping existing cohort: ${cohort.name}`);
    } else {
      await createCohort(cohort);
      // Add a small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  console.log('\n✨ Cohort setup complete!');
  console.log('\n📈 Next steps:');
  console.log('1. Visit your PostHog dashboard to view cohorts');
  console.log('2. Create insights filtered by cohorts');
  console.log('3. Set up feature flags targeting specific cohorts');
  console.log('4. Build dashboards to track cohort metrics');
  console.log(`\n🔗 View cohorts at: ${POSTHOG_HOST}/project/${POSTHOG_PROJECT_ID}/cohorts`);
}

// Run the setup
setupCohorts().catch(console.error);
