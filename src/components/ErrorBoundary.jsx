import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        // Update state so the next render will show the fallback UI.
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        // You can also log the error to an error reporting service
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ errorInfo });
    }

    render() {
        if (this.state.hasError) {
            // You can render any custom fallback UI
            return (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950 text-white p-8">
                    <div className="max-w-2xl w-full bg-slate-900 border border-red-500/30 rounded-2xl p-6 shadow-2xl">
                        <h1 className="text-2xl font-bold text-red-400 mb-4">Something went wrong.</h1>
                        <p className="text-slate-300 mb-4">
                            The application encountered a critical error and had to stop.
                        </p>
                        <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 overflow-auto max-h-64 mb-6">
                            <code className="text-sm font-mono text-fuchsia-300">
                                {this.state.error && this.state.error.toString()}
                            </code>
                            {this.state.errorInfo && (
                                <pre className="text-xs text-slate-500 mt-2">
                                    {this.state.errorInfo.componentStack}
                                </pre>
                            )}
                        </div>
                        <button
                            onClick={() => window.location.reload()}
                            className="w-full py-3 bg-red-500 hover:bg-red-600 rounded-xl font-bold transition"
                        >
                            Reload Application
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
