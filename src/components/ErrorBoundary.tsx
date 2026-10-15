import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

/** Last-resort guard: never show a blank screen or a stack trace to users. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) console.error('[family-memories] unexpected error', error, info);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div style={{ padding: '3rem 1rem', textAlign: 'center', display: 'grid', gap: '1rem', justifyItems: 'center' }}>
        <h1>Algo ha fallado</h1>
        <p>Ha ocurrido un error inesperado. Recarga la página para continuar.</p>
        <button type="button" onClick={() => window.location.reload()}>
          Recargar
        </button>
      </div>
    );
  }
}
