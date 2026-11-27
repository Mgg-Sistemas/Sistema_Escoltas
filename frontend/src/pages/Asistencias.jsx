import ReporteModulo from "../components/ReporteModulo.jsx";
import { useOutletContext } from 'react-router-dom';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRealtimeRecarga } from '../hooks/useRealtime.js';
import {
  CalendarCheck2,
  CheckCircle2,
  Clock4,
  LogIn,
  LogOut,
  Pencil,
  Plus,
  Search,
} from 'lucide-react';
import DataTable from '../components/DataTable.jsx';
import {
  Badge,
  Button,
  Card,
  HelpTip,
  Input,
  Modal,
  Select,
  useToast,
} from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import {
  actualizar,
  aTimestampLocal,
  calcularHoras,
  crear,
  formatearFecha,
  formatearHoras,
  formatearHora,
  hoyISO,
  listar,
  nombreCompleto,
  TABLAS,
} from '../lib/data.js';
import { estadoLabel, estadoTone, OPCIONES_ESTADO_ASISTENCIA } from '../lib/constants.js';

const FORM_VACIO = {
  escolta_id: '',
  asignacion_id: '',
  fecha: hoyISO(),
  check_in: '',
  check_out: '',
  estado: 'presente',
};

function horaActual() {
  const ahora = new Date();
  return `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`;
}

export default function Asistencias() {
  const telefono = useOutletContext()?.telefono === true;
  const { role, user } = useAuth();
  const toast = useToast();
  const puedeEditar = ['admin', 'supervisor'].includes(role);

  const [registros, setRegistros] = useState([]);
  const [escoltas, setEscoltas] = useState([]);
  const [asignaciones, setAsignaciones] = useState([]);
  const [fecha, setFecha] = useState(hoyISO());
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [formulario, setFormulario] = useState(FORM_VACIO);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [mostrarHistorialMobile, setMostrarHistorialMobile] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const resultados = await Promise.allSettled([
        listar(TABLAS.asistencias, { filtros: { fecha }, ordenarPor: 'check_in', ascendente: false }),
        listar(TABLAS.escoltas, { ordenarPor: 'nombres', ascendente: true }),
        listar(TABLAS.asignaciones, { ordenarPor: 'fecha_inicio', ascendente: false }),
      ]);

      const escoltasCargadas = resultados[1].status === 'fulfilled' ? resultados[1].value : [];
      if (resultados[0].status === 'fulfilled') {
        const datos = resultados[0].value;
        const propio = role === 'escolta' ? escoltasCargadas.find((item) => item.user_id === user?.id) : null;
        setRegistros(role === 'escolta' ? datos.filter((item) => item.escolta_id === propio?.id) : datos);
      } else {
        toast.error('No se pudo cargar la asistencia', resultados[0].reason?.message);
      }
      if (resultados[1].status === 'fulfilled') {
        setEscoltas(role === 'escolta' ? escoltasCargadas.filter((item) => item.user_id === user?.id) : escoltasCargadas);
      }
      if (resultados[2].status === 'fulfilled') setAsignaciones(resultados[2].value);
    } finally {
      setCargando(false);
    }
  }, [fecha, role, user?.id, toast]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useRealtimeRecarga(cargar, { tablas: ['asistencias', 'asignaciones', 'escoltas'] });

  const mapas = useMemo(() => ({
    escoltas: Object.fromEntries(escoltas.map((item) => [item.id, item])),
    asignaciones: Object.fromEntries(asignaciones.map((item) => [item.id, item])),
  }), [escoltas, asignaciones]);

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return registros;
    return registros.filter((registro) =>
      nombreCompleto(mapas.escoltas[registro.escolta_id]).toLowerCase().includes(texto),
    );
  }, [registros, mapas, busqueda]);

  const abrirNuevo = () => {
    const propio = escoltas.find((item) => item.user_id === user?.id);
    setEditando(null);
    setFormulario({
      ...FORM_VACIO,
      fecha,
      escolta_id: role === 'escolta' ? propio?.id || '' : '',
    });
    setErrores({});
    setModal(true);
  };

  const abrirEdicion = (registro) => {
    setEditando(registro);
    setFormulario({
      escolta_id: registro.escolta_id || '',
      asignacion_id: registro.asignacion_id || '',
      fecha: registro.fecha || fecha,
      check_in: formatearHora(registro.check_in) === '—' ? '' : formatearHora(registro.check_in),
      check_out: formatearHora(registro.check_out) === '—' ? '' : formatearHora(registro.check_out),
      estado: registro.estado || 'presente',
    });
    setErrores({});
    setModal(true);
  };

  const registrarEntrada = (registro) => {
    setEditando(registro);
    setFormulario({
      escolta_id: registro.escolta_id,
      asignacion_id: registro.asignacion_id || '',
      fecha: registro.fecha || fecha,
      check_in: horaActual(),
      check_out: formatearHora(registro.check_out) === '—' ? '' : formatearHora(registro.check_out),
      estado: registro.estado || 'presente',
    });
    setErrores({});
    setModal(true);
  };

  const registrarSalida = async (registro) => {
    try {
      setGuardando(true);
      const salida = horaActual();
      await actualizar(TABLAS.asistencias, registro.id, {
        check_out: aTimestampLocal(registro.fecha, salida),
        horas: calcularHoras(registro.check_in, salida),
      });
      toast.success('Salida registrada', `Horas trabajadas: ${formatearHoras(calcularHoras(registro.check_in, salida))}.`);
      await cargar();
    } catch (error) {
      toast.error('No se pudo registrar la salida', error.message);
    } finally {
      setGuardando(false);
    }
  };

  const cambiar = (campo, valor) => setFormulario((actual) => ({ ...actual, [campo]: valor }));

  const guardar = async () => {
    const nuevosErrores = {};
    if (!formulario.escolta_id) nuevosErrores.escolta_id = 'Selecciona el escolta.';
    if (!formulario.fecha) nuevosErrores.fecha = 'Selecciona la fecha.';
    if (formulario.check_in && formulario.check_out && formulario.check_out < formulario.check_in) {
      nuevosErrores.check_out = 'La salida no puede ser anterior a la entrada.';
    }
    if (Object.keys(nuevosErrores).length) {
      setErrores(nuevosErrores);
      toast.warning('Revisa los campos marcados');
      return;
    }

    const valores = {
      escolta_id: formulario.escolta_id,
      asignacion_id: formulario.asignacion_id || null,
      fecha: formulario.fecha,
      check_in: aTimestampLocal(formulario.fecha, formulario.check_in),
      check_out: aTimestampLocal(formulario.fecha, formulario.check_out),
      horas: calcularHoras(formulario.check_in, formulario.check_out),
      estado: formulario.estado,
    };

    try {
      setGuardando(true);
      if (editando) {
        await actualizar(TABLAS.asistencias, editando.id, valores);
        toast.success('Asistencia actualizada');
      } else {
        await crear(TABLAS.asistencias, valores);
        toast.success('Asistencia registrada', 'Las horas se calcularon automáticamente.');
      }
      setModal(false);
      await cargar();
    } catch (error) {
      toast.error('No se pudo guardar la asistencia', error.message);
    } finally {
      setGuardando(false);
    }
  };

  const columnas = [
    {
      key: 'escolta',
      label: 'Escolta',
      primary: true,
      render: (fila) => (
        <div className="min-w-0">
          <p className="truncate font-bold text-slate-900">{nombreCompleto(mapas.escoltas[fila.escolta_id])}</p>
          <p className="text-xs text-slate-500">{formatearFecha(fila.fecha)}</p>
        </div>
      ),
    },
    { key: 'check_in', label: 'Entrada', render: (fila) => formatearHora(fila.check_in) },
    { key: 'check_out', label: 'Salida', render: (fila) => formatearHora(fila.check_out) },
    {
      key: 'horas',
      label: 'Horas',
      render: (fila) => <span className="font-semibold">{formatearHoras(fila.horas ?? calcularHoras(fila.check_in, fila.check_out))}</span>,
    },
    { key: 'estado', label: 'Estado', render: (fila) => <Badge tone={estadoTone(fila.estado)}>{estadoLabel(fila.estado)}</Badge> },
  ];

  const totalHoras = registros.reduce((suma, registro) => suma + (Number(registro.horas) || calcularHoras(registro.check_in, registro.check_out)), 0);
  const totalHorasHoy = registros
    .filter((registro) => registro.fecha === hoyISO())
    .reduce((suma, registro) => suma + (Number(registro.horas) || calcularHoras(registro.check_in, registro.check_out)), 0);

  return (
    <div className="space-y-6">
      <ReporteModulo titulo="Asistencias" archivo="asistencias" columnas={["Personal","Fecha","Entrada","Salida","Horas","Estado"]}
        filas={filtrados.map((r) => [nombreCompleto(mapas.escoltas[r.escolta_id]), r.fecha, r.check_in, r.check_out, Number(r.horas ?? calcularHoras(r.check_in, r.check_out)), r.estado])} deshabilitado={cargando} />
      {/* Vista resumida de acción rápida para teléfonos (Acción Principal Primero) */}
      <div className={telefono ? 'space-y-3' : 'space-y-3 md:hidden'}>
        <div className="rounded-2xl border border-slate-800 bg-[#161a22] p-4 shadow-md space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <CalendarCheck2 className="h-4 w-4 text-[#ff8a00]" />
              <span className="text-xs font-black uppercase text-slate-200">Guardia de Hoy</span>
            </div>
            <span className="text-xs font-mono font-bold text-slate-400">{formatearFecha(hoyISO())}</span>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Horas Acumuladas Hoy</span>
              <strong className="text-lg font-black text-white">{formatearHoras(totalHorasHoy)}</strong>
            </div>
            <Button size="sm" variant="primary" leftIcon={LogIn} onClick={abrirNuevo}>
              Registrar Check-in
            </Button>
          </div>
        </div>

        {/* Botón para desplegar historial completo bajo demanda en teléfonos */}
        <button
          type="button"
          onClick={() => setMostrarHistorialMobile((prev) => !prev)}
          className="w-full flex items-center justify-between p-3.5 rounded-xl border border-slate-800 bg-[#14171c] hover:bg-slate-800/80 text-xs font-bold text-slate-200 shadow-sm transition-all"
        >
          <span className="flex items-center gap-2">
            <Clock4 className="h-4 w-4 text-[#ff8a00]" />
            {mostrarHistorialMobile ? 'Ocultar historial de asistencias' : `Ver historial completo (${filtrados.length})`}
          </span>
          <span className="text-slate-400 font-mono text-xs">{mostrarHistorialMobile ? '▲ Ocultar' : '▼ Expandir'}</span>
        </button>
      </div>

      {/* Contenedor completo: siempre visible en desktop (md:block), bajo demanda en teléfono */}
      <div className={mostrarHistorialMobile ? 'space-y-6 block' : (telefono ? 'hidden' : 'hidden md:block') + ' space-y-6'}>
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-100 sm:text-3xl">Asistencias</h1>
          </div>
          <Button size="lg" leftIcon={Plus} onClick={abrirNuevo} className="self-start">
            Registrar asistencia
          </Button>
        </header>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card title="Fecha consultada" subtitle="Cambia el día para ver otros registros">
            <Input type="date" value={fecha} onChange={(evento) => setFecha(evento.target.value)} aria-label="Fecha de consulta" />
          </Card>
          <Card title="Registros del día" subtitle="Incluye entradas y salidas">
            <p className="text-3xl font-extrabold text-slate-100">{registros.length}</p>
          </Card>
          <Card title="Horas acumuladas" subtitle="Suma del día seleccionado">
            <p className="text-3xl font-extrabold text-brand-400">{formatearHoras(totalHoras)}</p>
          </Card>
        </div>

        <Card
          title="Detalle de asistencia"
          subtitle={`${filtrados.length} registros el ${formatearFecha(fecha, { weekday: 'long', day: 'numeric', month: 'long' })}`}
          actions={<HelpTip title="Horas automáticas">Se calculan restando la hora de entrada de la de salida. Si haces un cambio manual, se recalculan al guardar.</HelpTip>}
        >
          <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-slate-400" aria-hidden="true" />
              <input
                type="search"
                value={busqueda}
                onChange={(evento) => setBusqueda(evento.target.value.toLocaleUpperCase("es"))}
                placeholder="Buscar escolta…"
                aria-label="Buscar asistencia por escolta"
                className="min-h-11 w-full rounded-xl border border-slate-700 bg-slate-900/80 pl-10 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
            <Button variant="outline" onClick={() => setFecha(hoyISO())} leftIcon={CalendarCheck2} fullWidth className="sm:w-auto">
              Ir a hoy
            </Button>
          </div>

          <DataTable
            columns={columnas}
            data={filtrados}
            loading={cargando}
            emptyTitle="No hay asistencias en esta fecha"
            emptyDescription="Elige otra fecha o registra la entrada del escolta que inició su jornada."
            emptyActionLabel="Registrar asistencia"
            onEmptyAction={abrirNuevo}
            emptyIcon={Clock4}
            actions={(fila) => (
              <>
                {!fila.check_in ? (
                  <Button variant="success" size="sm" leftIcon={LogIn} onClick={() => registrarEntrada(fila)} loading={guardando}>Entrada</Button>
                ) : null}
                {fila.check_in && !fila.check_out ? (
                  <Button variant="primary" size="sm" leftIcon={LogOut} onClick={() => registrarSalida(fila)} loading={guardando}>Salida</Button>
                ) : null}
                {(puedeEditar || role === 'escolta') && (
                  <Button variant="ghost" size="sm" leftIcon={Pencil} onClick={() => abrirEdicion(fila)}>Editar</Button>
                )}
              </>
            )}
          />
        </Card>
      </div>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editando ? 'Editar asistencia' : 'Registrar asistencia'}
        description="Indica la hora exacta de entrada y salida; las horas se calculan solas."
        size="lg"
        footer={
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <Button onClick={guardar} loading={guardando} fullWidth className="sm:w-auto">
              {editando ? 'Guardar cambios' : 'Guardar asistencia'}
            </Button>
            <Button variant="outline" onClick={() => setModal(false)} disabled={guardando} fullWidth className="sm:w-auto">Cancelar</Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label="Escolta" required value={formulario.escolta_id} error={errores.escolta_id}
            onChange={(evento) => cambiar('escolta_id', evento.target.value)}
            disabled={role === 'escolta'}
          >
            <option value="">Selecciona un escolta</option>
            {escoltas.map((escolta) => (
              <option key={escolta.id} value={escolta.id}>{nombreCompleto(escolta)}</option>
            ))}
          </Select>
          <Select
            label="Asignación (opcional)" value={formulario.asignacion_id}
            onChange={(evento) => cambiar('asignacion_id', evento.target.value)}
            help="Útil para saber para qué cliente trabajó ese día."
          >
            <option value="">Sin asignación específica</option>
            {asignaciones.map((asignacion) => (
              <option key={asignacion.id} value={asignacion.id}>
                {nombreCompleto(mapas.escoltas[asignacion.escolta_id])} · {formatearFecha(asignacion.fecha_inicio)}
              </option>
            ))}
          </Select>
          <Input
            label="Fecha" type="date" required value={formulario.fecha} error={errores.fecha}
            onChange={(evento) => cambiar('fecha', evento.target.value)}
          />
          <Select
            label="Estado" value={formulario.estado} options={OPCIONES_ESTADO_ASISTENCIA}
            onChange={(evento) => cambiar('estado', evento.target.value)}
          />
          <Input
            label="Hora de entrada" type="time" value={formulario.check_in}
            onChange={(evento) => cambiar('check_in', evento.target.value)}
          />
          <Input
            label="Hora de salida" type="time" value={formulario.check_out} error={errores.check_out}
            onChange={(evento) => cambiar('check_out', evento.target.value)}
          />
        </div>
        <div className="mt-5 flex items-center gap-3 rounded-xl border border-brand-500/30 bg-brand-950/40 p-4 text-brand-200">
          <Clock4 className="h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-brand-100">Horas calculadas</p>
            <p className="text-2xl font-extrabold">{formatearHoras(calcularHoras(formulario.check_in, formulario.check_out))}</p>
          </div>
          {formulario.check_in && formulario.check_out && (
            <CheckCircle2 className="ml-auto h-6 w-6 text-emerald-400" aria-hidden="true" />
          )}
        </div>
      </Modal>
    </div>
  );
}
