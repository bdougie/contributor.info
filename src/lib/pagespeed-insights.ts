import { supabase } from './supabase';

const PAGESPEED_API_URL = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
const API_KEY = process.env.VITE_PAGESPEED_API_KEY || '';

export interface PageSpeedResult {
  url: string;
  fetchTime: string;
  lighthouseResult: {
    finalUrl: string;
    requestedUrl: string;
    fetchTime: string;
    categories: {
      performance: {
        score: number;
        title: string;
      };
      accessibility?: {
        score: number;
        title: string;
      };
      'best-practices'?: {
        score: number;
        title: string;
      };
      seo?: {
        score: number;
        title: string;
      };
    };
    audits: {
      [key: string]: {
        id: string;
        title: string;
        description: string;
        score: number | null;
        scoreDisplayMode: string;
        numericValue?: number;
        numericUnit?: string;
        displayValue?: string;
      };
    };
  };
  loadingExperience?: {
    metrics: {
      CUMULATIVE_LAYOUT_SHIFT_SCORE?: {
        percentile: number;
        category: string;
      };
      FIRST_CONTENTFUL_PAINT_MS?: {
        percentile: number;
        category: string;
      };
      FIRST_INPUT_DELAY_MS?: {
        percentile: number;
        category: string;
      };
      INTERACTION_TO_NEXT_PAINT?: {
        percentile: number;
        category: string;
      };
      LARGEST_CONTENTFUL_PAINT_MS?: {
        percentile: number;
        category: string;
      };
    };
    overall_category: string;
  };
}

export interface PageSpeedMetrics {
  url: string;
  timestamp: string;
  performanceScore: number;
  lcp: number;
  fcp: number;
  cls: number;
  tti: number;
  tbt: number;
  speedIndex: number;
  inp?: number;
  fieldData?: {
    lcp: number;
    fcp: number;
    cls: number;
    inp: number;
  };
}

class PageSpeedInsightsAPI {
  private apiKey: string;
  private cache: Map<string, { data: PageSpeedResult; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

  constructor(apiKey?: string) {
    this.apiKey = apiKey || API_KEY;
  }

  /**
   * Run PageSpeed Insights test for a URL
   */
  async runTest(url: string, strategy: 'mobile' | 'desktop' = 'mobile'): Promise<PageSpeedResult> {
    // Check cache first
    const cacheKey = `${url}-${strategy}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }

    try {
      const params = new URLSearchParams({
        url,
        strategy,
        category: 'performance',
        ...(this.apiKey && { key: this.apiKey }),
      });

      const response = await fetch(`${PAGESPEED_API_URL}?${params}`);
      
      if (!response.ok) {
        throw new Error(`PageSpeed API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Cache the result
      this.cache.set(cacheKey, { data, timestamp: Date.now() });
      
      // Store in database
      await this.storeResult(data, strategy);
      
      return data;
    } catch (error) {
      console.error('PageSpeed Insights API error:', error);
      throw error;
    }
  }

  /**
   * Extract key metrics from PageSpeed result
   */
  extractMetrics(result: PageSpeedResult): PageSpeedMetrics {
    const audits = result.lighthouseResult.audits;
    
    return {
      url: result.lighthouseResult.finalUrl,
      timestamp: result.fetchTime,
      performanceScore: (result.lighthouseResult.categories.performance.score ?? 0) * 100,
      lcp: audits['largest-contentful-paint']?.numericValue || 0,
      fcp: audits['first-contentful-paint']?.numericValue || 0,
      cls: audits['cumulative-layout-shift']?.numericValue || 0,
      tti: audits['interactive']?.numericValue || 0,
      tbt: audits['total-blocking-time']?.numericValue || 0,
      speedIndex: audits['speed-index']?.numericValue || 0,
      inp: audits['interaction-to-next-paint']?.numericValue,
      fieldData: result.loadingExperience ? {
        lcp: result.loadingExperience.metrics.LARGEST_CONTENTFUL_PAINT_MS?.percentile || 0,
        fcp: result.loadingExperience.metrics.FIRST_CONTENTFUL_PAINT_MS?.percentile || 0,
        cls: result.loadingExperience.metrics.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile || 0,
        inp: result.loadingExperience.metrics.INTERACTION_TO_NEXT_PAINT?.percentile || 0,
      } : undefined,
    };
  }

  /**
   * Store PageSpeed result in database
   */
  private async storeResult(result: PageSpeedResult, strategy: string): Promise<void> {
    try {
      const metrics = this.extractMetrics(result);
      
      const { error } = await supabase
        .from('pagespeed_results')
        .insert([{
          url: metrics.url,
          strategy,
          performance_score: metrics.performanceScore,
          lcp: metrics.lcp,
          fcp: metrics.fcp,
          cls: metrics.cls,
          tti: metrics.tti,
          tbt: metrics.tbt,
          speed_index: metrics.speedIndex,
          inp: metrics.inp,
          field_data: metrics.fieldData,
          full_result: result,
          timestamp: metrics.timestamp,
        }]);
      
      if (error) {
        console.error('Failed to store PageSpeed result:', error);
      }
    } catch (err) {
      console.error('Error storing PageSpeed result:', err);
    }
  }

  /**
   * Get historical PageSpeed data for a URL
   */
  async getHistory(url: string, days: number = 30): Promise<PageSpeedMetrics[]> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      const { data, error } = await supabase
        .from('pagespeed_results')
        .select('*')
        .eq('url', url)
        .gte('timestamp', startDate.toISOString())
        .order('timestamp', { ascending: false });
      
      if (error) {
        console.error('Failed to get PageSpeed history:', error);
        return [];
      }
      
      return (data || []).map(row => ({
        url: row.url,
        timestamp: row.timestamp,
        performanceScore: row.performance_score,
        lcp: row.lcp,
        fcp: row.fcp,
        cls: row.cls,
        tti: row.tti,
        tbt: row.tbt,
        speedIndex: row.speed_index,
        inp: row.inp,
        fieldData: row.field_data,
      }));
    } catch (err) {
      console.error('Error getting PageSpeed history:', err);
      return [];
    }
  }

  /**
   * Check if performance budget is met
   */
  checkPerformanceBudget(metrics: PageSpeedMetrics, budget: {
    performanceScore?: number;
    lcp?: number;
    fcp?: number;
    cls?: number;
    tti?: number;
    tbt?: number;
  }): { passed: boolean; violations: string[] } {
    const violations: string[] = [];
    
    if (budget.performanceScore && metrics.performanceScore < budget.performanceScore) {
      violations.push(`Performance score ${metrics.performanceScore} < ${budget.performanceScore}`);
    }
    
    if (budget.lcp && metrics.lcp > budget.lcp) {
      violations.push(`LCP ${metrics.lcp}ms > ${budget.lcp}ms`);
    }
    
    if (budget.fcp && metrics.fcp > budget.fcp) {
      violations.push(`FCP ${metrics.fcp}ms > ${budget.fcp}ms`);
    }
    
    if (budget.cls && metrics.cls > budget.cls) {
      violations.push(`CLS ${metrics.cls} > ${budget.cls}`);
    }
    
    if (budget.tti && metrics.tti > budget.tti) {
      violations.push(`TTI ${metrics.tti}ms > ${budget.tti}ms`);
    }
    
    if (budget.tbt && metrics.tbt > budget.tbt) {
      violations.push(`TBT ${metrics.tbt}ms > ${budget.tbt}ms`);
    }
    
    return {
      passed: violations.length === 0,
      violations,
    };
  }

  /**
   * Generate performance report for PR
   */
  async generatePRReport(baseUrl: string, prUrl: string): Promise<string> {
    try {
      // Run tests for both base and PR
      const [baseResult, prResult] = await Promise.all([
        this.runTest(baseUrl),
        this.runTest(prUrl),
      ]);
      
      const baseMetrics = this.extractMetrics(baseResult);
      const prMetrics = this.extractMetrics(prResult);
      
      // Calculate deltas
      const scoreDelta = prMetrics.performanceScore - baseMetrics.performanceScore;
      const lcpDelta = prMetrics.lcp - baseMetrics.lcp;
      const fcpDelta = prMetrics.fcp - baseMetrics.fcp;
      const clsDelta = prMetrics.cls - baseMetrics.cls;
      
      // Generate report
      let report = `## 📊 Performance Report\n\n`;
      // Helper functions to avoid ternary operators
      const getDeltaIcon = (delta: number) => delta > 0 ? '✅' : '⚠️';
      const getMetricStatus = (delta: number) => delta <= 0 ? '✅' : '⚠️';
      const formatDelta = (delta: number) => delta > 0 ? `+${delta}` : `${delta}`;
      const formatDeltaWithUnit = (delta: number | string, unit: string = '') => {
        const numDelta = typeof delta === 'string' ? parseFloat(delta) : delta;
        const sign = numDelta > 0 ? '+' : '';
        return `${sign}${delta}${unit}`;
      };
      
      report += `### Overall Score\n`;
      report += `- **Base**: ${baseMetrics.performanceScore}/100\n`;
      report += `- **PR**: ${prMetrics.performanceScore}/100\n`;
      report += `- **Delta**: ${getDeltaIcon(scoreDelta)} ${formatDelta(scoreDelta)}\n\n`;
      
      report += `### Core Web Vitals\n`;
      report += `| Metric | Base | PR | Delta | Status |\n`;
      report += `|--------|------|-----|-------|--------|\n`;
      report += `| LCP | ${(baseMetrics.lcp / 1000).toFixed(2)}s | ${(prMetrics.lcp / 1000).toFixed(2)}s | ${formatDeltaWithUnit((lcpDelta / 1000).toFixed(2), 's')} | ${getMetricStatus(lcpDelta)} |\n`;
      report += `| FCP | ${(baseMetrics.fcp / 1000).toFixed(2)}s | ${(prMetrics.fcp / 1000).toFixed(2)}s | ${formatDeltaWithUnit((fcpDelta / 1000).toFixed(2), 's')} | ${getMetricStatus(fcpDelta)} |\n`;
      report += `| CLS | ${baseMetrics.cls.toFixed(3)} | ${prMetrics.cls.toFixed(3)} | ${formatDeltaWithUnit(clsDelta.toFixed(3), '')} | ${getMetricStatus(clsDelta)} |\n`;
      
      // Check performance budget
      const budget = {
        performanceScore: 90,
        lcp: 2500,
        fcp: 1800,
        cls: 0.1,
      };
      
      const budgetCheck = this.checkPerformanceBudget(prMetrics, budget);
      
      if (!budgetCheck.passed) {
        report += `\n### ⚠️ Performance Budget Violations\n`;
        budgetCheck.violations.forEach(violation => {
          report += `- ${violation}\n`;
        });
      } else {
        report += `\n### ✅ Performance Budget: Passed\n`;
      }
      
      return report;
    } catch (error) {
      console.error('Failed to generate PR report:', error);
      return `## ❌ Performance Report Failed\n\nUnable to generate performance report: ${error}`;
    }
  }
}

// Singleton instance
let apiInstance: PageSpeedInsightsAPI | null = null;

export function getPageSpeedInsightsAPI(apiKey?: string): PageSpeedInsightsAPI {
  if (!apiInstance) {
    apiInstance = new PageSpeedInsightsAPI(apiKey);
  }
  return apiInstance;
}

export default PageSpeedInsightsAPI;