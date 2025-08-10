// Wrapper component to conditionally load contributions chart
import { lazy, Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

// Lazy load the contributions component to avoid ES module issues in tests
const ContributionsChart = lazy(() => {
  // Check if we're in a test environment
  if (import.meta.env?.MODE === 'test' || typeof global !== 'undefined' && global.process?.env?.NODE_ENV === 'test') {
    // Return a mock component for tests
    return Promise.resolve({
      default: () => (
        <div data-testid="mock-contributions-chart" className="h-[400px] w-full flex items-center justify-center">
          <span>Mock Contributions Chart</span>
        </div>
      )
    });
  }
  
  // TEMPORARY: Load comparison component for A/B testing
  return import('./contributions-comparison').then(module => ({ default: module.default }));
  // Original: return import('./contributions').then(module => ({ default: module.default }));
});

export default function ContributionsWrapper() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pull Request Contributions</CardTitle>
        <CardDescription>
          Visualize the size and frequency of contributions
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        <Suspense fallback={
          <div className="h-[400px] w-full flex items-center justify-center">
            <span className="text-muted-foreground">Loading chart...</span>
          </div>
        }>
          <ContributionsChart />
        </Suspense>
      </CardContent>
    </Card>
  );
}