import { Component } from 'react';

// Top-level safety net for uncaught render errors. Plain inline styles on
// purpose — this fallback screen is rarely seen and doesn't need to draw
// from the app's CSS design system.
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Unhandled UI error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '24px',
            textAlign: 'center',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <h1 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>Something went wrong</h1>
          <p style={{ color: '#64748B', maxWidth: '360px' }}>
            Please refresh the page. If the problem persists, contact support.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
