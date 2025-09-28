import { analyzeCodebasePatterns } from './codebase-analyzer';
import { generateEnhancedPrompt } from './enhanced-prompt-generator';
import { ReviewMetricsTracker, parseReviewMetrics } from './review-metrics';

/**
 * Test script for enhanced review functionality
 */
async function testEnhancedReview() {
  console.log('🧪 Testing Enhanced Continue Review Components...\n');

  try {
    // Test 1: Codebase Pattern Analysis
    console.log('1. Testing Codebase Pattern Analysis...');
    const testFiles = [
      'src/components/UserProfile.tsx',
      'src/hooks/useAuth.ts',
      'src/types/user.ts'
    ];

    const projectContext = await analyzeCodebasePatterns(testFiles);
    console.log(`✅ Found ${projectContext.patterns.length} patterns`);
    console.log(`✅ Detected frameworks: ${projectContext.conventions.dependencies.frameworks.join(', ')}`);
    console.log(`✅ Project structure: ${projectContext.conventions.structure.directories.length} directories\n`);

    // Test 2: Enhanced Prompt Generation
    console.log('2. Testing Enhanced Prompt Generation...');
    const mockContext = {
      pr: {
        number: 123,
        title: 'Add user authentication flow',
        body: 'Implements OAuth login with GitHub provider',
        author: 'testuser',
        files: [
          {
            filename: 'src/auth/LoginButton.tsx',
            patch: '+const LoginButton = () => {\n+  return <button>Login</button>\n+}',
            additions: 10,
            deletions: 0
          }
        ]
      },
      rules: [
        {
          file: 'typescript-no-any.md',
          globs: '**/*.{ts,tsx}',
          description: 'TypeScript Type Safety',
          content: 'Never use any types'
        }
      ],
      repository: 'test/repo'
    };

    const enhancedPrompt = generateEnhancedPrompt(mockContext, projectContext);
    console.log(`✅ Generated enhanced prompt: ${enhancedPrompt.length} characters`);
    console.log(`✅ Contains strategic analysis section: ${enhancedPrompt.includes('Strategic Insights')}`);
    console.log(`✅ Contains pattern references: ${enhancedPrompt.includes('Established Patterns')}\n`);

    // Test 3: Metrics Tracking
    console.log('3. Testing Metrics Tracking...');
    const metricsTracker = new ReviewMetricsTracker();

    const testMetrics = {
      timestamp: new Date().toISOString(),
      repository: 'test/repo',
      prNumber: 123,
      prAuthor: 'testuser',
      filesChanged: 1,
      reviewerId: 'test-reviewer',
      metrics: {
        promptLength: enhancedPrompt.length,
        responseLength: 1000,
        processingTime: 45,
        rulesApplied: 1,
        patternsDetected: projectContext.patterns.length,
        issuesFound: { high: 1, medium: 2, low: 1 }
      },
      context: {
        hasCustomCommand: false,
        projectType: 'React Application',
        mainLanguages: ['.tsx', '.ts']
      }
    };

    const reviewId = await metricsTracker.recordReviewMetrics(testMetrics);
    console.log(`✅ Recorded review metrics with ID: ${reviewId}`);

    const insights = await metricsTracker.getReviewInsights();
    console.log(`✅ Generated insights: ${insights.totalReviews} total reviews tracked`);

    const summary = await metricsTracker.generateMetricsSummary();
    console.log(`✅ Generated metrics summary: ${summary.length} characters\n`);

    // Test 4: Review Parsing
    console.log('4. Testing Review Parsing...');
    const mockReview = `
    ## Strategic Insights
    Some analysis here.

    ## Issues Found

    ### Issue 1
    **Priority**: High
    Problem description

    ### Issue 2
    **Priority**: Medium
    Another problem

    **Suggestion**: Use better types
    `;

    const parsedMetrics = parseReviewMetrics(mockReview);
    console.log(`✅ Parsed issues: ${parsedMetrics.issuesFound.high} high, ${parsedMetrics.issuesFound.medium} medium`);
    console.log(`✅ Total suggestions: ${parsedMetrics.totalSuggestions}\n`);

    console.log('🎉 All Enhanced Review Tests Passed!\n');

    // Summary
    console.log('📊 Test Results Summary:');
    console.log(`- Codebase Pattern Analysis: ${projectContext.patterns.length} patterns detected`);
    console.log(`- Enhanced Prompt Generation: ${enhancedPrompt.length} characters`);
    console.log(`- Metrics Tracking: Review ID ${reviewId} recorded`);
    console.log(`- Review Parsing: ${parsedMetrics.issuesFound.high + parsedMetrics.issuesFound.medium + parsedMetrics.issuesFound.low} issues detected`);

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testEnhancedReview();
}

export { testEnhancedReview };