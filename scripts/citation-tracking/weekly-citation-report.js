#!/usr/bin/env node

/**
 * Weekly Citation Report Generator
 * 
 * Generates a weekly summary of LLM citations and referral traffic
 * Run via: node scripts/citation-tracking/weekly-citation-report.js
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '..', '..', '.env');
config({ path: envPath });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_TOKEN;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   VITE_SUPABASE_URL:', !!SUPABASE_URL ? '✅' : '❌');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!SUPABASE_SERVICE_KEY ? '✅' : '❌');
  process.exit(1);
}

// Initialize Supabase client with service role key
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Get date range for the last 7 days
 */
function getLastWeekDateRange() {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 7);
  
  return {
    start: startDate.toISOString(),
    end: endDate.toISOString(),
  };
}

/**
 * Get referral traffic metrics for the past week
 */
async function getReferralMetrics() {
  const { start, end } = getLastWeekDateRange();
  
  const { data, error } = await supabase
    .from('referral_traffic')
    .select('*')
    .gte('created_at', start)
    .lte('created_at', end)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching referral metrics:', error);
    return null;
  }

  return data || [];
}

/**
 * Get citation alerts for the past week
 */
async function getCitationAlerts() {
  const { start, end } = getLastWeekDateRange();
  
  const { data, error } = await supabase
    .from('citation_alerts')
    .select('*')
    .gte('created_at', start)
    .lte('created_at', end)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching citation alerts:', error);
    return null;
  }

  return data || [];
}

/**
 * Get query patterns for the past week
 */
async function getQueryPatterns() {
  const { start, end } = getLastWeekDateRange();
  
  const { data, error } = await supabase
    .from('query_patterns')
    .select('*')
    .gte('last_seen_at', start)
    .lte('last_seen_at', end)
    .order('frequency_count', { ascending: false });

  if (error) {
    console.error('Error fetching query patterns:', error);
    return null;
  }

  return data || [];
}

/**
 * Analyze referral data and generate insights
 */
function analyzeReferralData(referrals) {
  const analysis = {
    total: referrals.length,
    aiPlatforms: {},
    repositories: {},
    confidence: {
      high: 0,
      medium: 0,
      low: 0,
    },
    dailyTrend: {},
  };

  referrals.forEach(referral => {
    // AI Platform breakdown
    if (referral.ai_platform) {
      analysis.aiPlatforms[referral.ai_platform] = 
        (analysis.aiPlatforms[referral.ai_platform] || 0) + 1;
    }

    // Repository breakdown
    if (referral.repository) {
      analysis.repositories[referral.repository] = 
        (analysis.repositories[referral.repository] || 0) + 1;
    }

    // Confidence levels
    const confidence = referral.citation_confidence || 0;
    if (confidence >= 0.7) {
      analysis.confidence.high++;
    } else if (confidence >= 0.4) {
      analysis.confidence.medium++;
    } else {
      analysis.confidence.low++;
    }

    // Daily trend
    const date = new Date(referral.created_at).toISOString().split('T')[0];
    analysis.dailyTrend[date] = (analysis.dailyTrend[date] || 0) + 1;
  });

  return analysis;
}

/**
 * Format and display the weekly report
 */
function generateReport(referrals, alerts, patterns) {
  const analysis = analyzeReferralData(referrals);
  const { start, end } = getLastWeekDateRange();
  
  console.log('\n🚀 WEEKLY LLM CITATION REPORT');
  console.log('=' .repeat(50));
  console.log(`📅 Period: ${start.split('T')[0]} to ${end.split('T')[0]}`);
  console.log(`⏰ Generated: ${new Date().toISOString()}`);
  
  // Overview
  console.log('\n📊 OVERVIEW');
  console.log('-'.repeat(30));
  console.log(`Total Referrals: ${analysis.total}`);
  console.log(`Citation Alerts: ${alerts.length}`);
  console.log(`Query Patterns: ${patterns.length}`);
  console.log(`Unique Repositories: ${Object.keys(analysis.repositories).length}`);
  console.log(`AI Platform Sources: ${Object.keys(analysis.aiPlatforms).length}`);

  // AI Platform Breakdown
  if (Object.keys(analysis.aiPlatforms).length > 0) {
    console.log('\n🤖 AI PLATFORM BREAKDOWN');
    console.log('-'.repeat(30));
    Object.entries(analysis.aiPlatforms)
      .sort(([,a], [,b]) => b - a)
      .forEach(([platform, count]) => {
        const percentage = ((count / analysis.total) * 100).toFixed(1);
        console.log(`${platform.padEnd(12)}: ${count.toString().padStart(3)} (${percentage}%)`);
      });
  }

  // Top Cited Repositories
  if (Object.keys(analysis.repositories).length > 0) {
    console.log('\n📁 TOP CITED REPOSITORIES');
    console.log('-'.repeat(30));
    Object.entries(analysis.repositories)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .forEach(([repo, count], index) => {
        console.log(`${(index + 1).toString().padStart(2)}. ${repo.padEnd(30)}: ${count} citations`);
      });
  }

  // Citation Confidence Distribution
  console.log('\n🎯 CITATION CONFIDENCE');
  console.log('-'.repeat(30));
  console.log(`High (≥70%):   ${analysis.confidence.high.toString().padStart(3)} referrals`);
  console.log(`Medium (40-69%): ${analysis.confidence.medium.toString().padStart(3)} referrals`);
  console.log(`Low (<40%):    ${analysis.confidence.low.toString().padStart(3)} referrals`);

  // Daily Trend
  if (Object.keys(analysis.dailyTrend).length > 0) {
    console.log('\n📈 DAILY TREND');
    console.log('-'.repeat(30));
    Object.entries(analysis.dailyTrend)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([date, count]) => {
        const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'short' });
        console.log(`${date} (${dayName}): ${count} referrals`);
      });
  }

  // Query Patterns
  if (patterns.length > 0) {
    console.log('\n🔍 TOP QUERY PATTERNS');
    console.log('-'.repeat(30));
    patterns.slice(0, 5).forEach((pattern, index) => {
      console.log(`${(index + 1).toString().padStart(2)}. [${pattern.pattern_type}] ${pattern.pattern_text}`);
      console.log(`    Frequency: ${pattern.frequency_count}, Platforms: ${pattern.ai_platforms?.join(', ') || 'N/A'}`);
    });
  }

  // Citation Alerts
  if (alerts.length > 0) {
    console.log('\n🚨 CITATION ALERTS');
    console.log('-'.repeat(30));
    alerts.slice(0, 5).forEach((alert, index) => {
      console.log(`${(index + 1).toString().padStart(2)}. [${alert.alert_source}] ${alert.citation_type || 'Unknown'}`);
      console.log(`    Source: ${alert.source_domain || 'N/A'}`);
      console.log(`    Confidence: ${((alert.confidence_score || 0) * 100).toFixed(1)}%`);
    });
    
    if (alerts.length > 5) {
      console.log(`    ... and ${alerts.length - 5} more alerts`);
    }
  }

  // Recommendations
  console.log('\n💡 RECOMMENDATIONS');
  console.log('-'.repeat(30));
  
  if (analysis.total === 0) {
    console.log('• No citations detected this week. Consider:');
    console.log('  - Reviewing referrer tracking implementation');
    console.log('  - Checking if citation confidence scoring is working');
    console.log('  - Setting up Google Alerts for manual monitoring');
  } else {
    if (analysis.confidence.high / analysis.total < 0.3) {
      console.log('• Low citation confidence detected. Consider improving:');
      console.log('  - AI platform detection algorithms');
      console.log('  - Landing page analysis for better scoring');
    }
    
    if (Object.keys(analysis.aiPlatforms).length < 2) {
      console.log('• Limited platform diversity. Consider:');
      console.log('  - Expanding referrer detection patterns');
      console.log('  - Monitoring additional AI platforms');
    }
    
    if (alerts.length === 0) {
      console.log('• No manual citations alerts. Consider:');
      console.log('  - Setting up Google Alerts');
      console.log('  - Monitoring social media mentions');
    }
  }

  console.log('\n🎉 Report complete! View detailed analytics at: /admin/llm-citations');
  console.log('=' .repeat(50));
}

/**
 * Main execution function
 */
async function main() {
  try {
    console.log('🔍 Generating weekly LLM citation report...');
    
    // Fetch all data in parallel
    const [referrals, alerts, patterns] = await Promise.all([
      getReferralMetrics(),
      getCitationAlerts(),
      getQueryPatterns(),
    ]);

    if (referrals === null || alerts === null || patterns === null) {
      console.error('❌ Failed to fetch required data. Check database connection and permissions.');
      process.exit(1);
    }

    // Generate and display report
    generateReport(referrals, alerts, patterns);
    
    // Store report summary in database
    const { error: insertError } = await supabase
      .from('citation_metrics')
      .upsert({
        metric_date: new Date().toISOString().split('T')[0],
        total_citations: referrals.length,
        citations_by_platform: referrals.reduce((acc, r) => {
          if (r.ai_platform) {
            acc[r.ai_platform] = (acc[r.ai_platform] || 0) + 1;
          }
          return acc;
        }, {}),
        top_repositories: Object.entries(
          referrals.reduce((acc, r) => {
            if (r.repository) {
              acc[r.repository] = (acc[r.repository] || 0) + 1;
            }
            return acc;
          }, {})
        ).sort(([,a], [,b]) => b - a).slice(0, 10).map(([repo]) => repo),
        citation_rate_percent: referrals.length > 0 ? 
          (referrals.filter(r => (r.citation_confidence || 0) >= 0.7).length / referrals.length) * 100 : 0,
        metadata: {
          alerts_count: alerts.length,
          patterns_count: patterns.length,
          generated_at: new Date().toISOString(),
        },
      });

    if (insertError) {
      console.warn('⚠️ Warning: Failed to store report summary in database:', insertError.message);
    } else {
      console.log('✅ Report summary stored in database');
    }

  } catch (error) {
    console.error('❌ Error generating report:', error);
    process.exit(1);
  }
}

// Run the script
main();