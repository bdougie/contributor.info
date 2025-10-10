import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import * as core from '@actions/core';

export interface CodebasePattern {
  type: 'import' | 'component' | 'function' | 'type' | 'constant';
  pattern: string;
  frequency: number;
  examples: string[];
  fileTypes: string[];
}

export interface ProjectContext {
  patterns: CodebasePattern[];
  conventions: {
    naming: { files: string[]; functions: string[]; types: string[] };
    structure: { directories: string[]; testPatterns: string[] };
    dependencies: { frameworks: string[]; libraries: string[] };
  };
  architecture: {
    componentPatterns: string[];
    dataFlowPatterns: string[];
    errorHandlingPatterns: string[];
  };
}

/**
 * Analyze codebase to understand patterns and conventions
 */
export async function analyzeCodebasePatterns(changedFiles: string[]): Promise<ProjectContext> {
  core.info('Analyzing codebase patterns for enhanced context...');

  const patterns: CodebasePattern[] = [];
  const conventions = {
    naming: { files: [] as string[], functions: [] as string[], types: [] as string[] },
    structure: { directories: [] as string[], testPatterns: [] as string[] },
    dependencies: { frameworks: [] as string[], libraries: [] as string[] },
  };
  const architecture = {
    componentPatterns: [] as string[],
    dataFlowPatterns: [] as string[],
    errorHandlingPatterns: [] as string[],
  };

  try {
    // Analyze related files to understand patterns
    const relatedFiles = await findRelatedFiles(changedFiles);

    // Extract patterns from existing code
    for (const file of relatedFiles.slice(0, 50)) {
      // Limit to prevent timeout
      try {
        const content = await fs.readFile(file, 'utf-8');

        // Analyze imports to understand dependencies
        const imports = extractImportPatterns(content, file);
        patterns.push(...imports);

        // Analyze component patterns for React files
        if (file.match(/\.(tsx?|jsx?)$/)) {
          const componentPatterns = extractComponentPatterns(content, file);
          architecture.componentPatterns.push(...componentPatterns);
        }

        // ENHANCEMENT: Analyze Supabase migration patterns for SQL files
        if (file.match(/\.sql$/)) {
          const sqlPatterns = extractSupabasePatterns(content, file);
          architecture.dataFlowPatterns.push(...sqlPatterns);
        }

        // Analyze naming conventions
        const namingPatterns = extractNamingPatterns(content, file);
        conventions.naming.files.push(...namingPatterns.files);
        conventions.naming.functions.push(...namingPatterns.functions);
        conventions.naming.types.push(...namingPatterns.types);
      } catch (error) {
        core.debug(`Failed to analyze ${file}: ${error}`);
      }
    }

    // Analyze project structure
    conventions.structure = await analyzeProjectStructure();

    // Analyze package.json for framework/library patterns
    conventions.dependencies = await analyzeDependencies();

    // Remove duplicates and get most common patterns
    const uniquePatterns = deduplicatePatterns(patterns);

    core.info(`Found ${uniquePatterns.length} codebase patterns for context`);

    return {
      patterns: uniquePatterns,
      conventions,
      architecture,
    };
  } catch (error) {
    core.warning(`Failed to analyze codebase patterns: ${error}`);
    return {
      patterns: [],
      conventions: {
        naming: { files: [] as string[], functions: [] as string[], types: [] as string[] },
        structure: { directories: [] as string[], testPatterns: [] as string[] },
        dependencies: { frameworks: [] as string[], libraries: [] as string[] },
      },
      architecture: {
        componentPatterns: [] as string[],
        dataFlowPatterns: [] as string[],
        errorHandlingPatterns: [] as string[],
      },
    };
  }
}

/**
 * Find files related to the changed files for pattern analysis
 */
async function findRelatedFiles(changedFiles: string[]): Promise<string[]> {
  const relatedFiles = new Set<string>();

  for (const file of changedFiles) {
    // Add the file itself
    relatedFiles.add(file);

    // Find files in the same directory
    const dir = path.dirname(file);
    try {
      const siblingFiles = await glob(`${dir}/*.{ts,tsx,js,jsx}`, {
        ignore: ['node_modules/**', '**/*.test.*', '**/*.spec.*'],
      });
      for (const f of siblingFiles) {
        relatedFiles.add(f);
      }
    } catch (error) {
      core.debug(`Failed to find sibling files for ${dir}: ${error}`);
    }

    // Find test files
    const baseName = path.basename(file, path.extname(file));
    try {
      const testFiles = await glob(`**/${baseName}.{test,spec}.{ts,tsx,js,jsx}`, {
        ignore: ['node_modules/**'],
      });
      for (const f of testFiles) {
        relatedFiles.add(f);
      }
    } catch (error) {
      core.debug(`Failed to find test files for ${baseName}: ${error}`);
    }
  }

  // ENHANCEMENT: Always include Supabase migration files for database-related context
  try {
    const migrationFiles = await glob('supabase/migrations/*.sql', {
      ignore: ['node_modules/**'],
    });
    for (const f of migrationFiles) {
      relatedFiles.add(f);
    }
    core.info(`Added ${migrationFiles.length} Supabase migration files for database context`);
  } catch (error) {
    core.debug(`Failed to find Supabase migration files: ${error}`);
  }

  // ENHANCEMENT: Include relevant schema and configuration files
  try {
    const configFiles = await glob('{supabase/**/*.sql,src/lib/supabase.ts,*.env.example}', {
      ignore: ['node_modules/**'],
    });
    for (const f of configFiles) {
      relatedFiles.add(f);
    }
  } catch (error) {
    core.debug(`Failed to find configuration files: ${error}`);
  }

  return Array.from(relatedFiles);
}

/**
 * Extract import patterns from file content
 */
function extractImportPatterns(content: string, filepath: string): CodebasePattern[] {
  const patterns: CodebasePattern[] = [];
  // Updated regex to handle type-only imports (import type { ... } from ...)
  const importRegex =
    /import\s+(?:type\s+)?(?:{[^}]+}|\*\s+as\s+\w+|\w+)?\s*(?:,\s*(?:type\s+)?{[^}]+})?\s*from\s+['"`]([^'"`]+)['"`]/g;

  let match;
  const imports = new Map<string, number>();

  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1];
    imports.set(importPath, (imports.get(importPath) || 0) + 1);
  }

  imports.forEach((frequency, pattern) => {
    patterns.push({
      type: 'import',
      pattern,
      frequency,
      examples: [filepath],
      fileTypes: [path.extname(filepath)],
    });
  });

  return patterns;
}

/**
 * Extract React component patterns
 */
function extractComponentPatterns(content: string, filepath: string): string[] {
  const patterns: string[] = [];

  // Check for common React patterns
  if (content.includes('useState')) patterns.push('React Hooks (useState)');
  if (content.includes('useEffect')) patterns.push('React Hooks (useEffect)');
  if (content.includes('useCallback')) patterns.push('React Hooks (useCallback)');
  if (content.includes('useMemo')) patterns.push('React Hooks (useMemo)');
  if (content.includes('forwardRef')) patterns.push('React forwardRef');
  if (content.includes('memo(')) patterns.push('React.memo optimization');
  if (content.includes('createContext')) patterns.push('React Context');
  if (content.includes('Provider')) patterns.push('Context Provider pattern');

  // Check for TypeScript patterns
  if (content.includes('interface ')) patterns.push('TypeScript interfaces');
  if (content.includes('type ')) patterns.push('TypeScript type aliases');
  if (content.includes('enum ')) patterns.push('TypeScript enums');
  if (content.includes('as const')) patterns.push('TypeScript const assertions');

  // Check for error handling patterns
  if (content.includes('try {') || content.includes('catch ('))
    patterns.push('Try-catch error handling');
  if (content.includes('throw new Error')) patterns.push('Error throwing');
  if (content.includes('ErrorBoundary')) patterns.push('React Error Boundaries');

  return patterns;
}

/**
 * Extract naming convention patterns
 */
function extractNamingPatterns(
  content: string,
  filepath: string
): {
  files: string[];
  functions: string[];
  types: string[];
} {
  const patterns = { files: [] as string[], functions: [] as string[], types: [] as string[] };

  // File naming pattern
  const fileName = path.basename(filepath, path.extname(filepath));
  if (fileName.includes('-')) patterns.files.push('kebab-case');
  if (fileName.includes('_')) patterns.files.push('snake_case');
  if (/^[a-z][a-zA-Z0-9]*$/.test(fileName)) patterns.files.push('camelCase');
  if (/^[A-Z][a-zA-Z0-9]*$/.test(fileName)) patterns.files.push('PascalCase');

  // Function naming patterns
  const functionRegex = /(?:function\s+|const\s+|let\s+|var\s+)([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
  let match;
  while ((match = functionRegex.exec(content)) !== null) {
    const funcName = match[1];
    if (/^[a-z][a-zA-Z0-9]*$/.test(funcName)) patterns.functions.push('camelCase');
    if (funcName.includes('_')) patterns.functions.push('snake_case');
  }

  // Type naming patterns
  const typeRegex = /(?:interface\s+|type\s+|enum\s+)([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
  while ((match = typeRegex.exec(content)) !== null) {
    const typeName = match[1];
    if (/^[A-Z][a-zA-Z0-9]*$/.test(typeName)) patterns.types.push('PascalCase');
    if (typeName.includes('_')) patterns.types.push('snake_case');
  }

  return patterns;
}

/**
 * Analyze project directory structure
 */
async function analyzeProjectStructure(): Promise<{
  directories: string[];
  testPatterns: string[];
}> {
  try {
    const directories = await glob('*/', { ignore: ['node_modules/', '.git/', 'dist/', 'build/'] });
    const testFiles = await glob('**/*.{test,spec}.{ts,tsx,js,jsx}', {
      ignore: ['node_modules/**'],
    });

    const testPatterns: string[] = [];
    testFiles.forEach((file) => {
      if (file.includes('__tests__')) testPatterns.push('__tests__ directory');
      if (file.includes('.test.')) testPatterns.push('.test.* files');
      if (file.includes('.spec.')) testPatterns.push('.spec.* files');
    });

    return {
      directories: directories.map((d) => d.replace('/', '')),
      testPatterns: Array.from(new Set(testPatterns)),
    };
  } catch (error) {
    core.debug(`Failed to analyze project structure: ${error}`);
    return { directories: [] as string[], testPatterns: [] as string[] };
  }
}

/**
 * Analyze package.json for framework and library patterns
 */
async function analyzeDependencies(): Promise<{ frameworks: string[]; libraries: string[] }> {
  try {
    const packageJson = await fs.readFile('package.json', 'utf-8');
    const pkg = JSON.parse(packageJson);

    const allDeps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
    };

    const frameworks: string[] = [];
    const libraries: string[] = [];

    // Identify frameworks
    if (allDeps.react) frameworks.push('React');
    if (allDeps.vue) frameworks.push('Vue');
    if (allDeps.angular) frameworks.push('Angular');
    if (allDeps.next) frameworks.push('Next.js');
    if (allDeps.nuxt) frameworks.push('Nuxt.js');
    if (allDeps.svelte) frameworks.push('Svelte');

    // Identify common libraries
    if (allDeps.typescript) libraries.push('TypeScript');
    if (allDeps.tailwindcss) libraries.push('Tailwind CSS');
    if (allDeps['styled-components']) libraries.push('Styled Components');
    if (allDeps.emotion) libraries.push('Emotion');
    if (allDeps.zustand) libraries.push('Zustand');
    if (allDeps.redux) libraries.push('Redux');
    if (allDeps.axios) libraries.push('Axios');
    if (allDeps.vitest) libraries.push('Vitest');
    if (allDeps.jest) libraries.push('Jest');
    if (allDeps.playwright) libraries.push('Playwright');
    if (allDeps.storybook) libraries.push('Storybook');

    return { frameworks, libraries };
  } catch (error) {
    core.debug(`Failed to analyze dependencies: ${error}`);
    return { frameworks: [] as string[], libraries: [] as string[] };
  }
}

/**
 * Extract Supabase-specific patterns from SQL migration files
 */
function extractSupabasePatterns(content: string, filepath: string): string[] {
  const patterns: string[] = [];

  // Check for foreign key constraints
  if (content.includes('REFERENCES') && content.includes('ON DELETE')) {
    patterns.push('Foreign key constraints with cascade options');
  }
  if (content.includes('REFERENCES')) {
    patterns.push('Foreign key relationships');
  }

  // Check for UUID patterns
  if (content.includes('UUID')) {
    patterns.push('UUID column types');
  }
  if (content.includes('uuid_generate_v4()')) {
    patterns.push('UUID generation functions');
  }

  // Check for RLS patterns
  if (content.includes('ENABLE ROW LEVEL SECURITY')) {
    patterns.push('Row Level Security (RLS)');
  }
  if (content.includes('CREATE POLICY')) {
    patterns.push('RLS policies');
  }

  // Check for index patterns
  if (content.includes('CREATE INDEX')) {
    patterns.push('Database indexes');
  }
  if (content.includes('CREATE UNIQUE INDEX')) {
    patterns.push('Unique constraints via indexes');
  }

  // Check for trigger patterns
  if (content.includes('CREATE TRIGGER')) {
    patterns.push('Database triggers');
  }
  if (content.includes('updated_at')) {
    patterns.push('Automatic timestamp updates');
  }

  // Check for function patterns
  if (content.includes('CREATE OR REPLACE FUNCTION')) {
    patterns.push('Custom database functions');
  }

  // Check for data type patterns
  if (content.includes('TIMESTAMPTZ')) {
    patterns.push('Timezone-aware timestamps');
  }
  if (content.includes('JSONB')) {
    patterns.push('JSONB document storage');
  }

  return patterns;
}

/**
 * Remove duplicate patterns and sort by frequency
 */
function deduplicatePatterns(patterns: CodebasePattern[]): CodebasePattern[] {
  const patternMap = new Map<string, CodebasePattern>();

  patterns.forEach((pattern) => {
    const key = `${pattern.type}:${pattern.pattern}`;
    if (patternMap.has(key)) {
      const existing = patternMap.get(key)!;
      existing.frequency += pattern.frequency;
      existing.examples.push(...pattern.examples);
      existing.fileTypes.push(...pattern.fileTypes);
    } else {
      patternMap.set(key, { ...pattern });
    }
  });

  return Array.from(patternMap.values())
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 20); // Top 20 patterns
}
