import React from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ArrowLeft, CircleHelp, Loader2, ShieldAlert, ShieldCheck } from 'lucide-react';
import Layout from './components/Layout.jsx';
import { Button } from './components/ui.jsx';
import { useAuth } from './context/AuthContext.jsx';
import Login from './pages/Login.jsx';
import RecuperarClave from './pages/RecuperarClave.jsx';
import CambiarClave from './pages/CambiarClave.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Escoltas from './pages/Escoltas.jsx';
import Distribucion from './pages/Distribucion.jsx';
import Permisos from './pages/Permisos.jsx';
import Asistencias from './pages/Asistencias.jsx';
import Nomina from './pages/Nomina.jsx';
import Pagos from './pages/Pagos.jsx';
import Choferes from './pages/Choferes.jsx';
import Rrhh from './pages/Rrhh.jsx';
import Usuarios from './pages/Usuarios.jsx';
import RolesPermisos from './pages/RolesPermisos.jsx';
import Ajustes from './pages/Ajustes.jsx';
import Ayuda from './pages/Ayuda.jsx';

function PantallaCarga() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-6 text-center">
      <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-700 text-white shadow-card">
        <ShieldCheck className="h-7 w-7" aria-hidden="true" />
      </div>
      <Loader2 className="h-6 w-6 animate-spin text-brand-600" aria-hidden="true" />
      <p className="text-sm font-medium text-slate-600">Preparando tu espacio de trabajo…</p>
    </div>
  );
}

export function SinPermiso({ modulo = 'este módulo' }) {
  const { roleLabel } = useAuth();
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center shadow-card">
      <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
        <ShieldAlert className="h-8 w-8" aria-hidden="true" />
      </div>
      <h1 className="mt-5 text-2xl font-bold text-slate-900">No tienes acceso a {modulo}</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-600">
        Tu perfil actual es <strong className="text-slate-800">{roleLabel}</strong> y este módulo está
        reservado a otros roles. No es un error de tu cuenta: simplemente tus permisos no incluyen
        esta sección. Si necesitas acceder, pide al administrador que revise tu rol.
      </p>
      <div className="mt-6 flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
        <Link to="/" className="w-full sm:w-auto">
          <Button variant="primary" size="lg" fullWidth leftIcon={ArrowLeft}>Volver al inicio</Button>
        </Link>
        <Link to="/ayuda" className="w-full sm:w-auto">
          <Button variant="outline" size="lg" fullWidth leftIcon={CircleHelp}>Ver ayuda</Button>
        </Link>
      </div>
    </div>
  );
}

function RoleRoute({ roles, modulo, children }) {
  const { role, loading } = useAuth();
  if (loading) return <PantallaCarga />;
  if (!roles.includes(role)) return <SinPermiso modulo={modulo} />;
  return children;
}

export default function App() {
  const { autenticado, loading, debeCambiarClave } = useAuth();
  const ubicacion = useLocation();

  if (loading) return <PantallaCarga />;

  const rutaActual = ubicacion.pathname;
  const rutasClave = ['/cambiar-clave', '/restablecer-clave'];
  if (autenticado && debeCambiarClave && !rutasClave.includes(rutaActual)) {
    return <Navigate to="/cambiar-clave" replace />;
  }

  return (
    <Routes>
      <Route path="/login" element={autenticado ? <Navigate to="/" replace /> : <Login />} />
      <Route
        path="/recuperar-clave"
        element={autenticado ? <Navigate to="/" replace /> : <RecuperarClave />}
      />
      <Route
        path="/cambiar-clave"
        element={autenticado ? <CambiarClave /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/restablecer-clave"
        element={autenticado ? <CambiarClave /> : <Navigate to="/login" replace />}
      />
      <Route element={autenticado ? <Layout /> : <Navigate to="/login" replace />}>
        <Route index element={<Dashboard />} />
        <Route path="escoltas" element={<Escoltas />} />
        <Route path="distribucion" element={<Distribucion />} />
        <Route path="permisos" element={<Permisos />} />
        <Route path="asistencias" element={<Asistencias />} />
        <Route path="choferes" element={<RoleRoute roles={['admin', 'supervisor', 'chofer']} modulo="Choferes"><Choferes /></RoleRoute>} />
        <Route path="rrhh" element={<RoleRoute roles={['admin', 'rrhh', 'contador']} modulo="RRHH"><Rrhh /></RoleRoute>} />
        <Route path="nomina" element={<RoleRoute roles={['admin', 'contador']} modulo="Nómina"><Nomina /></RoleRoute>} />
        <Route path="pagos" element={<RoleRoute roles={['admin', 'contador']} modulo="Pagos"><Pagos /></RoleRoute>} />
        <Route path="usuarios" element={<RoleRoute roles={['admin']} modulo="Usuarios"><Usuarios /></RoleRoute>} />
        <Route path="roles-permisos" element={<RoleRoute roles={['admin']} modulo="Roles y permisos"><RolesPermisos /></RoleRoute>} />
        <Route path="ajustes" element={<RoleRoute roles={['admin']} modulo="Ajustes"><Ajustes /></RoleRoute>} />
        <Route path="ayuda" element={<Ayuda />} />
      </Route>
      <Route path="*" element={<Navigate to={autenticado ? '/' : '/login'} replace />} />
    </Routes>
  );
}

export { PantallaCarga, RoleRoute };
