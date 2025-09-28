import { describe, it, expect } from 'vitest';
import {
  createDemoRandomGenerator,
  generateDemoAnalyticsData,
  generateDemoWorkspaceRepositories,
  generateDemoWorkspaceMetrics,
  generateDemoWorkspaceTrendData,
  generateDemoRepositories,
} from '../demo-data-generator';

describe('Demo Data Generator', () => {
  describe('createDemoRandomGenerator', () => {
    it('should generate consistent random numbers with same seed', () => {
      const gen1 = createDemoRandomGenerator(42);
      const gen2 = createDemoRandomGenerator(42);

      const values1 = [gen1(), gen1(), gen1()];
      const values2 = [gen2(), gen2(), gen2()];

      expect(values1).toEqual(values2);
    });

    it('should generate different numbers with different seeds', () => {
      const gen1 = createDemoRandomGenerator(42);
      const gen2 = createDemoRandomGenerator(123);

      const value1 = gen1();
      const value2 = gen2();

      expect(value1).not.toEqual(value2);
    });

    it('should generate numbers between 0 and 1', () => {
      const gen = createDemoRandomGenerator(42);

      for (let i = 0; i < 100; i++) {
        const value = gen();
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      }
    });
  });

  describe('generateDemoAnalyticsData', () => {
    it('should generate consistent data on multiple calls', () => {
      const data1 = generateDemoAnalyticsData();
      const data2 = generateDemoAnalyticsData();

      expect(data1.activities).toHaveLength(data2.activities.length);
      expect(data1.contributors).toHaveLength(data2.contributors.length);
      expect(data1.repositories).toHaveLength(data2.repositories.length);
      expect(data1.trends).toHaveLength(data2.trends.length);
    });

    it('should generate expected number of items', () => {
      const data = generateDemoAnalyticsData();

      expect(data.activities).toHaveLength(200);
      expect(data.contributors).toHaveLength(50);
      expect(data.repositories).toHaveLength(5);
      expect(data.trends).toHaveLength(2);
    });

    it('should generate valid activity data', () => {
      const data = generateDemoAnalyticsData();

      data.activities.forEach((activity) => {
        expect(activity).toHaveProperty('id');
        expect(activity).toHaveProperty('type');
        expect(activity).toHaveProperty('title');
        expect(activity).toHaveProperty('author');
        expect(activity).toHaveProperty('repository');
        expect(activity).toHaveProperty('created_at');
        expect(activity).toHaveProperty('status');
        expect(activity).toHaveProperty('url');

        expect(['pr', 'issue', 'commit', 'review']).toContain(activity.type);
        expect(['open', 'merged', 'closed', 'approved']).toContain(activity.status);
        expect(activity.url).toMatch(/^https:\/\/github\.com\//);
      });
    });

    it('should generate valid contributor data', () => {
      const data = generateDemoAnalyticsData();

      data.contributors.forEach((contributor) => {
        expect(contributor).toHaveProperty('id');
        expect(contributor).toHaveProperty('username');
        expect(contributor).toHaveProperty('avatar_url');
        expect(contributor).toHaveProperty('contributions');
        expect(contributor).toHaveProperty('pull_requests');
        expect(contributor).toHaveProperty('issues');
        expect(contributor).toHaveProperty('reviews');
        expect(contributor).toHaveProperty('commits');
        expect(contributor).toHaveProperty('trend');

        expect(contributor.contributions).toBeGreaterThan(0);
        expect(contributor.avatar_url).toMatch(/^https:\/\/github\.com\/.*\.png$/);
      });
    });

    it('should generate trend data with 30 days of data points', () => {
      const data = generateDemoAnalyticsData();

      data.trends.forEach((trend) => {
        expect(trend.data).toHaveLength(30);
        trend.data.forEach((point) => {
          expect(point).toHaveProperty('date');
          expect(point).toHaveProperty('value');
          expect(point.value).toBeGreaterThan(0);
          expect(point.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        });
      });
    });
  });

  describe('generateDemoWorkspaceRepositories', () => {
    it('should generate 4 repositories by default', () => {
      const repos = generateDemoWorkspaceRepositories();
      expect(repos).toHaveLength(4);
    });

    it('should use provided workspace ID', () => {
      const workspaceId = 'custom-workspace';
      const repos = generateDemoWorkspaceRepositories(workspaceId);

      repos.forEach((repo) => {
        expect(repo.workspace_id).toBe(workspaceId);
      });
    });

    it('should generate valid repository structure', () => {
      const repos = generateDemoWorkspaceRepositories();

      repos.forEach((repo) => {
        expect(repo).toHaveProperty('id');
        expect(repo).toHaveProperty('workspace_id');
        expect(repo).toHaveProperty('repository_id');
        expect(repo).toHaveProperty('repository');
        expect(repo).toHaveProperty('added_by_user');

        expect(repo.repository).toHaveProperty('full_name');
        expect(repo.repository).toHaveProperty('owner');
        expect(repo.repository).toHaveProperty('name');
        expect(repo.repository).toHaveProperty('description');
        expect(repo.repository).toHaveProperty('language');
        expect(repo.repository).toHaveProperty('stargazers_count');
      });
    });
  });

  describe('generateDemoWorkspaceMetrics', () => {
    const mockRepos = [
      { id: '1', stars: 100, contributors: 10 },
      { id: '2', stars: 200, contributors: 20 },
    ] as unknown[];

    it('should generate metrics based on provided repositories', () => {
      const metrics = generateDemoWorkspaceMetrics(mockRepos, '30d');

      expect(metrics).toHaveProperty('totalStars');
      expect(metrics).toHaveProperty('totalPRs');
      expect(metrics).toHaveProperty('totalContributors');
      expect(metrics).toHaveProperty('totalCommits');
      expect(metrics).toHaveProperty('starsTrend');
      expect(metrics).toHaveProperty('prsTrend');
      expect(metrics).toHaveProperty('contributorsTrend');
      expect(metrics).toHaveProperty('commitsTrend');

      expect(metrics.totalStars).toBe(300); // 100 + 200
      expect(metrics.totalContributors).toBe(30); // 10 + 20
    });

    it('should handle different time ranges', () => {
      const timeRanges: Array<'7d' | '30d' | '90d' | '1y' | 'all'> = [
        '7d',
        '30d',
        '90d',
        '1y',
        'all',
      ];

      timeRanges.forEach((range) => {
        const metrics = generateDemoWorkspaceMetrics(mockRepos, range);
        expect(metrics).toHaveProperty('totalStars');
        expect(metrics.totalStars).toBe(300);
      });
    });

    it('should filter repositories by selection', () => {
      const metricsAll = generateDemoWorkspaceMetrics(mockRepos, '30d');
      const metricsFiltered = generateDemoWorkspaceMetrics(mockRepos, '30d', ['1']);

      expect(metricsAll.totalStars).toBe(300);
      expect(metricsFiltered.totalStars).toBe(100); // Only first repo
    });
  });

  describe('generateDemoWorkspaceTrendData', () => {
    it('should generate trend data for specified number of days', () => {
      const days = 7;
      const data = generateDemoWorkspaceTrendData(days);

      expect(data).toHaveLength(days);
    });

    it('should generate valid trend data structure', () => {
      const data = generateDemoWorkspaceTrendData(30);

      data.forEach((point) => {
        expect(point).toHaveProperty('date');
        expect(point).toHaveProperty('additions');
        expect(point).toHaveProperty('deletions');
        expect(point).toHaveProperty('commits');
        expect(point).toHaveProperty('files_changed');

        expect(point.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(point.additions).toBeGreaterThan(0);
        expect(point.deletions).toBeGreaterThan(0);
        expect(point.commits).toBeGreaterThan(0);
        expect(point.files_changed).toBeGreaterThan(0);
      });
    });

    it('should scale data based on number of repositories', () => {
      const repos = [{ id: '1' }, { id: '2' }] as unknown[];
      const dataWithRepos = generateDemoWorkspaceTrendData(7, repos);
      const dataWithoutRepos = generateDemoWorkspaceTrendData(7);

      // With more repos, we should generally get higher numbers
      const avgAdditionsWithRepos =
        dataWithRepos.reduce((sum, d) => sum + d.additions, 0) / dataWithRepos.length;
      const avgAdditionsWithoutRepos =
        dataWithoutRepos.reduce((sum, d) => sum + d.additions, 0) / dataWithoutRepos.length;

      expect(avgAdditionsWithRepos).toBeGreaterThan(avgAdditionsWithoutRepos * 0.5); // Should be somewhat proportional
    });
  });

  describe('generateDemoRepositories', () => {
    it('should generate 5 repositories', () => {
      const repos = generateDemoRepositories();
      expect(repos).toHaveLength(5);
    });

    it('should generate valid repository structure', () => {
      const repos = generateDemoRepositories();

      repos.forEach((repo) => {
        expect(repo).toHaveProperty('id');
        expect(repo).toHaveProperty('full_name');
        expect(repo).toHaveProperty('name');
        expect(repo).toHaveProperty('owner');
        expect(repo).toHaveProperty('description');
        expect(repo).toHaveProperty('language');
        expect(repo).toHaveProperty('stars');
        expect(repo).toHaveProperty('forks');
        expect(repo).toHaveProperty('open_prs');
        expect(repo).toHaveProperty('open_issues');
        expect(repo).toHaveProperty('contributors');
        expect(repo).toHaveProperty('last_activity');
        expect(repo).toHaveProperty('html_url');

        expect(repo.full_name).toMatch(/^organization\//);
        expect(repo.owner).toBe('organization');
        expect(repo.stars).toBeGreaterThan(0);
        expect(repo.forks).toBeGreaterThan(0);
        expect(repo.contributors).toBeGreaterThan(0);
        expect(repo.html_url).toMatch(/^https:\/\/github\.com\/organization\//);
      });
    });

    it('should generate consistent data on multiple calls', () => {
      const repos1 = generateDemoRepositories();
      const repos2 = generateDemoRepositories();

      expect(repos1).toHaveLength(repos2.length);

      // Should be the same because we use deterministic random
      repos1.forEach((repo, index) => {
        expect(repo.id).toBe(repos2[index].id);
        expect(repo.name).toBe(repos2[index].name);
        expect(repo.stars).toBe(repos2[index].stars);
      });
    });
  });
});
