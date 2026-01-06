// src/components/ErrorBoundary.jsx
import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.state = { 
      hasError: true, 
      error: error, 
      errorInfo: errorInfo 
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-dark via-mid-dark to-dark p-4">
          <div className="max-w-2xl w-full bg-mid-dark border border-white/20 rounded-xl p-8 shadow-2xl">
            <div className="text-center mb-6">
              <div className="text-6xl mb-4">⚠️</div>
              <h1 className="text-3xl font-bold text-light mb-2">Oops! Something went wrong</h1>
              <p className="text-light/60 mb-6">
                The application encountered an error. Please try refreshing the page.
              </p>
            </div>

            {this.state.error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-red-300 mb-2">Error Details:</h3>
                <pre className="text-xs text-red-200 overflow-auto">
                  {this.state.error.toString()}
                </pre>
                {this.state.errorInfo && (
                  <details className="mt-3">
                    <summary className="text-xs text-red-300 cursor-pointer hover:text-red-200">
                      Stack Trace (click to expand)
                    </summary>
                    <pre className="text-xs text-red-200/70 mt-2 overflow-auto max-h-40">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            <div className="flex gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-3 bg-primary hover:bg-primary-dark text-white rounded-lg font-medium transition-all"
              >
                🔄 Refresh Page
              </button>
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null, errorInfo: null });
                }}
                className="px-6 py-3 bg-white/10 hover:bg-white/20 text-light rounded-lg font-medium transition-all"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="px-6 py-3 bg-white/10 hover:bg-white/20 text-light rounded-lg font-medium transition-all"
              >
                🏠 Go Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

