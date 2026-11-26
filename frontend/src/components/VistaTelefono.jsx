import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Bell,
  Building,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Coffee,
  DollarSign,
  FileText,
  IdCard,
  LayoutDashboard,
  MapPin,
  Menu,
  Moon,
  QrCode,
  Shield,
  ShieldCheck,
  User,
  UsersRound,
  Wallet,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import CarnetPersonal from './CarnetPersonal.jsx';

/**
 * Vista Móvil Nativa de Alta Fidelidad
 * Replica con precisión el diseño de la imagen de referencia (media_1795719296188_bad3ae06.jpg)
 */
export default function VistaTelefono({ alCerrar, soloPreview = false }) {
  const { user, profile, roleLabel } = useAuth();
  const navigate = useNavigate();

  // Estados locales
  const [tabInferior, setTabInferior] = useState('inicio'); // 'inicio' | 'turnos' | 'nomina' | 'notificaciones' | 'perfil'
  const [seccionActiva, setSeccionActiva] = useState('inicio'); // 'inicio' | 'nomina' | 'turnos' | 'descansos' | 'personal'
  const [disponible, setDisponible] = useState(true);
  const [notificacionesLeidas, setNotificacionesLeidas] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [modalCarnet, setModalCarnet] = useState(false);

  const nombreUsuario = profile?.full_name || user?.user_metadata?.nombre || 'Carlos Méndez';
  const cargoUsuario = roleLabel || 'Escolta / Seguridad Operativa';
  const idUsuario = 'ESC-0147';
  const fotoUsuario = profile?.avatar_url || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&fit=crop&q=80';

  const escoltaData = {
    id: 'esc-0147',
    codigo: idUsuario,
    nombres: nombreUsuario.split(' ')[0] || 'Carlos',
    apellidos: nombreUsuario.split(' ').slice(1).join(' ') || 'Méndez',
    cedula: 'V-20.458.763',
    telefono: '0414-2345678',
    direccion: 'Urb. Altamira, Caracas',
    cargo: cargoUsuario,
    area: 'Presidencia / Seguridad Operativa',
    turno: 'Diurno (08:00 - 20:00)',
    foto_url: fotoUsuario,
    fecha_ingreso: '2023-03-15',
  };

  const irA = (ruta, tab = 'inicio') => {
    setTabInferior(tab);
    setMenuAbierto(false);
    navigate(ruta);
  };

  return (
    <div className="flex flex-col items-center justify-center p-0 sm:p-4 select-none">
      {/* Contenedor Mockup Teléfono (iPhone Style) */}
      <div className="relative w-full max-w-[410px] min-h-[820px] rounded-[44px] border-[8px] border-[#22272f] bg-black shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9),0_0_30px_rgba(255,138,0,0.15)] overflow-hidden flex flex-col justify-between text-slate-100">
        
        {/* Notch / Dynamic Island */}
        <div className="relative z-50 flex items-center justify-between px-7 pt-3 pb-1 text-[11px] font-bold text-slate-300">
          <span>10:24</span>
          <div className="h-4 w-28 rounded-full bg-[#111317] border border-[#2b3038] shadow-inner" />
          <div className="flex items-center gap-1.5">
            <span className="text-[10px]">5G</span>
            <div className="h-2.5 w-5 rounded-sm border border-slate-400 p-[1px]">
              <div className="h-full w-full bg-[#29c081] rounded-xs" />
            </div>
          </div>
        </div>

        {/* Top Header Bar con Escudo y Logo */}
        <header className="relative z-40 flex items-center justify-between px-5 py-2.5 border-b border-[#252a32] bg-gradient-to-b from-[#181b20] to-[#0e1013]">
          <button
            onClick={() => setMenuAbierto(!menuAbierto)}
            className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/60"
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Logo Centrado con Escudo */}
          <div className="flex items-center gap-2">
            <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#ff8a00] to-[#ffd54a] p-0.5 shadow-md">
              <div className="flex h-full w-full items-center justify-center rounded-[6px] bg-[#111317]">
                <ShieldCheck className="h-4 w-4 text-[#ff8a00]" />
              </div>
            </div>
            <div className="text-left">
              <p className="text-xs font-black tracking-tight text-white leading-none">
                ESCOLTAS
              </p>
              <p className="text-[7.5px] font-bold tracking-[0.16em] text-[#ff8a00] uppercase mt-0.5">
                Seguridad y Vigilancia
              </p>
            </div>
          </div>

          {/* Campana con Badge */}
          <div className="relative">
            <button
              onClick={() => {
                setTabInferior('notificaciones');
                setNotificacionesLeidas(true);
              }}
              className="relative p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/60"
            >
              <Bell className="h-5 w-5 text-slate-200" />
              {!notificacionesLeidas && (
                <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[9px] font-black text-white shadow-md animate-pulse">
                  3
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Menú Desplegable Móvil */}
        {menuAbierto && (
          <div className="absolute top-16 left-0 right-0 z-50 bg-[#161a20]/95 backdrop-blur-md border-b border-slate-700/80 p-4 shadow-2xl space-y-2 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center justify-between pb-2 border-b border-slate-700">
              <span className="text-xs font-bold uppercase text-[#ff8a00]">Menú Operativo</span>
              <button onClick={() => setMenuAbierto(false)} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <button onClick={() => irA('/escoltas', 'personal')} className="flex items-center gap-2.5 w-full text-left py-2 px-3 rounded-xl text-xs font-bold text-slate-200 hover:bg-slate-800">
              <UsersRound className="h-4 w-4 text-[#ff8a00]" /> Personal y Fichas
            </button>
            <button onClick={() => irA('/distribucion', 'turnos')} className="flex items-center gap-2.5 w-full text-left py-2 px-3 rounded-xl text-xs font-bold text-slate-200 hover:bg-slate-800">
              <Calendar className="h-4 w-4 text-[#ff8a00]" /> Turnos y Distribución
            </button>
            <button onClick={() => irA('/nomina', 'nomina')} className="flex items-center gap-2.5 w-full text-left py-2 px-3 rounded-xl text-xs font-bold text-slate-200 hover:bg-slate-800">
              <Wallet className="h-4 w-4 text-[#ff8a00]" /> Nómina y Recibos
            </button>
            <button onClick={() => irA('/permisos', 'descansos')} className="flex items-center gap-2.5 w-full text-left py-2 px-3 rounded-xl text-xs font-bold text-slate-200 hover:bg-slate-800">
              <Coffee className="h-4 w-4 text-[#ff8a00]" /> Descansos y Permisos
            </button>
            {soloPreview && alCerrar && (
              <div className="pt-2 border-t border-slate-700">
                <button onClick={alCerrar} className="w-full py-2 text-center rounded-xl bg-slate-800 text-xs font-bold text-rose-400 hover:bg-slate-700">
                  Cerrar Vista Móvil
                </button>
              </div>
            )}
          </div>
        )}

        {/* CUERPO PRINCIPAL CON SCROLL SUAVE */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3.5 scrollbar-thin scrollbar-thumb-slate-800">
          
          {/* 1. Tarjeta de Bienvenida del Operador */}
          <div className="rounded-2xl border border-[#343a46] bg-gradient-to-b from-[#1c2027] to-[#12151a] p-3 shadow-lg">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {/* Foto circular con aro naranja */}
                <div className="relative inline-block">
                  <img
                    src={fotoUsuario}
                    alt={nombreUsuario}
                    className="h-12 w-12 rounded-full object-cover border-2 border-[#ff8a00] shadow-md"
                  />
                  <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-[#29c081] border-2 border-black" />
                </div>

                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-slate-400 leading-tight">Hola,</p>
                  <h2 className="text-sm font-black text-white truncate">{nombreUsuario}</h2>
                  <p className="text-[10px] text-slate-400 truncate">{cargoUsuario}</p>
                  <span className="inline-block mt-0.5 text-[9px] font-mono font-bold text-[#ff8a00]">
                    ID: {idUsuario}
                  </span>
                </div>
              </div>

              {/* Badge de Disponibilidad */}
              <div className="flex flex-col items-end gap-1">
                <button
                  onClick={() => setDisponible(!disponible)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black border transition-all ${
                    disponible
                      ? 'bg-[#29c081]/15 text-[#29c081] border-[#29c081]/40'
                      : 'bg-rose-500/15 text-rose-400 border-rose-500/40'
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${disponible ? 'bg-[#29c081]' : 'bg-rose-400'}`} />
                  {disponible ? 'Disponible' : 'No disp.'}
                </button>

                <button
                  onClick={() => setModalCarnet(true)}
                  className="text-[9px] text-[#ffd54a] font-bold underline hover:text-white"
                >
                  Ver Carnet
                </button>
              </div>
            </div>
          </div>

          {/* 2. Cuatro Botones de Acción Rápida (Touch Friendly) */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { id: 'nomina', label: 'Nómina', icon: FileText, activo: seccionActiva === 'nomina', to: '/nomina' },
              { id: 'turnos', label: 'Turnos', icon: Calendar, activo: seccionActiva === 'turnos', to: '/distribucion' },
              { id: 'descansos', label: 'Descansos', icon: Coffee, activo: seccionActiva === 'descansos', to: '/permisos' },
              { id: 'personal', label: 'Personal', icon: UsersRound, activo: seccionActiva === 'personal', to: '/escoltas' },
            ].map((btn) => {
              const Icono = btn.icon;
              return (
                <button
                  key={btn.id}
                  onClick={() => {
                    setSeccionActiva(btn.id);
                    navigate(btn.to);
                  }}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border transition-all ${
                    btn.activo
                      ? 'border-[#ff8a00] bg-gradient-to-b from-[#ff8a00] to-[#cc4400] text-black shadow-lg shadow-[#ff8a00]/30 font-black'
                      : 'border-[#2d333e] bg-gradient-to-b from-[#1e222a] to-[#12151a] text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <Icono className={`h-5 w-5 mb-1 ${btn.activo ? 'text-black' : 'text-[#ff8a00]'}`} />
                  <span className="text-[10px] font-bold tracking-tight">{btn.label}</span>
                </button>
              );
            })}
          </div>

          {/* 3. Banner Destacado "Mi Nómina" */}
          <div className="rounded-2xl border border-[#ff8a00]/40 bg-gradient-to-r from-[#1f242d] via-[#241a12] to-[#ff8a00]/25 p-3.5 shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#ff8a00] to-[#ffd54a] text-black shadow">
                  <Wallet className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-white uppercase tracking-wider">Mi Nómina</h3>
                  <p className="text-[10px] text-slate-400">Período: 01 – 15 Nov 2026</p>
                </div>
              </div>

              <div className="text-right">
                <p className="text-sm font-black text-[#ffd54a] font-mono leading-tight">
                  Bs. 14.850,00
                </p>
                <button
                  onClick={() => navigate('/nomina')}
                  className="inline-flex items-center text-[10px] font-bold text-[#ff8a00] hover:text-white mt-0.5"
                >
                  Ver Detalle <ChevronRight className="h-3 w-3 ml-0.5" />
                </button>
              </div>
            </div>
          </div>

          {/* 4. Tarjetas Gemelas: Próximo Turno y Descanso */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* Próximo Turno */}
            <div className="rounded-2xl border border-[#343a46] bg-gradient-to-b from-[#1c2027] to-[#12151a] p-3 shadow">
              <div className="flex items-center gap-1.5 border-b border-slate-800 pb-1.5 text-xs font-bold text-[#ff8a00]">
                <Calendar className="h-3.5 w-3.5" />
                <span>Próximo Turno</span>
              </div>
              <div className="mt-2 space-y-1 text-[10.5px]">
                <p className="font-bold text-slate-200">Lun, 17 Nov 2026</p>
                <p className="text-slate-400 flex items-center gap-1">
                  <Clock className="h-3 w-3 text-[#ff8a00]" /> 08:00 – 20:00
                </p>
                <p className="text-slate-400 flex items-center gap-1 truncate">
                  <MapPin className="h-3 w-3 text-blue-400 shrink-0" /> Sede Principal
                </p>
              </div>
              <button
                onClick={() => navigate('/distribucion')}
                className="mt-2.5 w-full rounded-xl bg-gradient-to-r from-[#ff8a00] to-[#e67a00] py-1 text-center text-[10px] font-black text-black shadow-sm"
              >
                Ver Turnos &gt;
              </button>
            </div>

            {/* Descanso */}
            <div className="rounded-2xl border border-[#343a46] bg-gradient-to-b from-[#1c2027] to-[#12151a] p-3 shadow">
              <div className="flex items-center gap-1.5 border-b border-slate-800 pb-1.5 text-xs font-bold text-[#ffd54a]">
                <Coffee className="h-3.5 w-3.5" />
                <span>Descanso</span>
              </div>
              <div className="mt-2 space-y-1 text-[10.5px]">
                <p className="font-bold text-slate-200">Mar, 18 Nov 2026</p>
                <p className="text-slate-400 flex items-center gap-1">
                  <Clock className="h-3 w-3 text-[#ffd54a]" /> 24 Horas
                </p>
                <p className="text-slate-400 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-[#29c081]" /> Próximo descanso
                </p>
              </div>
              <button
                onClick={() => navigate('/permisos')}
                className="mt-2.5 w-full rounded-xl border border-slate-700 bg-slate-800/80 py-1 text-center text-[10px] font-bold text-slate-200 hover:bg-slate-700"
              >
                Ver Calendario &gt;
              </button>
            </div>
          </div>

          {/* 5. Switch Bar: Estado de Disponibilidad */}
          <div className="flex items-center justify-between rounded-2xl border border-[#343a46] bg-[#14171c] px-3.5 py-2.5 shadow">
            <div className="flex items-center gap-2.5">
              <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#29c081]/15 border border-[#29c081]/30 text-[#29c081]">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-bold">Estado de Disponibilidad</p>
                <p className={`text-xs font-black ${disponible ? 'text-[#29c081]' : 'text-rose-400'}`}>
                  {disponible ? 'DISPONIBLE' : 'NO DISPONIBLE'}
                </p>
              </div>
            </div>

            <button
              onClick={() => setDisponible(!disponible)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                disponible ? 'bg-[#29c081]' : 'bg-slate-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  disponible ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* 6. Notificaciones Operativas Recientes */}
          <div className="rounded-2xl border border-[#343a46] bg-[#12151a] p-3 shadow space-y-2">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                <Bell className="h-3.5 w-3.5 text-[#ff8a00]" />
                <span>Notificaciones</span>
              </div>
              <button onClick={() => navigate('/ayuda')} className="text-[10px] font-bold text-[#ff8a00] hover:underline">
                Ver todas &gt;
              </button>
            </div>

            <div className="space-y-2 text-[10.5px]">
              <div className="flex items-start gap-2.5 p-1.5 rounded-xl hover:bg-slate-800/40">
                <Calendar className="h-4 w-4 text-[#ff8a00] shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-200">Cambio de turno</p>
                  <p className="text-slate-400 truncate">Tu turno del 20 Nov fue actualizado.</p>
                </div>
                <span className="text-[9px] text-slate-500 whitespace-nowrap">Hace 12 min</span>
              </div>

              <div className="flex items-start gap-2.5 p-1.5 rounded-xl hover:bg-slate-800/40">
                <DollarSign className="h-4 w-4 text-[#29c081] shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-200">Nómina disponible</p>
                  <p className="text-slate-400 truncate">Tu pago del período 01 – 15 Nov ya está disponible.</p>
                </div>
                <span className="text-[9px] text-slate-500 whitespace-nowrap">Hace 1 h</span>
              </div>

              <div className="flex items-start gap-2.5 p-1.5 rounded-xl hover:bg-slate-800/40">
                <AlertTriangle className="h-4 w-4 text-[#ffd54a] shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-200">Recordatorio</p>
                  <p className="text-slate-400 truncate">Revisión de equipo y dotación mañana a las 07:30.</p>
                </div>
                <span className="text-[9px] text-slate-500 whitespace-nowrap">Hace 3 h</span>
              </div>
            </div>
          </div>
        </div>

        {/* 7. Bottom Navigation Dock (Barra Inferior con 5 Botones) */}
        <nav className="relative z-40 border-t border-[#252a32] bg-gradient-to-t from-[#090b0d] to-[#14171c] px-2 py-1.5">
          <div className="grid grid-cols-5 gap-1 text-center">
            {[
              { id: 'inicio', label: 'Inicio', icon: LayoutDashboard, to: '/' },
              { id: 'turnos', label: 'Turnos', icon: Calendar, to: '/distribucion' },
              { id: 'nomina', label: 'Nómina', icon: FileText, to: '/nomina' },
              { id: 'notificaciones', label: 'Notif.', icon: Bell, to: '/ayuda', badge: notificacionesLeidas ? null : 3 },
              { id: 'perfil', label: 'Mi Perfil', icon: User, accion: () => setModalCarnet(true) },
            ].map((tab) => {
              const Icono = tab.icon;
              const activo = tabInferior === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setTabInferior(tab.id);
                    if (tab.accion) tab.accion();
                    else if (tab.to) navigate(tab.to);
                  }}
                  className={`relative flex flex-col items-center justify-center py-1 rounded-xl transition-all ${
                    activo ? 'text-[#ff8a00] font-bold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="relative">
                    <Icono className={`h-4.5 w-4.5 ${activo ? 'text-[#ff8a00]' : 'text-slate-400'}`} />
                    {tab.badge && (
                      <span className="absolute -top-1 -right-2 h-3.5 w-3.5 rounded-full bg-rose-600 text-[8px] font-black text-white flex items-center justify-center">
                        {tab.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-[9px] tracking-tight mt-0.5">{tab.label}</span>
                  {activo && (
                    <span className="absolute bottom-0 h-0.5 w-5 rounded-full bg-[#ff8a00]" />
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      </div>

      {/* Modal del Carnet Digital en vista móvil */}
      {modalCarnet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="relative w-full max-w-sm rounded-3xl bg-[#14171c] border border-slate-700 p-4 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-[#ff8a00] uppercase">Carnet Digital Oficial</span>
              <button onClick={() => setModalCarnet(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <CarnetPersonal escolta={escoltaData} grado={cargoUsuario} />
          </div>
        </div>
      )}
    </div>
  );
}
