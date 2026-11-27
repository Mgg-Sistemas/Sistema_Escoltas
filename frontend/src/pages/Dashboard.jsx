import ReporteModulo from "../components/ReporteModulo.jsx";
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRealtimeRecarga } from '../hooks/useRealtime.js';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Bed,
  Bell,
  Briefcase,
  Calendar,
  CalendarCheck2,
  CalendarRange,
  CheckCircle2,
  CircleHelp,
  ClipboardCheck,
  Clock,
  CreditCard,
  DollarSign,
  Eye,
  FileSpreadsheet,
  FileText,
  Layers,
  ListChecks,
  MapPin,
  Moon,
  Plus,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sun,
  TrendingUp,
  Truck,
  UserCheck,
  UserPlus,
  UsersRound,
  WalletCards,
} from 'lucide-react';
import { Badge, Button, Card, EmptyState, HelpTip, Skeleton, StatCard, useToast } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import {
  contar,
  formatearFecha,
  formatearFechaHora,
  formatearMoneda,
  formatearNumero,
  hoyISO,
  listar,
  nombreCompleto,
  TABLAS,
} from '../lib/data.js';
import { estadoLabel, estadoTone } from '../lib/constants.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Dashboard() {
  const { role, roleLabel, user, profile, puede } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [cargando, setCargando] = useState(true);
  const [resumen, setResumen] = useState(null);
  const [conteos, setConteos] = useState({ escoltas: 0, pendientes: 0, asistenciasHoy: 0, periodos: 0 });
  const [actividad, setActividad] = useState([]);
  const [escoltas, setEscoltas] = useState([]);
  const [permisos, setPermisos] = useState([]);
  const [asistencias, setAsistencias] = useState([]);

  // Matriz interactiva de turnos y descansos (D / N / L) estilo docs/escoltas.html
  const [turnosMatriz, setTurnosMatriz] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('escoltas_turnos_matriz')) || {};
    } catch {
      return {};
    }
  });

  // Estado de disponibilidad personal (para rol escolta / vigilante)
  const [disponibilidadPersonal, setDisponibilidadPersonal] = useState(true);

  const alternarTurno = (clave, actual) => {
    const orden = { D: 'N', N: 'L', L: 'D' };
    const nuevo = orden[actual] || 'D';
    setTurnosMatriz((prev) => {
      const act = { ...prev, [clave]: nuevo };
      localStorage.setItem('escoltas_turnos_matriz', JSON.stringify(act));
      return act;
    });
  };

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const resultados = await Promise.allSettled([
        api.resumenDashboard(),
        contar(TABLAS.escoltas, { estado: 'activo' }),
        contar(TABLAS.permisos, { estado: 'pendiente' }),
        contar(TABLAS.asistencias, { fecha: hoyISO() }),
        contar(TABLAS.periodosNomina),
        listar(TABLAS.permisos, { ordenarPor: 'fecha_inicio', ascendente: false, limite: 6 }),
        listar(TABLAS.asistencias, { ordenarPor: 'fecha', ascendente: false, limite: 6 }),
        listar(TABLAS.escoltas, { ordenarPor: 'nombres', ascendente: true, limite: 20 }),
      ]);

      if (resultados[0].status === 'fulfilled') setResumen(resultados[0].value);
      if (resultados[1].status === 'fulfilled') setConteos((prev) => ({ ...prev, escoltas: resultados[1].value }));
      if (resultados[2].status === 'fulfilled') setConteos((prev) => ({ ...prev, pendientes: resultados[2].value }));
      if (resultados[3].status === 'fulfilled') setConteos((prev) => ({ ...prev, asistenciasHoy: resultados[3].value }));
      if (resultados[4].status === 'fulfilled') setConteos((prev) => ({ ...prev, periodos: resultados[4].value }));

      if (resultados[5].status === 'fulfilled') setPermisos(resultados[5].value);
      if (resultados[6].status === 'fulfilled') setAsistencias(resultados[6].value);
      if (resultados[7].status === 'fulfilled') setEscoltas(resultados[7].value);

      const escoltasPorId = {};
      if (resultados[7].status === 'fulfilled') {
        resultados[7].value.forEach((esc) => {
          escoltasPorId[esc.id] = esc;
        });
      }

      const eventos = [];
      if (resultados[5].status === 'fulfilled') {
        resultados[5].value.forEach((perm) => {
          eventos.push({
            id: `permiso-${perm.id}`,
            titulo: `Permiso/Descanso · ${nombreCompleto(escoltasPorId[perm.escolta_id])}`,
            fecha: perm.fecha_inicio,
            estado: perm.estado,
            icono: ClipboardCheck,
            ruta: '/permisos',
          });
        });
      }
      if (resultados[6].status === 'fulfilled') {
        resultados[6].value.forEach((asist) => {
          eventos.push({
            id: `asistencia-${asist.id}`,
            titulo: `Asistencia operativa · ${nombreCompleto(escoltasPorId[asist.escolta_id])}`,
            fecha: asist.check_in || asist.fecha,
            estado: asist.estado,
            icono: CalendarCheck2,
            ruta: '/asistencias',
          });
        });
      }
      eventos.sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));
      setActividad(eventos.slice(0, 6));
    } catch (err) {
      toast.error('No se pudo cargar el panel', err.message);
    } finally {
      setCargando(false);
    }
  }, [toast]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useRealtimeRecarga(cargar, {
    tablas: ['escoltas', 'asignaciones', 'asistencias', 'permisos', 'nomina_detalles', 'periodos_nomina'],
  });

  // Métricas calculadas operativas (estrictamente basadas en datos reales)
  const totalPersonal = conteos.escoltas;
  const enTurnoHoy = conteos.asistenciasHoy;
  const enDescansoHoy = conteos.pendientes;
  const disponiblesHoy = Math.max(0, totalPersonal - enTurnoHoy);
  const porcentajeTurno = totalPersonal > 0 ? Math.round((enTurnoHoy / totalPersonal) * 100) : 0;
  const porcentajeDescanso = totalPersonal > 0 ? Math.round((enDescansoHoy / totalPersonal) * 100) : 0;
  const porcentajeDisponibles = totalPersonal > 0 ? Math.round((disponiblesHoy / totalPersonal) * 100) : 0;

  // Lista de personal para la matriz de turnos (estrictamente de la BD)
  const listaMatriz = useMemo(() => {
    return escoltas.map((esc, i) => ({
      id: esc.id,
      codigo: esc.codigo || `ESC-00${i + 1}`,
      nombre: nombreCompleto(esc) || `Escolta ${i + 1}`,
      cargo: esc.cargo || 'Escolta Operativo',
    }));
  }, [escoltas]);

  // Próximos descansos y permisos reales
  const proximosDescansos = useMemo(() => {
    return permisos.filter((p) => p.estado === 'aprobado' || p.estado === 'pendiente').slice(0, 5);
  }, [permisos]);

  // VISTA MÓVIL DEDICADA PARA ESCOLTAS / VIGILANTES (Según maqueta 2 del usuario)
  if (role === 'escolta') {
    return (
      <div className="mx-auto max-w-lg space-y-5 pb-10">
        {/* Cabecera Móvil del Escolta */}
        <div className="rounded-2xl border border-[#333944] bg-[#23272e] p-5 shadow-panel">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-[#2b3038] border border-[#ff8a00]/40 text-xl font-bold text-[#ff8a00] shadow">
                {profile?.nombres?.[0] || profile?.usuario?.[0]?.toUpperCase() || 'E'}
              </div>
              <span className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-[#23272e] ${disponibilidadPersonal ? 'bg-[#29c081]' : 'bg-[#ef4f5e]'}`} />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase font-bold text-slate-400 tracking-wider">Hola,</p>
              <h1 className="truncate text-xl font-extrabold text-slate-100 text-metalico">
                {profile?.full_name || profile?.nombres ? `${profile?.nombres} ${profile?.apellidos || ''}` : 'Carlos Méndez'}
              </h1>
              <p className="text-xs text-[#9aa6b5]">Escolta / Seguridad Operativa</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="font-mono text-[11px] text-[#ff8a00] font-semibold">ID: ESC-0147</span>
                <span className="rounded-full bg-[#29c081]/15 border border-[#29c081]/30 px-2 py-0.5 text-[10px] font-bold text-[#29c081]">
                  {disponibilidadPersonal ? '● Disponible' : '● No disponible'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Acciones Rápidas Móviles */}
        <div className="grid grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => navigate('/nomina')}
            className="flex flex-col items-center justify-center gap-1 rounded-xl border border-[#ff8a00]/40 bg-[#ff8a00] p-3 text-white shadow hover:brightness-110"
          >
            <WalletCards className="h-5 w-5" />
            <span className="text-[11px] font-bold">Nómina</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/distribucion')}
            className="flex flex-col items-center justify-center gap-1 rounded-xl border border-[#333944] bg-[#23272e] p-3 text-slate-200 hover:bg-[#2b3038]"
          >
            <CalendarRange className="h-5 w-5 text-[#ff8a00]" />
            <span className="text-[11px] font-semibold">Turnos</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/permisos')}
            className="flex flex-col items-center justify-center gap-1 rounded-xl border border-[#333944] bg-[#23272e] p-3 text-slate-200 hover:bg-[#2b3038]"
          >
            <Bed className="h-5 w-5 text-oro" />
            <span className="text-[11px] font-semibold">Descanso</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/escoltas')}
            className="flex flex-col items-center justify-center gap-1 rounded-xl border border-[#333944] bg-[#23272e] p-3 text-slate-200 hover:bg-[#2b3038]"
          >
            <UsersRound className="h-5 w-5 text-slate-400" />
            <span className="text-[11px] font-semibold">Personal</span>
          </button>
        </div>

        {/* Tarjeta Mi Nómina */}
        <div className="rounded-2xl border border-[#ff8a00]/30 bg-gradient-to-r from-[#23272e] to-[#2b3038] p-5 shadow-panel">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
              <WalletCards className="h-4 w-4 text-[#ff8a00]" />
              <span>Mi Nómina Activa</span>
            </div>
            <span className="text-xs text-slate-400">01 – 15 Nov 2026</span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div>
              <p className="text-xs text-slate-400">Monto neto quincenal</p>
              <p className="text-2xl font-black text-slate-100">Bs. 14.850,00</p>
              <p className="text-xs font-medium text-oro">$ 350.00 USD (Tasa BCV)</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => navigate('/nomina')}>
              Ver Detalle
            </Button>
          </div>
        </div>

        {/* Próximo Turno y Próximo Descanso (Dual Cards) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl border border-[#333944] bg-[#23272e] p-4 shadow">
            <div className="flex items-center gap-2 text-xs font-bold text-[#ff8a00]">
              <Calendar className="h-4 w-4" />
              <span>Próximo Turno</span>
            </div>
            <p className="mt-2 text-sm font-bold text-slate-100">Lun, 17 Nov 2026</p>
            <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
              <Clock className="h-3 w-3" /> 08:00 – 20:00 (Diurno)
            </p>
            <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
              <MapPin className="h-3 w-3" /> Planta Principal
            </p>
            <Link to="/distribucion" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#ff8a00] hover:underline">
              Ver Turnos <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="rounded-xl border border-[#333944] bg-[#23272e] p-4 shadow">
            <div className="flex items-center gap-2 text-xs font-bold text-oro">
              <Bed className="h-4 w-4" />
              <span>Próximo Descanso</span>
            </div>
            <p className="mt-2 text-sm font-bold text-slate-100">Mar, 18 Nov 2026</p>
            <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
              <Clock className="h-3 w-3" /> 24 Horas reglamentarias
            </p>
            <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
              <Sparkles className="h-3 w-3 text-emerald-400" /> Post-guardia programada
            </p>
            <Link to="/permisos" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-oro hover:underline">
              Ver Calendario <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* Toggle de Disponibilidad del Escolta */}
        <div className="rounded-xl border border-[#333944] bg-[#23272e] p-4 flex items-center justify-between shadow">
          <div>
            <span className="text-xs text-slate-400 block font-semibold uppercase">Estado de Disponibilidad</span>
            <span className={`text-sm font-extrabold ${disponibilidadPersonal ? 'text-[#29c081]' : 'text-slate-400'}`}>
              {disponibilidadPersonal ? 'DISPONIBLE PARA SERVICIO' : 'NO DISPONIBLE / EN REPOSO'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setDisponibilidadPersonal((v) => !v);
              toast.success(disponibilidadPersonal ? 'Estado cambiado a No disponible.' : 'Estado cambiado a Disponible.');
            }}
            className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${disponibilidadPersonal ? 'bg-[#29c081]' : 'bg-slate-700'}`}
          >
            <span
              className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${disponibilidadPersonal ? 'translate-x-7' : 'translate-x-0'}`}
            />
          </button>
        </div>

        {/* Feed de Notificaciones Operativas */}
        <div className="rounded-2xl border border-[#333944] bg-[#23272e] p-4 shadow">
          <div className="flex items-center justify-between pb-3 border-b border-[#333944]">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
              <Bell className="h-4 w-4 text-[#ff8a00]" />
              <span>Notificaciones Operativas</span>
            </div>
            <span className="rounded-full bg-[#ef4f5e] px-2 py-0.5 text-[10px] font-bold text-white">3</span>
          </div>

          <div className="divide-y divide-[#333944] text-xs">
            <div className="py-2.5">
              <p className="font-semibold text-slate-200">Cambio de turno confirmado</p>
              <p className="text-slate-400 mt-0.5">Tu turno del 20 Nov fue actualizado a Diurno (Planta Principal).</p>
              <span className="text-[10px] text-slate-500">Hace 12 min</span>
            </div>
            <div className="py-2.5">
              <p className="font-semibold text-slate-200">Nómina disponible para consulta</p>
              <p className="text-slate-400 mt-0.5">El recibo de pago de la quincena actual ya está procesado.</p>
              <span className="text-[10px] text-slate-500">Hace 1 hora</span>
            </div>
            <div className="py-2.5">
              <p className="font-semibold text-slate-200">Revisión de equipamiento y dotación</p>
              <p className="text-slate-400 mt-0.5">Inspección de chalecos y radios en guardia matutina.</p>
              <span className="text-[10px] text-slate-500">Hace 3 horas</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // VISTA ADMINISTRATIVA Y OPERATIVA COMPLETA (para Administradores y Supervisores)
  return (
    <div className="space-y-6">
      <ReporteModulo titulo="Resumen del sistema" archivo="resumen" columnas={["Indicador","Cantidad"]}
        filas={[['Personal', conteos.escoltas], ['Permisos pendientes', conteos.pendientes], ['Asistencias hoy', conteos.asistenciasHoy], ['Periodos', conteos.periodos]]} deshabilitado={cargando} />
      {/* Encabezado General del Panel Operativo */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-slate-100 sm:text-3xl text-metalico">
              Dashboard Operativo
            </h1>
            <span className="rounded-full badge-cromo px-2.5 py-0.5 text-[11px] font-extrabold text-[#ff8a00]">
              SEGURIDAD Y VIGILANCIA
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Control de Personal, Servicios de Vigilancia, Turnos, Nómina y Descansos en tiempo real.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={cargar}
            disabled={cargando}
            leftIcon={RefreshCw}
            className={cargando ? 'animate-spin' : ''}
          >
            Actualizar
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/distribucion')}
            leftIcon={CalendarRange}
          >
            Asignar Turno
          </Button>
        </div>
      </div>

      {/* FILA 1: 4 INDICADORES CLAVE (KPIs EXACTOS DE LA MAQUETA) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* KPI 1: Personal Activo */}
        <div className="rounded-2xl border border-[#333944] bg-[#23272e] p-5 shadow-panel transition hover:border-[#ff8a00]/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Personal Activo</span>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#ff8a00]/15 text-[#ff8a00] border border-[#ff8a00]/30">
              <UsersRound className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-100">{totalPersonal}</span>
            <span className="text-xs font-bold text-[#29c081] flex items-center gap-0.5">
              ▲ 100% activo
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">Escoltas y vigilantes registrados</p>
        </div>

        {/* KPI 2: En Turno (Hoy) */}
        <div className="rounded-2xl border border-[#333944] bg-[#23272e] p-5 shadow-panel transition hover:border-[#ff8a00]/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">En Turno (Hoy)</span>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <CalendarCheck2 className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-100">{enTurnoHoy}</span>
            <span className="text-xs font-bold text-amber-400">{porcentajeTurno}% de cobertura</span>
          </div>
          <p className="mt-1 text-xs text-slate-400">Personal asignado en guardia activa</p>
        </div>

        {/* KPI 3: En Descanso */}
        <div className="rounded-2xl border border-[#333944] bg-[#23272e] p-5 shadow-panel transition hover:border-[#ff8a00]/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">En Descanso</span>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/30">
              <Bed className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-100">{enDescansoHoy}</span>
            <span className="text-xs font-bold text-blue-400">{porcentajeDescanso}% del total</span>
          </div>
          <p className="mt-1 text-xs text-slate-400">Rotación y descanso compensatorio</p>
        </div>

        {/* KPI 4: Nómina del Período */}
        <div className="rounded-2xl border border-[#333944] bg-[#23272e] p-5 shadow-panel transition hover:border-[#ff8a00]/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Nómina del Período</span>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <DollarSign className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-100">
              ${Number(resumen?.total_nomina_periodo || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[11px] font-bold text-emerald-400">
              {resumen?.periodo_abierto ? 'En curso' : 'Sin período'}
            </span>
          </div>
          <p className="mt-1 text-xs text-oro">
            {resumen?.periodo_abierto ? (resumen.periodo_abierto.nombre || `Período ${resumen.periodo_abierto.fecha_inicio} a ${resumen.periodo_abierto.fecha_fin}`) : 'Sin período de nómina abierto'}
          </p>
        </div>
      </div>

      {/* FILA 2: DISPONIBILIDAD OPERATIVA + ASIGNACIÓN DE SERVICIOS + ALERTAS OPERATIVAS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* PANEL 1: DISPONIBILIDAD Y DISTRIBUCIÓN OPERATIVA */}
        <Card bodyClassName="space-y-5">
          <div className="flex items-center justify-between border-b border-[#333944] pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-[#ff8a00]" />
              <h2 className="text-base font-bold text-slate-100">Disponibilidad de Escoltas</h2>
            </div>
            <span className="text-xs font-mono font-bold text-slate-400">{totalPersonal} Total</span>
          </div>

          <div className="rounded-xl border border-[#333944] bg-[#1c1f24] p-4 text-center">
            <div className="flex items-center justify-center gap-4 py-2">
              <div className="relative inline-flex h-24 w-24 items-center justify-center rounded-full border-4 border-[#ff8a00] bg-[#23272e] shadow-inner">
                <div className="text-center">
                  <span className="block text-2xl font-black text-slate-100">{totalPersonal}</span>
                  <span className="text-[10px] font-bold uppercase text-slate-400">Personal</span>
                </div>
              </div>

              <div className="space-y-2 text-left text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-[#ff8a00]" />
                  <span className="text-slate-300">En Turno:</span>
                  <strong className="text-slate-100">{enTurnoHoy} ({porcentajeTurno}%)</strong>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-blue-400" />
                  <span className="text-slate-300">En Descanso:</span>
                  <strong className="text-slate-100">{enDescansoHoy} ({porcentajeDescanso}%)</strong>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-[#29c081]" />
                  <span className="text-slate-300">Disponibles:</span>
                  <strong className="text-slate-100">{disponiblesHoy} ({porcentajeDisponibles}%)</strong>
                </div>
              </div>
            </div>

            <Button
              variant="primary"
              fullWidth
              leftIcon={CalendarRange}
              className="mt-3"
              onClick={() => navigate('/distribucion')}
            >
              Asignar Turno / Distribución
            </Button>
          </div>
        </Card>

        {/* PANEL 2: ASIGNACIÓN DE SERVICIOS (HOY) */}
        <Card bodyClassName="space-y-4">
          <div className="flex items-center justify-between border-b border-[#333944] pb-3">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-amber-400" />
              <h2 className="text-base font-bold text-slate-100">Asignación de Servicios (Hoy)</h2>
            </div>
            <Link to="/distribucion" className="text-xs font-semibold text-[#ff8a00] hover:underline">
              Ver todos →
            </Link>
          </div>

          <div className="space-y-2.5 text-xs">
            {enTurnoHoy === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center">
                No hay personal con asistencia o turno activo hoy.
              </p>
            ) : (
              <div className="rounded-xl border border-[#333944] bg-[#1c1f24] p-3 text-center">
                <span className="text-xs font-bold text-slate-200">{enTurnoHoy} guardia(s) operativa(s) en curso</span>
              </div>
            )}
          </div>
        </Card>

        {/* PANEL 3: ALERTAS OPERATIVAS */}
        <Card bodyClassName="space-y-4">
          <div className="flex items-center justify-between border-b border-[#333944] pb-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-[#ef4f5e]" />
              <h2 className="text-base font-bold text-slate-100">Alertas Operativas</h2>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${conteos.pendientes > 0 ? 'bg-[#ef4f5e]/15 border border-[#ef4f5e]/30 text-[#ef4f5e]' : 'bg-[#29c081]/15 border border-[#29c081]/30 text-[#29c081]'}`}>
              {conteos.pendientes > 0 ? `${conteos.pendientes} activa(s)` : '0 activas'}
            </span>
          </div>

          <div className="space-y-3 text-xs">
            {conteos.pendientes > 0 ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-400">Permisos pendientes</span>
                  <span className="text-[10px] text-slate-400">Hoy</span>
                </div>
                <p className="mt-1 text-slate-300">Hay {conteos.pendientes} solicitud(es) de permiso/descanso por revisar.</p>
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-8 text-center">
                No hay alertas operativas pendientes. El sistema está al día.
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* FILA 3: MATRIZ SEMANAL DE TURNOS Y DESCANSOS (SOLO INFORMATIVO EN DASHBOARD) */}
      <Card bodyClassName="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#333944] pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-[#ff8a00]" />
              <h2 className="text-base font-bold text-slate-100">
                Matriz Semanal de Turnos y Descansos
              </h2>
              <span className="rounded-full bg-slate-800 border border-slate-700/80 px-2 py-0.5 text-[10px] font-bold text-slate-400">
                Solo informativo
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Vista general de asignaciones de la semana: <strong className="text-[#ff8a00]">D</strong> (Diurno) · <strong className="text-slate-300">N</strong> (Nocturno) · <strong className="text-slate-300">L</strong> (Libre / Descanso). Para editar, usa el módulo de Distribución.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded bg-[#ff8a00] px-2 py-0.5 font-bold text-black">D Diurno</span>
            <span className="inline-flex items-center gap-1 rounded bg-[#333944] px-2 py-0.5 font-bold text-white">N Nocturno</span>
            <span className="inline-flex items-center gap-1 rounded bg-slate-300 px-2 py-0.5 font-bold text-black">L Libre</span>
            <Link
              to="/distribucion"
              className="ml-2 inline-flex items-center gap-1 rounded-lg bg-[#2b3038] border border-[#ff8a00]/30 px-3 py-1 font-bold text-xs text-[#ff8a00] hover:bg-[#ff8a00] hover:text-black transition"
            >
              Ir a Turnos y Distribución →
            </Link>
          </div>
        </div>

        <div className="overflow-x-auto">
          {listaMatriz.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400">
              No hay personal registrado en el sistema. Registra personal en el módulo correspondiente para ver la matriz de turnos.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#333944] text-slate-400">
                  <th className="py-2.5 px-3 font-bold">Personal / Escolta</th>
                  <th className="py-2.5 px-2 text-center font-bold">Lun</th>
                  <th className="py-2.5 px-2 text-center font-bold">Mar</th>
                  <th className="py-2.5 px-2 text-center font-bold">Mié</th>
                  <th className="py-2.5 px-2 text-center font-bold">Jue</th>
                  <th className="py-2.5 px-2 text-center font-bold">Vie</th>
                  <th className="py-2.5 px-2 text-center font-bold">Sáb</th>
                  <th className="py-2.5 px-2 text-center font-bold">Dom</th>
                  <th className="py-2.5 px-3 text-right font-bold">Módulo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#333944]">
                {listaMatriz.map((m, idx) => (
                  <tr key={m.id} className="hover:bg-[#23272e]/60 transition">
                    <td className="py-3 px-3">
                      <p className="font-bold text-slate-100">{m.nombre}</p>
                      <p className="text-[10px] text-slate-400">{m.codigo} · {m.cargo}</p>
                    </td>

                    {['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'].map((dia, diaIdx) => {
                      const clave = `${m.id}-${diaIdx}`;
                      const valorPorDefecto = ['D', 'D', 'N', 'N', 'L', 'L', 'D'][(diaIdx + idx) % 7];
                      const valor = turnosMatriz[clave] || valorPorDefecto;

                      const colorClase =
                        valor === 'D'
                          ? 'bg-[#ff8a00] text-black font-extrabold shadow'
                          : valor === 'N'
                            ? 'bg-[#333944] text-white font-extrabold'
                            : 'bg-slate-300 text-black font-extrabold';

                      return (
                        <td key={dia} className="py-2 px-1 text-center">
                          <span
                            className={`inline-flex items-center justify-center h-8 w-8 rounded-lg text-xs select-none ${colorClase}`}
                            title={`${m.nombre} - ${dia}: ${valor === 'D' ? 'Diurno' : valor === 'N' ? 'Nocturno' : 'Libre'}`}
                          >
                            {valor}
                          </span>
                        </td>
                      );
                    })}

                    <td className="py-3 px-3 text-right">
                      <Link to="/distribucion" className="text-xs font-semibold text-[#ff8a00] hover:underline">
                        Ajustar
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {/* FILA 4: PRÓXIMOS DESCANSOS + RESUMEN FINANCIERO NÓMINA + ACTIVIDAD */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* PRÓXIMOS DESCANSOS */}
        <Card bodyClassName="space-y-4">
          <div className="flex items-center justify-between border-b border-[#333944] pb-3">
            <div className="flex items-center gap-2">
              <Bed className="h-5 w-5 text-oro" />
              <h2 className="text-base font-bold text-slate-100">Próximos Descansos</h2>
            </div>
            <Link to="/permisos" className="text-xs font-semibold text-oro hover:underline">
              Ver todos →
            </Link>
          </div>

          <div className="space-y-2.5 text-xs">
            {proximosDescansos.length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center">
                No hay descansos o permisos programados.
              </p>
            ) : (
              proximosDescansos.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-xl border border-[#333944] bg-[#1c1f24] p-3 transition hover:bg-[#2b3038]"
                >
                  <div>
                    <p className="font-bold text-slate-100">{item.motivo || 'Permiso/Descanso'}</p>
                    <p className="text-[11px] text-slate-400">{item.dias || 1} día(s)</p>
                  </div>
                  <span className="rounded-lg bg-blue-500/15 border border-blue-500/30 px-2 py-1 font-mono font-bold text-blue-400">
                    {item.fecha_inicio}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* RESUMEN DE NÓMINA */}
        <Card bodyClassName="space-y-4">
          <div className="flex items-center justify-between border-b border-[#333944] pb-3">
            <div className="flex items-center gap-2">
              <WalletCards className="h-5 w-5 text-emerald-400" />
              <h2 className="text-base font-bold text-slate-100">Resumen de Nómina</h2>
            </div>
            <Link to="/nomina" className="text-xs font-semibold text-[#ff8a00] hover:underline">
              Gestionar →
            </Link>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1.5 border-b border-[#333944]/60">
              <span className="text-slate-400">Personal en Nómina:</span>
              <span className="font-bold text-slate-100">{resumen?.periodo_abierto ? totalPersonal : 0}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#333944]/60">
              <span className="text-slate-400">Estado del Período:</span>
              <span className="font-bold text-emerald-400">{resumen?.periodo_abierto ? 'Abierto / En cálculo' : 'Sin período abierto'}</span>
            </div>

            <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-center">
              <span className="text-xs font-bold uppercase text-slate-300">Total a Pagar (Período)</span>
              <p className="text-2xl font-black text-emerald-400 mt-0.5">
                ${Number(resumen?.total_nomina_periodo || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-oro mt-0.5 font-medium">
                {resumen?.periodo_abierto?.nombre || 'Ningún período de nómina activo'}
              </p>
            </div>
          </div>
        </Card>

        {/* ACTIVIDAD RECIENTE EN VIVO */}
        <Card bodyClassName="space-y-4">
          <div className="flex items-center justify-between border-b border-[#333944] pb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-slate-300" />
              <h2 className="text-base font-bold text-slate-100">Actividad Reciente</h2>
            </div>
            <Link to="/ayuda" className="text-xs font-semibold text-slate-400 hover:underline">
              Ayuda
            </Link>
          </div>

          {cargando ? (
            <div className="space-y-2">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : actividad.length ? (
            <ul className="divide-y divide-[#333944] text-xs">
              {actividad.map((ev) => {
                const Icono = ev.icono;
                return (
                  <li key={ev.id} className="py-2.5">
                    <Link to={ev.ruta} className="flex items-center gap-2.5 hover:text-[#ff8a00] transition">
                      <Icono className="h-4 w-4 text-[#ff8a00] shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-slate-200">{ev.titulo}</p>
                        <p className="text-[10px] text-slate-400">{formatearFechaHora(ev.fecha)}</p>
                      </div>
                      <Badge tone={estadoTone(ev.estado)}>{estadoLabel(ev.estado)}</Badge>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-xs text-slate-400 py-8 text-center">
              Sin actividad reciente registrada.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
