import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createChartShareUrl, getDubConfig } from "@/lib/dub";

export function DubTest() {
  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState(false);
  
  const config = getDubConfig();
  
  const testDubAPI = async () => {
    setLoading(true);
    setResult("Testing dub.co API...");
    
    try {
      const currentUrl = window.location.href;
      const shortUrl = await createChartShareUrl(
        currentUrl,
        "test-chart",
        "test-repo"
      );
      
      setResult(`✅ Success! Short URL: ${shortUrl}`);
    } catch (error: any) {
      setResult(`❌ Error: ${error.message}`);
      console.error("Dub API test error:", error);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="p-4 border rounded-lg space-y-4">
      <h3 className="font-semibold">Dub.co API Test</h3>
      
      <div className="space-y-2 text-sm">
        <div>Environment: {config.isDev ? "Development" : "Production"}</div>
        <div>Domain: {config.domain}</div>
        <div>API Key: {config.hasApiKey ? "✅ Present" : "❌ Missing"}</div>
        <div>
          API Key from import.meta.env: {import.meta.env.VITE_DUB_CO_KEY ? "✅ Present" : "❌ Missing"}
        </div>
        <div>
          API Key format: {import.meta.env.VITE_DUB_CO_KEY?.startsWith('dub_') ? "✅ Valid" : "❌ Invalid"}
        </div>
        <div>
          API Mode: {import.meta.env.DEV ? "Development (mocked)" : "Production (Netlify function)"}
        </div>
        <div>
          Environment DEV: {import.meta.env.DEV ? "true" : "false"}
        </div>
        <div>
          Environment MODE: {import.meta.env.MODE}
        </div>
      </div>
      
      <Button onClick={testDubAPI} disabled={loading}>
        {loading ? "Testing..." : "Test Dub API"}
      </Button>
      
      {result && (
        <div className="p-2 bg-gray-100 rounded text-sm font-mono whitespace-pre-wrap">
          {result}
        </div>
      )}
    </div>
  );
}