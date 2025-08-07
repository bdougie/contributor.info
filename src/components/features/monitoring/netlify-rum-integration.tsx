import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ExternalLink, BarChart3, TrendingUp, Users, Globe } from 'lucide-react';

/**
 * Netlify RUM Integration Component
 * 
 * This component provides a link to Netlify's Real User Monitoring dashboard
 * and displays key insights about Core Web Vitals from real user data.
 * 
 * Since Netlify RUM data is accessed through their dashboard, this component
 * serves as a bridge to guide users to the external monitoring tools.
 */
export function NetlifyRUMIntegration() {
  const netlifyRumUrl = 'https://app.netlify.com/projects/contributor-info/metrics/rum';
  
  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Real User Monitoring (RUM)
            </CardTitle>
            <CardDescription>
              Live Core Web Vitals data from actual users via Netlify
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(netlifyRumUrl, '_blank')}
            className="flex items-center gap-2"
          >
            View in Netlify
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertDescription>
            Netlify RUM automatically tracks Core Web Vitals (LCP, INP, CLS) from real user sessions.
            Click "View in Netlify" to access detailed metrics, geographic insights, and device breakdowns.
          </AlertDescription>
        </Alert>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-start gap-3">
            <TrendingUp className="h-5 w-5 text-muted-foreground mt-1" />
            <div>
              <p className="font-medium text-sm">Performance Trends</p>
              <p className="text-xs text-muted-foreground">
                Track Core Web Vitals over time with p75 metrics
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <Users className="h-5 w-5 text-muted-foreground mt-1" />
            <div>
              <p className="font-medium text-sm">User Experience</p>
              <p className="text-xs text-muted-foreground">
                Real user data segmented by device and browser
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <Globe className="h-5 w-5 text-muted-foreground mt-1" />
            <div>
              <p className="font-medium text-sm">Geographic Insights</p>
              <p className="text-xs text-muted-foreground">
                Performance metrics by user location
              </p>
            </div>
          </div>
        </div>
        
        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground">
            <strong>Note:</strong> Netlify RUM provides real user monitoring as part of your deployment.
            No additional setup required - data is collected automatically for all production builds.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}