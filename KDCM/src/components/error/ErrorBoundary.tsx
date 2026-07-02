import { Component, type ErrorInfo, type ReactNode } from "react";
import { PanelError } from "./PanelError";

interface Props {
  /** Label shown in the error screen (e.g. "left panel") */
  panel: string;
  children: ReactNode;
  /** Optional fallback UI — defaults to PanelError */
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Per-panel ErrorBoundary.
 *
 * If a child component crashes, only THAT panel shows the error screen —
 * the other panels continue functioning normally.
 *
 * Usage (App.tsx):
 *   <ErrorBoundary panel="left">
 *     <LeftPanel />
 *   </ErrorBoundary>
 *   <ErrorBoundary panel="center">
 *     <CenterPanel />
 *   </ErrorBoundary>
 *   <ErrorBoundary panel="right">
 *     <RightPanel />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error(`[ErrorBoundary:${this.props.panel}]`, error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ error: null, errorInfo: null });
  };

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <PanelError
          panel={this.props.panel}
          error={this.state.error}
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
