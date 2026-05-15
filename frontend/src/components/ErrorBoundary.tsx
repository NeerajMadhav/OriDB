/**
 * Catches render errors in workspace UI and shows recovery UI.
 */
import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertCircle } from "lucide-react";

type Props = { children: ReactNode; title?: string };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[oridb] UI error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="border-border bg-surface-elevated flex h-full min-h-[200px] flex-col items-center justify-center gap-3 rounded border p-6 text-center">
          <AlertCircle className="text-error h-8 w-8" />
          <div>
            <p className="text-text-primary text-sm font-semibold">
              {this.props.title ?? "Something went wrong"}
            </p>
            <p className="text-text-muted mt-1 max-w-md font-mono text-xs">
              {this.state.error.message}
            </p>
          </div>
          <button
            type="button"
            className="bg-primary rounded px-3 py-1.5 text-sm text-white"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}


