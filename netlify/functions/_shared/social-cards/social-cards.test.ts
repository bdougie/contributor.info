import { describe, expect, it } from 'vitest';
import { sizedAvatarUrl } from './avatars';
import { formatNumber, generateSocialCard } from './card-generator';
import { cardHeaders, errorHeaders, parseCardRequest, sanitizeName } from './http';

describe('sanitizeName', () => {
  it('accepts GitHub-safe names', () => {
    expect(sanitizeName('bdougie')).toBe('bdougie');
    expect(sanitizeName('contributor.info')).toBe('contributor.info');
    expect(sanitizeName('my-repo_2')).toBe('my-repo_2');
  });

  it('rejects missing, oversized, and unsafe values', () => {
    expect(sanitizeName(null)).toBeNull();
    expect(sanitizeName('')).toBeNull();
    expect(sanitizeName('a'.repeat(101))).toBeNull();
    expect(sanitizeName('owner/../etc')).toBeNull();
    expect(sanitizeName('<script>')).toBeNull();
    expect(sanitizeName('a b')).toBeNull();
  });
});

describe('parseCardRequest', () => {
  it('parses repo cards from path and query', () => {
    const req = parseCardRequest(
      new URL('https://contributor.info/social-cards/repo?owner=vitejs&repo=vite')
    );
    expect(req).toEqual({ type: 'repo', owner: 'vitejs', repo: 'vite', username: null });
  });

  it('parses user cards', () => {
    const req = parseCardRequest(
      new URL('https://contributor.info/social-cards/user?username=bdougie')
    );
    expect(req).toEqual({ type: 'user', owner: null, repo: null, username: 'bdougie' });
  });

  it('infers type from query when the path segment is bare', () => {
    const repo = parseCardRequest(
      new URL('https://contributor.info/social-cards?owner=vitejs&repo=vite')
    );
    expect(repo.type).toBe('repo');
    const user = parseCardRequest(new URL('https://contributor.info/social-cards?username=b'));
    expect(user.type).toBe('user');
  });

  it('falls back to the home card on missing or malformed params', () => {
    expect(parseCardRequest(new URL('https://contributor.info/social-cards')).type).toBe('home');
    expect(parseCardRequest(new URL('https://contributor.info/social-cards/home')).type).toBe(
      'home'
    );
    // repo card missing its repo param
    expect(
      parseCardRequest(new URL('https://contributor.info/social-cards/repo?owner=vitejs')).type
    ).toBe('home');
    // injection attempt sanitized away
    expect(
      parseCardRequest(
        new URL('https://contributor.info/social-cards/repo?owner=%3Cscript%3E&repo=vite')
      ).type
    ).toBe('home');
    // unknown card type
    expect(
      parseCardRequest(new URL('https://contributor.info/social-cards/workspace?name=x')).type
    ).toBe('home');
  });
});

describe('cardHeaders', () => {
  const headers = cardHeaders({ dataMs: 12.34, resvgMs: 56.78 }, 'database');

  it('caches durably at the CDN with stale-while-revalidate', () => {
    expect(headers['Netlify-CDN-Cache-Control']).toContain('durable');
    expect(headers['Netlify-CDN-Cache-Control']).toContain('s-maxage=86400');
    expect(headers['Netlify-CDN-Cache-Control']).toContain('stale-while-revalidate');
  });

  it('varies the CDN cache key on the card params', () => {
    // Without Netlify-Vary the CDN ignores the query string and every card
    // URL would serve whichever card rendered first.
    expect(headers['Netlify-Vary']).toBe('query=owner|repo|username');
  });

  it('reports render timings, data source, and content type', () => {
    expect(headers['Content-Type']).toBe('image/png');
    expect(headers['Server-Timing']).toBe('data;dur=12.3, resvg;dur=56.8');
    expect(headers['X-Data-Source']).toBe('database');
  });
});

describe('errorHeaders', () => {
  it('never lets failures land in the durable cache', () => {
    expect(errorHeaders()['Cache-Control']).toBe('no-store');
  });
});

describe('sizedAvatarUrl', () => {
  it('adds a size param to GitHub avatar URLs', () => {
    expect(sizedAvatarUrl('https://avatars.githubusercontent.com/u/5713670?v=4')).toBe(
      'https://avatars.githubusercontent.com/u/5713670?v=4&s=80'
    );
  });

  it('rejects non-GitHub or non-https hosts', () => {
    expect(sizedAvatarUrl('https://evil.example.com/a.png')).toBeNull();
    expect(sizedAvatarUrl('http://avatars.githubusercontent.com/u/1')).toBeNull();
    expect(sizedAvatarUrl('not a url')).toBeNull();
  });
});

describe('formatNumber', () => {
  it('formats magnitudes', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(999)).toBe('999');
    expect(formatNumber(1500)).toBe('1.5K');
    expect(formatNumber(2000000)).toBe('2.0M');
  });

  it('never renders negative or missing values', () => {
    expect(formatNumber(-5)).toBe('0');
    expect(formatNumber(Number.NaN)).toBe('0');
  });
});

describe('generateSocialCard', () => {
  it('escapes HTML in titles', () => {
    const svg = generateSocialCard({
      type: 'user',
      title: '@<script>alert(1)</script>',
    });
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;');
  });

  it('renders zeros — never mock figures — when stats are unavailable', () => {
    const svg = generateSocialCard({ type: 'repo', title: 'a/b', stats: null });
    expect(svg).toContain('>0</text>');
    // The old fallback numbers must not resurface as real-looking data
    expect(svg).not.toContain('>10<');
    expect(svg).not.toContain('>25<');
  });

  it('renders repo stats when present', () => {
    const svg = generateSocialCard({
      type: 'repo',
      title: 'vitejs/vite',
      stats: { weeklyPRVolume: 42, activeContributors: 18, totalContributors: 312 },
    });
    expect(svg).toContain('vitejs/vite');
    expect(svg).toContain('>42</text>');
    expect(svg).toContain('>18</text>');
    expect(svg).toContain('+307');
  });

  it('embeds avatar images and pads the rest with placeholder circles', () => {
    const avatar = 'data:image/png;base64,AAAA';
    const svg = generateSocialCard({
      type: 'repo',
      title: 'a/b',
      stats: { weeklyPRVolume: 1, activeContributors: 2, totalContributors: 30 },
      avatars: [avatar, avatar],
    });
    expect(svg.match(/<image href="data:image\/png;base64,AAAA"/g)).toHaveLength(2);
    // remaining 3 of the 5 slots stay placeholders
    expect(svg.match(/opacity="0\.3"/g)).toHaveLength(3);
  });

  it('renders all placeholder circles when no avatars are available', () => {
    const svg = generateSocialCard({ type: 'repo', title: 'a/b', stats: null });
    expect(svg).not.toContain('<image');
    expect(svg.match(/opacity="0\.3"/g)).toHaveLength(5);
  });

  it('produces a 1200x630 SVG for every card type', () => {
    const cards = [
      generateSocialCard({ type: 'home', stats: null }),
      generateSocialCard({ type: 'repo', title: 'a/b', stats: null }),
      generateSocialCard({ type: 'user', title: '@a' }),
      generateSocialCard({ type: 'error', title: 'Error', subtitle: 'Failed' }),
    ];
    for (const svg of cards) {
      expect(svg).toContain('width="1200" height="630"');
    }
  });
});
