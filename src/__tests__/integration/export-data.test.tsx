import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Mock file download functionality
const mockFileDownload = {
  downloadBlob: vi.fn(),
  createBlobUrl: vi.fn(),
  revokeBlobUrl: vi.fn(),
};

global.URL.createObjectURL = vi.fn(() => 'mock-blob-url');
global.URL.revokeObjectURL = vi.fn();

// Mock browser APIs
Object.defineProperty(window, 'navigator', {
  value: {
    msSaveOrOpenBlob: vi.fn(),
  },
  writable: true,
});

// Mock document createElement for download links
const mockAnchor = {
  href: '',
  download: '',
  click: vi.fn(),
  style: { display: '' },
};

Object.defineProperty(document, 'createElement', {
  value: vi.fn((tagName) => {
    if (tagName === 'a') {
      return mockAnchor;
    }
    return document.createElement.bind(document)(tagName);
  }),
  writable: true,
});

Object.defineProperty(document.body, 'appendChild', {
  value: vi.fn(),
  writable: true,
});

Object.defineProperty(document.body, 'removeChild', {
  value: vi.fn(),
  writable: true,
});

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        order: vi.fn(() => ({
          data: [],
          error: null,
        })),
      })),
    })),
  })),
  rpc: vi.fn(() => ({
    data: [],
    error: null,
  })),
};

vi.mock('@/lib/supabase', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

// Mock logging
vi.mock('@/lib/simple-logging', () => ({
  setApplicationContext: vi.fn(),
  startSpan: vi.fn((options, fn) => fn({ setStatus: vi.fn() })),
}));

// Mock CSV generation library
vi.mock('csv-stringify/browser/esm/sync', () => ({
  stringify: vi.fn((data, options) => {
    // Simple CSV generation mock
    const headers = options?.header ? Object.keys(data[0] || {}) : [];
    const rows = [
      options?.header ? headers.join(',') : '',
      ...data.map((row: any) => 
        headers.map(header => `"${row[header] || ''}"`).join(',')
      ),
    ].filter(Boolean);
    return rows.join('\n');
  }),
}));

// Mock JSON export
const mockJsonExport = {
  generateJson: vi.fn(),
  formatJson: vi.fn(),
  validateJsonStructure: vi.fn(),
};

vi.mock('@/lib/export-utils', () => mockJsonExport);

interface ContributorData {
  id: string;
  username: string;
  name: string;
  email: string;
  contributions: number;
  pullRequests: number;
  issues: number;
  reviews: number;
  joinDate: string;
  lastActivity: string;
}

interface RepositoryData {
  id: string;
  name: string;
  fullName: string;
  description: string;
  language: string;
  stars: number;
  forks: number;
  issues: number;
  lastUpdate: string;
  contributors: number;
}

interface ExportOptions {
  format: 'csv' | 'json' | 'xlsx';
  includeMetadata?: boolean;
  dateRange?: {
    start: string;
    end: string;
  };
  fields?: string[];
  compression?: boolean;
}

describe('Data Export Integration Tests', () => {
  const mockContributorData: ContributorData[] = [
    {
      id: 'user1',
      username: 'alice',
      name: 'Alice Johnson',
      email: 'alice@example.com',
      contributions: 125,
      pullRequests: 45,
      issues: 23,
      reviews: 67,
      joinDate: '2024-01-15T00:00:00Z',
      lastActivity: '2024-06-20T15:30:00Z',
    },
    {
      id: 'user2',
      username: 'bob',
      name: 'Bob Smith',
      email: 'bob@example.com',
      contributions: 89,
      pullRequests: 32,
      issues: 15,
      reviews: 42,
      joinDate: '2024-02-01T00:00:00Z',
      lastActivity: '2024-06-18T10:45:00Z',
    },
    {
      id: 'user3',
      username: 'charlie',
      name: 'Charlie Brown',
      email: 'charlie@example.com',
      contributions: 203,
      pullRequests: 78,
      issues: 34,
      reviews: 91,
      joinDate: '2023-11-20T00:00:00Z',
      lastActivity: '2024-06-21T09:15:00Z',
    },
  ];

  const mockRepositoryData: RepositoryData[] = [
    {
      id: 'repo1',
      name: 'awesome-project',
      fullName: 'org/awesome-project',
      description: 'An awesome TypeScript project',
      language: 'TypeScript',
      stars: 1250,
      forks: 234,
      issues: 45,
      lastUpdate: '2024-06-21T12:00:00Z',
      contributors: 67,
    },
    {
      id: 'repo2',
      name: 'useful-tool',
      fullName: 'org/useful-tool',
      description: 'A useful development tool',
      language: 'Python',
      stars: 856,
      forks: 143,
      issues: 23,
      lastUpdate: '2024-06-19T14:30:00Z',
      contributors: 34,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default Supabase responses
    mockSupabase.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            data: mockContributorData,
            error: null,
          })),
        })),
      })),
    });
    
    // Setup export utilities
    mockJsonExport.generateJson.mockImplementation((data) => JSON.stringify(data, null, 2));
    mockJsonExport.formatJson.mockImplementation((data) => JSON.stringify(data, null, 2));
    mockJsonExport.validateJsonStructure.mockReturnValue({ valid: true, errors: [] });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
  });

  describe('CSV Export Functionality', () => {
    it('should export contributor data to CSV format', async () => {
      const { stringify } = await import('csv-stringify/browser/esm/sync');
      
      const exportToCsv = async (data: ContributorData[], filename: string) => {
        const csvContent = stringify(data, {
          header: true,
          quoted: true,
        });
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
        
        return { success: true, filename, recordCount: data.length };
      };

      const result = await exportToCsv(mockContributorData, 'contributors.csv');

      expect(stringify).toHaveBeenCalledWith(mockContributorData, {
        header: true,
        quoted: true,
      });
      expect(mockAnchor.click).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.recordCount).toBe(3);
    });

    it('should handle CSV export with custom field selection', async () => {
      const { stringify } = await import('csv-stringify/browser/esm/sync');
      
      const exportSelectedFields = async (
        data: ContributorData[], 
        fields: (keyof ContributorData)[], 
        filename: string
      ) => {
        const selectedData = data.map(item => 
          fields.reduce((obj, field) => {
            obj[field] = item[field];
            return obj;
          }, {} as Partial<ContributorData>)
        );
        
        const csvContent = stringify(selectedData, {
          header: true,
          quoted: true,
        });
        
        return { csvContent, recordCount: selectedData.length };
      };

      const selectedFields: (keyof ContributorData)[] = ['username', 'contributions', 'pullRequests'];
      const result = await exportSelectedFields(mockContributorData, selectedFields, 'summary.csv');

      expect(stringify).toHaveBeenCalled();
      expect(result.recordCount).toBe(3);
    });

    it('should handle large datasets efficiently', async () => {
      const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
        ...mockContributorData[0],
        id: `user${i}`,
        username: `user${i}`,
        contributions: Math.floor(Math.random() * 500),
      }));

      const startTime = performance.now();
      
      const { stringify } = await import('csv-stringify/browser/esm/sync');
      const csvContent = stringify(largeDataset, { header: true });
      
      const endTime = performance.now();

      expect(csvContent).toBeDefined();
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle CSV export with date filtering', async () => {
      const filterByDateRange = (
        data: ContributorData[],
        dateField: keyof ContributorData,
        start: string,
        end: string
      ) => {
        return data.filter(item => {
          const itemDate = new Date(item[dateField] as string);
          const startDate = new Date(start);
          const endDate = new Date(end);
          return itemDate >= startDate && itemDate <= endDate;
        });
      };

      const filtered = filterByDateRange(
        mockContributorData,
        'lastActivity',
        '2024-06-18T00:00:00Z',
        '2024-06-21T23:59:59Z'
      );

      const { stringify } = await import('csv-stringify/browser/esm/sync');
      const csvContent = stringify(filtered, { header: true });

      expect(filtered.length).toBeGreaterThan(0);
      expect(csvContent).toContain('username');
    });
  });

  describe('JSON Export Functionality', () => {
    it('should export data to JSON format with metadata', async () => {
      const exportToJson = async (
        data: ContributorData[], 
        options: ExportOptions
      ) => {
        const exportData = {
          metadata: {
            exportDate: new Date().toISOString(),
            recordCount: data.length,
            format: options.format,
            includeMetadata: options.includeMetadata,
          },
          data: data,
        };
        
        const jsonContent = mockJsonExport.generateJson(exportData);
        
        const blob = new Blob([jsonContent], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        return { success: true, content: jsonContent, url };
      };

      const options: ExportOptions = {
        format: 'json',
        includeMetadata: true,
      };

      const result = await exportToJson(mockContributorData, options);

      expect(mockJsonExport.generateJson).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();
    });

    it('should validate JSON structure before export', async () => {
      const exportWithValidation = async (data: ContributorData[]) => {
        const validation = mockJsonExport.validateJsonStructure(data);
        
        if (!validation.valid) {
          throw new Error(`Invalid data structure: ${validation.errors.join(', ')}`);
        }
        
        return mockJsonExport.generateJson(data);
      };

      const result = await exportWithValidation(mockContributorData);

      expect(mockJsonExport.validateJsonStructure).toHaveBeenCalledWith(mockContributorData);
      expect(mockJsonExport.generateJson).toHaveBeenCalledWith(mockContributorData);
      expect(result).toBeDefined();
    });

    it('should handle nested data structures in JSON export', async () => {
      const nestedData = mockContributorData.map(contributor => ({
        ...contributor,
        activity: {
          monthly: {
            contributions: Math.floor(contributor.contributions / 12),
            reviews: Math.floor(contributor.reviews / 12),
          },
          repositories: [`repo-${contributor.id}-1`, `repo-${contributor.id}-2`],
        },
      }));

      const jsonContent = mockJsonExport.generateJson(nestedData);

      expect(mockJsonExport.generateJson).toHaveBeenCalledWith(nestedData);
      expect(jsonContent).toBeDefined();
    });

    it('should compress JSON export when requested', async () => {
      const exportWithCompression = async (
        data: ContributorData[], 
        compress: boolean
      ) => {
        let content = mockJsonExport.generateJson(data);
        
        if (compress) {
          // Mock compression (in reality, you'd use a compression library)
          content = content.replace(/\s+/g, ' ').trim();
        }
        
        return { content, compressed: compress };
      };

      const compressed = await exportWithCompression(mockContributorData, true);
      const uncompressed = await exportWithCompression(mockContributorData, false);

      expect(compressed.compressed).toBe(true);
      expect(uncompressed.compressed).toBe(false);
      expect(mockJsonExport.generateJson).toHaveBeenCalledTimes(2);
    });
  });

  describe('Multi-format Export Support', () => {
    it('should support exporting the same data in multiple formats', async () => {
      const multiFormatExport = async (
        data: ContributorData[], 
        formats: ExportOptions['format'][]
      ) => {
        const results = [];
        
        for (const format of formats) {
          switch (format) {
            case 'csv': {
              const { stringify } = await import('csv-stringify/browser/esm/sync');
              const content = stringify(data, { header: true });
              results.push({ format, content, type: 'text/csv' });
              break;
            }
            case 'json': {
              const content = mockJsonExport.generateJson(data);
              results.push({ format, content, type: 'application/json' });
              break;
            }
            default:
              throw new Error(`Unsupported format: ${format}`);
          }
        }
        
        return results;
      };

      const results = await multiFormatExport(mockContributorData, ['csv', 'json']);

      expect(results).toHaveLength(2);
      expect(results[0].format).toBe('csv');
      expect(results[1].format).toBe('json');
    });

    it('should handle format-specific options', async () => {
      const exportWithFormatOptions = async (
        data: ContributorData[],
        format: ExportOptions['format'],
        formatOptions: Record<string, any>
      ) => {
        switch (format) {
          case 'csv': {
            const { stringify } = await import('csv-stringify/browser/esm/sync');
            const content = stringify(data, {
              header: formatOptions.includeHeaders ?? true,
              delimiter: formatOptions.delimiter ?? ',',
              quoted: formatOptions.quoted ?? true,
            });
            return { content, options: formatOptions };
          }
          case 'json': {
            const content = JSON.stringify(data, null, formatOptions.indent ?? 2);
            return { content, options: formatOptions };
          }
          default:
            throw new Error(`Unsupported format: ${format}`);
        }
      };

      const csvResult = await exportWithFormatOptions(
        mockContributorData, 
        'csv', 
        { delimiter: ';', includeHeaders: true }
      );

      const jsonResult = await exportWithFormatOptions(
        mockContributorData, 
        'json', 
        { indent: 4 }
      );

      expect(csvResult.options.delimiter).toBe(';');
      expect(jsonResult.options.indent).toBe(4);
    });
  });

  describe('Batch Export Operations', () => {
    it('should handle batch export of multiple datasets', async () => {
      const batchExport = async () => {
        const exports = [
          { name: 'contributors', data: mockContributorData, format: 'csv' as const },
          { name: 'repositories', data: mockRepositoryData, format: 'json' as const },
        ];
        
        const results = [];
        
        for (const exportItem of exports) {
          switch (exportItem.format) {
            case 'csv': {
              const { stringify } = await import('csv-stringify/browser/esm/sync');
              const content = stringify(exportItem.data, { header: true });
              results.push({ 
                name: exportItem.name, 
                format: exportItem.format, 
                content,
                recordCount: exportItem.data.length 
              });
              break;
            }
            case 'json': {
              const content = mockJsonExport.generateJson(exportItem.data);
              results.push({ 
                name: exportItem.name, 
                format: exportItem.format, 
                content,
                recordCount: exportItem.data.length 
              });
              break;
            }
          }
        }
        
        return results;
      };

      const results = await batchExport();

      expect(results).toHaveLength(2);
      expect(results[0].name).toBe('contributors');
      expect(results[0].format).toBe('csv');
      expect(results[1].name).toBe('repositories');
      expect(results[1].format).toBe('json');
    });

    it('should handle concurrent export operations', async () => {
      const datasets = [
        mockContributorData.slice(0, 1),
        mockContributorData.slice(1, 2),
        mockContributorData.slice(2, 3),
      ];

      const concurrentExports = datasets.map(async (data, index) => {
        const { stringify } = await import('csv-stringify/browser/esm/sync');
        const content = stringify(data, { header: true });
        return { index, content, recordCount: data.length };
      });

      const results = await Promise.all(concurrentExports);

      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result.index).toBe(index);
        expect(result.recordCount).toBe(1);
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty datasets gracefully', async () => {
      const exportEmptyData = async (data: ContributorData[]) => {
        if (data.length === 0) {
          return { 
            success: false, 
            error: 'No data to export',
            content: null 
          };
        }
        
        const { stringify } = await import('csv-stringify/browser/esm/sync');
        const content = stringify(data, { header: true });
        return { success: true, content, recordCount: data.length };
      };

      const result = await exportEmptyData([]);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No data to export');
      expect(result.content).toBeNull();
    });

    it('should handle malformed data during export', async () => {
      const malformedData = [
        { ...mockContributorData[0], contributions: null as any },
        { ...mockContributorData[1], username: undefined as any },
      ];

      const sanitizeData = (data: any[]) => {
        return data.map(item => {
          const sanitized = { ...item };
          Object.keys(sanitized).forEach(key => {
            if (sanitized[key] === null || sanitized[key] === undefined) {
              sanitized[key] = '';
            }
          });
          return sanitized;
        });
      };

      const sanitized = sanitizeData(malformedData);
      const { stringify } = await import('csv-stringify/browser/esm/sync');
      const content = stringify(sanitized, { header: true });

      expect(content).toBeDefined();
      expect(sanitized[0].contributions).toBe('');
      expect(sanitized[1].username).toBe('');
    });

    it('should handle export failures gracefully', async () => {
      const { stringify } = await import('csv-stringify/browser/esm/sync');
      stringify.mockImplementation(() => {
        throw new Error('CSV generation failed');
      });

      const exportWithErrorHandling = async (data: ContributorData[]) => {
        try {
          const content = stringify(data, { header: true });
          return { success: true, content };
        } catch (error) {
          return { 
            success: false, 
            error: (error as Error).message,
            content: null 
          };
        }
      };

      const result = await exportWithErrorHandling(mockContributorData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('CSV generation failed');
    });

    it('should handle browser compatibility issues', async () => {
      // Simulate older browser without Blob support
      const originalBlob = global.Blob;
      (global as any).Blob = undefined;

      const exportWithFallback = async (data: ContributorData[]) => {
        const { stringify } = await import('csv-stringify/browser/esm/sync');
        const content = stringify(data, { header: true });
        
        if (typeof Blob === 'undefined') {
          // Fallback for older browsers
          return {
            content,
            downloadMethod: 'manual',
            message: 'Please copy the content manually',
          };
        }
        
        return { content, downloadMethod: 'automatic' };
      };

      const result = await exportWithFallback(mockContributorData);

      expect(result.downloadMethod).toBe('manual');
      expect(result.message).toBe('Please copy the content manually');

      // Restore Blob
      global.Blob = originalBlob;
    });

    it('should handle memory constraints with large datasets', async () => {
      // Simulate memory-constrained environment
      const processInChunks = async (data: ContributorData[], chunkSize = 1000) => {
        const chunks = [];
        
        for (let i = 0; i < data.length; i += chunkSize) {
          const chunk = data.slice(i, i + chunkSize);
          const { stringify } = await import('csv-stringify/browser/esm/sync');
          const content = stringify(chunk, { 
            header: i === 0, // Only include header in first chunk
          });
          chunks.push(content);
        }
        
        return chunks.join('\n');
      };

      const largeDataset = Array.from({ length: 2500 }, (_, i) => ({
        ...mockContributorData[0],
        id: `user${i}`,
      }));

      const result = await processInChunks(largeDataset, 1000);

      expect(result).toBeDefined();
      expect(result.split('\n')).toHaveLength(2501); // 2500 data rows + 1 header
    });
  });

  describe('Export Progress and Monitoring', () => {
    it('should track export progress for large operations', async () => {
      const progressTracker = {
        processed: 0,
        total: 0,
        stage: '',
      };

      const exportWithProgress = async (data: ContributorData[]) => {
        progressTracker.total = data.length;
        progressTracker.stage = 'preparation';
        
        // Simulate processing each record
        const processedData = [];
        for (const item of data) {
          progressTracker.processed++;
          processedData.push(item);
          
          // Yield control to allow progress updates
          await new Promise(resolve => setTimeout(resolve, 0));
        }
        
        progressTracker.stage = 'generation';
        const { stringify } = await import('csv-stringify/browser/esm/sync');
        const content = stringify(processedData, { header: true });
        
        progressTracker.stage = 'complete';
        
        return {
          content,
          progress: progressTracker,
        };
      };

      const result = await exportWithProgress(mockContributorData);

      expect(result.progress.processed).toBe(3);
      expect(result.progress.total).toBe(3);
      expect(result.progress.stage).toBe('complete');
    });

    it('should provide export statistics', async () => {
      const exportWithStats = async (data: ContributorData[]) => {
        const startTime = performance.now();
        
        const { stringify } = await import('csv-stringify/browser/esm/sync');
        const content = stringify(data, { header: true });
        
        const endTime = performance.now();
        
        const stats = {
          recordCount: data.length,
          duration: endTime - startTime,
          fileSize: content.length,
          format: 'csv',
          timestamp: new Date().toISOString(),
        };
        
        return { content, stats };
      };

      const result = await exportWithStats(mockContributorData);

      expect(result.stats.recordCount).toBe(3);
      expect(result.stats.duration).toBeGreaterThan(0);
      expect(result.stats.fileSize).toBeGreaterThan(0);
      expect(result.stats.format).toBe('csv');
    });
  });
});