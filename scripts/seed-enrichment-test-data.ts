/**
 * Seed Test Enrichment Data
 *
 * Quick script to populate enrichment data for testing the AI Insights UI
 * Run with: npx tsx scripts/seed-enrichment-test-data.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'mock-anon-key';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function seedEnrichmentData() {
  console.log('🌱 Seeding enrichment test data...\n');

  // Get first contributor from any workspace
  const { data: contributors, error: contributorError } = await supabase
    .from('contributors')
    .select('id, username, workspace_id')
    .limit(5);

  if (contributorError || !contributors || contributors.length === 0) {
    console.error('❌ Error fetching contributors:', contributorError);
    console.log('ℹ️  Make sure you have contributors in your database first.');
    return;
  }

  console.log('Found %s contributors to enrich:\n', contributors.length);

  for (const contributor of contributors) {
    console.log('Enriching @%s...', contributor.username);

    // Update contributors table with current analytics state
    const { error: updateError } = await supabase
      .from('contributors')
      .update({
        primary_topics: ['authentication', 'api-design', 'security'],
        topic_confidence: 0.85,
        detected_persona: ['enterprise', 'security'],
        persona_confidence: 0.78,
        contribution_style: 'code',
        engagement_pattern_type: 'builder',
        expertise_areas: ['OAuth', 'SSO', 'JWT', 'API Security'],
        quality_score: 82,
        discussion_impact_score: 75,
        code_review_depth_score: 88,
        issue_quality_score: 79,
        mentor_score: 85,
        last_analytics_update: new Date().toISOString(),
      })
      .eq('id', contributor.id);

    if (updateError) {
      console.error('  ❌ Error updating contributor: %s', updateError.message);
      continue;
    }

    // Create analytics snapshot with velocity and topic shifts
    const { error: analyticsError } = await supabase
      .from('contributor_analytics')
      .insert({
        contributor_id: contributor.id,
        workspace_id: contributor.workspace_id,
        snapshot_date: new Date().toISOString().split('T')[0],
        primary_topics: ['authentication', 'api-design', 'security'],
        topic_confidence: 0.85,
        contribution_velocity: {
          current7d: 8,
          previous7d: 5,
          current30d: 32,
          previous30d: 28,
          trend: 'accelerating',
          changePercent: 14.3,
        },
        topic_shifts: [
          {
            from: ['frontend', 'ui'],
            to: ['backend', 'api-design'],
            timeframe: '30d',
            significance: 'major',
            confidence: 0.82,
          },
        ],
        engagement_pattern: 'increasing',
        quality_score: 82,
        discussion_impact_score: 75,
        code_review_depth_score: 88,
        issue_quality_score: 79,
        mentor_score: 85,
        detected_persona: ['enterprise', 'security'],
        persona_confidence: 0.78,
        contribution_style: 'code',
        engagement_pattern_type: 'builder',
      })
      .select()
      .maybeSingle();

    if (analyticsError) {
      // If already exists, update it with ALL fields
      if (analyticsError.code === '23505') {
        const { error: updateAnalyticsError } = await supabase
          .from('contributor_analytics')
          .update({
            primary_topics: ['authentication', 'api-design', 'security'],
            topic_confidence: 0.85,
            contribution_velocity: {
              current7d: 8,
              previous7d: 5,
              current30d: 32,
              previous30d: 28,
              trend: 'accelerating',
              changePercent: 14.3,
            },
            topic_shifts: [
              {
                from: ['frontend', 'ui'],
                to: ['backend', 'api-design'],
                timeframe: '30d',
                significance: 'major',
                confidence: 0.82,
              },
            ],
            engagement_pattern: 'increasing',
            quality_score: 82,
            discussion_impact_score: 75,
            code_review_depth_score: 88,
            issue_quality_score: 79,
            mentor_score: 85,
            detected_persona: ['enterprise', 'security'],
            persona_confidence: 0.78,
            contribution_style: 'code',
            engagement_pattern_type: 'builder',
          })
          .eq('contributor_id', contributor.id)
          .eq('workspace_id', contributor.workspace_id)
          .eq('snapshot_date', new Date().toISOString().split('T')[0]);

        if (updateAnalyticsError) {
          console.error('  ❌ Error updating analytics: %s', updateAnalyticsError.message);
        } else {
          console.log('  ✅ Updated analytics for @%s', contributor.username);
        }
      } else {
        console.error('  ❌ Error creating analytics: %s', analyticsError.message);
      }
    } else {
      console.log('  ✅ Created analytics for @%s', contributor.username);
    }
  }

  console.log('\n✨ Enrichment data seeded successfully!');
  console.log('\n📝 Test Data Summary:');
  console.log('   - Personas: Enterprise, Security');
  console.log('   - Topics: authentication, api-design, security');
  console.log('   - Quality Score: 82/100');
  console.log('   - Velocity: Accelerating (+14.3%)');
  console.log('   - Topic Shift: frontend → backend/api-design');
  console.log('\n🎯 Now open a contributor profile to see the AI Insights tab!');
}

// Run the seeding
seedEnrichmentData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
