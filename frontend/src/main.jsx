import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ToastProvider } from './components/ui.jsx';
import { RealtimeProvider } from './context/RealtimeContext.jsx';
import { aplicarTema } from './lib/preferencias.js';
import './index.css';

aplicarTema();

// Inicializar paleta guardada de ESCOLTAS CONTROL 360
try {
  const paletaActiva = localStorage.getItem('escoltas_tema_paleta') || 'grafito';
  document.documentElement.setAttribute('data-paleta', paletaActiva);
} catch {
  // Entorno sin localStorage
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary capturó un error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[#0e1217] px-6 text-center text-slate-100">
          <div className="max-w-md rounded-2xl border border-red-500/30 bg-[#161b22] p-8 shadow-2xl">
            <h1 className="text-xl font-bold text-red-400">Ocurrió un error al cargar la vista</h1>
            <p className="mt-3 text-sm text-slate-400">
              {this.state.error?.message || 'Error inesperado en la interfaz.'}
            </p>
            <button
              type="button"
              onClick={() => {
                window.location.reload();
              }}
              className="mt-6 inline-flex items-center justify-center rounded-xl bg-[#ff8a00] px-5 py-2.5 font-bold text-white shadow-md hover:brightness-110"
            >
              Recargar página
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <RealtimeProvider>
              <App />
            </RealtimeProvider>
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);
