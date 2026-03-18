import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      let isFirestoreError = false;
      let errorMessage = 'An unexpected error occurred.';
      
      try {
        if (this.state.error?.message) {
          const parsed = JSON.parse(this.state.error.message);
          if (parsed.error && parsed.operationType) {
            isFirestoreError = true;
            errorMessage = `Database Error: ${parsed.error}`;
          }
        }
      } catch (e) {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-luxury-black p-4">
          <div className="glass-panel p-8 rounded-[2rem] max-w-md w-full text-center border border-white/10">
            <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            
            <h2 className="text-2xl font-serif text-white mb-4">Something went wrong</h2>
            
            <div className="bg-black/40 rounded-xl p-4 mb-8 text-left">
              <p className="text-white/60 text-sm font-mono break-words">
                {errorMessage}
              </p>
              {isFirestoreError && (
                <p className="text-luxury-gold text-[10px] uppercase tracking-widest mt-2">
                  Check your network connection or ad-blocker.
                </p>
              )}
            </div>

            <button
              onClick={this.handleReset}
              className="luxury-button w-full bg-white text-luxury-black flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
