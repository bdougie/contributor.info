import { useState, useEffect } from 'react';
import { analyzePullRequests, type PRAnalysisResult } from '../../lib/insights/pullRequests';

interface PullRequestInsightsProps {
  owner: string;
  repo: string;
  dateRange?: { 
    startDate?: Date; 
    endDate?: Date 
  };
}

export function PullRequestInsights({ 
  owner, 
  repo,
  dateRange
}: PullRequestInsightsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prAnalysis, setPrAnalysis] = useState<PRAnalysisResult | null>(null);

  useEffect(() => {
    async function fetchPRAnalysis() {
      if (!owner || !repo) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const analysis = await analyzePullRequests(owner, repo, dateRange);
        setPrAnalysis(analysis.totalPRs > 0 ? analysis : null);
      } catch (err) {
        setError('Failed to analyze pull requests. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    fetchPRAnalysis();
  }, [owner, repo, dateRange]);

  if (loading) return <div>Loading pull request insights...</div>;
  if (error) return <div className="text-red-500">{error}</div>;
  if (!prAnalysis) return <div>No pull requests available for analysis</div>;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Pull Request Insights</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
          <h3 className="font-medium">Overview</h3>
          <p>Total PRs: {prAnalysis.totalPRs}</p>
          <p>Average time to merge: {prAnalysis.averageTimeToMerge.toFixed(1)} hours</p>
        </div>
        
        <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
          <h3 className="font-medium">PRs by Author</h3>
          {Object.entries(prAnalysis.prsByAuthor).length > 0 ? (
            Object.entries(prAnalysis.prsByAuthor).map(([author, count]) => (
              <div key={author} className="flex justify-between">
                <span>{author}</span>
                <span>{count}</span>
              </div>
            ))
          ) : (
            <p>No author data available</p>
          )}
        </div>
      </div>
      
      {/* Add more visualizations or metrics as needed */}
    </div>
  );
}