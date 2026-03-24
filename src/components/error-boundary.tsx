"use client";

import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="min-h-[300px] flex items-center justify-center p-8">
          <div className="glass-card p-8 max-w-md w-full text-center space-y-4">
            <div className="w-12 h-12 rounded-xl bg-[var(--accent-rose)]/15 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" style={{ color: "var(--accent-rose)" }} />
            </div>
            <div>
              <h2 className="font-bold text-base mb-1">Algo deu errado</h2>
              <p className="text-sm text-[var(--text-muted)]">
                {this.state.error?.message ?? "Ocorreu um erro inesperado nesta seção."}
              </p>
            </div>
            <button
              onClick={this.handleReset}
              className="btn-primary inline-flex items-center gap-2 mx-auto"
            >
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
              Tentar novamente
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
