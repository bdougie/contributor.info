
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BadgeGenerator } from '../badge-generator';
import type { WidgetData } from '../widget-types';

const mockData: WidgetData = {
  repository: {
    owner: 'test-owner',
    repo: 'test-repo',
  },
  stats: {
    totalContributors: 10,
    totalPRs: 20,
    mergedPRs: 15,
    mergeRate: 75,
    lotteryFactor: 2.5,
  },
  activity: {
    weeklyPRVolume: 5,
    activeContributors: 3,
    recentActivity: true,
  },
  topContributors: [],
};

describe('BadgeGenerator Security', () => {
  it('escapes malicious scripts in label', () => {
    const maliciousLabel = '"><script>alert(1)</script>';
    render(
      <BadgeGenerator
        config={{
          owner: 'test-owner',
          repo: 'test-repo',
          type: 'badge',
          format: 'svg',
          label: maliciousLabel,
          message: 'safe',
        }}
        data={mockData}
      />
    );

    const svgContainer = document.querySelector('.badge-svg');
    expect(svgContainer).toBeDefined();

    // Check that the script tag is not present as raw HTML
    // We expect the rendered output to contain the escaped version
    const html = svgContainer?.innerHTML || '';

    // The browser/jsdom might normalize quotes, but the key is that <script> is escaped
    // We expect &lt;script&gt; not <script>
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('escapes malicious scripts in message', () => {
    const maliciousMessage = '"><img src=x onerror=alert(1)>';
    render(
      <BadgeGenerator
        config={{
          owner: 'test-owner',
          repo: 'test-repo',
          type: 'badge',
          format: 'svg',
          label: 'safe',
          message: maliciousMessage,
        }}
        data={mockData}
      />
    );

    const svgContainer = document.querySelector('.badge-svg');
    const html = svgContainer?.innerHTML || '';

    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('sanitizes colors', () => {
    const maliciousColor = 'blue; background: url(javascript:alert(1))';
    render(
      <BadgeGenerator
        config={{
          owner: 'test-owner',
          repo: 'test-repo',
          type: 'badge',
          format: 'svg',
          label: 'safe',
          message: 'safe',
          color: maliciousColor,
        }}
        data={mockData}
      />
    );

    const svgContainer = document.querySelector('.badge-svg');
    // It should fall back to default color because it doesn't match the safe patterns
    expect(svgContainer?.innerHTML).toContain('fill="#007ec6"');
    expect(svgContainer?.innerHTML).not.toContain('javascript:');
  });

    it('sanitizes hex colors correctly', () => {
    render(
      <BadgeGenerator
        config={{
          owner: 'test-owner',
          repo: 'test-repo',
          type: 'badge',
          format: 'svg',
          label: 'safe',
          message: 'safe',
          color: '#ff0000',
        }}
        data={mockData}
      />
    );

    const svgContainer = document.querySelector('.badge-svg');
    expect(svgContainer?.innerHTML).toContain('fill="#ff0000"');
  });
});
