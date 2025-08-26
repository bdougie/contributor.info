import { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class CommandPaletteErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(_error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, _errorInfo: ErrorInfo) {
    console.error('CommandPalette error:', _error, _errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, _error: null });
    this.props.onReset?.();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="bg-background border rounded-lg p-6 max-w-md mx-auto shadow-lg">
            <h2 className="text-lg font-semibold mb-2">Command Palette Error</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Something went wrong with the command palette. Please try again.
            </p>
            <Button onClick={this.handleReset} size="sm">
              Close and Reset
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
