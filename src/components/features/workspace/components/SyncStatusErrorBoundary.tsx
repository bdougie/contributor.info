import { Component, ReactNode } from 'react';
import { AlertCircle } from '@/components/ui/icon';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Error boundary for sync status display
 * Prevents sync status fetch failures from breaking the entire MyWorkCard
 */
export class SyncStatusErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }): void {
    // Log error for debugging without exposing to user
    console.error('Sync status error:', error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="mt-2 px-3 py-2 rounded-md text-xs flex items-center gap-2 bg-muted/50 text-muted-foreground border border-border">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          <span>Unable to load sync status</span>
        </div>
      );
    }

    return this.props.children;
  }
}
