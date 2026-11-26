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

const AREAS_BASE = [
  { nombre: 'Presidencia / Corporativo', total: 24, estado: 'Activo', cupo: '100%' },
  { nombre: 'Fundición y Hornos', total: 18, estado: 'Activo', cupo: '100%' },
  { nombre: 'Matanzas y Siderúrgica', total: 16, estado: 'Activo', cupo: '95%' },
  { nombre: 'Traslados Ejecutivos VJ', total: 8, estado: 'Activo', cupo: '100%' },
  { nombre: 'Logística y Almacén Central', total: 12, estado: 'Activo', cupo: '100%' },
  { nombre: 'Seguridad Perimetral / Garitas', total: 8, estado: 'Activo', cupo: '90%' },
];

const PROXIMOS_DESCANSOS_BASE = [
  { id: 'desc-1', nombre: 'Carlos Mendoza', fecha: '14 Nov 2026', dias: 2, puesto: 'Presidencia' },
  { id: 'desc-2', nombre: 'Luis Figueroa', fecha: '15 Nov 2026', dias: 2, puesto: 'Fundición' },
  { id: 'desc-3', nombre: 'Andrea Rojas', fecha: '15 Nov 2026', dias: 2, puesto: 'Logística' },
  { id: 'desc-4', nombre: 'José Paredes', fecha: '16 Nov 2026', dias: 1, puesto: 'Matanzas' },
  { id: 'desc-5', nombre: 'María Salazar', fecha: '16 Nov 2026', dias: 2, puesto: 'Traslados' },
];

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
      return JSON.parse(localStorage.getItem('esc360_turnos_matriz')) || {};
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
      localStorage.setItem('esc360_turnos_matriz', JSON.stringify(act));
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

  // Métricas calculadas operativas 360 (combinando datos reales + modelo conceptual de la maqueta)
  const totalPersonal = conteos.escoltas > 0 ? conteos.escoltas : 86;
  const enTurnoHoy = conteos.asistenciasHoy > 0 ? conteos.asistenciasHoy : Math.round(totalPersonal * 0.74);
  const enDescansoHoy = conteos.pendientes > 0 ? conteos.pendientes : Math.round(totalPersonal * 0.26);
  const disponiblesHoy = Math.max(0, totalPersonal - enTurnoHoy);

  // Lista de personal para la matriz de turnos (de la BD o seed representativo)
  const listaMatriz = useMemo(() => {
    if (escoltas.length >= 4) {
      return escoltas.slice(0, 6).map((esc, i) => ({
        id: esc.id,
        codigo: esc.codigo || `ESC-00${i + 1}`,
        nombre: nombreCompleto(esc) || `Escolta ${i + 1}`,
        cargo: esc.cargo || 'Escolta Operativo',
      }));
    }
    return [
      { id: '1', codigo: 'ESC-001', nombre: 'Carlos Mendoza', cargo: 'Escolta VIP' },
      { id: '2', codigo: 'ESC-002', nombre: 'Luis Figueroa', cargo: 'Vigilante Planta' },
      { id: '3', codigo: 'ESC-003', nombre: 'José Rodríguez', cargo: 'Escolta Custodia' },
      { id: '4', codigo: 'ESC-004', nombre: 'Miguel Pérez', cargo: 'Supervisor de Turno' },
      { id: '5', codigo: 'ESC-005', nombre: 'Andrea Rojas', cargo: 'Escolta Perim.' },
    ];
  }, [escoltas]);

  // VISTA MÓVIL DEDICADA PARA ESCOLTAS / VIGILANTES (Según maqueta 2 del usuario)
  if (role === 'escolta') {
    return (
      <div className="mx-auto max-w-lg space-y-5 pb-10">
        {/* Cabecera Móvil del Escolta */}
        <div className="rounded-2xl border border-[#333944] bg-[#23272e] p-5 shadow-panel">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-[#2b3038] border border-[#ff8a00]/40 text-xl font-bold text-[#ff8a00] shadow">
                {profile?.nombres?.[0] || user?.email?.[0]?.toUpperCase() || 'E'}
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

  // VISTA ADMINISTRATIVA Y OPERATIVA COMPLETA (Dashboard 360 para Administradores y Supervisores)
  return (
    <div className="space-y-6">
      {/* Encabezado General del Panel 360 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-slate-100 sm:text-3xl text-metalico">
              Dashboard Operativo 360
            </h1>
            <span className="rounded-full badge-cromo px-2.5 py-0.5 text-[11px] font-extrabold text-[#ff8a00]">
              CONTROL 360°
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
            <span className="text-xs font-bold text-amber-400">74% de cobertura</span>
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
            <span className="text-xs font-bold text-blue-400">26% del total</span>
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
            <span className="text-2xl font-black text-slate-100">$ 128,540.00</span>
            <span className="text-[11px] font-bold text-emerald-400">98% autorizada</span>
          </div>
          <p className="mt-1 text-xs text-oro">Bs. 452.840,00 (Quincena 1 - Nov 2026)</p>
        </div>
      </div>

      {/* FILA 2: DISPONIBILIDAD 360 + ASIGNACIÓN DE SERVICIOS + ALERTAS OPERATIVAS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* PANEL 1: DISPONIBILIDAD Y DISTRIBUCIÓN OPERATIVA */}
        <Card className="space-y-5">
          <div className="flex items-center justify-between border-b border-[#333944] pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-[#ff8a00]" />
              <h2 className="text-base font-bold text-slate-100">Disponibilidad de Escoltas</h2>
            </div>
            <span className="text-xs font-mono font-bold text-slate-400">{totalPersonal} Total</span>
          </div>

          {/* Gráfico circular / Barra de ocupación conceptual */}
          <div className="rounded-xl border border-[#333944] bg-[#1c1f24] p-4 text-center">
            <div className="flex items-center justify-center gap-4 py-2">
              <div className="relative inline-flex h-24 w-24 items-center justify-center rounded-full border-4 border-[#ff8a00] bg-[#23272e] shadow-inner">
                <div className="text-center">
                  <span className="block text-2xl font-black text-slate-100">{totalPersonal}</span>
                  <span className="text-[10px] font-bold uppercase text-slate-400">Escoltas</span>
                </div>
              </div>

              <div className="space-y-2 text-left text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-[#ff8a00]" />
                  <span className="text-slate-300">En Turno:</span>
                  <strong className="text-slate-100">{enTurnoHoy} (74%)</strong>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-blue-400" />
                  <span className="text-slate-300">En Descanso:</span>
                  <strong className="text-slate-100">{enDescansoHoy} (26%)</strong>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-[#29c081]" />
                  <span className="text-slate-300">Disponibles:</span>
                  <strong className="text-slate-100">{disponiblesHoy} (21%)</strong>
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

        {/* PANEL 2: ASIGNACIÓN DE SERVICIOS POR ÁREA (HOY) */}
        <Card className="space-y-4">
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
            {AREAS_BASE.map((area) => (
              <div
                key={area.nombre}
                className="flex items-center justify-between rounded-xl border border-[#333944] bg-[#1c1f24] px-3 py-2.5 transition hover:bg-[#2b3038]"
              >
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#ff8a00]" />
                  <span className="font-semibold text-slate-200">{area.nombre}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-slate-400">{area.total} Escoltas</span>
                  <span className="rounded-full bg-[#29c081]/15 border border-[#29c081]/30 px-2 py-0.5 text-[10px] font-bold text-[#29c081]">
                    {area.estado}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* PANEL 3: ALERTAS OPERATIVAS */}
        <Card className="space-y-4">
          <div className="flex items-center justify-between border-b border-[#333944] pb-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-[#ef4f5e]" />
              <h2 className="text-base font-bold text-slate-100">Alertas Operativas</h2>
            </div>
            <span className="rounded-full bg-[#ef4f5e]/15 border border-[#ef4f5e]/30 px-2 py-0.5 text-[11px] font-bold text-[#ef4f5e]">
              3 activas
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="rounded-xl border border-[#ef4f5e]/30 bg-[#ef4f5e]/10 p-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#ef4f5e]">Turno sin cubrir</span>
                <span className="text-[10px] text-slate-400">Hoy</span>
              </div>
              <p className="mt-1 text-slate-300">Puesto: Torre Norte – 20:00 a 08:00 (Falta relevo).</p>
            </div>

            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-400">Descanso por vencer</span>
                <span className="text-[10px] text-slate-400">Hoy</span>
              </div>
              <p className="mt-1 text-slate-300">4 escoltas completan ciclo continuo de 6 días de guardia.</p>
            </div>

            <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-blue-400">Nómina quincenal pendiente</span>
                <span className="text-[10px] text-slate-400">Mañana</span>
              </div>
              <p className="mt-1 text-slate-300">Autorizar pago de Quincena activa antes de las 18:00.</p>
            </div>
          </div>
        </Card>
      </div>

      {/* FILA 3: MATRIZ SEMANAL INTERACTIVA DE TURNOS Y DESCANSOS (DEL ARCHIVO HTML DE EJEMPLO) */}
      <Card className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#333944] pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-[#ff8a00]" />
              <h2 className="text-base font-bold text-slate-100">
                Matriz Semanal de Turnos y Descansos (Interactivo 360)
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Pulsa cualquier celda para alternar el turno en tiempo real: <strong className="text-[#ff8a00]">D</strong> (Diurno) · <strong className="text-slate-300">N</strong> (Nocturno) · <strong className="text-oro">L</strong> (Libre / Descanso).
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded bg-[#ff8a00] px-2 py-0.5 font-bold text-black">D Diurno</span>
            <span className="inline-flex items-center gap-1 rounded bg-[#333944] px-2 py-0.5 font-bold text-white">N Nocturno</span>
            <span className="inline-flex items-center gap-1 rounded bg-slate-300 px-2 py-0.5 font-bold text-black">L Libre</span>
          </div>
        </div>

        <div className="overflow-x-auto">
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
                <th className="py-2.5 px-3 text-right font-bold">Acción</th>
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
                        <button
                          type="button"
                          onClick={() => alternarTurno(clave, valor)}
                          title={`Cambiar turno de ${m.nombre} el ${dia}`}
                          className={`h-8 w-8 rounded-lg text-xs transition transform active:scale-90 ${colorClase}`}
                        >
                          {valor}
                        </button>
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
        </div>
      </Card>

      {/* FILA 4: PRÓXIMOS DESCANSOS + RESUMEN FINANCIERO NÓMINA + ACTIVIDAD */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* PRÓXIMOS DESCANSOS */}
        <Card className="space-y-4">
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
            {PROXIMOS_DESCANSOS_BASE.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-xl border border-[#333944] bg-[#1c1f24] p-3 transition hover:bg-[#2b3038]"
              >
                <div>
                  <p className="font-bold text-slate-100">{item.nombre}</p>
                  <p className="text-[11px] text-slate-400">{item.puesto} · {item.dias} días libres</p>
                </div>
                <span className="rounded-lg bg-blue-500/15 border border-blue-500/30 px-2 py-1 font-mono font-bold text-blue-400">
                  {item.fecha}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* RESUMEN DE NÓMINA */}
        <Card className="space-y-4">
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
              <span className="text-slate-400">Total Empleados:</span>
              <span className="font-bold text-slate-100">86</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#333944]/60">
              <span className="text-slate-400">Horas Normales:</span>
              <span className="font-bold text-slate-100">7,820 hrs</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#333944]/60">
              <span className="text-slate-400">Horas Extras Operativas:</span>
              <span className="font-bold text-slate-100">340 hrs</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#333944]/60">
              <span className="text-slate-400">Bonificaciones Nocturnas:</span>
              <span className="font-bold text-emerald-400">+$ 6,500.00</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#333944]/60">
              <span className="text-slate-400">Deducciones / Préstamos:</span>
              <span className="font-bold text-rose-400">-$ 2,340.00</span>
            </div>

            <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-center">
              <span className="text-xs font-bold uppercase text-slate-300">Total a Pagar (Quincena)</span>
              <p className="text-2xl font-black text-emerald-400 mt-0.5">$ 128,540.00</p>
              <p className="text-xs text-oro mt-0.5 font-medium">Bs. 452.840,00</p>
            </div>
          </div>
        </Card>

        {/* ACTIVIDAD RECIENTE EN VIVO */}
        <Card className="space-y-4">
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
            <div className="space-y-2.5 text-xs">
              <div className="rounded-xl border border-[#333944] bg-[#1c1f24] p-2.5">
                <p className="font-semibold text-slate-200">Turno asignado: Torre Este – Turno B</p>
                <p className="text-[10px] text-slate-400">Hoy, 10:24</p>
              </div>
              <div className="rounded-xl border border-[#333944] bg-[#1c1f24] p-2.5">
                <p className="font-semibold text-slate-200">Descanso registrado: Carlos Mendoza</p>
                <p className="text-[10px] text-slate-400">Hoy, 09:47</p>
              </div>
              <div className="rounded-xl border border-[#333944] bg-[#1c1f24] p-2.5">
                <p className="font-semibold text-slate-200">Nómina quincenal autorizada</p>
                <p className="text-[10px] text-slate-400">Hoy, 08:30</p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
