import { Suspense, lazy } from 'react';

const LoginPage = lazy(() => import('@/components/features/auth/login-page'));

export default function LoginRoute() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <LoginPage />
    </Suspense>
  );
}
