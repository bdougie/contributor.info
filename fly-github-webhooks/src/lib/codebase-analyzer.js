import { readFile } from 'fs/promises';
import { basename, dirname, extname } from 'path';
import { glob } from 'glob';

/**
 * Analyze codebase to understand patterns and conventions
 * @param {string[]} changedFiles - Array of changed file paths
 * @param {object} logger - Logger instance
 * @returns {Promise<object>} Project context with patterns, conventions, and architecture
 */
export async function analyzeCodebasePatterns(changedFiles, logger) {
  logger.info('Analyzing codebase patterns for enhanced context...');

  const patterns = [];
  const conventions = {
    naming: { files: [], functions: [], types: [] },
    structure: { directories: [], testPatterns: [] },
    dependencies: { frameworks: [], libraries: [] },
  };
  const architecture = {
    componentPatterns: [],
    dataFlowPatterns: [],
    errorHandlingPatterns: [],
  };

  try {
    // Analyze related files to understand patterns
    const relatedFiles = await findRelatedFiles(changedFiles, logger);

    // Extract patterns from existing code
    for (const file of relatedFiles.slice(0, 50)) {
      // Limit to prevent timeout
      try {
        const content = await readFile(file, 'utf-8');

        // Analyze imports to understand dependencies
        const imports = extractImportPatterns(content, file);
        patterns.push(...imports);

        // Analyze component patterns for React files
        if (file.match(/\.(tsx?|jsx?)$/)) {
          const componentPatterns = extractComponentPatterns(content, file);
          architecture.componentPatterns.push(...componentPatterns);
        }

        // Analyze naming conventions
        const namingPatterns = extractNamingPatterns(content, file);
        conventions.naming.files.push(...namingPatterns.files);
        conventions.naming.functions.push(...namingPatterns.functions);
        conventions.naming.types.push(...namingPatterns.types);
      } catch (error) {
        logger.debug('Failed to analyze %s: %s', file, error.message);
      }
    }

    // Analyze project structure
    conventions.structure = await analyzeProjectStructure(logger);

    // Analyze package.json for framework/library patterns
    conventions.dependencies = await analyzeDependencies(logger);

    // Remove duplicates and get most common patterns
    const uniquePatterns = deduplicatePatterns(patterns);

    logger.info('Found %d codebase patterns for context', uniquePatterns.length);

    return {
      patterns: uniquePatterns,
      conventions,
      architecture,
    };
  } catch (error) {
    logger.warn('Failed to analyze codebase patterns: %s', error.message);
    return {
      patterns: [],
      conventions: {
        naming: { files: [], functions: [], types: [] },
        structure: { directories: [], testPatterns: [] },
        dependencies: { frameworks: [], libraries: [] },
      },
      architecture: {
        componentPatterns: [],
        dataFlowPatterns: [],
        errorHandlingPatterns: [],
      },
    };
  }
}

/**
 * Find files related to the changed files for pattern analysis
 */
async function findRelatedFiles(changedFiles, logger) {
  const relatedFiles = new Set();

  for (const file of changedFiles) {
    // Add the file itself
    relatedFiles.add(file);

    // Find files in the same directory
    const dir = dirname(file);
    try {
      const siblingFiles = await glob(`${dir}/*.{ts,tsx,js,jsx}`, {
        ignore: ['node_modules/**', '**/*.test.*', '**/*.spec.*'],
      });
      for (const f of siblingFiles) {
        relatedFiles.add(f);
      }
    } catch (error) {
      logger.debug('Failed to find sibling files for %s: %s', dir, error.message);
    }

    // Find test files
    const baseName = basename(file, extname(file));
    try {
      const testFiles = await glob(`**/${baseName}.{test,spec}.{ts,tsx,js,jsx}`, {
        ignore: ['node_modules/**'],
      });
      for (const f of testFiles) {
        relatedFiles.add(f);
      }
    } catch (error) {
      logger.debug('Failed to find test files for %s: %s', baseName, error.message);
    }
  }

  return Array.from(relatedFiles);
}

/**
 * Extract import patterns from file content
 */
function extractImportPatterns(content, filepath) {
  const patterns = [];
  const importRegex =
    /import\s+(?:type\s+)?(?:{[^}]+}|\*\s+as\s+\w+|\w+)?\s*(?:,\s*(?:type\s+)?{[^}]+})?\s*from\s+['"`]([^'"`]+)['"`]/g;

  let match;
  const imports = new Map();

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
      fileTypes: [extname(filepath)],
    });
  });

  return patterns;
}

/**
 * Extract React component patterns
 */
function extractComponentPatterns(content, filepath) {
  const patterns = [];

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
function extractNamingPatterns(content, filepath) {
  const patterns = { files: [], functions: [], types: [] };

  // File naming pattern
  const fileName = basename(filepath, extname(filepath));
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
async function analyzeProjectStructure(logger) {
  try {
    const directories = await glob('*/', { ignore: ['node_modules/', '.git/', 'dist/', 'build/'] });
    const testFiles = await glob('**/*.{test,spec}.{ts,tsx,js,jsx}', {
      ignore: ['node_modules/**'],
    });

    const testPatterns = [];
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
    logger.debug('Failed to analyze project structure: %s', error.message);
    return { directories: [], testPatterns: [] };
  }
}

/**
 * Analyze package.json for framework and library patterns
 */
async function analyzeDependencies(logger) {
  try {
    const packageJson = await readFile('package.json', 'utf-8');
    const pkg = JSON.parse(packageJson);

    const allDeps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
    };

    const frameworks = [];
    const libraries = [];

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
    logger.debug('Failed to analyze dependencies: %s', error.message);
    return { frameworks: [], libraries: [] };
  }
}

/**
 * Remove duplicate patterns and sort by frequency
 */
function deduplicatePatterns(patterns) {
  const patternMap = new Map();

  patterns.forEach((pattern) => {
    const key = `${pattern.type}:${pattern.pattern}`;
    if (patternMap.has(key)) {
      const existing = patternMap.get(key);
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
