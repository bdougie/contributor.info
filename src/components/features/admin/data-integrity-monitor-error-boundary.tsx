import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from '@/components/ui/icon';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class DataIntegrityMonitorErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Data Integrity Monitor Error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="space-y-6">
          <div className="flex items-center justify-center min-h-[400px]">
            <Card className="max-w-2xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  Data Integrity Monitor Error
                </CardTitle>
                <CardDescription>
                  The monitoring dashboard encountered an unexpected error
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <div>
                        <strong>Error:</strong>{' '}
                        {this.state.error?.message || 'Unknown error occurred'}
                      </div>
                      {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
                        <details className="mt-2">
                          <summary className="cursor-pointer font-medium">
                            Technical Details (Development Only)
                          </summary>
                          <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto">
                            {this.state.error?.stack}
                            {this.state.errorInfo.componentStack}
                          </pre>
                        </details>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>

                <div className="flex gap-2">
                  <Button onClick={this.handleRetry} variant="outline" size="sm">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Try Again
                  </Button>
                  <Button onClick={() => window.location.reload()} variant="outline" size="sm">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Reload Page
                  </Button>
                </div>

                <div className="text-sm text-muted-foreground">
                  <p>If this error persists:</p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>Check your network connection</li>
                    <li>Verify your admin permissions are still valid</li>
                    <li>Try refreshing the page</li>
                    <li>Contact support if the issue continues</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
