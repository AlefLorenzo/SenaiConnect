import React, { Component } from 'react';
import { AlertTriangle, RefreshCw, Home, MessageCircle } from 'lucide-react';
import './ErrorBoundary.css';

/**
 * Error Boundary Component
 * Catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI instead of crashing the whole app.
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // Log error to console (in production, send to error reporting service)
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Call optional onError callback
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      // Render custom fallback UI if provided
      if (this.props.fallback) {
        return this.props.fallback({
          error: this.state.error,
          errorInfo: this.state.errorInfo,
          resetError: this.handleRetry,
        });
      }

      // Default fallback UI
      return (
        <div className="error-boundary" role="alert">
          <div className="error-boundary__container">
            <div className="error-boundary__icon" aria-hidden="true">
              <AlertTriangle size={48} strokeWidth={1.5} />
            </div>

            <h1 className="error-boundary__title">
              Oops! Algo deu errado
            </h1>

            <p className="error-boundary__message">
              Encontramos um erro inesperado. Nossa equipe já foi notificada.
            </p>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="error-boundary__details">
                <summary>Detalhes técnicos (desenvolvimento)</summary>
                <pre className="error-boundary__stack">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            <div className="error-boundary__actions">
              <button
                className="btn btn--primary"
                onClick={this.handleRetry}
                type="button"
              >
                <RefreshCw size={18} aria-hidden="true" />
                Tentar novamente
              </button>

              <button
                className="btn btn--secondary"
                onClick={this.handleGoHome}
                type="button"
              >
                <Home size={18} aria-hidden="true" />
                Ir para o início
              </button>
            </div>

            <div className="error-boundary__support">
              <p>Se o problema persistir,</p>
              <button
                className="btn btn--ghost btn--sm"
                onClick={() => window.open('mailto:suporte@senai.br?subject=Erro%20SENAI%20Connect', '_blank')}
                type="button"
              >
                <MessageCircle size={16} aria-hidden="true" />
                Contatar suporte
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * HOC wrapper for easy error boundary usage
 */
export function withErrorBoundary(WrappedComponent, errorBoundaryProps = {}) {
  return function WithErrorBoundary(props) {
    return (
      <ErrorBoundary {...errorBoundaryProps}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  };
}

/**
 * Hook to access error boundary state (for advanced use cases)
 */
export function useErrorBoundary() {
  // This is a placeholder - in practice you'd use context
  // to communicate with the nearest ErrorBoundary
  return {
    captureError: (error) => {
      throw error; // Will be caught by nearest ErrorBoundary
    },
  };
}

export default ErrorBoundary;