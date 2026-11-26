import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRealtimeRecarga } from '../hooks/useRealtime.js';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CalendarCheck2,
  CalendarRange,
  CheckCircle2,
  CircleHelp,
  ClipboardCheck,
  CreditCard,
  FileText,
  ListChecks,
  ShieldCheck,
  TrendingUp,
  Truck,
  UserPlus,
  UsersRound,
  WalletCards,
} from 'lucide-react';
import { Badge, Button, Card, EmptyState, HelpTip, Skeleton, StatCard, useToast } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { contar, formatearFecha, formatearFechaHora, hoyISO, listar, nombreCompleto, TABLAS } from '../lib/data.js';
import { estadoLabel, estadoTone } from '../lib/constants.js';
import { useAuth } from '../context/AuthContext.jsx';

function valorResumen(resumen, claves) {
  for (const clave of claves) {
    if (resumen && resumen[clave] !== undefined && resumen[clave] !== null) return resumen[clave];
  }
  return null;
}

export default function Dashboard() {
  const { role, roleLabel, puede } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [cargando, setCargando] = useState(true);
  const [resumen, setResumen] = useState(null);
  const [conteos, setConteos] = useState({ escoltas: 0, pendientes: 0, asistenciasHoy: 0, periodos: 0 });
  const [actividad, setActividad] = useState([]);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const resultados = await Promise.allSettled([
        api.resumenDashboard(),
        contar(TABLAS.escoltas, { estado: 'activo' }),
        contar(TABLAS.permisos, { estado: 'pendiente' }),
        contar(TABLAS.asistencias, { fecha: hoyISO() }),
        contar(TABLAS.periodosNomina),
        listar(TABLAS.permisos, { ordenarPor: 'fecha_inicio', ascendente: false, limite: 4 }),
        listar(TABLAS.asistencias, { ordenarPor: 'fecha', ascendente: false, limite: 4 }),
        listar(TABLAS.escoltas, { select: 'id,nombres,apellidos,codigo' }),
      ]);

      if (resultados[0].status === 'fulfilled') setResumen(resultados[0].value);
      if (resultados[1].status === 'fulfilled') setConteos((actual) => ({ ...actual, escoltas: resultados[1].value }));
      if (resultados[2].status === 'fulfilled') setConteos((actual) => ({ ...actual, pendientes: resultados[2].value }));
      if (resultados[3].status === 'fulfilled') setConteos((actual) => ({ ...actual, asistenciasHoy: resultados[3].value }));
      if (resultados[4].status === 'fulfilled') setConteos((actual) => ({ ...actual, periodos: resultados[4].value }));

      const escoltasPorId = {};
      if (resultados[7].status === 'fulfilled') {
        resultados[7].value.forEach((escolta) => { escoltasPorId[escolta.id] = escolta; });
      }

      const eventos = [];
      if (resultados[5].status === 'fulfilled') {
        resultados[5].value.forEach((permiso) => {
          eventos.push({
            id: `permiso-${permiso.id}`,
            titulo: `Permiso solicitado · ${nombreCompleto(escoltasPorId[permiso.escolta_id])}`,
            fecha: permiso.fecha_inicio,
            estado: permiso.estado,
            icono: ClipboardCheck,
            ruta: '/permisos',
          });
        });
      }
      if (resultados[6].status === 'fulfilled') {
        resultados[6].value.forEach((asistencia) => {
          eventos.push({
            id: `asistencia-${asistencia.id}`,
            titulo: `Asistencia · ${nombreCompleto(escoltasPorId[asistencia.escolta_id])}`,
            fecha: asistencia.check_in || asistencia.fecha,
            estado: asistencia.estado,
            icono: CalendarCheck2,
            ruta: '/asistencias',
          });
        });
      }
      eventos.sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));
      setActividad(eventos.slice(0, 6));

      const fallos = resultados.filter((resultado) => resultado.status === 'rejected');
      if (fallos.length === resultados.length) {
        toast.error('No se pudo cargar el resumen', 'Revisa tu conexión e intenta actualizar la página.');
      }
    } catch (error) {
      toast.error('No se pudo cargar el panel', error.message);
    } finally {
      setCargando(false);
    }
  }, [toast]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useRealtimeRecarga(cargar, {
    tablas: ['escoltas', 'asignaciones', 'asistencias', 'permisos', 'nomina_detalles', 'periodos_nomina', 'pagos'],
  });

  const metricas = useMemo(() => [
    {
      label: 'Escoltas activos',
      valor: valorResumen(resumen, ['escoltas_activos', 'escoltasActivos', 'total_escoltas']) ?? conteos.escoltas,
      hint: 'Personal disponible en el sistema',
      icono: UsersRound,
      tono: 'brand',
    },
    {
      label: 'Permisos pendientes',
      valor: valorResumen(resumen, ['permisos_pendientes', 'permisosPendientes']) ?? conteos.pendientes,
      hint: 'Solicitudes por revisar',
      icono: ClipboardCheck,
      tono: 'amarillo',
    },
    {
      label: 'Asistencias de hoy',
      valor: valorResumen(resumen, ['asistencias_hoy', 'asistenciasHoy']) ?? conteos.asistenciasHoy,
      hint: formatearFecha(hoyISO(), { weekday: 'long', day: 'numeric', month: 'long' }),
      icono: CalendarCheck2,
      tono: 'verde',
    },
    {
      label: 'Periodos de nómina',
      valor: valorResumen(resumen, ['periodos_nomina', 'periodos', 'total_periodos']) ?? conteos.periodos,
      hint: 'Ciclos registrados',
      icono: WalletCards,
      tono: 'morado',
    },
  ], [resumen, conteos]);

  const accesos = useMemo(() => {
    const lista = [];
    if (puede('escoltas')) lista.push({ to: '/escoltas', label: 'Fichas de escoltas', descripcion: 'Alta, edición y consulta', icono: UserPlus, color: 'bg-[#ff8a00]/15 text-[#ff8a00] border border-[#ff8a00]/30' });
    if (puede('choferes')) lista.push({ to: '/choferes', label: 'Choferes y Flota', descripcion: 'Viajes, rutas y viáticos GT', icono: Truck, color: 'bg-amber-500/15 text-amber-400 border border-amber-500/30' });
    if (puede('rrhh')) lista.push({ to: '/rrhh', label: 'Recursos Humanos', descripcion: 'Personal, expedientes y anticipos', icono: UsersRound, color: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' });
    if (puede('distribucion')) lista.push({ to: '/distribucion', label: 'Distribución', descripcion: 'Asignar clientes y turnos', icono: CalendarRange, color: 'bg-blue-500/15 text-blue-400 border border-blue-500/30' });
    lista.push({ to: '/permisos', label: 'Permisos', descripcion: 'Solicitar y revisar', icono: ClipboardCheck, color: 'bg-amber-500/15 text-amber-400 border border-amber-500/30' });
    lista.push({ to: '/asistencias', label: 'Asistencias', descripcion: 'Registrar entrada y salida', icono: CalendarCheck2, color: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' });
    if (puede('nomina')) lista.push({ to: '/nomina', label: 'Nómina', descripcion: 'Cerrar periodos y calcular', icono: WalletCards, color: 'bg-violet-500/15 text-violet-400 border border-violet-500/30' });
    if (puede('pagos')) lista.push({ to: '/pagos', label: 'Pagos', descripcion: 'Registrar y confirmar', icono: CreditCard, color: 'bg-rose-500/15 text-rose-400 border border-rose-500/30' });
    if (puede('usuarios')) lista.push({ to: '/usuarios', label: 'Usuarios y Cuentas', descripcion: 'Directorio y accesos', icono: ShieldCheck, color: 'bg-slate-700/30 text-slate-300 border border-slate-600/30' });
    return lista;
  }, [puede]);

  const pasos = useMemo(() => {
    if (role === 'escolta') {
      return [
        { label: 'Revisa tus datos', done: conteos.escoltas > 0, to: '/escoltas' },
        { label: 'Registra tu asistencia diaria', done: conteos.asistenciasHoy > 0, to: '/asistencias' },
        { label: 'Consulta tus permisos', done: false, to: '/permisos' },
      ];
    }
    if (role === 'contador') {
      return [
        { label: 'Verifica las fichas de escoltas', done: conteos.escoltas > 0, to: '/escoltas' },
        { label: 'Revisa las asistencias del periodo', done: conteos.asistenciasHoy > 0, to: '/asistencias' },
        { label: 'Prepara y cierra la nómina', done: conteos.periodos > 0, to: '/nomina' },
      ];
    }
    return [
      { label: 'Registra el personal escolta', done: conteos.escoltas > 0, to: '/escoltas' },
      { label: 'Asigna clientes y turnos', done: false, to: '/distribucion' },
      { label: 'Revisa los permisos pendientes', done: conteos.pendientes === 0, to: '/permisos' },
    ];
  }, [role, conteos]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 sm:text-3xl">Bienvenido de nuevo 👋</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400 sm:text-base">
            Estás entrando como <strong className="text-slate-200">{roleLabel}</strong>. Aquí tienes un
            resumen de la operación y los accesos más usados.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={cargar}
          disabled={cargando}
          leftIcon={TrendingUp}
          className="self-start"
        >
          Actualizar datos
        </Button>
      </header>

      <section aria-label="Indicadores principales" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metricas.map((metrica) => {
          const Icono = metrica.icono;
          return (
            <StatCard
              key={metrica.label}
              label={metrica.label}
              value={metrica.valor}
              hint={metrica.hint}
              icon={Icono}
              tone={metrica.tono}
              loading={cargando}
            />
          );
        })}
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card
          title="Primeros pasos"
          subtitle="Sigue esta lista para dejar todo en orden"
          className="xl:col-span-1"
          actions={<HelpTip title="¿Para qué sirve?">Marca visualmente las tareas clave. No cambia datos, solo te orienta sobre qué revisar primero.</HelpTip>}
        >
          <ol className="space-y-3">
            {pasos.map((paso, indice) => (
              <li key={paso.label}>
                <Link
                  to={paso.to}
                  className="flex min-h-14 items-center gap-3 rounded-xl border border-slate-800 bg-[#0e1217]/60 px-3 py-2.5 transition-colors hover:border-brand-500/40 hover:bg-slate-800/40"
                >
                  <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${paso.done ? 'bg-emerald-950/60 text-emerald-400 ring-1 ring-emerald-500/30' : 'bg-slate-800 text-slate-300 ring-1 ring-slate-700'}`}>
                    {paso.done ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : indice + 1}
                  </span>
                  <span className={`flex-1 text-sm font-medium ${paso.done ? 'text-slate-500 line-through decoration-slate-600' : 'text-slate-200'}`}>
                    {paso.label}
                  </span>
                  <ArrowRight className="h-4 w-4 text-slate-500" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ol>
          <div className="mt-5 rounded-xl border border-brand-500/20 bg-brand-950/30 p-4 text-sm text-brand-200">
            <p className="font-semibold text-brand-100">💡 Consejo</p>
            <p className="mt-1 leading-relaxed text-brand-200/90">
              Un buen flujo es: personal → asignación → asistencia → permisos → nómina → pagos.
            </p>
          </div>
        </Card>

        <Card
          title="Accesos rápidos"
          subtitle="Entra directamente al módulo que necesitas"
          className="xl:col-span-2"
        >
          {cargando ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }, (_, indice) => <Skeleton key={indice} className="h-24" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {accesos.map((acceso) => {
                const Icono = acceso.icono;
                return (
                  <Link
                    key={acceso.to}
                    to={acceso.to}
                    className="group flex min-h-24 items-center gap-3 rounded-xl border border-slate-800 bg-[#0e1217]/50 p-4 transition-all hover:-translate-y-0.5 hover:border-brand-500/50 hover:bg-slate-800/40 hover:shadow-card"
                  >
                    <span className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${acceso.color}`}>
                      <Icono className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-slate-200">{acceso.label}</span>
                      <span className="mt-0.5 block text-xs text-slate-400">{acceso.descripcion}</span>
                    </span>
                    <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-slate-500 transition-transform group-hover:translate-x-1 group-hover:text-brand-400" aria-hidden="true" />
                  </Link>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <Card
        title="Actividad reciente"
        subtitle="Últimos permisos y asistencias registrados"
        actions={<Link to="/ayuda" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-400 hover:underline"><CircleHelp className="h-4 w-4" aria-hidden="true" /> Cómo funciona</Link>}
      >
        {cargando ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }, (_, indice) => <Skeleton key={indice} className="h-14" />)}
          </div>
        ) : actividad.length ? (
          <ul className="divide-y divide-slate-800">
            {actividad.map((evento) => {
              const Icono = evento.icono;
              return (
                <li key={evento.id}>
                  <Link to={evento.ruta} className="flex items-center gap-3 py-3 transition-colors hover:bg-slate-800/40">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-slate-300">
                      <Icono className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-200">{evento.titulo}</span>
                      <span className="block text-xs text-slate-400">{formatearFechaHora(evento.fecha)}</span>
                    </span>
                    <Badge tone={estadoTone(evento.estado)}>{estadoLabel(evento.estado)}</Badge>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            icon={ListChecks}
            title="Todavía no hay actividad"
            description="Cuando se registren asistencias o permisos, los verás aquí en orden de fecha."
            actionLabel="Ir a asistencias"
            onAction={() => navigate('/asistencias')}
          />
        )}
      </Card>

      <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-[#161b22] p-4 text-sm text-slate-300">
        <FileText className="h-5 w-5 shrink-0 text-brand-400" aria-hidden="true" />
        <p>
          ¿Tienes dudas sobre un paso? La sección <Link to="/ayuda" className="font-semibold text-brand-400 hover:underline">Ayuda</Link> explica cada módulo con ejemplos y un glosario.
        </p>
      </div>
    </div>
  );
}
