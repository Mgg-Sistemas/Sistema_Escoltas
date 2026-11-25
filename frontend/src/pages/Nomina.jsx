import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRealtimeRecarga } from '../hooks/useRealtime.js';
import {
  Calculator,
  CheckCircle2,
  FileSpreadsheet,
  LockKeyhole,
  Pencil,
  Plus,
  UsersRound,
} from 'lucide-react';
import DataTable from '../components/DataTable.jsx';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  HelpTip,
  Input,
  Modal,
  Select,
  StatCard,
  useToast,
} from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import {
  actualizar,
  crear,
  formatearFecha,
  formatearMoneda,
  formatearNumero,
  listar,
  nombreCompleto,
  totalNomina,
  TABLAS,
} from '../lib/data.js';
import { estadoLabel, estadoTone, OPCIONES_ESTADO_DETALLE } from '../lib/constants.js';

const FORM_PERIODO = { nombre: '', fecha_inicio: '', fecha_fin: '' };
const FORM_DETALLE = {
  escolta_id: '', sueldo_base: '0', bonos: '0', descuentos: '0',
  horas_extras: '0', dias_trabajados: '30', estado: 'pendiente',
};

export default function Nomina() {
  const { role } = useAuth();
  const toast = useToast();
  const puedeEditar = ['admin', 'contador'].includes(role);

  const [periodos, setPeriodos] = useState([]);
  const [detalles, setDetalles] = useState([]);
  const [escoltas, setEscoltas] = useState([]);
  const [periodoId, setPeriodoId] = useState('');
  const [cargando, setCargando] = useState(true);
  const [modalPeriodo, setModalPeriodo] = useState(false);
  const [modalDetalle, setModalDetalle] = useState(false);
  const [editandoDetalle, setEditandoDetalle] = useState(null);
  const [formPeriodo, setFormPeriodo] = useState(FORM_PERIODO);
  const [formDetalle, setFormDetalle] = useState(FORM_DETALLE);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [confirmarCierre, setConfirmarCierre] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const resultados = await Promise.allSettled([
        listar(TABLAS.periodosNomina, { ordenarPor: 'fecha_inicio', ascendente: false }),
        listar(TABLAS.detallesNomina),
        listar(TABLAS.escoltas, { ordenarPor: 'nombres', ascendente: true }),
      ]);

      if (resultados[0].status === 'fulfilled') {
        setPeriodos(resultados[0].value);
        setPeriodoId((actual) => actual || resultados[0].value[0]?.id || '');
      } else {
        toast.error('No se pudieron cargar los periodos', resultados[0].reason?.message);
      }
      if (resultados[1].status === 'fulfilled') setDetalles(resultados[1].value);
      else toast.error('No se pudo cargar el detalle de nómina', resultados[1].reason?.message);
      if (resultados[2].status === 'fulfilled') setEscoltas(resultados[2].value);
    } finally {
      setCargando(false);
    }
  }, [toast]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useRealtimeRecarga(cargar, { tablas: ['periodos_nomina', 'nomina_detalles', 'escoltas'] });

  const periodoActivo = useMemo(() => periodos.find((periodo) => periodo.id === periodoId) || null, [periodos, periodoId]);
  const detallesDelPeriodo = useMemo(
    () => detalles.filter((detalle) => detalle.periodo_id === periodoId),
    [detalles, periodoId],
  );
  const escoltasPorId = useMemo(
    () => Object.fromEntries(escoltas.map((escolta) => [escolta.id, escolta])),
    [escoltas],
  );
  const escoltasYaIncluidas = useMemo(
    () => new Set(detallesDelPeriodo.map((detalle) => detalle.escolta_id)),
    [detallesDelPeriodo],
  );
  const totalGeneral = useMemo(
    () => detallesDelPeriodo.reduce((suma, detalle) => suma + totalNomina(detalle), 0),
    [detallesDelPeriodo],
  );

  const abrirPeriodo = () => {
    setFormPeriodo(FORM_PERIODO);
    setErrores({});
    setModalPeriodo(true);
  };

  const guardarPeriodo = async () => {
    const nuevosErrores = {};
    if (!formPeriodo.nombre.trim()) nuevosErrores.nombre = 'Ponle un nombre al periodo, por ejemplo «Noviembre 2026».';
    if (!formPeriodo.fecha_inicio) nuevosErrores.fecha_inicio = 'Indica la fecha de inicio.';
    if (!formPeriodo.fecha_fin) nuevosErrores.fecha_fin = 'Indica la fecha de fin.';
    if (formPeriodo.fecha_fin && formPeriodo.fecha_inicio && formPeriodo.fecha_fin < formPeriodo.fecha_inicio) {
      nuevosErrores.fecha_fin = 'El fin no puede ser anterior al inicio.';
    }
    if (Object.keys(nuevosErrores).length) {
      setErrores(nuevosErrores);
      toast.warning('Revisa el periodo');
      return;
    }
    try {
      setGuardando(true);
      const creado = await crear(TABLAS.periodosNomina, {
        nombre: formPeriodo.nombre.trim(),
        fecha_inicio: formPeriodo.fecha_inicio,
        fecha_fin: formPeriodo.fecha_fin,
        estado: 'abierto',
      });
      toast.success('Periodo creado', 'Ahora agrega a los escoltas y sus conceptos.');
      setModalPeriodo(false);
      setPeriodoId(creado.id);
      await cargar();
    } catch (error) {
      toast.error('No se pudo crear el periodo', error.message);
    } finally {
      setGuardando(false);
    }
  };

  const abrirDetalle = (detalle) => {
    setEditandoDetalle(detalle);
    setFormDetalle({
      escolta_id: detalle.escolta_id || '',
      sueldo_base: String(detalle.sueldo_base ?? 0),
      bonos: String(detalle.bonos ?? 0),
      descuentos: String(detalle.descuentos ?? 0),
      horas_extras: String(detalle.horas_extras ?? 0),
      dias_trabajados: String(detalle.dias_trabajados ?? 30),
      estado: detalle.estado || 'pendiente',
    });
    setErrores({});
    setModalDetalle(true);
  };

  const abrirNuevoDetalle = () => {
    setEditandoDetalle(null);
    setFormDetalle(FORM_DETALLE);
    setErrores({});
    setModalDetalle(true);
  };

  const guardarDetalle = async () => {
    if (!periodoId) {
      toast.warning('Selecciona primero un periodo de nómina');
      return;
    }
    const nuevosErrores = {};
    if (!formDetalle.escolta_id) nuevosErrores.escolta_id = 'Selecciona un escolta.';
    if (Number(formDetalle.sueldo_base) < 0) nuevosErrores.sueldo_base = 'El sueldo no puede ser negativo.';
    if (Object.keys(nuevosErrores).length) {
      setErrores(nuevosErrores);
      toast.warning('Revisa los valores');
      return;
    }

    const valores = {
      periodo_id: periodoId,
      escolta_id: formDetalle.escolta_id,
      sueldo_base: Number(formDetalle.sueldo_base) || 0,
      bonos: Number(formDetalle.bonos) || 0,
      descuentos: Number(formDetalle.descuentos) || 0,
      horas_extras: Number(formDetalle.horas_extras) || 0,
      dias_trabajados: Number(formDetalle.dias_trabajados) || 0,
      estado: formDetalle.estado,
      total: totalNomina(formDetalle),
    };

    try {
      setGuardando(true);
      if (editandoDetalle) {
        await actualizar(TABLAS.detallesNomina, editandoDetalle.id, valores);
        toast.success('Detalle actualizado', `Total: ${formatearMoneda(valores.total)}.`);
      } else {
        await crear(TABLAS.detallesNomina, valores);
        toast.success('Escolta agregado a la nómina', `Total: ${formatearMoneda(valores.total)}.`);
      }
      setModalDetalle(false);
      await cargar();
    } catch (error) {
      toast.error('No se pudo guardar el detalle', error.message);
    } finally {
      setGuardando(false);
    }
  };

  const cerrarPeriodo = async () => {
    if (!periodoActivo) return;
    try {
      setGuardando(true);
      await api.cerrarPeriodo(periodoActivo.id);
      toast.success('Periodo cerrado', 'La nómina quedó lista para la etapa de pagos.');
      setConfirmarCierre(false);
      await cargar();
    } catch (error) {
      toast.error('No se pudo cerrar el periodo', error.message);
    } finally {
      setGuardando(false);
    }
  };

  const opcionesEscolta = escoltas.filter(
    (escolta) => !escoltasYaIncluidas.has(escolta.id) || editandoDetalle?.escolta_id === escolta.id,
  );

  const columnas = [
    {
      key: 'escolta',
      label: 'Escolta',
      primary: true,
      render: (fila) => (
        <div className="min-w-0">
          <p className="truncate font-bold text-slate-900">{nombreCompleto(escoltasPorId[fila.escolta_id])}</p>
          <p className="text-xs text-slate-500">{formatearNumero(fila.dias_trabajados, 0)} días</p>
        </div>
      ),
    },
    { key: 'sueldo_base', label: 'Sueldo base', render: (fila) => formatearMoneda(fila.sueldo_base) },
    { key: 'bonos', label: 'Bonos', render: (fila) => formatearMoneda(fila.bonos), mobile: false },
    { key: 'descuentos', label: 'Descuentos', render: (fila) => formatearMoneda(fila.descuentos), mobile: false },
    { key: 'horas_extras', label: 'Horas extras', render: (fila) => formatearMoneda(fila.horas_extras), mobile: false },
    { key: 'total', label: 'Total', render: (fila) => <span className="font-bold text-brand-700">{formatearMoneda(totalNomina(fila))}</span> },
    { key: 'estado', label: 'Estado', render: (fila) => <Badge tone={estadoTone(fila.estado)}>{estadoLabel(fila.estado)}</Badge> },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Nómina</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
            Crea periodos, registra sueldo, bonos, descuentos y horas extras. El total se calcula
            automáticamente: sueldo + bonos + horas extras − descuentos.
          </p>
        </div>
        <Button size="lg" leftIcon={Plus} onClick={abrirPeriodo} className="self-start" disabled={!puedeEditar}>
          Nuevo periodo
        </Button>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Periodos registrados" value={periodos.length} icon={FileSpreadsheet} tone="brand" loading={cargando} />
        <StatCard label="Escoltas en el periodo" value={detallesDelPeriodo.length} icon={UsersRound} tone="verde" loading={cargando} />
        <StatCard label="Total del periodo" value={formatearMoneda(totalGeneral)} icon={Calculator} tone="morado" loading={cargando} />
        <StatCard label="Estado del periodo" value={periodoActivo ? estadoLabel(periodoActivo.estado) : '—'} icon={CheckCircle2} tone="amarillo" loading={cargando} />
      </section>

      <Card
        title="Periodos de nómina"
        subtitle="Selecciona un periodo para ver y editar su detalle"
        actions={<HelpTip title="Cerrar periodo">El cierre bloquea cambios de ese ciclo y lo deja listo para pagos. Hazlo solo cuando hayas revisado todos los totales.</HelpTip>}
      >
        {cargando ? (
          <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
        ) : periodos.length ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {periodos.map((periodo) => {
              const activo = periodo.id === periodoId;
              return (
                <button
                  key={periodo.id}
                  type="button"
                  onClick={() => setPeriodoId(periodo.id)}
                  className={`min-h-24 rounded-xl border p-4 text-left transition-colors ${
                    activo ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-200' : 'border-slate-200 bg-white hover:border-brand-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-bold text-slate-900">{periodo.nombre || 'Periodo sin nombre'}</p>
                    <Badge tone={estadoTone(periodo.estado)}>{estadoLabel(periodo.estado)}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-slate-600">
                    {formatearFecha(periodo.fecha_inicio)} → {formatearFecha(periodo.fecha_fin)}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-brand-700">
                    {detalles.filter((detalle) => detalle.periodo_id === periodo.id).length} escoltas
                  </p>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
            <FileSpreadsheet className="mx-auto h-8 w-8 text-brand-700" aria-hidden="true" />
            <h3 className="mt-3 font-bold text-slate-900">Todavía no hay periodos</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">Crea el primer periodo para empezar a calcular la nómina.</p>
            <Button className="mt-5" onClick={abrirPeriodo} leftIcon={Plus}>Crear periodo</Button>
          </div>
        )}
      </Card>

      {periodoActivo && (
        <Card
          title={`Detalle · ${periodoActivo.nombre || 'Periodo'}`}
          subtitle="Revisa cada concepto antes de cerrar el periodo"
          actions={
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" leftIcon={Plus} onClick={abrirNuevoDetalle} disabled={!puedeEditar}>
                Agregar escolta
              </Button>
              <Button
                variant="success"
                size="sm"
                leftIcon={LockKeyhole}
                onClick={() => setConfirmarCierre(true)}
                disabled={!puedeEditar || periodoActivo.estado === 'cerrado' || periodoActivo.estado === 'pagado'}
              >
                Cerrar periodo
              </Button>
            </div>
          }
        >
          {periodoActivo.estado !== 'abierto' && (
            <div className="mb-4 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
              <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              Este periodo está {estadoLabel(periodoActivo.estado).toLowerCase()}; verifica con el backend si aún permite cambios.
            </div>
          )}

          <DataTable
            columns={columnas}
            data={detallesDelPeriodo}
            loading={cargando}
            emptyTitle="Este periodo aún no tiene escoltas"
            emptyDescription="Agrega a cada escolta con su sueldo, bonos y descuentos para calcular el total."
            emptyActionLabel="Agregar escolta"
            onEmptyAction={puedeEditar ? abrirNuevoDetalle : undefined}
            emptyIcon={UsersRound}
            actions={(fila) => (
              <Button variant="outline" size="sm" leftIcon={Pencil} onClick={() => abrirDetalle(fila)} disabled={!puedeEditar}>
                Editar
              </Button>
            )}
          />

          {detallesDelPeriodo.length > 0 && (
            <div className="mt-5 flex flex-col gap-2 rounded-xl bg-brand-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-brand-900">Resumen del periodo</p>
                <p className="text-xs text-brand-800">{detallesDelPeriodo.length} escoltas · {formatearNumero(detallesDelPeriodo.reduce((s, d) => s + (Number(d.horas_extras) || 0), 0))} en horas extras</p>
              </div>
              <p className="text-2xl font-extrabold text-brand-800">{formatearMoneda(totalGeneral)}</p>
            </div>
          )}
        </Card>
      )}

      <Modal
        open={modalPeriodo}
        onClose={() => setModalPeriodo(false)}
        title="Crear periodo de nómina"
        description="Define el nombre y el rango de fechas que cubre este ciclo de pago."
        size="sm"
        footer={
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <Button onClick={guardarPeriodo} loading={guardando} fullWidth className="sm:w-auto">Crear periodo</Button>
            <Button variant="outline" onClick={() => setModalPeriodo(false)} disabled={guardando} fullWidth className="sm:w-auto">Cancelar</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label="Nombre del periodo" required value={formPeriodo.nombre} error={errores.nombre}
            onChange={(evento) => setFormPeriodo((actual) => ({ ...actual, nombre: evento.target.value }))}
            placeholder="Ej. Noviembre 2026"
          />
          <Input
            label="Fecha de inicio" type="date" required value={formPeriodo.fecha_inicio} error={errores.fecha_inicio}
            onChange={(evento) => setFormPeriodo((actual) => ({ ...actual, fecha_inicio: evento.target.value }))}
          />
          <Input
            label="Fecha de fin" type="date" required value={formPeriodo.fecha_fin} error={errores.fecha_fin}
            onChange={(evento) => setFormPeriodo((actual) => ({ ...actual, fecha_fin: evento.target.value }))}
          />
        </div>
      </Modal>

      <Modal
        open={modalDetalle}
        onClose={() => setModalDetalle(false)}
        title={editandoDetalle ? 'Editar detalle de nómina' : 'Agregar escolta a la nómina'}
        description="Los montos se guardan con el total calculado automáticamente."
        size="lg"
        footer={
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <Button onClick={guardarDetalle} loading={guardando} fullWidth className="sm:w-auto">
              {editandoDetalle ? 'Guardar cambios' : 'Agregar a nómina'}
            </Button>
            <Button variant="outline" onClick={() => setModalDetalle(false)} disabled={guardando} fullWidth className="sm:w-auto">Cancelar</Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label="Escolta" required value={formDetalle.escolta_id} error={errores.escolta_id}
            onChange={(evento) => setFormDetalle((actual) => ({ ...actual, escolta_id: evento.target.value }))}
            containerClassName="sm:col-span-2"
            help="Solo aparecen escoltas que aún no tienen detalle en este periodo."
          >
            <option value="">Selecciona un escolta</option>
            {opcionesEscolta.map((escolta) => (
              <option key={escolta.id} value={escolta.id}>{nombreCompleto(escolta)} · {escolta.codigo || '—'}</option>
            ))}
          </Select>
          <Input
            label="Sueldo base" type="number" min="0" step="0.01" value={formDetalle.sueldo_base} error={errores.sueldo_base}
            onChange={(evento) => setFormDetalle((actual) => ({ ...actual, sueldo_base: evento.target.value }))}
          />
          <Input
            label="Bonos" type="number" min="0" step="0.01" value={formDetalle.bonos}
            onChange={(evento) => setFormDetalle((actual) => ({ ...actual, bonos: evento.target.value }))}
          />
          <Input
            label="Descuentos" type="number" min="0" step="0.01" value={formDetalle.descuentos}
            onChange={(evento) => setFormDetalle((actual) => ({ ...actual, descuentos: evento.target.value }))}
          />
          <Input
            label="Horas extras (monto)" type="number" min="0" step="0.01" value={formDetalle.horas_extras}
            onChange={(evento) => setFormDetalle((actual) => ({ ...actual, horas_extras: evento.target.value }))}
            help="Monto a pagar por horas extras, no cantidad de horas."
          />
          <Input
            label="Días trabajados" type="number" min="0" max="31" step="1" value={formDetalle.dias_trabajados}
            onChange={(evento) => setFormDetalle((actual) => ({ ...actual, dias_trabajados: evento.target.value }))}
          />
          <Select
            label="Estado" value={formDetalle.estado} options={OPCIONES_ESTADO_DETALLE}
            onChange={(evento) => setFormDetalle((actual) => ({ ...actual, estado: evento.target.value }))}
          />
        </div>
        <div className="mt-5 flex items-center justify-between rounded-xl bg-brand-50 p-4">
          <div>
            <p className="text-sm font-semibold text-brand-900">Total calculado</p>
            <p className="text-xs text-brand-800">Base + bonos + extras − descuentos</p>
          </div>
          <p className="text-2xl font-extrabold text-brand-800">{formatearMoneda(totalNomina(formDetalle))}</p>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmarCierre}
        onClose={() => setConfirmarCierre(false)}
        title="¿Cerrar este periodo?"
        description={`Se cerrará "${periodoActivo?.nombre || ''}" y se marcará como listo para pagos. Revisa primero que los ${detallesDelPeriodo.length} detalles sean correctos.`}
        confirmLabel="Sí, cerrar periodo"
        onConfirm={cerrarPeriodo}
        loading={guardando}
        variant="success"
      />
    </div>
  );
}
