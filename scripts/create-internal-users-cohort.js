#!/usr/bin/env node

/**
 * Script to create an internal users cohort in PostHog
 * Run with: node scripts/create-internal-users-cohort.js
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

// Internal team members - add more as needed
const INTERNAL_USERS = [
  'bdougie', // Brian Douglas
  'brian@opensauced.pizza', // Email as backup identifier
  // Add more team members here as needed
];

// Cohort definition for internal users
const INTERNAL_USERS_COHORT = {
  name: 'Internal Team',
  description: 'Internal team members and contributors for testing and development',
  filters: {
    properties: {
      type: 'OR', // OR so any of these conditions will include the user
      values: [
        // Match by GitHub username
        {
          type: 'person',
          key: 'github_username',
          value: INTERNAL_USERS,
          operator: 'is_in',
        },
        // Match by email
        {
          type: 'person',
          key: 'email',
          value: INTERNAL_USERS,
          operator: 'is_in',
        },
        // Match by distinct ID (if using GitHub username as ID)
        {
          type: 'person',
          key: 'distinct_id',
          value: INTERNAL_USERS,
          operator: 'is_in',
        },
        // Match by user ID
        {
          type: 'person',
          key: 'id',
          value: INTERNAL_USERS,
          operator: 'is_in',
        },
        // Also include anyone with internal_user flag
        {
          type: 'person',
          key: 'internal_user',
          value: true,
          operator: 'exact',
        },
      ],
    },
  },
};

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

async function createOrUpdateCohort(cohortDef, existingCohortId = null) {
  try {
    const method = existingCohortId ? 'PATCH' : 'POST';
    const url = existingCohortId
      ? `${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/cohorts/${existingCohortId}/`
      : `${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/cohorts/`;

    const response = await fetch(url, {
      method,
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
      throw new Error(
        `Failed to ${existingCohortId ? 'update' : 'create'} cohort: ${response.statusText} - ${errorText}`
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error ${existingCohortId ? 'updating' : 'creating'} cohort:`, error.message);
    return null;
  }
}

async function main() {
  console.log('🚀 Creating Internal Users Cohort...');
  console.log(`📍 PostHog Host: ${POSTHOG_HOST}`);
  console.log(`📁 Project ID: ${POSTHOG_PROJECT_ID}`);
  console.log('');

  console.log('👥 Internal users to be included:');
  INTERNAL_USERS.forEach((user) => {
    console.log(`   - ${user}`);
  });
  console.log('');

  // Get existing cohorts
  console.log('📋 Checking for existing cohorts...');
  const existingCohorts = await getCohorts();
  const existingInternalCohort = existingCohorts.find((c) => c.name === 'Internal Team');

  if (existingInternalCohort) {
    console.log(`📝 Found existing "Internal Team" cohort (ID: ${existingInternalCohort.id})`);
    console.log('   Updating with latest configuration...');

    const result = await createOrUpdateCohort(INTERNAL_USERS_COHORT, existingInternalCohort.id);
    if (result) {
      console.log(`   ✅ Updated successfully!`);
    } else {
      console.log(`   ❌ Failed to update`);
    }
  } else {
    console.log('📊 Creating new "Internal Team" cohort...');

    const result = await createOrUpdateCohort(INTERNAL_USERS_COHORT);
    if (result) {
      console.log(`   ✅ Created successfully with ID: ${result.id}`);
    } else {
      console.log(`   ❌ Failed to create`);
    }
  }

  console.log('');
  console.log('✨ Complete!');
  console.log('');
  console.log('📝 Next steps:');
  console.log('1. Visit PostHog to verify the cohort was created');
  console.log('2. Use this cohort for internal testing features');
  console.log('3. Create feature flags that target "Internal Team" cohort');
  console.log('');
  console.log('💡 To add more team members:');
  console.log('   1. Edit the INTERNAL_USERS array in this script');
  console.log('   2. Run the script again to update the cohort');
  console.log('');
  console.log('🔧 You can also manually set the "internal_user" property to true');
  console.log('   for any user in your application code to include them.');
}

// Run the script
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
