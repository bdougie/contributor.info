import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Performance thresholds for mobile
const MOBILE_THRESHOLDS = {
  FCP: { good: 1800, poor: 3000 }, // First Contentful Paint
  LCP: { good: 2500, poor: 4000 }, // Largest Contentful Paint
  CLS: { good: 0.1, poor: 0.25 }, // Cumulative Layout Shift
  FID: { good: 100, poor: 300 }, // First Input Delay
  TTI: { good: 3800, poor: 7300 }, // Time to Interactive
  SI: { good: 3387, poor: 5800 }, // Speed Index
};

// Bundle size thresholds (in KB)
const BUNDLE_THRESHOLDS = {
  CRITICAL_PATH: { good: 50, poor: 100 },
  TOTAL_JS: { good: 200, poor: 400 },
  TOTAL_CSS: { good: 50, poor: 100 },
};

async function analyzeLighthouseReport(reportPath) {
  try {
    const reportData = await fs.readFile(reportPath, 'utf8');
    const report = JSON.parse(reportData);

    const audits = report.audits;
    const metrics = {
      FCP: audits['first-contentful-paint']?.numericValue || 0,
      LCP: audits['largest-contentful-paint']?.numericValue || 0,
      CLS: audits['cumulative-layout-shift']?.numericValue || 0,
      FID: audits['max-potential-fid']?.numericValue || 0,
      TTI: audits['interactive']?.numericValue || 0,
      SI: audits['speed-index']?.numericValue || 0,
      performanceScore: report.categories?.performance?.score * 100 || 0,
    };

    // Analyze bundle sizes
    const resourceSummary = audits['resource-summary'];
    const bundles = {
      totalJS:
        resourceSummary?.details?.items?.find((item) => item.resourceType === 'script')?.size || 0,
      totalCSS:
        resourceSummary?.details?.items?.find((item) => item.resourceType === 'stylesheet')?.size ||
        0,
      totalImages:
        resourceSummary?.details?.items?.find((item) => item.resourceType === 'image')?.size || 0,
    };

    return { metrics, bundles, report: path.basename(reportPath) };
  } catch (error) {
    console.error(`Error analyzing ${reportPath}:`, error.message);
    return null;
  }
}

function getPerformanceRating(value, threshold) {
  if (value <= threshold.good) return 'GOOD';
  if (value <= threshold.poor) return 'NEEDS IMPROVEMENT';
  return 'POOR';
}

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

async function generateMobilePerformanceReport() {
  const reportsDir = path.join(__dirname, '../lighthouse-reports');

  try {
    // Ensure reports directory exists
    await fs.mkdir(reportsDir, { recursive: true });

    const reportFiles = [
      'mobile-report.json',
      'mobile-fast-report.json',
      'mobile-slow-report.json',
    ];

    console.log('🔍 Analyzing Mobile Performance Reports...\n');

    const analyses = [];

    for (const reportFile of reportFiles) {
      const reportPath = path.join(reportsDir, reportFile);

      try {
        await fs.access(reportPath);
        const analysis = await analyzeLighthouseReport(reportPath);
        if (analysis) {
          analyses.push(analysis);
        }
      } catch (error) {
        console.log(`⚠️  Report ${reportFile} not found, skipping...`);
      }
    }

    if (analyses.length === 0) {
      console.log(
        '❌ No mobile lighthouse reports found. Run npm run test:lighthouse:mobile first.'
      );
      return;
    }

    // Generate summary report
    let report = '# Mobile Performance Analysis Report\n\n';
    report += `Generated: ${new Date().toISOString()}\n\n`;

    for (const analysis of analyses) {
      const { metrics, bundles, report: reportName } = analysis;

      report += `## ${reportName.replace('.json', '').replace(/-/g, ' ').toUpperCase()}\n\n`;

      // Performance Score
      report += `**Performance Score: ${metrics.performanceScore.toFixed(1)}/100**\n\n`;

      // Core Web Vitals
      report += '### Core Web Vitals\n\n';
      report += `| Metric | Value | Rating | Threshold |\n`;
      report += `|--------|-------|--------|-----------|\n`;
      report += `| FCP | ${(metrics.FCP / 1000).toFixed(2)}s | ${getPerformanceRating(metrics.FCP, MOBILE_THRESHOLDS.FCP)} | ≤${MOBILE_THRESHOLDS.FCP.good / 1000}s good |\n`;
      report += `| LCP | ${(metrics.LCP / 1000).toFixed(2)}s | ${getPerformanceRating(metrics.LCP, MOBILE_THRESHOLDS.LCP)} | ≤${MOBILE_THRESHOLDS.LCP.good / 1000}s good |\n`;
      report += `| CLS | ${metrics.CLS.toFixed(3)} | ${getPerformanceRating(metrics.CLS, MOBILE_THRESHOLDS.CLS)} | ≤${MOBILE_THRESHOLDS.CLS.good} good |\n`;
      report += `| FID | ${metrics.FID.toFixed(0)}ms | ${getPerformanceRating(metrics.FID, MOBILE_THRESHOLDS.FID)} | ≤${MOBILE_THRESHOLDS.FID.good}ms good |\n`;
      report += `| TTI | ${(metrics.TTI / 1000).toFixed(2)}s | ${getPerformanceRating(metrics.TTI, MOBILE_THRESHOLDS.TTI)} | ≤${MOBILE_THRESHOLDS.TTI.good / 1000}s good |\n`;
      report += `| SI | ${(metrics.SI / 1000).toFixed(2)}s | ${getPerformanceRating(metrics.SI, MOBILE_THRESHOLDS.SI)} | ≤${MOBILE_THRESHOLDS.SI.good / 1000}s good |\n\n`;

      // Bundle Analysis
      report += '### Bundle Analysis\n\n';
      report += `| Resource Type | Size | Rating |\n`;
      report += `|---------------|------|---------|\n`;
      report += `| JavaScript | ${formatBytes(bundles.totalJS)} | ${bundles.totalJS / 1024 <= BUNDLE_THRESHOLDS.TOTAL_JS.good ? 'GOOD' : bundles.totalJS / 1024 <= BUNDLE_THRESHOLDS.TOTAL_JS.poor ? 'NEEDS IMPROVEMENT' : 'POOR'} |\n`;
      report += `| CSS | ${formatBytes(bundles.totalCSS)} | ${bundles.totalCSS / 1024 <= BUNDLE_THRESHOLDS.TOTAL_CSS.good ? 'GOOD' : bundles.totalCSS / 1024 <= BUNDLE_THRESHOLDS.TOTAL_CSS.poor ? 'NEEDS IMPROVEMENT' : 'POOR'} |\n`;
      report += `| Images | ${formatBytes(bundles.totalImages)} | - |\n\n`;

      report += '---\n\n';
    }

    // Recommendations
    report += '## 🎯 Mobile Optimization Recommendations\n\n';

    const avgScore =
      analyses.reduce((sum, a) => sum + a.metrics.performanceScore, 0) / analyses.length;

    if (avgScore < 75) {
      report += '### High Priority\n';
      report += '- 🚨 Critical performance issues detected\n';
      report += '- Implement aggressive code splitting for mobile\n';
      report += '- Defer non-critical JavaScript\n';
      report += '- Optimize images for mobile viewports\n\n';
    } else if (avgScore < 90) {
      report += '### Medium Priority\n';
      report += '- ⚠️ Good performance with room for improvement\n';
      report += '- Fine-tune bundle splitting strategy\n';
      report += '- Implement service worker caching\n';
      report += '- Optimize font loading\n\n';
    } else {
      report += '### Low Priority\n';
      report += '- ✅ Excellent mobile performance!\n';
      report += '- Monitor for performance regressions\n';
      report += '- Consider advanced optimizations (prefetching, etc.)\n\n';
    }

    // Save report
    const reportPath = path.join(reportsDir, 'mobile-performance-analysis.md');
    await fs.writeFile(reportPath, report, 'utf8');

    console.log('📊 Mobile Performance Analysis Complete!\n');
    console.log(`Average Performance Score: ${avgScore.toFixed(1)}/100`);
    console.log(`Report saved to: ${reportPath}`);

    // Console summary
    console.log('\n📋 Quick Summary:');
    analyses.forEach((analysis) => {
      const rating =
        analysis.metrics.performanceScore >= 90
          ? '🟢'
          : analysis.metrics.performanceScore >= 75
            ? '🟡'
            : '🔴';
      console.log(
        `${rating} ${analysis.report}: ${analysis.metrics.performanceScore.toFixed(1)}/100`
      );
    });
  } catch (error) {
    console.error('Error generating mobile performance report:', error);
    process.exit(1);
  }
}

generateMobilePerformanceReport();
