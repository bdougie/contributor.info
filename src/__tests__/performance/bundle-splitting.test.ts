import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Bundle Splitting', () => {
  it.skip('should properly split vendor and app bundles', () => {
    const distPath = path.join(process.cwd(), 'dist', 'assets');

    if (!fs.existsSync(distPath)) {
      console.warn('Dist folder not found. Run npm run build first.');
      return;
    }

    const files = fs.readdirSync(distPath);
    const jsFiles = files.filter((f) => f.endsWith('.js'));

    const vendorChunks = jsFiles.filter((f) => f.includes('vendor'));
    const appChunks = jsFiles.filter((f) => f.includes('index'));

    expect(vendorChunks.length).toBeGreaterThan(0);
    expect(appChunks.length).toBeGreaterThan(0);

    vendorChunks.forEach((chunk) => {
      const stats = fs.statSync(path.join(distPath, chunk));
      const sizeInKB = stats.size / 1024;
      expect(sizeInKB).toBeLessThan(500);
    });
  });
});
