import { cn } from "@/lib/utils";
import type { BadgeConfig, WidgetData } from "./widget-types";

interface BadgeGeneratorProps {
  config: BadgeConfig;
  data: WidgetData;
  className?: string;
}

// Badge style configurations
const BADGE_STYLES = {
  flat: {
    containerClass: "rounded",
    leftClass: "rounded-l",
    rightClass: "rounded-r",
    height: 20,
    shadow: false,
  },
  "flat-square": {
    containerClass: "rounded-none",
    leftClass: "rounded-none",
    rightClass: "rounded-none", 
    height: 20,
    shadow: false,
  },
  plastic: {
    containerClass: "rounded",
    leftClass: "rounded-l",
    rightClass: "rounded-r",
    height: 18,
    shadow: true,
  },
  social: {
    containerClass: "rounded-md",
    leftClass: "rounded-l-md",
    rightClass: "rounded-r-md",
    height: 22,
    shadow: false,
  },
};

// Color schemes for badge metrics
const COLORS = {
  contributors: "#007ec6",
  pullRequests: "#28a745",
  mergeRate: {
    high: "#28a745",    // > 80%
    medium: "#ffc107",  // > 60%
    low: "#dc3545"      // <= 60%
  },
  lotteryFactor: {
    excellent: "#28a745",  // > 3
    good: "#ffc107",       // > 2
    poor: "#dc3545",       // <= 2
    unavailable: "#6c757d" // N/A
  },
  activity: {
    active: "#28a745",
    low: "#ffc107"
  }
};

// Helper functions to determine colors
function getMergeRateColor(rate: number): string {
  if (rate > 80) return COLORS.mergeRate.high;
  if (rate > 60) return COLORS.mergeRate.medium;
  return COLORS.mergeRate.low;
}

function getLotteryFactorColor(factor: number | undefined): string {
  if (!factor) return COLORS.lotteryFactor.unavailable;
  if (factor > 3) return COLORS.lotteryFactor.excellent;
  if (factor > 2) return COLORS.lotteryFactor.good;
  return COLORS.lotteryFactor.poor;
}

// Predefined badge types with time context
const BADGE_PRESETS = {
  contributors: (data: WidgetData) => ({
    label: "contributors (30d)",
    message: data.stats.totalContributors.toString(),
    color: COLORS.contributors,
  }),
  "pull-requests": (data: WidgetData) => ({
    label: "PRs (30d)", 
    message: data.stats.totalPRs.toString(),
    color: COLORS.pullRequests,
  }),
  "merge-rate": (data: WidgetData) => ({
    label: "merge rate (30d)",
    message: `${data.stats.mergeRate.toFixed(1)}%`,
    color: getMergeRateColor(data.stats.mergeRate),
  }),
  "lottery-factor": (data: WidgetData) => ({
    label: "lottery factor (30d)",
    message: data.stats.lotteryFactor?.toFixed(1) || "N/A",
    color: getLotteryFactorColor(data.stats.lotteryFactor),
  }),
  activity: (data: WidgetData) => ({
    label: "activity (7d)",
    message: data.activity.recentActivity ? "active" : "low",
    color: data.activity.recentActivity ? COLORS.activity.active : COLORS.activity.low,
  }),
};

// Security functions for safe SVG generation
function escapeXml(text: any): string {
  if (typeof text !== 'string') {
    text = String(text);
  }
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

function sanitizeColor(color: string): string {
  const hexPattern = /^#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;
  const rgbPattern = /^rgba?\(\s*(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])\s*,\s*(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])\s*,\s*(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])\s*(?:,\s*(?:0?\.?[0-9]+|1(?:\.0+)?|0))?\)$/;
  const namedColors = ['red', 'green', 'blue', 'yellow', 'orange', 'purple', 'gray', 'black', 'white'];
  
  if (hexPattern.test(color) || rgbPattern.test(color) || namedColors.includes(color.toLowerCase())) {
    return color;
  }
  
  return '#007ec6';
}


export function BadgeGenerator({ config, data, className }: BadgeGeneratorProps) {
  const style = config.style || 'flat';
  const styleConfig = BADGE_STYLES[style];
  
  // Get badge content
  let badgeContent;
  if (config.label && config.message) {
    // Custom badge
    badgeContent = {
      label: config.label,
      message: config.message,
      color: config.color || "#007ec6",
    };
  } else {
    // Preset badge - infer from config or use first metric
    const presetKey = config.metrics?.[0] || 'contributors';
    const preset = BADGE_PRESETS[presetKey as keyof typeof BADGE_PRESETS];
    badgeContent = preset ? preset(data) : BADGE_PRESETS.contributors(data);
  }

  const { label, message, color } = badgeContent;

  // Generate SVG badge
  const generateSVG = () => {
    // Escape user inputs to prevent XSS
    const safeLabel = escapeXml(label);
    const safeMessage = escapeXml(message);
    const safeColor = sanitizeColor(color);
    
    // Calculate widths based on escaped content to prevent truncation
    const labelWidth = Math.max(safeLabel.length * 6.5 + 10, 50);
    const messageWidth = Math.max(safeMessage.length * 6.5 + 10, 30);
    const totalWidth = labelWidth + messageWidth;
    const height = styleConfig.height;

    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${height}" viewBox="0 0 ${totalWidth} ${height}">
        <defs>
          ${styleConfig.shadow ? `
            <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="rgba(0,0,0,0.2)"/>
            </filter>
          ` : ''}
        </defs>
        
        <!-- Left background (label) -->
        <rect x="0" y="0" width="${labelWidth}" height="${height}" fill="#555" rx="${style.includes('flat') && !style.includes('square') ? 3 : 0}"/>
        
        <!-- Right background (message) -->  
        <rect x="${labelWidth}" y="0" width="${messageWidth}" height="${height}" fill="${safeColor}" rx="${style.includes('flat') && !style.includes('square') ? 3 : 0}"/>
        
        <!-- Left text (label) -->
        <text x="${labelWidth / 2}" y="${height / 2}" 
              text-anchor="middle" 
              dominant-baseline="central"
              font-family="Verdana,Geneva,DejaVu Sans,sans-serif" 
              font-size="11" 
              fill="white">
          ${safeLabel}
        </text>
        
        <!-- Right text (message) -->
        <text x="${labelWidth + messageWidth / 2}" y="${height / 2}" 
              text-anchor="middle" 
              dominant-baseline="central"
              font-family="Verdana,Geneva,DejaVu Sans,sans-serif" 
              font-size="11" 
              font-weight="bold"
              fill="white">
          ${safeMessage}
        </text>
      </svg>
    `.trim();
  };

  if (config.format === 'svg') {
    // Return raw SVG for embedding
    return (
      <div 
        className={cn("embeddable-widget badge-svg", className)}
        dangerouslySetInnerHTML={{ __html: generateSVG() }}
      />
    );
  }

  // Generate HTML badge with styles
  const badgeUrl = `${window.location.origin}/api/widget/badge?` + new URLSearchParams({
    owner: data.repository.owner,
    repo: data.repository.repo,
    type: config.metrics?.[0] || 'contributors',
    style: config.style || 'flat',
    label: config.label || '',
    color: config.color || '',
  }).toString();

  const embedCode = config.format === 'html' 
    ? `<img src="${badgeUrl}" alt="${data.repository.repo} badge" />`
    : `![${data.repository.repo} badge](${badgeUrl})`;

  return (
    <div className={cn("badge-generator", className)}>
      <div className="badge-preview mb-4">
        <img src={badgeUrl} alt="Badge preview" />
      </div>
      
      <div className="embed-code p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
        <p className="text-sm font-medium mb-2">Embed Code:</p>
        <code className="text-xs break-all">{embedCode}</code>
      </div>
    </div>
  );
}

// Utility function to generate badge URL
export function generateBadgeURL(config: BadgeConfig, data: WidgetData): string {
  return `${window.location.origin}/api/widget/badge?` + new URLSearchParams({
    owner: data.repository.owner,
    repo: data.repository.repo,
    type: config.metrics?.[0] || 'contributors',
    style: config.style || 'flat',
    label: config.label || '',
    color: config.color || '',
  }).toString();
}

// Utility function to generate badge markdown
export function generateBadgeMarkdown(config: BadgeConfig, data: WidgetData): string {
  const badgeUrl = generateBadgeURL(config, data);
  return `![${data.repository.repo} badge](${badgeUrl})`;
}