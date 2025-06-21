/**
 * Ground Truth Dataset Extractor
 * Extracts verified contributor classifications from Supabase for evaluation
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import type { EvaluationSample, GitHubEvent, ContributorMetrics, DatasetStats } from '../types';

// Load environment variables
dotenv.config();

// Load environment variables with fallbacks
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://egcxzonpmmcirmgqdrla.supabase.co';
const supabaseKey = process.env.SUPABASE_TOKEN || process.env.SUPABASE_SERVICE_ROLE;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(`Missing Supabase configuration: URL=${!!supabaseUrl}, Key=${!!supabaseKey}`);
}

const supabase = createClient(supabaseUrl, supabaseKey);

export class GroundTruthExtractor {
  private minConfidenceScore = 0.7; // High confidence samples only
  private targetSamplesPerRole = 50; // Balanced dataset

  async extractGroundTruthDataset(): Promise<EvaluationSample[]> {
    console.log('Extracting ground truth dataset from Supabase...');

    // Get high-confidence contributor classifications
    const { data: contributorRoles, error } = await supabase
      .from('contributor_roles')
      .select(`
        *
      `)
      .gte('confidence_score', this.minConfidenceScore)
      .order('confidence_score', { ascending: false })
      .limit(1500);

    if (error) {
      throw new Error(`Failed to extract contributor roles: ${error.message}`);
    }

    console.log(`Found ${contributorRoles?.length} high-confidence contributor roles`);

    // Balance the dataset across role types
    const balancedSamples = this.balanceDataset(contributorRoles);
    
    // Convert to evaluation samples with enhanced features
    const evaluationSamples = await Promise.all(
      balancedSamples.map(async (role) => {
        const events = await this.extractGitHubEvents(role.user_id, role.repository_owner, role.repository_name);
        const metrics = this.calculateMetrics(role, events);
        
        return this.createEvaluationSample(role, events, metrics);
      })
    );

    console.log(`Generated ${evaluationSamples.length} evaluation samples`);
    return evaluationSamples.filter(sample => sample !== null) as EvaluationSample[];
  }

  private balanceDataset(contributorRoles: any[]): any[] {
    const roleGroups = {
      owner: contributorRoles.filter(r => r.role === 'owner'),
      maintainer: contributorRoles.filter(r => r.role === 'maintainer'),
      contributor: contributorRoles.filter(r => r.role === 'contributor')
    };

    const balanced: any[] = [];
    
    // Take equal samples from each role type
    Object.entries(roleGroups).forEach(([role, samples]) => {
      const shuffled = samples.sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, Math.min(this.targetSamplesPerRole, samples.length));
      balanced.push(...selected);
      console.log(`Selected ${selected.length} ${role} samples`);
    });

    return balanced.sort(() => Math.random() - 0.5); // Final shuffle
  }

  private async extractGitHubEvents(userId: string, repoOwner: string, repoName: string): Promise<GitHubEvent[]> {
    // Extract relevant GitHub events for the contributor in this repository
    // Note: Using github_events_cache table which has the actual event data
    const { data: events, error } = await supabase
      .from('github_events_cache')
      .select('*')
      .eq('actor_login', userId)
      .eq('repository_owner', repoOwner)
      .eq('repository_name', repoName)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.warn(`Failed to extract events for ${userId} in ${repoOwner}/${repoName}: ${error.message}`);
      return [];
    }

    return events?.map(event => ({
      type: event.event_type as GitHubEvent['type'],
      action: event.payload?.action || '',
      merged: event.payload?.pull_request?.merged || false,
      ref: event.payload?.ref || '',
      forced: event.payload?.forced || false,
      created_at: event.created_at
    })) || [];
  }

  private calculateMetrics(role: any, events: GitHubEvent[]): ContributorMetrics {
    const mergeEvents = events.filter(e => 
      e.type === 'PullRequestEvent' && e.merged === true
    ).length;

    const pushEvents = events.filter(e => 
      e.type === 'PushEvent' && e.ref?.includes('main')
    ).length;

    const adminActions = events.filter(e =>
      ['ReleaseEvent', 'IssuesEvent'].includes(e.type)
    ).length;

    const privilegedEvents = mergeEvents + pushEvents + adminActions;

    return {
      privileged_events: privilegedEvents,
      total_events: events.length,
      days_active: this.calculateDaysActive(events),
      detection_methods: role.detection_methods || [],
      confidence_score: role.confidence_score,
      merge_events: mergeEvents,
      push_to_protected: pushEvents,
      admin_actions: adminActions,
      release_events: events.filter(e => e.type === 'ReleaseEvent').length
    };
  }

  private calculateDaysActive(events: GitHubEvent[]): number {
    if (events.length === 0) return 0;
    
    const dates = events.map(e => new Date(e.created_at));
    const earliest = new Date(Math.min(...dates.map(d => d.getTime())));
    const latest = new Date(Math.max(...dates.map(d => d.getTime())));
    
    return Math.ceil((latest.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24));
  }

  private createEvaluationSample(role: any, events: GitHubEvent[], metrics: ContributorMetrics): EvaluationSample {
    return {
      input: {
        user_id: role.user_id,
        repository: `${role.repository_owner}/${role.repository_name}`,
        events,
        metrics,
        repository_context: {
          size: 'medium', // Default since we don't have repo stats readily available
          stars: 0,
          contributors_count: 0,
          created_at: ''
        }
      },
      ideal: role.role === 'owner' ? 'maintainer' : role.role as 'maintainer' | 'contributor',
      metadata: {
        verified_by: 'automated_high_confidence',
        verification_date: new Date().toISOString(),
        confidence_level: parseFloat(role.confidence_score) >= 0.95 ? 'high' : 'medium',
        edge_case: metrics.privileged_events === 0 && role.role !== 'contributor'
      }
    };
  }

  private categorizeRepoSize(stars: number): 'small' | 'medium' | 'large' {
    if (stars < 100) return 'small';
    if (stars < 1000) return 'medium';
    return 'large';
  }

  async generateDatasetStats(samples: EvaluationSample[]): Promise<DatasetStats> {
    const stats: DatasetStats = {
      total_samples: samples.length,
      class_distribution: {
        maintainer: samples.filter(s => s.ideal === 'maintainer').length,
        contributor: samples.filter(s => s.ideal === 'contributor').length
      },
      repository_distribution: {},
      temporal_distribution: {},
      quality_metrics: {
        verified_samples: samples.filter(s => s.metadata?.verified_by).length,
        high_confidence_samples: samples.filter(s => s.metadata?.confidence_level === 'high').length,
        edge_cases: samples.filter(s => s.metadata?.edge_case).length
      }
    };

    // Calculate repository distribution
    samples.forEach(sample => {
      const repo = sample.input.repository;
      stats.repository_distribution[repo] = (stats.repository_distribution[repo] || 0) + 1;
    });

    // Calculate temporal distribution (by month)
    samples.forEach(sample => {
      if (sample.metadata?.verification_date) {
        const month = sample.metadata.verification_date.substring(0, 7); // YYYY-MM
        stats.temporal_distribution[month] = (stats.temporal_distribution[month] || 0) + 1;
      }
    });

    return stats;
  }

  async exportToJSONL(samples: EvaluationSample[], outputPath: string): Promise<void> {
    const fs = await import('fs');
    const jsonlContent = samples.map(sample => JSON.stringify(sample)).join('\n');
    
    fs.writeFileSync(outputPath, jsonlContent, 'utf-8');
    console.log(`Exported ${samples.length} samples to ${outputPath}`);
  }
}