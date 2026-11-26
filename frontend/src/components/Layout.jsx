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
  Moon,
  Settings2,
  ShieldCheck,
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
import { api } from '../lib/api.js';

const SECCIONES_NAVEGACION = [
  {
    titulo: 'Operación',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, descripcion: 'Centro de control operativo', exacto: true },
      { to: '/escoltas', label: 'Personal', icon: UsersRound, descripcion: 'Expediente digital y fichas', modulo: 'escoltas' },
      { to: '/distribucion', label: 'Turnos y Distribución', icon: CalendarRange, descripcion: 'Asignaciones y cobertura', modulo: 'distribucion' },
      { to: '/permisos', label: 'Descansos y Permisos', icon: ClipboardCheck, descripcion: 'Rotaciones y reposos', modulo: 'permisos' },
      { to: '/asistencias', label: 'Disponibilidad y Asistencia', icon: CalendarCheck2, descripcion: 'Entradas, salidas y guardias', modulo: 'asistencias' },
      { to: '/choferes', label: 'Flota y Servicios', icon: Truck, descripcion: 'Rutas, traslados y vehículos', modulo: 'choferes' },
    ],
  },
  {
    titulo: 'Finanzas y Gestión',
    items: [
      { to: '/rrhh', label: 'Recursos Humanos', icon: Briefcase, descripcion: 'Tabulador y contratos', modulo: 'rrhh' },
      { to: '/nomina', label: 'Nómina', icon: WalletCards, descripcion: 'Cálculos y períodos en Bs/$', modulo: 'nomina' },
      { to: '/pagos', label: 'Pagos y Recibos', icon: CreditCard, descripcion: 'Comprobantes y transferencias', modulo: 'pagos' },
    ],
  },
  {
    titulo: 'Sistema y Seguridad',
    items: [
      { to: '/usuarios', label: 'Usuarios y Cuentas', icon: UserCog, descripcion: 'Directorio y accesos', modulo: 'usuarios' },
      { to: '/roles-permisos', label: 'Roles y Permisos', icon: KeyRound, descripcion: 'Matriz de control', modulo: 'roles-permisos' },
      { to: '/ajustes', label: 'Configuración', icon: Settings2, descripcion: 'Ajustes y temas visuales', modulo: 'ajustes' },
      { to: '/ayuda', label: 'Ayuda', icon: CircleHelp, descripcion: 'Manuales y soporte', modulo: 'ayuda' },
    ],
  },
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
        `group flex font-medium transition-all ${
          barra
            ? 'min-h-14 flex-col items-center justify-center gap-0.5 rounded-none px-1 py-1 text-center text-[11px]'
            : 'min-h-10 items-center gap-2.5 rounded-xl px-3 py-2 text-sm'
        } ${
          isActive
            ? barra
              ? 'text-[#ff8a00] font-bold'
              : 'bg-[#ff8a00] text-white shadow-md font-bold'
            : barra
              ? 'text-[#9aa6b5] hover:text-[#e7ecf3]'
              : 'text-[#9aa6b5] hover:bg-[#2b3038] hover:text-[#e7ecf3]'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icono
            className={`h-4.5 w-4.5 shrink-0 ${
              isActive
                ? barra ? 'text-[#ff8a00]' : 'text-white'
                : 'text-[#ff8a00]/70 group-hover:text-[#ff8a00]'
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
  const [tasas, setTasas] = useState(null);

  useEffect(() => {
    let activo = true;
    const consultar = () => {
      api.obtenerTasas()
        .then((t) => {
          if (activo && t) setTasas(t);
        })
        .catch(() => {});
    };
    consultar();
    const timer = setInterval(consultar, 60_000);
    return () => {
      activo = false;
      clearInterval(timer);
    };
  }, []);

  // Filtramos por permisos respetando las secciones GT
  const seccionesFiltradas = useMemo(() => {
    return SECCIONES_NAVEGACION.map((sec) => ({
      ...sec,
      items: sec.items.filter((item) => !item.modulo || puede(item.modulo)),
    })).filter((sec) => sec.items.length > 0);
  }, [puede]);

  const todosLosItems = useMemo(
    () => seccionesFiltradas.flatMap((sec) => sec.items),
    [seccionesFiltradas],
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
      // Manejado por AuthContext
    } finally {
      setCerrandoSesion(false);
    }
  };

  const movilPrincipal = [
    todosLosItems[0],
    todosLosItems.find((item) => item.to === '/escoltas'),
    todosLosItems.find((item) => item.to === '/choferes') || todosLosItems.find((item) => item.to === '/rrhh'),
    todosLosItems.find((item) => item.to === '/nomina') || todosLosItems.find((item) => item.to === '/usuarios'),
  ].filter(Boolean);

  return (
    <div className="min-h-screen bg-[#1c1f24] text-[#e7ecf3]">
      {/* Barra superior oscura carbón GT */}
      <header className="sticky top-0 z-30 border-b border-[#333944] bg-[#23272e]/95 backdrop-blur shadow-sm">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-3 px-4 sm:px-6">
          <button
            type="button"
            aria-label="Abrir menú"
            onClick={() => setDrawerAbierto(true)}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[#9aa6b5] hover:bg-[#2b3038] hover:text-white md:hidden"
          >
            <Menu className="h-6 w-6" aria-hidden="true" />
          </button>

          <div className="flex min-w-0 items-center gap-3">
            <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2b3038] border border-[#ff8a00]/30 shadow-inner">
              <img
                src="/logo-escoltas.png"
                alt="Emblema de Seguridad Escoltas"
                className="h-8 w-8 object-contain"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-extrabold leading-tight sm:text-base text-metalico">
                  ESCOLTAS
                </p>
                <span className="hidden sm:inline-flex items-center gap-1 rounded-full badge-cromo px-2 py-0.5 text-[10px] font-bold text-[#ff8a00]">
                  <Moon className="h-2.5 w-2.5 text-oro" /> Seguridad y Vigilancia
                </span>
              </div>
              <p className="hidden text-xs text-[#9aa6b5] sm:block">Control de Personal, Servicios, Turnos y Nómina</p>
            </div>
          </div>

          {/* Ticker de Tasas Oficiales BCV, Euro y PMP Binance en Vivo */}
          <div className="hidden lg:flex items-center gap-2 rounded-xl bg-[#1c1f24] border border-[#333944] px-3 py-1 shadow-inner ml-2">
            <span className="h-2 w-2 rounded-full bg-[#29c081] animate-pulse" />
            <div className="flex items-center gap-3 font-mono text-[11px]">
              <span title="Dólar Oficial Banco Central de Venezuela">
                <span className="text-slate-400 font-sans font-semibold mr-1">BCV:</span>
                <strong className="text-slate-100">Bs. {tasas ? Number(tasas.bcv_usd).toFixed(2) : '924.35'}</strong>
              </span>
              <span className="text-[#333944]">|</span>
              <span title="Euro Oficial Banco Central de Venezuela">
                <span className="text-slate-400 font-sans font-semibold mr-1">EUR:</span>
                <strong className="text-oro">Bs. {tasas ? Number(tasas.bcv_eur).toFixed(2) : '1,011.73'}</strong>
              </span>
              <span className="text-[#333944]">|</span>
              <span title="Promedio Ponderado Binance P2P USDT/VES">
                <span className="text-slate-400 font-sans font-semibold mr-1">Binance:</span>
                <strong className="text-amber-400">Bs. {tasas ? Number(tasas.pmp_binance).toFixed(2) : '1,094.00'}</strong>
              </span>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium border ${
                conectado
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              }`}
              title={`Tiempo real: ${estadoTiempoReal}`}
            >
              <span className={`h-2 w-2 rounded-full ${conectado ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <span className="hidden sm:inline">{conectado ? 'En vivo' : 'Conectando'}</span>
            </span>

            {puede('ajustes') && (
              <NavLink
                to="/ajustes"
                aria-label="Ajustes del sistema"
                title="Ajustes"
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-[#9aa6b5] transition-colors hover:bg-[#2b3038] hover:text-[#ff8a00]"
              >
                <Settings2 className="h-4.5 w-4.5" aria-hidden="true" />
              </NavLink>
            )}

            <NavLink
              to="/ayuda"
              aria-label="Ir a la ayuda"
              title="Ayuda"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-[#9aa6b5] transition-colors hover:bg-[#2b3038] hover:text-[#ff8a00]"
            >
              <CircleHelp className="h-4.5 w-4.5" aria-hidden="true" />
            </NavLink>

            <div className="hidden items-center gap-2 border-l border-[#333944] pl-3 md:flex">
              <div className="text-right">
                <p className="max-w-[160px] truncate text-sm font-semibold text-[#e7ecf3]">
                  {profile?.full_name || profile?.usuario || user?.email || 'Usuario'}
                </p>
                <p className="text-xs text-[#9aa6b5]">{roleLabel}</p>
              </div>
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#2b3038] border border-[#ff8a00]/40 text-xs font-bold text-[#ff8a00]">
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

      {/* Sidebar escritorio oscuro (Gris carbón GT #23272e) */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-[#333944] bg-[#23272e] md:flex shadow-panel">
        <div className="flex h-16 items-center border-b border-[#333944] px-5 gap-2">
          <ShieldCheck className="h-5 w-5 text-[#ff8a00]" />
          <span className="text-xs font-bold uppercase tracking-wider text-[#9aa6b5]">Navegación</span>
        </div>

        <nav className="scrollbar-thin flex-1 space-y-4 overflow-y-auto px-3 py-4" aria-label="Navegación principal">
          {seccionesFiltradas.map((seccion) => (
            <div key={seccion.titulo} className="space-y-1">
              <div className="px-3 pb-1 pt-1 text-[11px] font-bold uppercase tracking-wider text-[#6a7585]">
                {seccion.titulo}
              </div>
              {seccion.items.map((item) => (
                <EnlaceNav key={item.to} item={item} />
              ))}
            </div>
          ))}
        </nav>

        <div className="border-t border-[#333944] p-3">
          <div className="rounded-xl bg-[#1c1f24] border border-[#333944] p-3">
            <div className="flex items-center justify-between">
              <Badge tone="naranja">{roleLabel}</Badge>
              <span className="text-[11px] text-[#29c081] font-medium flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-[#29c081] animate-ping" /> Activo
              </span>
            </div>
            <p className="mt-2 truncate text-xs text-[#9aa6b5] font-mono">{user?.email}</p>
          </div>
        </div>
      </aside>

      {/* Drawer móvil */}
      {drawerAbierto && (
        <div className="fixed inset-0 z-[60] md:hidden" role="dialog" aria-modal="true" aria-label="Menú de navegación">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setDrawerAbierto(false)} aria-hidden="true" />
          <div className="relative flex h-full w-[85%] max-w-xs flex-col bg-[#23272e] border-r border-[#333944] shadow-panel animate-fade-in">
            <div className="flex items-center justify-between border-b border-[#333944] px-4 py-4">
              <div className="flex items-center gap-2">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#2b3038] border border-[#333944]">
                  <img
                    src="/logo-escoltas.png"
                    alt="Emblema de Seguridad Escoltas"
                    className="h-8 w-8 object-contain"
                  />
                </div>
                <div>
                  <p className="text-sm font-bold text-metalico">ESCOLTAS</p>
                  <p className="text-xs text-[#9aa6b5]">Seguridad y Vigilancia</p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Cerrar menú"
                onClick={() => setDrawerAbierto(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-[#9aa6b5] hover:bg-[#2b3038] hover:text-white"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <nav className="scrollbar-thin flex-1 space-y-4 overflow-y-auto px-3 py-4" aria-label="Navegación móvil">
              {seccionesFiltradas.map((seccion) => (
                <div key={seccion.titulo} className="space-y-1">
                  <div className="px-3 pb-1 pt-1 text-[11px] font-bold uppercase tracking-wider text-[#6a7585]">
                    {seccion.titulo}
                  </div>
                  {seccion.items.map((item) => (
                    <EnlaceNav key={item.to} item={item} alNavegar={() => setDrawerAbierto(false)} />
                  ))}
                </div>
              ))}
            </nav>

            <div className="border-t border-[#333944] p-4">
              <div className="mb-3 flex items-center gap-3">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#2b3038] border border-[#ff8a00]/50 text-sm font-bold text-[#ff8a00]">
                  {iniciales(profile) || 'US'}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#e7ecf3]">{profile?.full_name || user?.email}</p>
                  <p className="text-xs text-[#9aa6b5]">{roleLabel}</p>
                </div>
              </div>
              <Button variant="outline" fullWidth onClick={cerrarSesion} loading={cerrandoSesion} leftIcon={LogOut}>
                Cerrar sesión
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Contenido principal con fondo carbón descansado GT */}
      <main className="mx-auto max-w-[1600px] px-4 pb-32 pt-6 sm:px-6 md:ml-64 md:pb-12 md:pt-8 bg-[#1c1f24] min-h-[calc(100vh-64px)]">
        <nav aria-label="Ruta de navegación" className="mb-5 flex flex-wrap items-center gap-1.5 text-xs text-[#9aa6b5]">
          {migas.map((miga, indice) => (
            <React.Fragment key={miga.to}>
              {indice > 0 && <span aria-hidden="true" className="text-[#6a7585]">/</span>}
              <NavLink
                to={miga.to}
                className={indice === migas.length - 1 ? 'font-semibold text-[#ff8a00]' : 'hover:text-[#e7ecf3]'}
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
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-[#333944] bg-[#23272e]/95 pb-safe backdrop-blur md:hidden shadow-lg"
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
              ? 'text-[#ff8a00] font-bold'
              : 'text-[#9aa6b5] hover:text-[#e7ecf3]'
          }`}
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
          Más
        </button>
      </nav>
    </div>
  );
}
