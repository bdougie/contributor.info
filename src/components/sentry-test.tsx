import { captureException, captureMessage } from '@/lib/sentry-lazy';

/**
 * Test component for Sentry integration
 * This component provides buttons to test different error types
 * Only visible in development mode
 */
export function SentryTest() {
  // Only show in development
  if (import.meta.env.PROD) {
    return null;
  }

  const testError = () => {
    console.log('[SentryTest] Triggering test error...');
    try {
      throw new Error('Test error from Sentry test component');
    } catch (error) {
      console.log('[SentryTest] Capturing exception:', error);
      captureException(error, {
        level: 'error',
        tags: {
          test: 'true',
          component: 'SentryTest',
        },
      });
      console.log('[SentryTest] Test error sent to Sentry');

      // Also test if Sentry is loaded directly
      import('@sentry/react').then((Sentry) => {
        console.log('[SentryTest] Direct Sentry check - Is initialized?', Sentry.getCurrentScope() !== undefined);
      }).catch(err => {
        console.error('[SentryTest] Failed to import Sentry:', err);
      });
    }
  };

  const testWarning = () => {
    captureMessage('Test warning from Sentry test component', 'warning');
    console.log('Test warning sent to Sentry');
  };

  const testUnhandledRejection = () => {
    // This will trigger the global error handler
    Promise.reject(new Error('Test unhandled rejection'));
    console.log('Unhandled rejection triggered');
  };

  const testNetworkError = async () => {
    try {
      // This will fail and be caught by trackedFetch
      await fetch('https://this-domain-does-not-exist-12345.com/api/test');
    } catch (error) {
      console.log('Network error triggered');
    }
  };

  const checkSentryStatus = async () => {
    console.log('[SentryTest] Checking Sentry status...');
    try {
      const Sentry = await import('@sentry/react');
      const scope = Sentry.getCurrentScope();
      const client = Sentry.getClient();
      console.log('[SentryTest] Sentry loaded:', !!Sentry);
      console.log('[SentryTest] Has scope:', !!scope);
      console.log('[SentryTest] Has client:', !!client);

      if (client) {
        const options = client.getOptions();
        console.log('[SentryTest] DSN configured:', !!options.dsn);
        console.log('[SentryTest] DSN value:', options.dsn?.substring(0, 30) + '...');
        console.log('[SentryTest] Environment:', options.environment);
      }

      // Try to send a test message directly
      if (client) {
        console.log('[SentryTest] Sending direct test message...');
        Sentry.captureMessage('Direct test message from SentryTest', 'info');
        console.log('[SentryTest] Direct message sent!');
      }
    } catch (err) {
      console.error('[SentryTest] Failed to check status:', err);
    }
  };

  return (
    <div className="fixed bottom-4 left-4 z-50 p-4 bg-gray-900 rounded-lg shadow-xl">
      <h3 className="text-white text-sm font-bold mb-2">Sentry Test (Dev Only)</h3>
      <div className="flex flex-col gap-2">
        <button
          onClick={testError}
          className="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
        >
          Test Error
        </button>
        <button
          onClick={testWarning}
          className="px-3 py-1 bg-yellow-600 text-white rounded text-xs hover:bg-yellow-700"
        >
          Test Warning
        </button>
        <button
          onClick={testUnhandledRejection}
          className="px-3 py-1 bg-purple-600 text-white rounded text-xs hover:bg-purple-700"
        >
          Test Unhandled
        </button>
        <button
          onClick={testNetworkError}
          className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
        >
          Test Network
        </button>
        <button
          onClick={checkSentryStatus}
          className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
        >
          Check Status
        </button>
      </div>
    </div>
  );
}