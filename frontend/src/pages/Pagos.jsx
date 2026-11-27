import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRealtimeRecarga } from '../hooks/useRealtime.js';
import {
  CheckCircle2,
  CreditCard,
  FileText,
  Filter,
  Plus,
  ReceiptText,
  Search,
  WalletCards,
  XCircle,
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
import {
  formatearFecha,
  formatearMoneda,
  listar,
  nombreCompleto,
  totalNomina,
  hoyISO,
  TABLAS,
} from '../lib/data.js';
import { estadoLabel, estadoTone, METODOS_PAGO, OPCIONES_ESTADO_PAGO } from '../lib/constants.js';

const FORM_VACIO = {
  periodo_id: '', escolta_id: '', monto: '', fecha_pago: hoyISO(),
  metodo: 'transferencia', referencia: '', estado: 'registrado',
};

export default function Pagos() {
  const toast = useToast();
  const [pagos, setPagos] = useState([]);
  const [periodos, setPeriodos] = useState([]);
  const [escoltas, setEscoltas] = useState([]);
  const [detalles, setDetalles] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [modal, setModal] = useState(false);
  const [formulario, setFormulario] = useState(FORM_VACIO);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [confirmacion, setConfirmacion] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const resultados = await Promise.allSettled([
        listar(TABLAS.pagos, { ordenarPor: 'fecha_pago', ascendente: false }),
        listar(TABLAS.periodosNomina, { ordenarPor: 'fecha_inicio', ascendente: false }),
        listar(TABLAS.escoltas, { ordenarPor: 'nombres', ascendente: true }),
        listar(TABLAS.detallesNomina),
      ]);
      const nombres = ['pagos', 'periodos', 'escoltas', 'detalles de nómina'];
      const setters = [setPagos, setPeriodos, setEscoltas, setDetalles];
      resultados.forEach((resultado, indice) => {
        if (resultado.status === 'fulfilled') setters[indice](resultado.value);
        else toast.error(`No se pudieron cargar ${nombres[indice]}`, resultado.reason?.message);
      });
    } finally {
      setCargando(false);
    }
  }, [toast]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useRealtimeRecarga(cargar, { tablas: ['pagos', 'periodos_nomina', 'nomina_detalles', 'escoltas'] });

  const mapas = useMemo(() => ({
    periodos: Object.fromEntries(periodos.map((item) => [item.id, item])),
    escoltas: Object.fromEntries(escoltas.map((item) => [item.id, item])),
  }), [periodos, escoltas]);

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return pagos.filter((pago) => {
      const escolta = mapas.escoltas[pago.escolta_id];
      const periodo = mapas.periodos[pago.periodo_id];
      const coincideTexto = !texto || [
        nombreCompleto(escolta), periodo?.nombre, pago.referencia,
      ].some((valor) => String(valor || '').toLowerCase().includes(texto));
      const coincideEstado = filtroEstado === 'todos' || pago.estado === filtroEstado;
      return coincideTexto && coincideEstado;
    });
  }, [pagos, mapas, busqueda, filtroEstado]);

  const montoSugerido = useMemo(() => {
    if (!formulario.periodo_id || !formulario.escolta_id) return null;
    const detalle = detalles.find(
      (item) => item.periodo_id === formulario.periodo_id && item.escolta_id === formulario.escolta_id,
    );
    return detalle ? totalNomina(detalle) : null;
  }, [detalles, formulario.periodo_id, formulario.escolta_id]);

  const totalPagado = pagos.filter((pago) => pago.estado === 'confirmado').reduce((suma, pago) => suma + (Number(pago.monto) || 0), 0);
  const totalPendiente = pagos.filter((pago) => pago.estado === 'pendiente').reduce((suma, pago) => suma + (Number(pago.monto) || 0), 0);

  const abrirNuevo = () => {
    setFormulario({ ...FORM_VACIO, periodo_id: periodos[0]?.id || '' });
    setErrores({});
    setModal(true);
  };

  const cambiar = (campo, valor) => setFormulario((actual) => ({ ...actual, [campo]: valor }));

  const guardar = async () => {
    const nuevosErrores = {};
    if (!formulario.periodo_id) nuevosErrores.periodo_id = 'Selecciona el periodo de nómina.';
    if (!formulario.escolta_id) nuevosErrores.escolta_id = 'Selecciona el escolta.';
    if (!(Number(formulario.monto) > 0)) nuevosErrores.monto = 'El monto debe ser mayor que cero.';
    if (!formulario.fecha_pago) nuevosErrores.fecha_pago = 'Indica la fecha del pago.';
    if (Object.keys(nuevosErrores).length) {
      setErrores(nuevosErrores);
      toast.warning('Revisa los datos del pago');
      return;
    }

    const valores = {
      periodo_id: formulario.periodo_id,
      escolta_id: formulario.escolta_id,
      monto: Number(formulario.monto),
      fecha_pago: formulario.fecha_pago,
      metodo: formulario.metodo,
      referencia: formulario.referencia.trim() || null,
      estado: formulario.estado,
    };

    try {
      setGuardando(true);
      await api.registrarPago(valores);
      toast.success('Pago registrado', 'Queda en estado "Registrado" hasta que sea confirmado.');
      setModal(false);
      await cargar();
    } catch (error) {
      toast.error('No se pudo registrar el pago', error.message);
    } finally {
      setGuardando(false);
    }
  };

  const cambiarEstado = async (pago, estado) => {
    try {
      setGuardando(true);
      await api.actualizarPago(pago.id, { estado });
      toast.success(estado === 'confirmado' ? 'Pago confirmado' : 'Pago anulado', 'El estado quedó actualizado.');
      setConfirmacion(null);
      await cargar();
    } catch (error) {
      toast.error('No se pudo actualizar el pago', error.message);
    } finally {
      setGuardando(false);
    }
  };

  const columnas = [
    {
      key: 'escolta',
      label: 'Escolta / Periodo',
      primary: true,
      render: (fila) => (
        <div className="min-w-0">
          <p className="truncate font-bold text-slate-900">{nombreCompleto(mapas.escoltas[fila.escolta_id])}</p>
          <p className="text-xs text-slate-500">{mapas.periodos[fila.periodo_id]?.nombre || 'Periodo'}</p>
        </div>
      ),
    },
    { key: 'monto', label: 'Monto', render: (fila) => <span className="font-bold text-brand-700">{formatearMoneda(fila.monto)}</span> },
    { key: 'fecha_pago', label: 'Fecha', render: (fila) => formatearFecha(fila.fecha_pago) },
    { key: 'metodo', label: 'Método', render: (fila) => METODOS_PAGO.find((metodo) => metodo.value === fila.metodo)?.label || fila.metodo || '—', mobile: false },
    { key: 'referencia', label: 'Referencia', render: (fila) => fila.referencia || '—', mobile: false },
    { key: 'estado', label: 'Estado', render: (fila) => <Badge tone={estadoTone(fila.estado)}>{estadoLabel(fila.estado)}</Badge> },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 sm:text-3xl">Pagos</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400 sm:text-base">
            Registra cada desembolso, guarda la referencia del comprobante y confirma o anula el pago
            cuando corresponda.
          </p>
        </div>
        <Button size="lg" leftIcon={Plus} onClick={abrirNuevo} className="self-start">Registrar pago</Button>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Pagos registrados" value={pagos.length} icon={ReceiptText} tone="brand" loading={cargando} />
        <StatCard label="Total confirmado" value={formatearMoneda(totalPagado)} icon={CheckCircle2} tone="verde" loading={cargando} />
        <StatCard label="Total pendiente" value={formatearMoneda(totalPendiente)} icon={WalletCards} tone="amarillo" loading={cargando} />
        <StatCard label="Anulados" value={pagos.filter((pago) => pago.estado === 'anulado').length} icon={XCircle} tone="rojo" loading={cargando} />
      </section>

      <Card
        title="Historial de pagos"
        subtitle="Busca por escolta, periodo o referencia bancaria"
        actions={<HelpTip title="Comprobante">Guarda el número de referencia o enlace del banco. Ese dato permite verificar el pago después.</HelpTip>}
      >
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              value={busqueda}
              onChange={(evento) => setBusqueda(evento.target.value.toLocaleUpperCase("es"))}
              placeholder="Buscar pago…"
              aria-label="Buscar pagos"
              className="min-h-11 w-full rounded-xl border border-slate-700 bg-slate-900/80 pl-10 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>
          <div className="relative">
            <Filter className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-slate-400" aria-hidden="true" />
            <select
              value={filtroEstado}
              onChange={(evento) => setFiltroEstado(evento.target.value)}
              aria-label="Filtrar pagos por estado"
              className="min-h-11 w-full rounded-xl border border-slate-700 bg-slate-900/80 pl-10 pr-3 text-sm text-slate-100 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            >
              <option value="todos">Todos los estados</option>
              {OPCIONES_ESTADO_PAGO.map((opcion) => (
                <option key={opcion.value} value={opcion.value}>{opcion.label}</option>
              ))}
            </select>
          </div>
        </div>

        <DataTable
          columns={columnas}
          data={filtrados}
          loading={cargando}
          emptyTitle="No hay pagos registrados"
          emptyDescription="Cuando registres el primer desembolso aparecerá aquí con su comprobante y estado."
          emptyActionLabel="Registrar el primer pago"
          onEmptyAction={abrirNuevo}
          emptyIcon={CreditCard}
          actions={(fila) => (
            <>
              {fila.estado === 'pendiente' && (
                <Button variant="success" size="sm" leftIcon={CheckCircle2} onClick={() => setConfirmacion({ pago: fila, estado: 'confirmado' })} loading={guardando}>
                  Confirmar
                </Button>
              )}
              {fila.estado !== 'anulado' && (
                <Button variant="danger" size="sm" leftIcon={XCircle} onClick={() => setConfirmacion({ pago: fila, estado: 'anulado' })} loading={guardando}>
                  Anular
                </Button>
              )}
              {fila.comprobante_url && (
                <a href={fila.comprobante_url} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs font-semibold text-slate-300 hover:bg-slate-800">
                  <FileText className="h-3.5 w-3.5" aria-hidden="true" /> Comprobante
                </a>
              )}
            </>
          )}
        />
      </Card>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Registrar pago"
        description="Selecciona el periodo y al escolta; el sistema te sugerirá el monto según su nómina."
        size="lg"
        footer={
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <Button onClick={guardar} loading={guardando} fullWidth className="sm:w-auto">Guardar pago</Button>
            <Button variant="outline" onClick={() => setModal(false)} disabled={guardando} fullWidth className="sm:w-auto">Cancelar</Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label="Periodo de nómina" required value={formulario.periodo_id} error={errores.periodo_id}
            onChange={(evento) => cambiar('periodo_id', evento.target.value)}
          >
            <option value="">Selecciona un periodo</option>
            {periodos.map((periodo) => (
              <option key={periodo.id} value={periodo.id}>{periodo.nombre || formatearFecha(periodo.fecha_inicio)}</option>
            ))}
          </Select>
          <Select
            label="Escolta" required value={formulario.escolta_id} error={errores.escolta_id}
            onChange={(evento) => cambiar('escolta_id', evento.target.value)}
          >
            <option value="">Selecciona un escolta</option>
            {escoltas.map((escolta) => (
              <option key={escolta.id} value={escolta.id}>{nombreCompleto(escolta)}</option>
            ))}
          </Select>
          <Input
            label="Monto" type="number" min="0" step="0.01" required value={formulario.monto} error={errores.monto}
            onChange={(evento) => cambiar('monto', evento.target.value)}
            placeholder="0.00"
          />
          <Input
            label="Fecha de pago" type="date" required value={formulario.fecha_pago} error={errores.fecha_pago}
            onChange={(evento) => cambiar('fecha_pago', evento.target.value)}
          />
          <Select
            label="Método" value={formulario.metodo} options={METODOS_PAGO}
            onChange={(evento) => cambiar('metodo', evento.target.value)}
          />
          <Select
            label="Estado" value={formulario.estado} options={OPCIONES_ESTADO_PAGO}
            onChange={(evento) => cambiar('estado', evento.target.value)}
            help="Normalmente se registra pendiente y se confirma al verificar la transferencia."
          />
          <Input
            label="Referencia / comprobante" conservarFormato value={formulario.referencia} containerClassName="sm:col-span-2"
            onChange={(evento) => cambiar('referencia', evento.target.value)}
            placeholder="Ej. Transferencia 123456789"
            help="Número de operación o enlace que permita verificar el pago."
          />
        </div>
        {montoSugerido !== null && (
          <div className="mt-5 flex flex-col gap-3 rounded-xl border border-brand-500/30 bg-brand-950/40 p-4 text-brand-200 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-brand-100">Monto sugerido según nómina</p>
              <p className="text-2xl font-extrabold">{formatearMoneda(montoSugerido)}</p>
            </div>
            <Button variant="outline" onClick={() => cambiar('monto', String(montoSugerido))}>Usar este monto</Button>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmacion)}
        onClose={() => setConfirmacion(null)}
        title={confirmacion?.estado === 'confirmado' ? '¿Confirmar este pago?' : '¿Anular este pago?'}
        description={confirmacion ? `${nombreCompleto(mapas.escoltas[confirmacion.pago.escolta_id])} · ${formatearMoneda(confirmacion.pago.monto)}. Esta acción quedará registrada.` : ''}
        confirmLabel={confirmacion?.estado === 'confirmado' ? 'Sí, confirmar' : 'Sí, anular'}
        variant={confirmacion?.estado === 'confirmado' ? 'success' : 'danger'}
        onConfirm={() => cambiarEstado(confirmacion.pago, confirmacion.estado)}
        loading={guardando}
      />
    </div>
  );
}
