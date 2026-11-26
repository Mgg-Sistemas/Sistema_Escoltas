import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Briefcase,
  CalendarCheck2,
  CalendarRange,
  CircleHelp,
  ClipboardCheck,
  CreditCard,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings2,
  Truck,
  UserCog,
  UsersRound,
  WalletCards,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useRealtime } from '../context/RealtimeContext.jsx';
import { Badge, Button } from './ui.jsx';
import { iniciales } from '../lib/data.js';

const NAVEGACION = [
  { to: '/', label: 'Inicio', icon: LayoutDashboard, descripcion: 'Resumen general', exacto: true },
  { to: '/escoltas', label: 'Escoltas', icon: UsersRound, descripcion: 'Personal y fichas', modulo: 'escoltas' },
  { to: '/distribucion', label: 'Distribución', icon: CalendarRange, descripcion: 'Asignaciones y turnos', modulo: 'distribucion' },
  { to: '/permisos', label: 'Permisos', icon: ClipboardCheck, descripcion: 'Solicitudes y revisiones', modulo: 'permisos' },
  { to: '/asistencias', label: 'Asistencias', icon: CalendarCheck2, descripcion: 'Entradas y salidas', modulo: 'asistencias' },
  { to: '/rrhh', label: 'RRHH', icon: Briefcase, descripcion: 'Personal y nóminas GT', modulo: 'rrhh' },
  { to: '/choferes', label: 'Choferes', icon: Truck, descripcion: 'Rutas, viajes y flota', modulo: 'choferes' },
  { to: '/nomina', label: 'Nómina', icon: WalletCards, descripcion: 'Periodos y cálculos', modulo: 'nomina' },
  { to: '/pagos', label: 'Pagos', icon: CreditCard, descripcion: 'Pagos y comprobantes', modulo: 'pagos' },
  { to: '/usuarios', label: 'Usuarios', icon: UserCog, descripcion: 'Cuentas y claves', modulo: 'usuarios' },
  { to: '/roles-permisos', label: 'Roles y permisos', icon: KeyRound, descripcion: 'Matriz de acceso', modulo: 'roles-permisos' },
  { to: '/ajustes', label: 'Ajustes', icon: Settings2, descripcion: 'Configuración del sistema', modulo: 'ajustes' },
  { to: '/cambiar-clave', label: 'Cambiar clave', icon: KeyRound, descripcion: 'Seguridad de la cuenta' },
  { to: '/ayuda', label: 'Ayuda', icon: CircleHelp, descripcion: 'Guía y preguntas', modulo: 'ayuda' },
];

const ETIQUETAS_RUTA = {
  escoltas: 'Escoltas',
  distribucion: 'Distribución',
  permisos: 'Permisos',
  asistencias: 'Asistencias',
  rrhh: 'Recursos Humanos',
  choferes: 'Choferes y Flota',
  nomina: 'Nómina',
  pagos: 'Pagos',
  usuarios: 'Usuarios',
  'roles-permisos': 'Roles y permisos',
  ajustes: 'Ajustes',
  'cambiar-clave': 'Cambiar clave',
  ayuda: 'Ayuda',
};

function EnlaceNav({ item, alNavegar, barra = false }) {
  const Icono = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.exacto}
      onClick={alNavegar}
      className={({ isActive }) =>
        `group flex font-semibold transition-all ${
          barra
            ? 'min-h-14 flex-col items-center justify-center gap-0.5 rounded-none px-1 py-1 text-center text-[11px]'
            : 'min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm'
        } ${
          isActive
            ? barra
              ? 'text-brand-400 font-bold'
              : 'bg-brand-600 text-white shadow-md ring-1 ring-brand-400/30'
            : barra
              ? 'text-slate-400 hover:text-slate-200'
              : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icono
            className={`h-4.5 w-4.5 shrink-0 ${
              isActive
                ? barra ? 'text-brand-400' : 'text-white'
                : 'text-slate-400 group-hover:text-brand-400'
            }`}
            aria-hidden="true"
          />
          <span className={`min-w-0 truncate ${barra ? 'max-w-full' : 'flex-1 text-left'}`}>{item.label}</span>
        </>
      )}
    </NavLink>
  );
}

export default function Layout() {
  const { user, profile, roleLabel, signOut, puede } = useAuth();
  const { conectado, estado: estadoTiempoReal } = useRealtime();
  const location = useLocation();
  const navigate = useNavigate();
  const [drawerAbierto, setDrawerAbierto] = useState(false);
  const [cerrandoSesion, setCerrandoSesion] = useState(false);

  const items = useMemo(
    () => NAVEGACION.filter((item) => !item.modulo || puede(item.modulo)),
    [puede],
  );

  useEffect(() => {
    setDrawerAbierto(false);
  }, [location.pathname]);

  const segmentos = location.pathname.split('/').filter(Boolean);
  const migas = [
    { label: 'Inicio', to: '/' },
    ...segmentos.map((segmento, indice) => ({
      label: ETIQUETAS_RUTA[segmento] || segmento,
      to: `/${segmentos.slice(0, indice + 1).join('/')}`,
    })),
  ];

  const cerrarSesion = async () => {
    try {
      setCerrandoSesion(true);
      await signOut();
      navigate('/login', { replace: true });
    } catch {
      // AuthContext handles local signout
    } finally {
      setCerrandoSesion(false);
    }
  };

  const movilPrincipal = [
    items[0],
    items.find((item) => item.to === '/escoltas'),
    items.find((item) => item.to === '/rrhh') || items.find((item) => item.to === '/choferes'),
    items.find((item) => item.to === '/nomina') || items.find((item) => item.to === '/asistencias'),
  ].filter(Boolean);

  return (
    <div className="min-h-screen bg-[#0e1217] text-slate-100">
      {/* Barra superior oscura */}
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-[#161b22]/95 backdrop-blur shadow-sm">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-3 px-4 sm:px-6">
          <button
            type="button"
            aria-label="Abrir menú"
            onClick={() => setDrawerAbierto(true)}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-300 hover:bg-slate-800 md:hidden"
          >
            <Menu className="h-6 w-6" aria-hidden="true" />
          </button>

          <div className="flex min-w-0 items-center gap-3">
            <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-950/80 ring-1 ring-brand-800/60 shadow-inner">
              <img
                src="/logo-escoltas.png"
                alt="Emblema de Seguridad Escoltas"
                className="h-8 w-8 object-contain"
              />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold leading-tight text-slate-100 sm:text-base">Sistema de Escoltas</p>
              <p className="hidden text-xs text-slate-400 sm:block">Control · RRHH · Choferes · Nómina</p>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <span
              className={`mr-0.5 inline-flex h-2.5 w-2.5 shrink-0 rounded-full ${conectado ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-amber-400'}`}
              title={`Tiempo real: ${estadoTiempoReal}`}
              aria-label={conectado ? 'Datos en tiempo real conectados' : 'Reconectando datos en tiempo real'}
            />
            <NavLink
              to="/ayuda"
              aria-label="Ir a la ayuda"
              title="Ayuda"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-800 hover:text-brand-400"
            >
              <CircleHelp className="h-5 w-5" aria-hidden="true" />
            </NavLink>
            <div className="hidden items-center gap-2 border-l border-slate-800 pl-3 md:flex">
              <div className="text-right">
                <p className="max-w-[160px] truncate text-sm font-semibold text-slate-200">
                  {profile?.full_name || user?.email || 'Usuario'}
                </p>
                <p className="text-xs text-slate-400">{roleLabel}</p>
              </div>
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-950/80 border border-brand-800/60 text-xs font-bold text-brand-300">
                {iniciales(profile) || 'US'}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={cerrarSesion}
                loading={cerrandoSesion}
                aria-label="Cerrar sesión"
                title="Cerrar sesión"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Sidebar escritorio oscuro */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-slate-800 bg-[#161b22] md:flex shadow-panel">
        <div className="flex h-16 items-center border-b border-slate-800 px-5">
          <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Menú principal</span>
        </div>
        <nav className="scrollbar-thin flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Navegación principal">
          {items.map((item) => (
            <EnlaceNav key={item.to} item={item} />
          ))}
        </nav>
        <div className="border-t border-slate-800 p-4">
          <div className="rounded-xl bg-[#0e1217]/90 border border-slate-800 p-3">
            <div className="flex items-center gap-2">
              <Badge tone="naranja">{roleLabel}</Badge>
              <span
                className={`text-xs font-medium ${conectado ? 'text-emerald-400' : 'text-amber-400'}`}
                title={`Tiempo real: ${estadoTiempoReal}`}
              >
                ● {conectado ? 'En vivo' : 'Conectando…'}
              </span>
            </div>
            <p className="mt-2 truncate text-xs text-slate-400 font-mono">{user?.email}</p>
          </div>
        </div>
      </aside>

      {/* Drawer móvil */}
      {drawerAbierto && (
        <div className="fixed inset-0 z-[60] md:hidden" role="dialog" aria-modal="true" aria-label="Menú de navegación">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDrawerAbierto(false)} aria-hidden="true" />
          <div className="relative flex h-full w-[85%] max-w-xs flex-col bg-[#161b22] border-r border-slate-800 shadow-panel animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-4">
              <div className="flex items-center gap-2">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-950/80 ring-1 ring-brand-800/60">
                  <img
                    src="/logo-escoltas.png"
                    alt="Emblema de Seguridad Escoltas"
                    className="h-8 w-8 object-contain"
                  />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-100">Sistema de Escoltas</p>
                  <p className="text-xs text-slate-400">Menú principal</p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Cerrar menú"
                onClick={() => setDrawerAbierto(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <nav className="scrollbar-thin flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Navegación móvil">
              {items.map((item) => (
                <EnlaceNav key={item.to} item={item} alNavegar={() => setDrawerAbierto(false)} />
              ))}
            </nav>
            <div className="border-t border-slate-800 p-4">
              <div className="mb-3 flex items-center gap-3">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-950/80 border border-brand-800/60 text-sm font-bold text-brand-300">
                  {iniciales(profile) || 'US'}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-200">{profile?.full_name || user?.email}</p>
                  <p className="text-xs text-slate-400">{roleLabel}</p>
                </div>
              </div>
              <Button variant="outline" fullWidth onClick={cerrarSesion} loading={cerrandoSesion} leftIcon={LogOut}>
                Cerrar sesión
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Contenido principal */}
      <main className="mx-auto max-w-[1600px] px-4 pb-32 pt-6 sm:px-6 md:ml-64 md:pb-12 md:pt-8">
        <nav aria-label="Ruta de navegación" className="mb-5 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
          {migas.map((miga, indice) => (
            <React.Fragment key={miga.to}>
              {indice > 0 && <span aria-hidden="true" className="text-slate-600">/</span>}
              <NavLink
                to={miga.to}
                className={indice === migas.length - 1 ? 'font-semibold text-brand-400' : 'hover:text-slate-200'}
              >
                {miga.label}
              </NavLink>
            </React.Fragment>
          ))}
        </nav>
        <Outlet />
      </main>

      {/* Barra inferior móvil */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-slate-800 bg-[#161b22]/95 pb-safe backdrop-blur md:hidden shadow-lg"
        aria-label="Navegación rápida"
      >
        {movilPrincipal.map((item) => (
          <EnlaceNav
            key={item.to}
            item={item}
            barra
            alNavegar={() => setDrawerAbierto(false)}
          />
        ))}
        <button
          type="button"
          onClick={() => setDrawerAbierto(true)}
          className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors ${
            !movilPrincipal.some((item) => location.pathname.startsWith(item.to) && item.to !== '/')
              ? 'text-brand-400 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
          Más
        </button>
      </nav>
    </div>
  );
}
