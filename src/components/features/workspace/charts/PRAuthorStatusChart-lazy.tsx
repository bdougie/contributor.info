import { lazy } from 'react';

export const PRAuthorStatusChart = lazy(() =>
  import('./PRAuthorStatusChart').then((module) => ({ default: module.PRAuthorStatusChart }))
);
