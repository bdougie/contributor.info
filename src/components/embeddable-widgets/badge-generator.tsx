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

// Predefined badge types
const BADGE_PRESETS = {
  contributors: (data: WidgetData) => ({
    label: "contributors",
    message: data.stats.totalContributors.toString(),
    color: "#007ec6",
  }),
  "pull-requests": (data: WidgetData) => ({
    label: "pull requests", 
    message: data.stats.totalPRs.toString(),
    color: "#28a745",
  }),
  "merge-rate": (data: WidgetData) => ({
    label: "merge rate",
    message: `${data.stats.mergeRate.toFixed(1)}%`,
    color: data.stats.mergeRate > 80 ? "#28a745" : data.stats.mergeRate > 60 ? "#ffc107" : "#dc3545",
  }),
  "lottery-factor": (data: WidgetData) => ({
    label: "lottery factor",
    message: data.stats.lotteryFactor?.toFixed(1) || "N/A",
    color: !data.stats.lotteryFactor ? "#6c757d" :
           data.stats.lotteryFactor > 3 ? "#28a745" : 
           data.stats.lotteryFactor > 2 ? "#ffc107" : "#dc3545",
  }),
  activity: (data: WidgetData) => ({
    label: "activity",
    message: data.activity.recentActivity ? "active" : "low",
    color: data.activity.recentActivity ? "#28a745" : "#ffc107",
  }),
};

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
    const labelWidth = Math.max(label.length * 6.5 + 10, 50);
    const messageWidth = Math.max(message.length * 6.5 + 10, 30);
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
        <rect x="${labelWidth}" y="0" width="${messageWidth}" height="${height}" fill="${color}" rx="${style.includes('flat') && !style.includes('square') ? 3 : 0}"/>
        
        <!-- Left text (label) -->
        <text x="${labelWidth / 2}" y="${height / 2}" 
              text-anchor="middle" 
              dominant-baseline="central"
              font-family="Verdana,Geneva,DejaVu Sans,sans-serif" 
              font-size="11" 
              fill="white">
          ${label}
        </text>
        
        <!-- Right text (message) -->
        <text x="${labelWidth + messageWidth / 2}" y="${height / 2}" 
              text-anchor="middle" 
              dominant-baseline="central"
              font-family="Verdana,Geneva,DejaVu Sans,sans-serif" 
              font-size="11" 
              font-weight="bold"
              fill="white">
          ${message}
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

  // Return HTML badge for preview/embedding
  return (
    <div className={cn("embeddable-widget badge-html inline-flex", className)}>
      <div className={cn(
        "flex items-center h-5 text-xs font-medium",
        styleConfig.containerClass,
        styleConfig.shadow && "shadow-sm"
      )}>
        <span className={cn(
          "px-2 bg-gray-500 text-white",
          styleConfig.leftClass
        )}>
          {label}
        </span>
        <span 
          className={cn(
            "px-2 text-white font-semibold",
            styleConfig.rightClass
          )}
          style={{ backgroundColor: color }}
        >
          {message}
        </span>
      </div>
    </div>
  );
}

// Utility function to generate badge URLs for direct embedding
export function generateBadgeURL(
  owner: string, 
  repo: string, 
  type: keyof typeof BADGE_PRESETS = 'contributors',
  style: keyof typeof BADGE_STYLES = 'flat'
): string {
  const baseURL = typeof window !== 'undefined' 
    ? window.location.origin 
    : 'https://contributor.info';
  
  return `${baseURL}/api/widgets/badge?owner=${owner}&repo=${repo}&type=${type}&style=${style}`;
}

// Generate markdown for README embedding
export function generateBadgeMarkdown(
  owner: string,
  repo: string, 
  type: keyof typeof BADGE_PRESETS = 'contributors',
  style: keyof typeof BADGE_STYLES = 'flat'
): string {
  const badgeURL = generateBadgeURL(owner, repo, type, style);
  const repoURL = `https://contributor.info/${owner}/${repo}`;
  
  return `[![${type}](${badgeURL})](${repoURL})`;
}