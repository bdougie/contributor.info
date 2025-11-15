import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { createChartShareUrl, getDubConfig } from '@/lib/dub';

export function DubTest() {
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const config = getDubConfig();

  const testDubAPI = async () => {
    setLoading(true);
    setResult('Testing dub.co API...');

    try {
      const currentUrl = window.location.href;
      const shortUrl = await createChartShareUrl(currentUrl, 'test-chart', 'test-repo');

      setResult(`✅ Success! Short URL: ${shortUrl}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setResult(`❌ Error: ${errorMessage}`);
      console.error('Dub API test error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg space-y-4">
      <h3 className="font-semibold">Dub.co API Test</h3>

      <div className="space-y-2 text-sm">
        <div>Environment: {config.isDev ? 'Development' : 'Production'}</div>
        <div>
          Architecture:{' '}
          {config.usesServerlessFunction ? 'Serverless Function (CORS-free)' : 'Direct API'}
        </div>
        <div>
          Mode:{' '}
          {import.meta.env.DEV
            ? 'Development (mocked)'
            : 'Production (calls /api/create-short-url)'}
        </div>
        <div>Domain: {import.meta.env.DEV ? 'dub.sh' : 'oss.fyi'}</div>
        <div className="text-xs text-gray-500 mt-2">
          Note: API key is securely stored in Netlify serverless function (not exposed to browser)
        </div>
      </div>

      <Button onClick={testDubAPI} disabled={loading}>
        {loading ? 'Testing...' : 'Test Dub API'}
      </Button>

      {result && (
        <div className="p-2 bg-gray-100 rounded text-sm font-mono whitespace-pre-wrap">
          {result}
        </div>
      )}
    </div>
  );
}
