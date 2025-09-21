import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle } from '@/components/ui/icon';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ModalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('%s %o %o', 'Modal Error Boundary caught an error:', error, errorInfo);
  }

  resetErrorBoundary = () => {
    this.setState({ hasError: false, error: undefined });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription className="mt-2">
              <p className="mb-2">
                We encountered an error while processing your request. Please try again.
              </p>
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm font-medium">
                    Error details (development only)
                  </summary>
                  <pre className="mt-2 text-xs overflow-auto p-2 bg-gray-100 dark:bg-gray-800 rounded">
                    {this.state.error.toString()}
                  </pre>
                </details>
              )}
            </AlertDescription>
          </Alert>
          <div className="mt-4">
            <Button onClick={this.resetErrorBoundary} variant="default" size="sm">
              Try Again
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
