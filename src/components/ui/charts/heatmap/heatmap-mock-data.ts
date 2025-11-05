/**
 * Mock data generators for heatmap visualizations
 * Provides realistic file activity data for testing and Storybook stories
 */

export interface FileActivityDataPoint {
  file: string;
  period: string;
  changes: number;
  additions?: number;
  deletions?: number;
}

export interface HeatmapData {
  files: string[];
  periods: string[];
  data: FileActivityDataPoint[];
}

/**
 * Generate sparse file activity data (20-30 files)
 * Simulates typical small-to-medium repository activity
 */
export function generateSparseFileActivityData(): HeatmapData {
  const files = [
    'src/index.ts',
    'src/components/Button.tsx',
    'src/components/Header.tsx',
    'src/components/Footer.tsx',
    'src/utils/api.ts',
    'src/utils/helpers.ts',
    'src/hooks/useAuth.ts',
    'src/hooks/useData.ts',
    'src/pages/Home.tsx',
    'src/pages/About.tsx',
    'src/pages/Dashboard.tsx',
    'src/styles/globals.css',
    'src/lib/supabase.ts',
    'src/lib/github.ts',
    'README.md',
    'package.json',
    'tsconfig.json',
    'vite.config.ts',
    '.env.example',
    'CONTRIBUTING.md',
  ];

  const periods = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];

  const data: FileActivityDataPoint[] = [];

  files.forEach((file) => {
    periods.forEach((period) => {
      // Generate realistic activity with some randomness
      const changes = Math.floor(Math.random() * 25);
      const additions = Math.floor(Math.random() * 50);
      const deletions = Math.floor(Math.random() * 30);

      data.push({
        file,
        period,
        changes,
        additions,
        deletions,
      });
    });
  });

  return { files, periods, data };
}

/**
 * Generate dense file activity data (100+ files)
 * Simulates large repository with extensive activity
 */
export function generateDenseFileActivityData(): HeatmapData {
  const fileTypes = [
    'src/components',
    'src/pages',
    'src/hooks',
    'src/utils',
    'src/lib',
    'src/types',
    'src/styles',
    'tests/unit',
    'tests/e2e',
  ];

  const files: string[] = [];
  for (let i = 0; i < 120; i++) {
    const type = fileTypes[i % fileTypes.length];
    let ext: string;
    if (i % 3 === 0) {
      ext = '.tsx';
    } else if (i % 3 === 1) {
      ext = '.ts';
    } else {
      ext = '.css';
    }
    files.push(`${type}/File${i}${ext}`);
  }

  const periods = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];

  const data: FileActivityDataPoint[] = [];

  files.forEach((file) => {
    periods.forEach((period) => {
      // Generate activity with some files having no activity
      const changes = Math.random() > 0.3 ? Math.floor(Math.random() * 30) : 0;
      const additions = changes > 0 ? Math.floor(Math.random() * 60) : 0;
      const deletions = changes > 0 ? Math.floor(Math.random() * 40) : 0;

      data.push({
        file,
        period,
        changes,
        additions,
        deletions,
      });
    });
  });

  return { files, periods, data };
}

/**
 * Generate daily file activity data
 * Shows activity across weekdays
 */
export function generateDailyFileActivityData(): HeatmapData {
  const files = [
    'src/index.ts',
    'src/components/Button.tsx',
    'src/components/Card.tsx',
    'src/components/Modal.tsx',
    'src/utils/api.ts',
    'src/utils/format.ts',
    'src/hooks/useAuth.ts',
    'src/pages/Home.tsx',
    'src/pages/Profile.tsx',
    'src/styles/main.css',
    'package.json',
    'README.md',
    'vite.config.ts',
    'tsconfig.json',
    '.env.example',
  ];

  const periods = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

  const data: FileActivityDataPoint[] = [];

  files.forEach((file) => {
    periods.forEach((period) => {
      // Generate realistic weekday patterns (more activity mid-week)
      const dayIndex = periods.indexOf(period);
      let baseActivity: number;
      if (dayIndex === 2) {
        baseActivity = 20; // Wednesday - most activity
      } else if (dayIndex === 0 || dayIndex === 4) {
        baseActivity = 8; // Monday or Friday - less activity
      } else {
        baseActivity = 15; // Tuesday or Thursday - moderate activity
      }
      const changes = Math.floor(Math.random() * baseActivity);
      const additions = Math.floor(Math.random() * (baseActivity * 2));
      const deletions = Math.floor(Math.random() * baseActivity);

      data.push({
        file,
        period,
        changes,
        additions,
        deletions,
      });
    });
  });

  return { files, periods, data };
}

/**
 * Generate empty/no data scenario
 */
export function generateEmptyHeatmapData(): HeatmapData {
  return {
    files: [],
    periods: [],
    data: [],
  };
}

/**
 * Generate hotspot data with concentrated activity
 * Simulates a few files with very high activity
 */
export function generateHotspotFileActivityData(): HeatmapData {
  const files = [
    'src/components/Button.tsx',
    'src/components/Input.tsx',
    'src/utils/api.ts',
    'src/hooks/useAuth.ts',
    'src/pages/Dashboard.tsx',
    'src/index.ts',
    'package.json',
    'src/lib/github.ts',
    'src/types/user.ts',
    'README.md',
  ];

  const periods = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
  const hotFiles = ['src/components/Button.tsx', 'src/utils/api.ts', 'src/hooks/useAuth.ts'];

  const data: FileActivityDataPoint[] = [];

  files.forEach((file) => {
    periods.forEach((period) => {
      // Hotspot files have much higher activity
      const isHotFile = hotFiles.includes(file);
      const maxChanges = isHotFile ? 50 : 10;
      const changes = Math.floor(Math.random() * maxChanges);
      const additions = Math.floor(Math.random() * (maxChanges * 2));
      const deletions = Math.floor(Math.random() * maxChanges);

      data.push({
        file,
        period,
        changes,
        additions,
        deletions,
      });
    });
  });

  return { files, periods, data };
}
