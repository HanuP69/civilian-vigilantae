import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught runtime error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    localStorage.clear();
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          background: '#0c0d12',
          color: '#ff6040',
          fontFamily: 'var(--font-mono, monospace)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          boxSizing: 'border-box'
        }}>
          <div className="rpg-panel" style={{
            maxWidth: '680px',
            width: '100%',
            background: 'rgba(255, 96, 64, 0.05)',
            border: '2px solid #ff6040',
            boxShadow: '8px 8px 0 rgba(0,0,0,0.8)',
            padding: '24px',
            boxSizing: 'border-box'
          }}>
            <h1 className="font-pixel" style={{
              fontSize: '1.5rem',
              color: '#ff6040',
              margin: '0 0 12px 0',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              🚨 CRITICAL HUD FAULT
            </h1>
            <p className="font-pixel" style={{ fontSize: '0.8rem', color: 'var(--ink-secondary)', margin: '0 0 20px 0' }}>
              The console application has encountered an unexpected runtime crash.
            </p>

            <div style={{
              background: '#050608',
              border: '1px solid rgba(255, 96, 64, 0.3)',
              padding: '16px',
              maxHeight: '280px',
              overflowY: 'auto',
              borderRadius: '2px',
              marginBottom: '24px',
              textAlign: 'left'
            }}>
              <p style={{
                color: '#ff6040',
                fontWeight: 'bold',
                margin: '0 0 8px 0',
                fontSize: '0.9rem'
              }}>
                Error: {this.state.error?.message || String(this.state.error)}
              </p>
              <pre style={{
                color: 'var(--ink-muted)',
                fontSize: '0.75rem',
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                lineHeight: 1.4
              }}>
                {this.state.error?.stack || 'No stack trace available'}
              </pre>
            </div>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button
                className="btn font-pixel"
                onClick={this.handleReload}
                style={{
                  background: '#ff6040',
                  color: '#0c0d12',
                  border: 'none',
                  padding: '10px 16px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '0.75rem',
                  borderRadius: 0,
                  boxShadow: '4px 4px 0 rgba(0,0,0,0.5)'
                }}
              >
                🔄 RELOAD CONSOLE
              </button>
              <button
                className="btn font-pixel"
                onClick={this.handleReset}
                style={{
                  background: 'transparent',
                  color: '#ff6040',
                  border: '1px solid #ff6040',
                  padding: '10px 16px',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  borderRadius: 0,
                  boxShadow: '4px 4px 0 rgba(0,0,0,0.5)'
                }}
              >
                💥 RESET ALL DATA
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
