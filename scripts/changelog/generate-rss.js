#!/usr/bin/env node

/**
 * Generate RSS and Atom feeds from CHANGELOG.md
 * This script parses the changelog and creates machine-readable feeds
 * for better content freshness signaling to LLMs and feed readers
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { marked } from 'marked';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CHANGELOG_PATH = path.join(process.cwd(), 'CHANGELOG.md');
const PUBLIC_DIR = path.join(process.cwd(), 'public');
const RSS_PATH = path.join(PUBLIC_DIR, 'changelog-rss.xml');
const ATOM_PATH = path.join(PUBLIC_DIR, 'changelog-atom.xml');

const SITE_URL = 'https://contributor.info';
const FEED_TITLE = 'contributor.info Changelog';
const FEED_DESCRIPTION =
  'All notable changes to contributor.info - the platform for understanding open source repository health and dynamics.';
const FEED_AUTHOR = 'contributor.info Team';
const FEED_EMAIL = 'team@contributor.info';

/**
 * Parse CHANGELOG.md to extract version entries
 */
function parseChangelog(content) {
  const entries = [];

  // Updated regex to handle markdown links in version headers
  const versionRegex = /## \[([0-9.]+)\]\(([^)]+)\) \((.+?)\)/g;
  const matches = [...content.matchAll(versionRegex)];

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const version = match[1];
    const versionLink = match[2];
    const date = match[3];

    // Extract content between this version and the next
    const startIndex = match.index + match[0].length;
    const endIndex = matches[i + 1]?.index || content.length;
    const entryContent = content.slice(startIndex, endIndex).trim();

    // Parse the content into sections
    const sections = parseVersionContent(entryContent);

    entries.push({
      version,
      versionLink,
      date: parseDate(date),
      dateString: date,
      title: `Version ${version}`,
      content: entryContent,
      sections,
      guid: `${SITE_URL}/changelog#version-${version.replace(/\./g, '-')}`,
    });
  }

  return entries;
}

/**
 * Parse version content into categorized sections
 */
function parseVersionContent(content) {
  const sections = {
    features: [],
    fixes: [],
    performance: [],
    documentation: [],
    breaking: [],
  };

  const lines = content.split('\n');
  let currentSection = null;

  for (const line of lines) {
    // Detect section headers
    if (line.includes('### 🚀 Features') || line.includes('### Features')) {
      currentSection = 'features';
    } else if (line.includes('### 🐛 Bug Fixes') || line.includes('### Bug Fixes')) {
      currentSection = 'fixes';
    } else if (line.includes('### ⚡ Performance') || line.includes('### Performance')) {
      currentSection = 'performance';
    } else if (line.includes('### 📚 Documentation') || line.includes('### Documentation')) {
      currentSection = 'documentation';
    } else if (line.includes('### ⚠️ Breaking') || line.includes('### Breaking')) {
      currentSection = 'breaking';
    } else if (line.startsWith('* ') && currentSection) {
      // Extract item text without the asterisk
      const item = line.substring(2).trim();
      sections[currentSection].push(item);
    }
  }

  return sections;
}

/**
 * Parse date string to Date object
 */
function parseDate(dateStr) {
  // Handle various date formats
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    // Throw error for invalid dates to ensure changelog integrity
    throw new Error(
      `Invalid date format in changelog: "${dateStr}". Please use a valid date format like "2025-01-15" or "January 15, 2025"`
    );
  }
  return date;
}

/**
 * Escape XML special characters
 */
function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Convert markdown to HTML for feed content using marked library
 */
function markdownToHtml(markdown) {
  try {
    // Configure marked for safe rendering
    marked.setOptions({
      breaks: true,
      gfm: true,
      headerIds: false,
      mangle: false,
      sanitize: false, // We're escaping XML separately
    });

    return marked.parse(markdown);
  } catch (error) {
    console.warn('Failed to parse markdown with marked, using fallback:', error.message);
    // Fallback to simple conversion
    let html = markdown;

    // Convert headers
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');

    // Convert bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Convert links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

    // Convert list items
    html = html.replace(/^\* (.+)$/gm, '<li>$1</li>');

    // Wrap consecutive list items in ul tags
    html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);

    // Convert line breaks
    html = html.replace(/\n\n/g, '</p><p>');
    html = `<p>${html}</p>`;

    return html;
  }
}

/**
 * Generate RSS 2.0 feed
 */
function generateRss(entries) {
  const now = new Date().toUTCString();

  let rss = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${escapeXml(FEED_TITLE)}</title>
    <description>${escapeXml(FEED_DESCRIPTION)}</description>
    <link>${SITE_URL}/changelog</link>
    <atom:link href="${SITE_URL}/changelog-rss.xml" rel="self" type="application/rss+xml" />
    <language>en-us</language>
    <lastBuildDate>${now}</lastBuildDate>
    <pubDate>${entries[0]?.date.toUTCString() || now}</pubDate>
    <ttl>1440</ttl>
    <generator>contributor.info RSS Generator</generator>
    <webMaster>${FEED_EMAIL} (${FEED_AUTHOR})</webMaster>
    <managingEditor>${FEED_EMAIL} (${FEED_AUTHOR})</managingEditor>
`;

  // Add WebSub hub links for real-time updates
  rss += `    <atom:link rel="hub" href="${SITE_URL}/api/websub/hub" />
`;

  // Add entries
  for (const entry of entries.slice(0, 20)) {
    // Limit to 20 most recent
    const htmlContent = generateEntryHtml(entry);

    rss += `
    <item>
      <title>${escapeXml(entry.title)} - ${escapeXml(entry.dateString)}</title>
      <description>${escapeXml(generateEntrySummary(entry))}</description>
      <content:encoded><![CDATA[${htmlContent}]]></content:encoded>
      <link>${entry.versionLink || entry.guid}</link>
      <guid isPermaLink="true">${entry.guid}</guid>
      <pubDate>${entry.date.toUTCString()}</pubDate>
      <author>${FEED_EMAIL} (${FEED_AUTHOR})</author>
      <category>Release</category>
`;

    // Add categories based on content
    if (entry.sections.features.length > 0) {
      rss += `      <category>Features</category>\n`;
    }
    if (entry.sections.fixes.length > 0) {
      rss += `      <category>Bug Fixes</category>\n`;
    }
    if (entry.sections.breaking.length > 0) {
      rss += `      <category>Breaking Changes</category>\n`;
    }

    rss += `    </item>`;
  }

  rss += `
  </channel>
</rss>`;

  return rss;
}

/**
 * Generate Atom 1.0 feed
 */
function generateAtom(entries) {
  const now = new Date().toISOString();

  let atom = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:webfeeds="http://webfeeds.org/rss/1.0">
  <title>${escapeXml(FEED_TITLE)}</title>
  <subtitle>${escapeXml(FEED_DESCRIPTION)}</subtitle>
  <link href="${SITE_URL}/changelog" rel="alternate" type="text/html"/>
  <link href="${SITE_URL}/changelog-atom.xml" rel="self" type="application/atom+xml"/>
  <link href="${SITE_URL}/api/websub/hub" rel="hub"/>
  <id>${SITE_URL}/changelog</id>
  <updated>${entries[0]?.date.toISOString() || now}</updated>
  <author>
    <name>${FEED_AUTHOR}</name>
    <email>${FEED_EMAIL}</email>
  </author>
  <generator>contributor.info Atom Generator</generator>
  <webfeeds:icon>${SITE_URL}/favicon.ico</webfeeds:icon>
  <webfeeds:accentColor>3B82F6</webfeeds:accentColor>
`;

  // Add entries
  for (const entry of entries.slice(0, 20)) {
    const htmlContent = generateEntryHtml(entry);

    atom += `
  <entry>
    <title>${escapeXml(entry.title)} - ${escapeXml(entry.dateString)}</title>
    <link href="${entry.versionLink || entry.guid}" rel="alternate" type="text/html"/>
    <id>${entry.guid}</id>
    <published>${entry.date.toISOString()}</published>
    <updated>${entry.date.toISOString()}</updated>
    <summary type="text">${escapeXml(generateEntrySummary(entry))}</summary>
    <content type="html">${escapeXml(htmlContent)}</content>
    <author>
      <name>${FEED_AUTHOR}</name>
      <email>${FEED_EMAIL}</email>
    </author>
`;

    // Add categories
    if (entry.sections.features.length > 0) {
      atom += `    <category term="Features"/>\n`;
    }
    if (entry.sections.fixes.length > 0) {
      atom += `    <category term="Bug Fixes"/>\n`;
    }
    if (entry.sections.breaking.length > 0) {
      atom += `    <category term="Breaking Changes"/>\n`;
    }

    atom += `  </entry>`;
  }

  atom += `
</feed>`;

  return atom;
}

/**
 * Generate HTML content for an entry
 */
function generateEntryHtml(entry) {
  let html = `<h2>${escapeXml(entry.title)}</h2>\n`;
  html += `<p><strong>Released on ${escapeXml(entry.dateString)}</strong></p>\n`;

  if (entry.sections.features.length > 0) {
    html += '<h3>🚀 Features</h3>\n<ul>\n';
    for (const feature of entry.sections.features) {
      html += `<li>${escapeXml(feature)}</li>\n`;
    }
    html += '</ul>\n';
  }

  if (entry.sections.fixes.length > 0) {
    html += '<h3>🐛 Bug Fixes</h3>\n<ul>\n';
    for (const fix of entry.sections.fixes) {
      html += `<li>${escapeXml(fix)}</li>\n`;
    }
    html += '</ul>\n';
  }

  if (entry.sections.performance.length > 0) {
    html += '<h3>⚡ Performance Improvements</h3>\n<ul>\n';
    for (const perf of entry.sections.performance) {
      html += `<li>${escapeXml(perf)}</li>\n`;
    }
    html += '</ul>\n';
  }

  if (entry.sections.breaking.length > 0) {
    html += '<h3>⚠️ Breaking Changes</h3>\n<ul>\n';
    for (const breaking of entry.sections.breaking) {
      html += `<li>${escapeXml(breaking)}</li>\n`;
    }
    html += '</ul>\n';
  }

  if (entry.versionLink) {
    html += `<p><a href="${escapeXml(entry.versionLink)}">View full release notes on GitHub</a></p>\n`;
  }

  return html;
}

/**
 * Generate a text summary for an entry
 */
function generateEntrySummary(entry) {
  const parts = [];

  if (entry.sections.features.length > 0) {
    parts.push(`${entry.sections.features.length} new features`);
  }
  if (entry.sections.fixes.length > 0) {
    parts.push(`${entry.sections.fixes.length} bug fixes`);
  }
  if (entry.sections.performance.length > 0) {
    parts.push(`${entry.sections.performance.length} performance improvements`);
  }
  if (entry.sections.breaking.length > 0) {
    parts.push(`${entry.sections.breaking.length} breaking changes`);
  }

  if (parts.length === 0) {
    return 'Release notes for ' + entry.title;
  }

  return parts.join(', ') + '.';
}

/**
 * Main function
 */
function main() {
  try {
    // Read changelog
    if (!fs.existsSync(CHANGELOG_PATH)) {
      console.error('CHANGELOG.md not found');
      process.exit(1);
    }

    const changelogContent = fs.readFileSync(CHANGELOG_PATH, 'utf-8');

    // Parse entries
    const entries = parseChangelog(changelogContent);

    if (entries.length === 0) {
      console.warn('No version entries found in changelog');
      process.exit(0);
    }

    console.log(`Found ${entries.length} changelog entries`);

    // Ensure public directory exists
    if (!fs.existsSync(PUBLIC_DIR)) {
      fs.mkdirSync(PUBLIC_DIR, { recursive: true });
    }

    // Generate and write RSS feed
    const rssFeed = generateRss(entries);
    fs.writeFileSync(RSS_PATH, rssFeed, 'utf-8');
    console.log(`✅ Generated RSS feed: ${RSS_PATH}`);

    // Generate and write Atom feed
    const atomFeed = generateAtom(entries);
    fs.writeFileSync(ATOM_PATH, atomFeed, 'utf-8');
    console.log(`✅ Generated Atom feed: ${ATOM_PATH}`);

    // Update feed metadata file for monitoring
    const metadata = {
      lastGenerated: new Date().toISOString(),
      entriesCount: entries.length,
      latestVersion: entries[0]?.version,
      latestDate: entries[0]?.date.toISOString(),
    };

    fs.writeFileSync(
      path.join(PUBLIC_DIR, 'changelog-feeds.json'),
      JSON.stringify(metadata, null, 2),
      'utf-8'
    );

    console.log('✅ Feed generation complete');
  } catch (error) {
    console.error('Error generating feeds:', error);
    process.exit(1);
  }
}

// Run if called directly (not when imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { parseChangelog, generateRss, generateAtom };
