import ReporteModulo from "../components/ReporteModulo.jsx";
import { useOutletContext } from 'react-router-dom';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRealtimeRecarga } from '../hooks/useRealtime.js';
import {
  Banknote,
  Calculator,
  CheckCircle2,
  CreditCard,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  LockKeyhole,
  Pencil,
  Plus,
  Printer,
  ReceiptText,
  Search,
  UsersRound,
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
import { useAuth } from '../context/AuthContext.jsx';
import {
  actualizar,
  crear,
  formatearFecha,
  formatearMoneda,
  formatearNumero,
  hoyISO,
  listar,
  nombreCompleto,
  totalNomina,
  TABLAS,
} from '../lib/data.js';
import {
  estadoLabel,
  estadoTone,
  METODOS_PAGO,
  OPCIONES_ESTADO_DETALLE,
  OPCIONES_ESTADO_PAGO,
} from '../lib/constants.js';

const PESTANAS_MODULO = [
  { id: 'nomina', label: 'Cálculo y Periodos de Nómina', icon: FileSpreadsheet, desc: 'Periodos quincenales/mensuales y conceptos' },
  { id: 'pagos', label: 'Pagos y Transferencias', icon: CreditCard, desc: 'Emisión, confirmación y métodos de pago' },
  { id: 'recibos', label: 'Recibos y Comprobantes', icon: ReceiptText, desc: 'Generación, impresión y consulta de recibos' },
];

const FORM_PERIODO = { nombre: '', fecha_inicio: '', fecha_fin: '' };
const FORM_DETALLE = {
  escolta_id: '', sueldo_base: '0', bonos: '0', descuentos: '0',
  horas_extras: '0', dias_trabajados: '30', estado: 'pendiente',
};
const FORM_PAGO = {
  periodo_id: '', escolta_id: '', monto: '', fecha_pago: hoyISO(),
  metodo: 'transferencia', referencia: '', estado: 'registrado',
};

export default function Nomina() {
  const telefono = useOutletContext()?.telefono === true;
  const { role } = useAuth();
  const toast = useToast();
  const puedeEditar = ['admin', 'contador'].includes(role);

  const [pestanaActiva, setPestanaActiva] = useState('nomina');

  // Estados de Nómina
  const [periodos, setPeriodos] = useState([]);
  const [detalles, setDetalles] = useState([]);
  const [escoltas, setEscoltas] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [periodoId, setPeriodoId] = useState('');
  const [cargando, setCargando] = useState(true);

  // Modales Nómina
  const [modalPeriodo, setModalPeriodo] = useState(false);
  const [modalDetalle, setModalDetalle] = useState(false);
  const [editandoDetalle, setEditandoDetalle] = useState(null);
  const [formPeriodo, setFormPeriodo] = useState(FORM_PERIODO);
  const [formDetalle, setFormDetalle] = useState(FORM_DETALLE);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [confirmarCierre, setConfirmarCierre] = useState(false);

  // Modales Pagos
  const [modalPago, setModalPago] = useState(false);
  const [formPago, setFormPago] = useState(FORM_PAGO);
  const [busquedaPago, setBusquedaPago] = useState('');
  const [filtroEstadoPago, setFiltroEstadoPago] = useState('todos');
  const [confirmacionPago, setConfirmacionPago] = useState(null);

  // Modal Recibo
  const [reciboSeleccionado, setReciboSeleccionado] = useState(null);
  const [mostrarDesgloseMobile, setMostrarDesgloseMobile] = useState(false);

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    try {
      const resultados = await Promise.allSettled([
        listar(TABLAS.periodosNomina, { ordenarPor: 'fecha_inicio', ascendente: false }),
        listar(TABLAS.detallesNomina),
        listar(TABLAS.escoltas, { ordenarPor: 'nombres', ascendente: true }),
        listar(TABLAS.pagos, { ordenarPor: 'fecha_pago', ascendente: false }),
      ]);

      if (resultados[0].status === 'fulfilled') {
        setPeriodos(resultados[0].value);
        setPeriodoId((actual) => actual || resultados[0].value[0]?.id || '');
      }
      if (resultados[1].status === 'fulfilled') setDetalles(resultados[1].value);
      if (resultados[2].status === 'fulfilled') setEscoltas(resultados[2].value);
      if (resultados[3].status === 'fulfilled') setPagos(resultados[3].value);
    } catch (e) {
      toast.error('Error al sincronizar datos', e.message);
    } finally {
      setCargando(false);
    }
  }, [toast]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  useRealtimeRecarga(cargarDatos, {
    tablas: ['periodos_nomina', 'nomina_detalles', 'escoltas', 'pagos'],
  });

  // Mapas y memorias de Nómina
  const periodoActivo = useMemo(() => periodos.find((p) => p.id === periodoId) || null, [periodos, periodoId]);
  const detallesDelPeriodo = useMemo(() => detalles.filter((d) => d.periodo_id === periodoId), [detalles, periodoId]);
  const escoltasPorId = useMemo(() => Object.fromEntries(escoltas.map((e) => [e.id, e])), [escoltas]);
  const totalGeneralNomina = useMemo(() => detallesDelPeriodo.reduce((acc, d) => acc + totalNomina(d), 0), [detallesDelPeriodo]);

  const opcionesEscoltaDetalle = useMemo(() => {
    const yaIncluidas = new Set(detallesDelPeriodo.map((d) => d.escolta_id));
    return escoltas.filter((e) => (editandoDetalle ? e.id === editandoDetalle.escolta_id || !yaIncluidas.has(e.id) : !yaIncluidas.has(e.id)));
  }, [detallesDelPeriodo, escoltas, editandoDetalle]);

  // Funciones Nómina
  const abrirPeriodo = () => {
    setFormPeriodo(FORM_PERIODO);
    setErrores({});
    setModalPeriodo(true);
  };

  const guardarPeriodo = async () => {
    const err = {};
    if (!formPeriodo.nombre.trim()) err.nombre = 'Indica el nombre del periodo.';
    if (!formPeriodo.fecha_inicio) err.fecha_inicio = 'Indica la fecha de inicio.';
    if (!formPeriodo.fecha_fin) err.fecha_fin = 'Indica la fecha de fin.';
    if (formPeriodo.fecha_fin && formPeriodo.fecha_inicio && formPeriodo.fecha_fin < formPeriodo.fecha_inicio) {
      err.fecha_fin = 'El fin no puede ser anterior al inicio.';
    }
    if (Object.keys(err).length) {
      setErrores(err);
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
      toast.success('Periodo creado exitosamente');
      setModalPeriodo(false);
      setPeriodoId(creado.id);
      cargarDatos();
    } catch (e) {
      toast.error('No se pudo crear el periodo', e.message);
    } finally {
      setGuardando(false);
    }
  };

  const cerrarPeriodo = async () => {
    if (!periodoActivo) return;
    try {
      setGuardando(true);
      await actualizar(TABLAS.periodosNomina, periodoActivo.id, {
        estado: 'cerrado',
        cerrado_at: new Date().toISOString(),
      });
      toast.success('Periodo cerrado', 'Ahora se encuentra listo para procesar pagos.');
      setConfirmarCierre(false);
      cargarDatos();
    } catch (e) {
      toast.error('No se pudo cerrar el periodo', e.message);
    } finally {
      setGuardando(false);
    }
  };

  const abrirNuevoDetalle = () => {
    setEditandoDetalle(null);
    setFormDetalle(FORM_DETALLE);
    setErrores({});
    setModalDetalle(true);
  };

  const abrirEdicionDetalle = (detalle) => {
    setEditandoDetalle(detalle);
    setFormDetalle({
      escolta_id: detalle.escolta_id,
      sueldo_base: String(detalle.sueldo_base ?? '0'),
      bonos: String(detalle.bonos ?? '0'),
      descuentos: String(detalle.descuentos ?? '0'),
      horas_extras: String(detalle.horas_extras ?? '0'),
      dias_trabajados: String(detalle.dias_trabajados ?? '30'),
      estado: detalle.estado || 'pendiente',
    });
    setErrores({});
    setModalDetalle(true);
  };

  const guardarDetalle = async () => {
    if (!formDetalle.escolta_id) {
      setErrores({ escolta_id: 'Selecciona un integrante.' });
      return;
    }
    try {
      setGuardando(true);
      const datos = {
        periodo_id: periodoId,
        escolta_id: formDetalle.escolta_id,
        sueldo_base: Number(formDetalle.sueldo_base) || 0,
        bonos: Number(formDetalle.bonos) || 0,
        descuentos: Number(formDetalle.descuentos) || 0,
        horas_extras: Number(formDetalle.horas_extras) || 0,
        dias_trabajados: Number(formDetalle.dias_trabajados) || 0,
        total: totalNomina(formDetalle),
        estado: formDetalle.estado,
      };

      if (editandoDetalle) {
        await actualizar(TABLAS.detallesNomina, editandoDetalle.id, datos);
        toast.success('Detalle actualizado');
      } else {
        await crear(TABLAS.detallesNomina, datos);
        toast.success('Integrante agregado a la nómina');
      }
      setModalDetalle(false);
      cargarDatos();
    } catch (e) {
      toast.error('No se pudo guardar el detalle', e.message);
    } finally {
      setGuardando(false);
    }
  };

  // Funciones Pagos
  const pagosFiltrados = useMemo(() => {
    return pagos.filter((p) => {
      const esc = escoltasPorId[p.escolta_id];
      const matchBusqueda =
        !busquedaPago ||
        (esc && (esc.nombres + ' ' + esc.apellidos).toLowerCase().includes(busquedaPago.toLowerCase())) ||
        (p.referencia && p.referencia.toLowerCase().includes(busquedaPago.toLowerCase()));
      const matchEstado = filtroEstadoPago === 'todos' || p.estado === filtroEstadoPago;
      return matchBusqueda && matchEstado;
    });
  }, [pagos, escoltasPorId, busquedaPago, filtroEstadoPago]);

  const abrirNuevoPago = (detalle = null) => {
    setFormPago({
      periodo_id: detalle?.periodo_id || periodoId || '',
      escolta_id: detalle?.escolta_id || '',
      monto: detalle ? String(totalNomina(detalle)) : '',
      fecha_pago: hoyISO(),
      metodo: 'transferencia',
      referencia: '',
      estado: 'registrado',
    });
    setErrores({});
    setModalPago(true);
  };

  const guardarPago = async () => {
    if (!formPago.escolta_id || !formPago.monto) {
      setErrores({
        escolta_id: !formPago.escolta_id ? 'Selecciona un escolta' : undefined,
        monto: !formPago.monto ? 'Ingresa el monto' : undefined,
      });
      return;
    }
    try {
      setGuardando(true);
      await crear(TABLAS.pagos, {
        periodo_id: formPago.periodo_id || null,
        escolta_id: formPago.escolta_id,
        monto: Number(formPago.monto),
        fecha_pago: formPago.fecha_pago,
        metodo: formPago.metodo,
        referencia: formPago.referencia.trim() || null,
        estado: formPago.estado,
      });
      toast.success('Pago registrado correctamente');
      setModalPago(false);
      cargarDatos();
    } catch (e) {
      toast.error('No se pudo registrar el pago', e.message);
    } finally {
      setGuardando(false);
    }
  };

  const cambiarEstadoPago = async (pago, nuevoEstado) => {
    try {
      setGuardando(true);
      await actualizar(TABLAS.pagos, pago.id, { estado: nuevoEstado });
      toast.success(`Pago ${nuevoEstado === 'confirmado' ? 'confirmado' : 'anulado'}`);
      setConfirmacionPago(null);
      cargarDatos();
    } catch (e) {
      toast.error('No se pudo actualizar el pago', e.message);
    } finally {
      setGuardando(false);
    }
  };

  // Función Imprimir Recibo Individual
  const imprimirRecibo = (recibo) => {
    const esc = escoltasPorId[recibo.escolta_id] || {};
    const per = periodos.find((p) => p.id === recibo.periodo_id) || {};
    const ventana = window.open('', '_blank');
    if (!ventana) return;

    const contenido = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="utf-8">
        <title>Recibo Oficial de Pago - ${nombreCompleto(esc)}</title>
        <style>
          @page { size: letter; margin: 15mm; }
          * { box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #111; margin: 0; padding: 25px; }
          .header { border-bottom: 2px solid #ff8a00; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
          .header h1 { margin: 0; color: #1c1f24; font-size: 20px; }
          * { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .metricas { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px; }
          .metrica { padding: 10px 12px; border-radius: 8px; background: #fff1e8; color: #994000; }
          .metrica:nth-child(2) { background: #fff8db; color: #854d0e; }
          .metrica:nth-child(3) { background: #ecfdf3; color: #166534; }
          .metrica strong { display: block; margin-top: 5px; }
          .header p { margin: 2px 0 0; color: #ff8a00; font-weight: bold; font-size: 12px; text-transform: uppercase; }
          .badge { background: #dcfce7; color: #15803d; border: 1px solid #86efac; padding: 4px 10px; border-radius: 999px; font-weight: bold; font-size: 11px; }
          .box { border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin-bottom: 16px; }
          .box-title { font-size: 12px; font-weight: bold; text-transform: uppercase; color: #475569; margin-bottom: 8px; border-bottom: 1px solid #f1f5f9; padding-bottom: 4px; }
          .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; }
          th { background: #f8fafc; font-weight: bold; }
          .total-row { font-size: 15px; font-weight: bold; background: #fff7ed; color: #c2410c; }
          .signatures { margin-top: 50px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 40px; text-align: center; }
          .sign-line { border-top: 1px solid #94a3b8; padding-top: 6px; font-size: 11px; font-weight: bold; color: #334155; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>ESCOLTAS · SEGURIDAD Y VIGILANCIA</h1>
            <p>Recibo Oficial de Pago y Liquidación</p>
          </div>
          <div>
            <span class="badge">COMPROBANTE VÁLIDO</span>
          </div>
        </div>

        <div class="metricas">
          <div class="metrica">Base <strong>${formatearMoneda(recibo.sueldo_base ?? recibo.monto)}</strong></div>
          <div class="metrica">Deducciones <strong>${formatearMoneda(recibo.descuentos ?? 0)}</strong></div>
          <div class="metrica">Neto <strong>${formatearMoneda(recibo.total ?? recibo.monto)}</strong></div>
        </div>

        <div class="box">
          <div class="box-title">Datos del Titular y Periodo</div>
          <div class="grid">
            <div><strong>Personal:</strong> ${nombreCompleto(esc)}</div>
            <div><strong>Cédula:</strong> ${esc.cedula || '—'}</div>
            <div><strong>Código:</strong> ${esc.codigo || '—'}</div>
            <div><strong>Cargo:</strong> ${esc.cargo || 'Seguridad y Escolta'}</div>
            <div><strong>Periodo:</strong> ${per.nombre || 'Liquidación Ordinaria'}</div>
            <div><strong>Fecha Emisión:</strong> ${formatearFecha(recibo.fecha_pago || hoyISO())}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Concepto</th>
              <th style="text-align: right;">Monto</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Sueldo Base Operativo</td><td style="text-align: right;">${formatearMoneda(recibo.sueldo_base ?? recibo.monto)}</td></tr>
            ${recibo.bonos ? `<tr><td>Bonos y Primas de Servicio</td><td style="text-align: right;">${formatearMoneda(recibo.bonos)}</td></tr>` : ''}
            ${recibo.horas_extras ? `<tr><td>Horas Extras y Guardias Especiales</td><td style="text-align: right;">${formatearMoneda(recibo.horas_extras)}</td></tr>` : ''}
            ${recibo.descuentos ? `<tr><td>Deducciones / Anticipos</td><td style="text-align: right; color: #dc2626;">-${formatearMoneda(recibo.descuentos)}</td></tr>` : ''}
            <tr class="total-row">
              <td><strong>TOTAL NETO LIQUIDADO</strong></td>
              <td style="text-align: right;"><strong>${formatearMoneda(recibo.total ?? recibo.monto)}</strong></td>
            </tr>
          </tbody>
        </table>

        <div class="signatures">
          <div class="sign-line">Firma del Trabajador<br><span style="font-weight: normal; color: #64748b;">Conforme con el pago recibido</span></div>
          <div class="sign-line">Administración / Pagaduría<br><span style="font-weight: normal; color: #64748b;">Firma y Sello Autorizado</span></div>
        </div>

        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `;
    ventana.document.write(contenido);
    ventana.document.close();
  };

  return (
    <div className="space-y-6">
      <ReporteModulo titulo="Nómina y pagos" archivo="nomina-pagos" columnas={["Personal","Fecha","Monto","Estado"]}
        filas={pestanaActiva === 'nomina' ? detallesDelPeriodo.map((r) => [nombreCompleto(escoltasPorId[r.escolta_id]), periodoActivo?.fecha_inicio, totalNomina(r), r.estado]) : pagosFiltrados.map((r) => [nombreCompleto(escoltasPorId[r.escolta_id]), r.fecha_pago, Number(r.monto), r.estado])} deshabilitado={cargando} />
      {/* Cabecera Principal */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#ff8a00] to-[#ffd54a] p-0.5 shadow-md">
              <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-[#14171c]">
                <WalletCards className="h-5 w-5 text-[#ff8a00]" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                Nómina, Pagos y Recibos
              </h1>
              <p className="text-xs font-bold text-[#ff8a00] uppercase tracking-wider">
                Módulo Financiero Centralizado · Escoltas y Seguridad
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-center">
          {puedeEditar && (
            <>
              {pestanaActiva === 'nomina' && (
                <>
                  <Button variant="outline" size="md" leftIcon={Plus} onClick={abrirPeriodo}>
                    Nuevo Periodo
                  </Button>
                  <Button
                    variant="primary"
                    size="md"
                    leftIcon={Plus}
                    disabled={!periodoActivo || periodoActivo.estado === 'cerrado'}
                    onClick={abrirNuevoDetalle}
                  >
                    Agregar Integrante
                  </Button>
                </>
              )}
              {pestanaActiva === 'pagos' && (
                <Button variant="primary" size="md" leftIcon={Plus} onClick={() => abrirNuevoPago()}>
                  Registrar Pago
                </Button>
              )}
            </>
          )}
        </div>
      </header>

      {/* Vista resumida de acción rápida para teléfonos */}
      <div className={telefono ? 'space-y-3' : 'space-y-3 md:hidden'}>
        <div className="rounded-2xl border border-slate-800 bg-[#161a22] p-4 shadow-md space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <WalletCards className="h-4 w-4 text-[#ff8a00]" />
              <span className="text-xs font-black uppercase text-slate-200">Nómina Activa</span>
            </div>
            {periodoActivo && (
              <Badge tone={periodoActivo.estado === 'cerrado' ? 'gris' : periodoActivo.estado === 'pagado' ? 'verde' : 'azul'}>
                {periodoActivo.estado.toUpperCase()}
              </Badge>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">
                {periodoActivo?.nombre || 'Periodo en curso'}
              </span>
              <strong className="text-lg font-black text-white">
                {formatearMoneda(totalGeneralNomina)}
              </strong>
            </div>
            {puedeEditar && (
              <Button size="sm" variant="primary" leftIcon={Plus} onClick={abrirNuevoDetalle} disabled={!periodoActivo || periodoActivo.estado === 'cerrado'}>
                Agregar
              </Button>
            )}
          </div>
        </div>

        {/* Botón para desplegar desglose completo bajo demanda en teléfonos */}
        <button
          type="button"
          onClick={() => setMostrarDesgloseMobile((prev) => !prev)}
          className="w-full flex items-center justify-between p-3.5 rounded-xl border border-slate-800 bg-[#14171c] hover:bg-slate-800/80 text-xs font-bold text-slate-200 shadow-sm transition-all"
        >
          <span className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-[#ff8a00]" />
            {mostrarDesgloseMobile ? 'Ocultar desglose de nómina' : `Ver desglose y recibos (${detallesDelPeriodo.length} integrantes)`}
          </span>
          <span className="text-slate-400 font-mono text-xs">{mostrarDesgloseMobile ? '▲ Ocultar' : '▼ Expandir'}</span>
        </button>
      </div>

      {/* Contenedor completo: visible en desktop (md:block) o bajo demanda en móvil */}
      <div className={mostrarDesgloseMobile ? 'space-y-6 block' : (telefono ? 'hidden' : 'hidden md:block') + ' space-y-6'}>
        {/* Pestañas de Navegación del Módulo Financiero */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl border border-slate-800 bg-[#0e1217]">
        {PESTANAS_MODULO.map((p) => {
          const Icono = p.icon;
          const activa = pestanaActiva === p.id;
          return (
            <button
              key={p.id}
              onClick={() => setPestanaActiva(p.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activa
                  ? 'bg-gradient-to-r from-[#ff8a00] to-[#e67a00] text-black shadow-lg shadow-[#ff8a00]/20 font-black'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Icono className={`h-4 w-4 ${activa ? 'text-black' : 'text-[#ff8a00]'}`} />
              <span>{p.label}</span>
            </button>
          );
        })}
      </div>

      {/* VISTA 1: CÁLCULO Y PERIODOS DE NÓMINA */}
      {pestanaActiva === 'nomina' && (
        <div className="space-y-6">
          {/* Selector de Periodo y Estadísticas */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
            <Card className="p-4 lg:col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">
                Periodo Activo
              </label>
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <select
                  value={periodoId}
                  onChange={(e) => setPeriodoId(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 font-bold focus:border-[#ff8a00]"
                >
                  {periodos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} ({formatearFecha(p.fecha_inicio)} al {formatearFecha(p.fecha_fin)}) — [{p.estado.toUpperCase()}]
                    </option>
                  ))}
                </select>
                {periodoActivo?.estado === 'abierto' && puedeEditar && (
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={LockKeyhole}
                    onClick={() => setConfirmarCierre(true)}
                    className="whitespace-nowrap shrink-0 text-amber-400 border-amber-500/40"
                  >
                    Cerrar Periodo
                  </Button>
                )}
              </div>
            </Card>

            <StatCard
              label="Integrantes en Periodo"
              value={formatearNumero(detallesDelPeriodo.length)}
              help={periodoActivo ? `Estado: ${periodoActivo.estado}` : 'Sin periodo'}
            />
            <StatCard
              label="Total Nómina"
              value={formatearMoneda(totalGeneralNomina)}
              tone="brand"
              help="Monto neto a desembolsar"
            />
          </div>

          {/* Tabla de Detalle de Nómina */}
          <Card
            title={`Detalles de ${periodoActivo?.nombre || 'la Nómina'}`}
            description="Conceptos salariales individuales, bonificaciones, horas extras y deducciones."
          >
            <DataTable
              columns={[
                {
                  key: 'escolta',
                  label: 'Personal',
                  primary: true,
                  render: (fila) => {
                    const esc = escoltasPorId[fila.escolta_id];
                    return (
                      <div>
                        <strong className="text-slate-100 block">{esc ? nombreCompleto(esc) : 'Personal sin asignar'}</strong>
                        <span className="text-xs text-slate-400 font-mono">{esc?.codigo || 'S/C'} · C.I. {esc?.cedula || '—'}</span>
                      </div>
                    );
                  },
                },
                { key: 'sueldo_base', label: 'Base', render: (f) => formatearMoneda(f.sueldo_base) },
                { key: 'bonos', label: 'Bonos', render: (f) => formatearMoneda(f.bonos), mobile: false },
                { key: 'horas_extras', label: 'Extras', render: (f) => formatearMoneda(f.horas_extras), mobile: false },
                { key: 'descuentos', label: 'Deducciones', render: (f) => <span className="text-rose-400">-{formatearMoneda(f.descuentos)}</span>, mobile: false },
                { key: 'total', label: 'Total Neto', render: (f) => <strong className="text-emerald-400 font-bold">{formatearMoneda(totalNomina(f))}</strong> },
                { key: 'estado', label: 'Estado', render: (f) => <Badge tone={estadoTone(f.estado)}>{estadoLabel(f.estado)}</Badge> },
              ]}
              data={detallesDelPeriodo}
              loading={cargando}
              emptyTitle="No hay integrantes en este periodo"
              emptyDescription="Comienza agregando personal con el botón superior."
              actions={(fila) => (
                <div className="flex items-center gap-1.5 whitespace-nowrap">
                  <Button
                    size="sm"
                    variant="outline"
                    leftIcon={ReceiptText}
                    onClick={() => imprimirRecibo(fila)}
                    title="Imprimir Recibo"
                  >
                    Recibo
                  </Button>
                  {puedeEditar && periodoActivo?.estado === 'abierto' && (
                    <Button
                      size="sm"
                      variant="outline"
                      leftIcon={Pencil}
                      onClick={() => abrirEdicionDetalle(fila)}
                      title="Editar Conceptos"
                    />
                  )}
                  {puedeEditar && (
                    <Button
                      size="sm"
                      variant="primary"
                      leftIcon={CreditCard}
                      onClick={() => abrirNuevoPago(fila)}
                      title="Registrar Pago de esta Ficha"
                    >
                      Pagar
                    </Button>
                  )}
                </div>
              )}
            />
          </Card>
        </div>
      )}

      {/* VISTA 2: PAGOS Y TRANSFERENCIAS */}
      {pestanaActiva === 'pagos' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-slate-400" />
              <input
                type="search"
                value={busquedaPago}
                onChange={(e) => setBusquedaPago(e.target.value.toLocaleUpperCase("es"))}
                placeholder="Buscar por personal o referencia bancaria..."
                className="w-full rounded-xl border border-slate-700 bg-slate-900/80 pl-10 pr-3 py-2 text-sm text-slate-100"
              />
            </div>
            <select
              value={filtroEstadoPago}
              onChange={(e) => setFiltroEstadoPago(e.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-100"
            >
              <option value="todos">Todos los estados de pago</option>
              {OPCIONES_ESTADO_PAGO.map((opc) => (
                <option key={opc.value} value={opc.value}>{opc.label}</option>
              ))}
            </select>
          </div>

          <Card title="Historial y Registro de Pagos" description="Comprobantes de transferencias y pagos procesados.">
            <DataTable
              columns={[
                {
                  key: 'escolta',
                  label: 'Beneficiario',
                  primary: true,
                  render: (fila) => {
                    const esc = escoltasPorId[fila.escolta_id];
                    return (
                      <div>
                        <strong className="text-slate-100 block">{esc ? nombreCompleto(esc) : 'Personal sin asignar'}</strong>
                        <span className="text-xs text-slate-400 font-mono">C.I. {esc?.cedula || '—'}</span>
                      </div>
                    );
                  },
                },
                { key: 'monto', label: 'Monto Pagado', render: (f) => <strong className="text-slate-100">{formatearMoneda(f.monto)}</strong> },
                { key: 'fecha_pago', label: 'Fecha', render: (f) => formatearFecha(f.fecha_pago) },
                { key: 'metodo', label: 'Método', render: (f) => <span className="capitalize">{f.metodo}</span>, mobile: false },
                { key: 'referencia', label: 'Referencia', render: (f) => f.referencia || '—', mobile: false },
                { key: 'estado', label: 'Estado', render: (f) => <Badge tone={estadoTone(f.estado)}>{estadoLabel(f.estado)}</Badge> },
              ]}
              data={pagosFiltrados}
              loading={cargando}
              emptyTitle="No hay pagos registrados"
              emptyDescription="Registra un pago para comenzar."
              actions={(fila) => (
                <div className="flex items-center gap-1.5 whitespace-nowrap">
                  <Button
                    size="sm"
                    variant="outline"
                    leftIcon={ReceiptText}
                    onClick={() => imprimirRecibo(fila)}
                    title="Imprimir Comprobante"
                  >
                    Comprobante
                  </Button>
                  {puedeEditar && fila.estado === 'registrado' && (
                    <Button
                      size="sm"
                      variant="primary"
                      leftIcon={CheckCircle2}
                      onClick={() => setConfirmacionPago({ pago: fila, estado: 'confirmado' })}
                      title="Confirmar Pago"
                    >
                      Confirmar
                    </Button>
                  )}
                  {puedeEditar && fila.estado !== 'anulado' && (
                    <Button
                      size="sm"
                      variant="outline"
                      leftIcon={XCircle}
                      onClick={() => setConfirmacionPago({ pago: fila, estado: 'anulado' })}
                      title="Anular Pago"
                      className="text-rose-400 hover:text-rose-300"
                    />
                  )}
                </div>
              )}
            />
          </Card>
        </div>
      )}

      {/* VISTA 3: RECIBOS Y COMPROBANTES OFICIALES */}
      {pestanaActiva === 'recibos' && (
        <div className="space-y-6">
          <Card
            title="Emisión de Recibos de Nómina"
            description="Consulta rápida y descarga de comprobantes individuales por trabajador."
          >
            <DataTable
              columns={[
                {
                  key: 'escolta',
                  label: 'Titular',
                  primary: true,
                  render: (fila) => {
                    const esc = escoltasPorId[fila.escolta_id];
                    return (
                      <div>
                        <strong className="text-slate-100 block">{esc ? nombreCompleto(esc) : 'Personal sin asignar'}</strong>
                        <span className="text-xs text-slate-400 font-mono">{esc?.codigo || 'S/C'} · C.I. {esc?.cedula || '—'}</span>
                      </div>
                    );
                  },
                },
                {
                  key: 'periodo',
                  label: 'Periodo de Nómina',
                  render: (f) => {
                    const p = periodos.find((per) => per.id === f.periodo_id);
                    return p?.nombre || 'Periodo General';
                  },
                },
                { key: 'total', label: 'Neto a Percibir', render: (f) => <strong className="text-emerald-400">{formatearMoneda(totalNomina(f))}</strong> },
                { key: 'estado', label: 'Estado', render: (f) => <Badge tone={estadoTone(f.estado)}>{estadoLabel(f.estado)}</Badge> },
              ]}
              data={detalles}
              loading={cargando}
              emptyTitle="No hay recibos disponibles"
              emptyDescription="Los recibos se generarán a medida que agregues personal a la nómina."
              actions={(fila) => (
                <Button
                  size="sm"
                  variant="primary"
                  leftIcon={Printer}
                  onClick={() => imprimirRecibo(fila)}
                >
                  Imprimir Recibo PDF
                </Button>
              )}
            />
          </Card>
        </div>
      )}
      </div>

      {/* MODAL CREAR PERIODO */}
      <Modal
        open={modalPeriodo}
        onClose={() => setModalPeriodo(false)}
        title="Crear Nuevo Periodo de Nómina"
        description="Establece el rango de fechas para el cálculo salarial."
        footer={
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <Button onClick={guardarPeriodo} loading={guardando} fullWidth className="sm:w-auto">
              Crear Periodo
            </Button>
            <Button variant="outline" onClick={() => setModalPeriodo(false)} disabled={guardando} fullWidth className="sm:w-auto">
              Cancelar
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label="Nombre del Periodo" maxLength={150}
            placeholder="Ej. Quincena 01-15 Diciembre 2026"
            required
            value={formPeriodo.nombre}
            error={errores.nombre}
            onChange={(e) => setFormPeriodo((p) => ({ ...p, nombre: e.target.value }))}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Fecha de Inicio"
              type="date"
              required
              value={formPeriodo.fecha_inicio}
              error={errores.fecha_inicio}
              onChange={(e) => setFormPeriodo((p) => ({ ...p, fecha_inicio: e.target.value }))}
            />
            <Input
              label="Fecha de Fin"
              type="date"
              required
              value={formPeriodo.fecha_fin}
              error={errores.fecha_fin}
              onChange={(e) => setFormPeriodo((p) => ({ ...p, fecha_fin: e.target.value }))}
            />
          </div>
        </div>
      </Modal>

      {/* MODAL AGREGAR / EDITAR DETALLE */}
      <Modal
        open={modalDetalle}
        onClose={() => setModalDetalle(false)}
        title={editandoDetalle ? 'Editar Detalle de Nómina' : 'Agregar Integrante a la Nómina'}
        size="lg"
        footer={
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <Button onClick={guardarDetalle} loading={guardando} fullWidth className="sm:w-auto">
              {editandoDetalle ? 'Guardar Cambios' : 'Agregar a Nómina'}
            </Button>
            <Button variant="outline" onClick={() => setModalDetalle(false)} disabled={guardando} fullWidth className="sm:w-auto">
              Cancelar
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label="Personal / Escolta"
            required
            value={formDetalle.escolta_id}
            error={errores.escolta_id}
            onChange={(e) => setFormDetalle((d) => ({ ...d, escolta_id: e.target.value }))}
            containerClassName="sm:col-span-2"
          >
            <option value="">Selecciona un integrante...</option>
            {opcionesEscoltaDetalle.map((esc) => (
              <option key={esc.id} value={esc.id}>{nombreCompleto(esc)} · {esc.codigo || 'S/C'}</option>
            ))}
          </Select>
          <Input
            label="Sueldo Base"
            type="number"
            min="0"
            step="0.01"
            value={formDetalle.sueldo_base}
            onChange={(e) => setFormDetalle((d) => ({ ...d, sueldo_base: e.target.value }))}
          />
          <Input
            label="Bonos y Primas"
            type="number"
            min="0"
            step="0.01"
            value={formDetalle.bonos}
            onChange={(e) => setFormDetalle((d) => ({ ...d, bonos: e.target.value }))}
          />
          <Input
            label="Horas Extras (Monto)"
            type="number"
            min="0"
            step="0.01"
            value={formDetalle.horas_extras}
            onChange={(e) => setFormDetalle((d) => ({ ...d, horas_extras: e.target.value }))}
          />
          <Input
            label="Deducciones / Anticipos"
            type="number"
            min="0"
            step="0.01"
            value={formDetalle.descuentos}
            onChange={(e) => setFormDetalle((d) => ({ ...d, descuentos: e.target.value }))}
          />
          <Input
            label="Días Trabajados"
            type="number"
            min="0"
            max="31"
            value={formDetalle.dias_trabajados}
            onChange={(e) => setFormDetalle((d) => ({ ...d, dias_trabajados: e.target.value }))}
          />
          <Select
            label="Estado"
            value={formDetalle.estado}
            options={OPCIONES_ESTADO_DETALLE}
            onChange={(e) => setFormDetalle((d) => ({ ...d, estado: e.target.value }))}
          />
        </div>
        <div className="mt-5 flex items-center justify-between rounded-xl border border-brand-500/30 bg-brand-950/40 p-4">
          <div>
            <p className="text-sm font-semibold text-brand-100">Total Neto Calculado</p>
            <p className="text-xs text-brand-300">Base + bonos + extras − deducciones</p>
          </div>
          <p className="text-2xl font-extrabold text-brand-300">{formatearMoneda(totalNomina(formDetalle))}</p>
        </div>
      </Modal>

      {/* MODAL REGISTRAR PAGO */}
      <Modal
        open={modalPago}
        onClose={() => setModalPago(false)}
        title="Registrar Pago de Nómina"
        description="Emisión de comprobante y transferencia bancaria."
        footer={
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <Button onClick={guardarPago} loading={guardando} fullWidth className="sm:w-auto">
              Registrar Pago
            </Button>
            <Button variant="outline" onClick={() => setModalPago(false)} disabled={guardando} fullWidth className="sm:w-auto">
              Cancelar
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Select
            label="Personal / Beneficiario"
            required
            value={formPago.escolta_id}
            error={errores.escolta_id}
            onChange={(e) => setFormPago((p) => ({ ...p, escolta_id: e.target.value }))}
          >
            <option value="">Selecciona un beneficiario...</option>
            {escoltas.map((esc) => (
              <option key={esc.id} value={esc.id}>{nombreCompleto(esc)} · C.I. {esc.cedula || '—'}</option>
            ))}
          </Select>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Monto"
              type="number"
              min="0"
              step="0.01"
              required
              value={formPago.monto}
              error={errores.monto}
              onChange={(e) => setFormPago((p) => ({ ...p, monto: e.target.value }))}
            />
            <Input
              label="Fecha de Pago"
              type="date"
              required
              value={formPago.fecha_pago}
              onChange={(e) => setFormPago((p) => ({ ...p, fecha_pago: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Método de Pago"
              value={formPago.metodo}
              options={METODOS_PAGO}
              onChange={(e) => setFormPago((p) => ({ ...p, metodo: e.target.value }))}
            />
            <Select
              label="Estado"
              value={formPago.estado}
              options={OPCIONES_ESTADO_PAGO}
              onChange={(e) => setFormPago((p) => ({ ...p, estado: e.target.value }))}
            />
          </div>
          <Input
            label="Referencia / Nro. Comprobante"
            placeholder="Ej. Transferencia Banesco 98765432"
            value={formPago.referencia}
            onChange={(e) => setFormPago((p) => ({ ...p, referencia: e.target.value }))}
          />
        </div>
      </Modal>

      {/* DIÁLOGOS DE CONFIRMACIÓN */}
      <ConfirmDialog
        open={confirmarCierre}
        onClose={() => setConfirmarCierre(false)}
        title="¿Cerrar este periodo de nómina?"
        description={`Se cerrará "${periodoActivo?.nombre || ''}" y se marcará como listo para pagos. Asegúrate de que los conceptos estén completos.`}
        confirmLabel="Sí, cerrar periodo"
        onConfirm={cerrarPeriodo}
        loading={guardando}
        variant="success"
      />

      <ConfirmDialog
        open={Boolean(confirmacionPago)}
        onClose={() => setConfirmacionPago(null)}
        title={confirmacionPago?.estado === 'confirmado' ? '¿Confirmar este pago?' : '¿Anular este pago?'}
        description={confirmacionPago ? `${nombreCompleto(escoltasPorId[confirmacionPago.pago.escolta_id])} · ${formatearMoneda(confirmacionPago.pago.monto)}` : ''}
        confirmLabel={confirmacionPago?.estado === 'confirmado' ? 'Sí, confirmar' : 'Sí, anular'}
        variant={confirmacionPago?.estado === 'confirmado' ? 'success' : 'danger'}
        onConfirm={() => cambiarEstadoPago(confirmacionPago.pago, confirmacionPago.estado)}
        loading={guardando}
      />
    </div>
  );
}
