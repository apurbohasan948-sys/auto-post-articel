import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, ShieldAlert, Terminal } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Sanitizes any error message or stack trace to ensure secret keys, tokens,
 * or credentials are never exposed in technical details.
 */
function sanitizeErrorMessage(msg: string): string {
  if (!msg) return 'An unexpected application error occurred.';
  return msg
    .replace(/(?:key|token|secret|password|auth|bearer)=['"]?[^&'"\s]+['"]?/gi, '[PROTECTED_CREDENTIAL]')
    .replace(/tvly-[a-zA-Z0-9_-]+/g, 'tvly-••••••••')
    .replace(/sk-[a-zA-Z0-9_-]+/g, 'sk-••••••••')
    .replace(/AIza[a-zA-Z0-9_-]+/g, 'AIza••••••••');
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public override state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    // Diagnostic safe console logging without secrets
    console.error('[Axiom ErrorBoundary Caught Exception]:', sanitizeErrorMessage(error.message));
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetToDashboard = () => {
    try {
      window.history.pushState(null, '', '/');
    } catch {
      // Ignore
    }
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private handleClearCacheAndReload = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // Ignore
    }
    window.location.href = '/';
  };

  public override render(): ReactNode {
    if (this.state.hasError) {
      const sanitizedMsg = sanitizeErrorMessage(this.state.error?.message || 'Unknown error');
      const sanitizedStack = sanitizeErrorMessage(this.state.error?.stack || '');

      return (
        <div
          id="error-boundary-screen"
          className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6"
        >
          <div className="w-full max-w-xl cyber-panel p-6 sm:p-8 rounded-2xl border border-rose-500/30 shadow-2xl bg-gradient-to-b from-slate-900/90 to-[#0b0f19] space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white font-display">Something went wrong</h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  The application encountered an unexpected runtime error, but data was safeguarded.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono space-y-2">
              <div className="flex items-center justify-between text-slate-500 text-[11px] pb-1 border-b border-slate-800/80">
                <span className="flex items-center gap-1.5 text-rose-400">
                  <ShieldAlert className="w-3.5 h-3.5" /> Technical Details
                </span>
                <span className="text-[10px] uppercase">Client Runtime Exception</span>
              </div>
              <p className="text-rose-300 break-words font-semibold">{sanitizedMsg}</p>
              {sanitizedStack && (
                <details className="mt-2 text-slate-400">
                  <summary className="cursor-pointer text-[10px] text-slate-500 hover:text-slate-300 select-none">
                    View Call Stack Trace
                  </summary>
                  <pre className="mt-2 text-[10px] text-slate-500 whitespace-pre-wrap max-h-36 overflow-y-auto p-2 rounded bg-slate-900/60 border border-slate-800/50">
                    {sanitizedStack}
                  </pre>
                </details>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
              <button
                id="error-boundary-reload-btn"
                onClick={this.handleReload}
                className="w-full sm:w-auto px-5 py-2.5 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 shadow-lg shadow-cyan-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reload Application</span>
              </button>

              <button
                id="error-boundary-dashboard-btn"
                onClick={this.handleResetToDashboard}
                className="w-full sm:w-auto px-4 py-2.5 rounded-lg text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Home className="w-4 h-4 text-cyan-400" />
                <span>Return to Dashboard</span>
              </button>

              <button
                id="error-boundary-clear-cache-btn"
                onClick={this.handleClearCacheAndReload}
                className="w-full sm:w-auto sm:ml-auto text-xs text-slate-500 hover:text-slate-300 transition-colors py-2 px-2 underline"
              >
                Reset Cache & Reload
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
