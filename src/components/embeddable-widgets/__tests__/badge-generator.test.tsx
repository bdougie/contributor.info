
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

    // Check that the SVG renders correctly with JSX escaping
    const svg = svgContainer?.querySelector('svg');
    expect(svg).toBeDefined();

    // Verify aria-label is set (accessibility)
    expect(svg?.getAttribute('aria-label')).toBeDefined();

    // Check that no actual script element was created in the DOM
    // This is the key security test - malicious content should be text, not executable
    const scriptElements = svgContainer?.querySelectorAll('script');
    expect(scriptElements?.length).toBe(0);

    // The text content should contain the escaped version as plain text
    const textElements = svgContainer?.querySelectorAll('text');
    expect(textElements?.length).toBeGreaterThan(0);
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
    expect(svgContainer).toBeDefined();

    // Check that the SVG renders correctly with JSX escaping
    const svg = svgContainer?.querySelector('svg');
    expect(svg).toBeDefined();

    // Check that no actual img element was created in the DOM
    // This is the key security test - malicious content should be text, not executable
    const imgElements = svgContainer?.querySelectorAll('img');
    expect(imgElements?.length).toBe(0);

    // The text content should contain the escaped version as plain text
    const textElements = svgContainer?.querySelectorAll('text');
    expect(textElements?.length).toBeGreaterThan(0);
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

describe('BadgeGenerator Accessibility', () => {
  it('renders SVG with role="img" attribute', () => {
    render(
      <BadgeGenerator
        config={{
          owner: 'test-owner',
          repo: 'test-repo',
          type: 'badge',
          format: 'svg',
          label: 'contributors',
          message: '10',
        }}
        data={mockData}
      />
    );

    const svg = document.querySelector('svg');
    expect(svg?.getAttribute('role')).toBe('img');
  });

  it('includes aria-label with badge content', () => {
    render(
      <BadgeGenerator
        config={{
          owner: 'test-owner',
          repo: 'test-repo',
          type: 'badge',
          format: 'svg',
          label: 'contributors',
          message: '10',
        }}
        data={mockData}
      />
    );

    const svg = document.querySelector('svg');
    const ariaLabel = svg?.getAttribute('aria-label');
    expect(ariaLabel).toBe('contributors: 10');
  });

  it('includes title element for screen readers', () => {
    render(
      <BadgeGenerator
        config={{
          owner: 'test-owner',
          repo: 'test-repo',
          type: 'badge',
          format: 'svg',
          label: 'PRs',
          message: '20',
        }}
        data={mockData}
      />
    );

    const title = document.querySelector('svg title');
    expect(title).toBeDefined();
    expect(title?.textContent).toBe('PRs: 20');
  });
});
