import ReporteModulo from "../components/ReporteModulo.jsx";
import { useOutletContext } from 'react-router-dom';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRealtimeRecarga } from '../hooks/useRealtime.js';
import {
  CalendarDays,
  CalendarRange,
  Filter,
  List,
  Pencil,
  Plus,
  Search,
  UserRound,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  Field,
  HelpTip,
  Input,
  Modal,
  Select,
  useToast,
} from '../components/ui.jsx';
import { actualizar, crear, aISOFecha, diasDeSemana, formatearFecha, listar, nombreCompleto, TABLAS } from '../lib/data.js';
import { DIAS_SEMANA, estadoLabel, estadoTone, OPCIONES_ESTADO_ASIGNACION } from '../lib/constants.js';

const FORM_VACIO = {
  escolta_id: '',
  cliente_id: '',
  turno_id: '',
  fecha_inicio: '',
  fecha_fin: '',
  estado: 'planificada',
};

const nombreCliente = (cliente) => cliente?.nombre || cliente?.razon_social || cliente?.empresa || 'Cliente sin nombre';
const nombreTurno = (turno) => turno?.nombre || turno?.descripcion || 'Turno sin nombre';

export default function Distribucion() {
  const telefono = useOutletContext()?.telefono === true;
  const toast = useToast();
  const [asignaciones, setAsignaciones] = useState([]);
  const [escoltas, setEscoltas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [turnos, setTurnos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEscolta, setFiltroEscolta] = useState('todos');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [vista, setVista] = useState('matriz');
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [formulario, setFormulario] = useState(FORM_VACIO);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [mostrarMatrizMobile, setMostrarMatrizMobile] = useState(false);

  // Matriz interactiva de turnos y descansos en el módulo de distribución
  const [turnosMatriz, setTurnosMatriz] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('escoltas_turnos_matriz')) || {};
    } catch {
      return {};
    }
  });

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
        listar(TABLAS.asignaciones, { ordenarPor: 'fecha_inicio', ascendente: false }),
        listar(TABLAS.escoltas, { ordenarPor: 'nombres', ascendente: true }),
        listar(TABLAS.clientes, { ordenarPor: 'nombre', ascendente: true }),
        listar(TABLAS.turnos, { ordenarPor: 'nombre', ascendente: true }),
      ]);

      const nombres = ['asignaciones', 'escoltas', 'clientes', 'turnos'];
      resultados.forEach((resultado, indice) => {
        if (resultado.status === 'fulfilled') {
          const setters = [setAsignaciones, setEscoltas, setClientes, setTurnos];
          setters[indice](resultado.value);
        } else {
          toast.error(`No se pudo cargar ${nombres[indice]}`, resultado.reason?.message);
        }
      });
    } finally {
      setCargando(false);
    }
  }, [toast]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useRealtimeRecarga(cargar, { tablas: ['asignaciones', 'escoltas', 'clientes', 'turnos'] });

  const mapas = useMemo(() => ({
    escoltas: Object.fromEntries(escoltas.map((item) => [item.id, item])),
    clientes: Object.fromEntries(clientes.map((item) => [item.id, item])),
    turnos: Object.fromEntries(turnos.map((item) => [item.id, item])),
  }), [escoltas, clientes, turnos]);

  const filtradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return asignaciones.filter((asignacion) => {
      const escolta = mapas.escoltas[asignacion.escolta_id];
      const cliente = mapas.clientes[asignacion.cliente_id];
      const turno = mapas.turnos[asignacion.turno_id];
      const coincideTexto = !texto || [
        nombreCompleto(escolta), nombreCliente(cliente), nombreTurno(turno),
      ].some((valor) => String(valor).toLowerCase().includes(texto));
      const coincideEscolta = filtroEscolta === 'todos' || asignacion.escolta_id === filtroEscolta;
      const coincideEstado = filtroEstado === 'todos' || asignacion.estado === filtroEstado;
      return coincideTexto && coincideEscolta && coincideEstado;
    });
  }, [asignaciones, mapas, busqueda, filtroEscolta, filtroEstado]);

  const agrupadas = useMemo(() => {
    const grupos = {};
    filtradas.forEach((asignacion) => {
      const clave = asignacion.escolta_id || 'sin-escolta';
      if (!grupos[clave]) grupos[clave] = [];
      grupos[clave].push(asignacion);
    });
    return Object.entries(grupos).map(([id, lista]) => ({
      id,
      escolta: mapas.escoltas[id],
      lista: lista.sort((a, b) => String(a.fecha_inicio || '').localeCompare(String(b.fecha_inicio || ''))),
    }));
  }, [filtradas, mapas]);

  const dias = useMemo(() => diasDeSemana(), []);

  const abrirNuevo = () => {
    setEditando(null);
    setFormulario({ ...FORM_VACIO, fecha_inicio: aISOFecha() });
    setErrores({});
    setModal(true);
  };

  const abrirEdicion = (asignacion) => {
    setEditando(asignacion);
    setFormulario({
      escolta_id: asignacion.escolta_id || '',
      cliente_id: asignacion.cliente_id || '',
      turno_id: asignacion.turno_id || '',
      fecha_inicio: asignacion.fecha_inicio || '',
      fecha_fin: asignacion.fecha_fin || '',
      estado: asignacion.estado || 'activo',
    });
    setErrores({});
    setModal(true);
  };

  const cambiar = (campo, valor) => setFormulario((actual) => ({ ...actual, [campo]: valor }));

  const guardar = async () => {
    const nuevosErrores = {};
    if (!formulario.escolta_id) nuevosErrores.escolta_id = 'Selecciona el escolta.';
    if (!formulario.cliente_id) nuevosErrores.cliente_id = 'Selecciona el cliente.';
    if (!formulario.fecha_inicio) nuevosErrores.fecha_inicio = 'Indica la fecha de inicio.';
    if (formulario.fecha_fin && formulario.fecha_inicio && formulario.fecha_fin < formulario.fecha_inicio) {
      nuevosErrores.fecha_fin = 'La fecha de fin no puede ser anterior al inicio.';
    }
    if (Object.keys(nuevosErrores).length) {
      setErrores(nuevosErrores);
      toast.warning('Completa los datos marcados');
      return;
    }

    const valores = {
      escolta_id: formulario.escolta_id,
      cliente_id: formulario.cliente_id,
      turno_id: formulario.turno_id || null,
      fecha_inicio: formulario.fecha_inicio,
      fecha_fin: formulario.fecha_fin || null,
      estado: formulario.estado,
    };

    try {
      setGuardando(true);
      if (editando) {
        await actualizar(TABLAS.asignaciones, editando.id, valores);
        toast.success('Asignación actualizada');
      } else {
        await crear(TABLAS.asignaciones, valores);
        toast.success('Asignación creada', 'El escolta ya aparece en la distribución.');
      }
      setModal(false);
      await cargar();
    } catch (error) {
      toast.error('No se pudo guardar la asignación', error.message);
    } finally {
      setGuardando(false);
    }
  };

  const cambiarEstado = async (asignacion, estado) => {
    try {
      await actualizar(TABLAS.asignaciones, asignacion.id, { estado });
      toast.success('Estado actualizado', `La asignación ahora está ${estadoLabel(estado).toLowerCase()}.`);
      await cargar();
    } catch (error) {
      toast.error('No se pudo cambiar el estado', error.message);
    }
  };

  const selectorEstado = (asignacion) => (
    <select
      value={asignacion.estado || 'activo'}
      onChange={(evento) => cambiarEstado(asignacion, evento.target.value)}
      aria-label={`Estado de la asignación de ${nombreCompleto(mapas.escoltas[asignacion.escolta_id])}`}
      className="min-h-9 rounded-lg border border-slate-700 bg-slate-900 px-2.5 text-xs font-semibold text-slate-200 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
    >
      {OPCIONES_ESTADO_ASIGNACION.map((opcion) => (
        <option key={opcion.value} value={opcion.value}>{opcion.label}</option>
      ))}
    </select>
  );

  return (
    <div className="space-y-6">
      <ReporteModulo titulo="Turnos y distribución" archivo="turnos" columnas={["Personal","Cliente","Turno","Inicio","Fin","Estado"]}
        filas={filtradas.map((r) => [nombreCompleto(mapas.escoltas[r.escolta_id]), nombreCliente(mapas.clientes[r.cliente_id]), nombreTurno(mapas.turnos[r.turno_id]), r.fecha_inicio, r.fecha_fin, r.estado])} indicadores={[["Activas", filtradas.filter((r) => r.estado === "activo").length]]} deshabilitado={cargando} />
      {/* Vista resumida de acción rápida para teléfonos */}
      <div className={telefono ? 'space-y-3' : 'space-y-3 md:hidden'}>
        <div className="rounded-2xl border border-slate-800 bg-[#161a22] p-4 shadow-md space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-[#ff8a00]" />
              <span className="text-xs font-black uppercase text-slate-200">Turnos y Distribución</span>
            </div>
            <span className="text-xs font-bold text-slate-400">
              {asignaciones.filter((a) => a.estado === 'activo').length} activas
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Personal en Guardia</span>
              <strong className="text-sm font-black text-white">{agrupadas.length} asignados</strong>
            </div>
            <Button size="sm" variant="primary" leftIcon={Plus} onClick={abrirNuevo}>
              Nueva Asignación
            </Button>
          </div>
        </div>

        {/* Botón para desplegar matriz y filtros bajo demanda en teléfonos */}
        <button
          type="button"
          onClick={() => setMostrarMatrizMobile((prev) => !prev)}
          className="w-full flex items-center justify-between p-3.5 rounded-xl border border-slate-800 bg-[#14171c] hover:bg-slate-800/80 text-xs font-bold text-slate-200 shadow-sm transition-all"
        >
          <span className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-[#ff8a00]" />
            {mostrarMatrizMobile ? 'Ocultar matriz de distribución' : `Ver matriz semanal y filtros (${filtradas.length})`}
          </span>
          <span className="text-slate-400 font-mono text-xs">{mostrarMatrizMobile ? '▲ Ocultar' : '▼ Expandir'}</span>
        </button>
      </div>

      {/* Contenedor completo: visible en desktop (md:block) o bajo demanda en móvil */}
      <div className={mostrarMatrizMobile ? 'space-y-6 block' : (telefono ? 'hidden' : 'hidden md:block') + ' space-y-6'}>
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-100 sm:text-3xl">Distribución</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400 sm:text-base">
              Asigna escoltas a clientes, define el turno y el periodo de cobertura. La vista semanal
              te ayuda a detectar solapes o fechas sin cubrir.
            </p>
          </div>
          <Button size="lg" leftIcon={Plus} onClick={abrirNuevo} className="self-start">
            Nueva asignación
          </Button>
        </header>

      <Card
        title="Filtros y vista"
        subtitle="Encuentra una asignación rápidamente"
        actions={<HelpTip title="Vista semanal">Muestra las asignaciones que solapan con la semana actual (lunes a domingo). Usa la lista para ver todo el historial.</HelpTip>}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="relative xl:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              value={busqueda}
              onChange={(evento) => setBusqueda(evento.target.value.toLocaleUpperCase("es"))}
              placeholder="Buscar escolta, cliente o turno…"
              aria-label="Buscar asignaciones"
              className="min-h-11 w-full rounded-xl border border-slate-700 bg-slate-900/80 pl-10 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>
          <div className="relative">
            <UserRound className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-slate-400" aria-hidden="true" />
            <select
              value={filtroEscolta}
              onChange={(evento) => setFiltroEscolta(evento.target.value)}
              aria-label="Filtrar por escolta"
              className="min-h-11 w-full rounded-xl border border-slate-700 bg-slate-900/80 pl-10 pr-3 text-sm text-slate-100 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            >
              <option value="todos">Todos los escoltas</option>
              {escoltas.map((escolta) => (
                <option key={escolta.id} value={escolta.id}>{nombreCompleto(escolta)}</option>
              ))}
            </select>
          </div>
          <div className="relative">
            <Filter className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-slate-400" aria-hidden="true" />
            <select
              value={filtroEstado}
              onChange={(evento) => setFiltroEstado(evento.target.value)}
              aria-label="Filtrar por estado"
              className="min-h-11 w-full rounded-xl border border-slate-700 bg-slate-900/80 pl-10 pr-3 text-sm text-slate-100 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            >
              <option value="todos">Todos los estados</option>
              {OPCIONES_ESTADO_ASIGNACION.map((opcion) => (
                <option key={opcion.value} value={opcion.value}>{opcion.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4 flex inline-flex rounded-xl border border-slate-800 bg-slate-900/80 p-1" role="group" aria-label="Cambiar vista">
          <button
            type="button"
            onClick={() => setVista('lista')}
            className={`inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors ${vista === 'lista' ? 'bg-slate-800 text-brand-400 shadow-sm' : 'text-slate-400'}`}
          >
            <List className="h-4 w-4" aria-hidden="true" /> Lista
          </button>
          <button
            type="button"
            onClick={() => setVista('semana')}
            className={`inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors ${vista === 'semana' ? 'bg-slate-800 text-brand-400 shadow-sm' : 'text-slate-400'}`}
          >
            <CalendarDays className="h-4 w-4" aria-hidden="true" /> Semana actual
          </button>
        </div>
      </Card>

      <Card
        title={vista === 'lista' ? 'Asignaciones por escolta' : 'Calendario semanal'}
        subtitle={`${filtradas.length} ${filtradas.length === 1 ? 'asignación' : 'asignaciones'} visibles`}
      >
        {cargando ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }, (_, indice) => <div key={indice} className="h-20 animate-pulse rounded-xl bg-slate-800" />)}
          </div>
        ) : !filtradas.length ? (
          <div className="rounded-2xl border border-dashed border-slate-700 bg-[#0e1217]/50 px-6 py-12 text-center">
            <CalendarRange className="mx-auto h-8 w-8 text-brand-400" aria-hidden="true" />
            <h3 className="mt-3 font-bold text-slate-100">No hay asignaciones para estos filtros</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
              Prueba quitando filtros o crea una asignación nueva para definir quién cubre cada cliente.
            </p>
            <Button className="mt-5" leftIcon={Plus} onClick={abrirNuevo}>Nueva asignación</Button>
          </div>
        ) : vista === 'lista' ? (
          <div className="space-y-4">
            {agrupadas.map((grupo) => (
              <div key={grupo.id} className="rounded-2xl border border-slate-800 bg-[#161b22]/70 p-4">
                <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-950/60 text-xs font-bold text-brand-300 ring-1 ring-brand-500/30">
                    {nombreCompleto(grupo.escolta).split(' ').map((p) => p[0]).slice(0, 2).join('')}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-100">{nombreCompleto(grupo.escolta)}</p>
                    <p className="text-xs text-slate-400">{grupo.lista.length} {grupo.lista.length === 1 ? 'asignación' : 'asignaciones'}</p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
                  {grupo.lista.map((asignacion) => (
                    <div key={asignacion.id} className="rounded-xl border border-slate-800 bg-[#0e1217] p-4 shadow-card">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-100">{nombreCliente(mapas.clientes[asignacion.cliente_id])}</p>
                          <p className="mt-0.5 text-xs text-slate-400">{nombreTurno(mapas.turnos[asignacion.turno_id])}</p>
                        </div>
                        <Badge tone={estadoTone(asignacion.estado)}>{estadoLabel(asignacion.estado)}</Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                        <span><strong>Desde:</strong> {formatearFecha(asignacion.fecha_inicio)}</span>
                        <span><strong>Hasta:</strong> {asignacion.fecha_fin ? formatearFecha(asignacion.fecha_fin) : 'Sin fecha fin'}</span>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-800/80 pt-3">
                        {selectorEstado(asignacion)}
                        <Button variant="ghost" size="sm" leftIcon={Pencil} onClick={() => abrirEdicion(asignacion)}>Editar</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="scrollbar-thin overflow-x-auto">
            <div className="grid min-w-[900px] grid-cols-7 gap-2">
              {dias.map((dia, indice) => {
                const iso = aISOFecha(dia);
                const delDia = filtradas.filter((asignacion) => {
                  const inicio = asignacion.fecha_inicio || '';
                  const fin = asignacion.fecha_fin || inicio;
                  return inicio && inicio <= iso && iso <= fin;
                });
                return (
                  <div key={iso} className="min-h-56 rounded-xl border border-slate-800 bg-[#0e1217]/60 p-2">
                    <div className="mb-2 rounded-lg border border-slate-800 bg-slate-900 px-2 py-2 text-center">
                      <p className="text-xs font-bold text-slate-400">{DIAS_SEMANA[indice]}</p>
                      <p className="text-lg font-extrabold text-slate-100">{dia.getDate()}</p>
                    </div>
                    <div className="space-y-2">
                      {delDia.length ? delDia.map((asignacion) => (
                        <button
                          key={asignacion.id}
                          type="button"
                          onClick={() => abrirEdicion(asignacion)}
                          className="w-full rounded-lg border border-brand-500/30 bg-brand-950/40 p-2 text-left transition-colors hover:bg-brand-900/50"
                        >
                          <p className="truncate text-xs font-bold text-brand-300">{nombreCompleto(mapas.escoltas[asignacion.escolta_id])}</p>
                          <p className="mt-0.5 truncate text-[11px] text-brand-400">{nombreTurno(mapas.turnos[asignacion.turno_id])}</p>
                          <p className="mt-1 truncate text-[11px] text-slate-400">{nombreCliente(mapas.clientes[asignacion.cliente_id])}</p>
                        </button>
                      )) : (
                        <p className="py-4 text-center text-[11px] text-slate-500">Sin cobertura</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-slate-500">Semana del {formatearFecha(dias[0])} al {formatearFecha(dias[6])}. Toca una asignación para editarla.</p>
          </div>
        )}
      </Card>
      </div>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editando ? 'Editar asignación' : 'Nueva asignación'}
        description="Define escolta, cliente, turno y el rango de fechas en el que aplica."
        size="lg"
        footer={
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <Button onClick={guardar} loading={guardando} fullWidth className="sm:w-auto">
              {editando ? 'Guardar cambios' : 'Crear asignación'}
            </Button>
            <Button variant="outline" onClick={() => setModal(false)} disabled={guardando} fullWidth className="sm:w-auto">Cancelar</Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label="Escolta" required value={formulario.escolta_id} error={errores.escolta_id}
            onChange={(evento) => cambiar('escolta_id', evento.target.value)}
          >
            <option value="">Selecciona un escolta</option>
            {escoltas.map((escolta) => (
              <option key={escolta.id} value={escolta.id}>{nombreCompleto(escolta)} · {escolta.codigo || '—'}</option>
            ))}
          </Select>
          <Select
            label="Cliente" required value={formulario.cliente_id} error={errores.cliente_id}
            onChange={(evento) => cambiar('cliente_id', evento.target.value)}
          >
            <option value="">Selecciona un cliente</option>
            {clientes.map((cliente) => (
              <option key={cliente.id} value={cliente.id}>{nombreCliente(cliente)}</option>
            ))}
          </Select>
          <Select
            label="Turno" value={formulario.turno_id}
            onChange={(evento) => cambiar('turno_id', evento.target.value)}
            help={turnos.length ? undefined : 'Configura turnos en la base de datos para poder seleccionarlos.'}
          >
            <option value="">Sin turno definido</option>
            {turnos.map((turno) => (
              <option key={turno.id} value={turno.id}>{nombreTurno(turno)}</option>
            ))}
          </Select>
          <Select
            label="Estado" value={formulario.estado} options={OPCIONES_ESTADO_ASIGNACION}
            onChange={(evento) => cambiar('estado', evento.target.value)}
          />
          <Input
            label="Fecha de inicio" type="date" required value={formulario.fecha_inicio} error={errores.fecha_inicio}
            onChange={(evento) => cambiar('fecha_inicio', evento.target.value)}
          />
          <Input
            label="Fecha de fin" type="date" value={formulario.fecha_fin} error={errores.fecha_fin}
            onChange={(evento) => cambiar('fecha_fin', evento.target.value)}
            help="Déjala vacía si la asignación es indefinida."
          />
        </div>
        <Field label="Resumen" help="Revisa que el rango de fechas y el escolta sean correctos antes de guardar.">
          <p className="rounded-xl border border-slate-800 bg-[#0e1217]/60 p-3 text-sm text-slate-300">
            {formulario.escolta_id ? nombreCompleto(mapas.escoltas[formulario.escolta_id]) : 'Escolta sin seleccionar'} →{' '}
            {formulario.cliente_id ? nombreCliente(mapas.clientes[formulario.cliente_id]) : 'Cliente sin seleccionar'}
          </p>
        </Field>
      </Modal>
    </div>
  );
}
