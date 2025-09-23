import { lazy } from 'react';

export const PRAuthorStatusChart = lazy(() =>
  import('./PRAuthorStatusChart')
    .then((module) => ({ default: module.PRAuthorStatusChart }))
    .catch((error) => {
      console.error('Failed to load PRAuthorStatusChart:', error);
      // Return a fallback component
      return {
        default: () => (
          <div className="text-muted-foreground text-sm p-4">
            Failed to load PR Author Status chart. Please refresh the page.
          </div>
        ),
      };
    })
);
