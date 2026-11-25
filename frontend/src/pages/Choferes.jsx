import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Truck,
  UserCheck,
  UserX,
  Users,
} from 'lucide-react';
import { Badge, Button, Card, HelpTip, Input, Modal, Select, useToast } from '../components/ui.jsx';
import { apiFetch } from '../lib/api.js';

export default function Choferes() {
  const toast = useToast();
  const [tab, setTab] = useState('tablero');
  const [cargando, setCargando] = useState(true);

  // Estados
  const [conductores, setConductores] = useState([]);
  const [viajes, setViajes] = useState([]);
  const [viaticos, setViaticos] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [resumen, setResumen] = useState(null);

  // Filtros
  const [busqueda, setBusqueda] = useState('');

  // Modales
  const [modalConductor, setModalConductor] = useState(false);
  const [formConductor, setFormConductor] = useState({
    nombre: '',
    apellido: '',
    cedula: '',
    telefono: '',
    externo: false,
    empresa_externa: '',
    tarifa_viaje_usd: 0,
    licencia_vence: '',
    certificado_medico_vence: '',
    seguro_vence: '',
  });

  const [modalViaje, setModalViaje] = useState(false);
  const [formViaje, setFormViaje] = useState({
    conductor_id: '',
    origen: '',
    destino: '',
    cliente: '',
    fecha_salida: new Date().toISOString().split('T')[0],
    categoria_viaje: 'VIAJE CORTO',
    viajes: 1,
    tarifa_usd: 0,
    observaciones: '',
  });

  const [modalViatico, setModalViatico] = useState(false);
  const [formViatico, setFormViatico] = useState({
    conductor_id: '',
    viaje_id: '',
    concepto: '',
    monto_usd: 0,
    tipo: 'anticipo',
  });

  const [guardando, setGuardando] = useState(false);

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    try {
      const [cRes, vRes, vtRes, pRes, rRes] = await Promise.all([
        apiFetch('/choferes/conductores').catch(() => []),
        apiFetch('/choferes/viajes').catch(() => []),
        apiFetch('/choferes/viaticos').catch(() => []),
        apiFetch('/choferes/pagos').catch(() => []),
        apiFetch('/choferes/resumen').catch(() => null),
      ]);
      setConductores(cRes || []);
      setViajes(vRes || []);
      setViaticos(vtRes || []);
      setPagos(pRes || []);
      setResumen(rRes);
    } catch {
      toast.error('No se pudieron cargar todos los datos de Choferes');
    } finally {
      setCargando(false);
    }
  }, [toast]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // Guardar Conductor
  const guardarConductor = async (e) => {
    e.preventDefault();
    if (!formConductor.nombre.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }
    setGuardando(true);
    try {
      await apiFetch('/choferes/conductores', {
        method: 'POST',
        body: formConductor,
      });
      toast.success('Conductor registrado exitosamente');
      setModalConductor(false);
      setFormConductor({
        nombre: '',
        apellido: '',
        cedula: '',
        telefono: '',
        externo: false,
        empresa_externa: '',
        tarifa_viaje_usd: 0,
        licencia_vence: '',
        certificado_medico_vence: '',
        seguro_vence: '',
      });
      cargarDatos();
    } catch (err) {
      toast.error(err.message || 'Error al guardar conductor');
    } finally {
      setGuardando(false);
    }
  };

  // Guardar Viaje
  const guardarViaje = async (e) => {
    e.preventDefault();
    if (!formViaje.origen || !formViaje.destino) {
      toast.error('Origen y destino son obligatorios');
      return;
    }
    const chofer = conductores.find((c) => c.id === formViaje.conductor_id);
    setGuardando(true);
    try {
      await apiFetch('/choferes/viajes', {
        method: 'POST',
        body: {
          ...formViaje,
          conductor_nombre: chofer ? `${chofer.nombre} ${chofer.apellido || ''}` : 'Sin asignar',
        },
      });
      toast.success('Viaje registrado correctamente');
      setModalViaje(false);
      setFormViaje({
        conductor_id: '',
        origen: '',
        destino: '',
        cliente: '',
        fecha_salida: new Date().toISOString().split('T')[0],
        categoria_viaje: 'VIAJE CORTO',
        viajes: 1,
        tarifa_usd: 0,
        observaciones: '',
      });
      cargarDatos();
    } catch (err) {
      toast.error(err.message || 'Error al registrar viaje');
    } finally {
      setGuardando(false);
    }
  };

  // Guardar Viático
  const guardarViatico = async (e) => {
    e.preventDefault();
    if (!formViatico.conductor_id || !formViatico.concepto || !formViatico.monto_usd) {
      toast.error('Completa los campos obligatorios');
      return;
    }
    setGuardando(true);
    try {
      await apiFetch('/choferes/viaticos', {
        method: 'POST',
        body: formViatico,
      });
      toast.success('Viático registrado');
      setModalViatico(false);
      setFormViatico({
        conductor_id: '',
        viaje_id: '',
        concepto: '',
        monto_usd: 0,
        tipo: 'anticipo',
      });
      cargarDatos();
    } catch (err) {
      toast.error(err.message || 'Error al registrar viático');
    } finally {
      setGuardando(false);
    }
  };

  // Cambiar estado de viaje
  const cambiarEstadoViaje = async (id, estado) => {
    try {
      await apiFetch(`/choferes/viajes/${id}/estado`, {
        method: 'PATCH',
        body: { estado },
      });
      toast.success(`Estado actualizado a ${estado}`);
      cargarDatos();
    } catch (err) {
      toast.error(err.message || 'Error al cambiar estado');
    }
  };

  // Semáforo de vencimientos
  const semaforoDoc = (fecha) => {
    if (!fecha) return { label: 'Sin fecha', color: 'slate' };
    const hoy = new Date();
    const vence = new Date(fecha);
    const diffDias = Math.round((vence - hoy) / (1000 * 60 * 60 * 24));
    if (diffDias < 0) return { label: `Vencido (${fecha})`, color: 'danger' };
    if (diffDias <= 30) return { label: `Vence en ${diffDias}d`, color: 'warning' };
    return { label: `Vigente (${fecha})`, color: 'success' };
  };

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-amber-500/10 p-2 text-amber-600">
              <Truck className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Choferes y Transporte</h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Control de flota, conductores, rutas de transporte, viáticos y liquidaciones de viaje.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={cargarDatos} leftIcon={RefreshCw} disabled={cargando}>
            Actualizar
          </Button>
          <Button variant="primary" size="sm" onClick={() => setModalViaje(true)} leftIcon={Plus}>
            Nueva Orden de Ruta
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        {[
          { id: 'tablero', label: 'Tablero' },
          { id: 'conductores', label: `Conductores (${conductores.length})` },
          { id: 'viajes', label: `Viajes / Rutas (${viajes.length})` },
          { id: 'viaticos', label: `Viáticos (${viaticos.length})` },
          { id: 'pagos', label: `Liquidaciones (${pagos.length})` },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.id
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 1. Tablero */}
      {tab === 'tablero' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Choferes Activos</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{resumen?.activos ?? 0}</p>
                </div>
                <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600">
                  <Users className="h-5 w-5" />
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Viajes en Ruta</p>
                  <p className="mt-1 text-2xl font-bold text-amber-600">{resumen?.enRuta ?? 0}</p>
                </div>
                <div className="rounded-xl bg-amber-50 p-2.5 text-amber-600">
                  <Truck className="h-5 w-5" />
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Viajes Completados</p>
                  <p className="mt-1 text-2xl font-bold text-emerald-600">{resumen?.completados ?? 0}</p>
                </div>
                <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Generado</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">${(resumen?.montoTotal ?? 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="rounded-xl bg-purple-50 p-2.5 text-purple-600">
                  <DollarSign className="h-5 w-5" />
                </div>
              </div>
            </Card>
          </div>

          {/* Alertas de Documentos por Vencer */}
          <Card className="p-4">
            <h2 className="text-base font-semibold text-slate-800">Estado de Documentación de Choferes</h2>
            <p className="text-xs text-slate-500 mt-0.5">Control de vigencia de licencias, certificados médicos y seguros vehiculares.</p>
            <div className="mt-4 divide-y divide-slate-100">
              {conductores.map((c) => {
                const lic = semaforoDoc(c.licencia_vence);
                const med = semaforoDoc(c.certificado_medico_vence);
                return (
                  <div key={c.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="font-medium text-slate-800">{c.nombre} {c.apellido}</span>
                      <span className="text-xs text-slate-400 ml-2">({c.externo ? 'Externo' : 'Propio'})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={lic.color}>Licencia: {lic.label}</Badge>
                      <Badge variant={med.color}>Médico: {med.label}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* 2. Conductores */}
      {tab === 'conductores' && (
        <Card className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-slate-800">Directorio de Conductores</h2>
            <Button variant="primary" size="sm" onClick={() => setModalConductor(true)} leftIcon={Plus}>
              Nuevo Conductor
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Cédula</th>
                  <th className="px-4 py-3">Teléfono</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Tarifa / Viaje</th>
                  <th className="px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {conductores.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{c.nombre} {c.apellido}</td>
                    <td className="px-4 py-3">{c.cedula || '—'}</td>
                    <td className="px-4 py-3">{c.telefono || '—'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={c.externo ? 'warning' : 'info'}>
                        {c.externo ? (c.empresa_externa || 'Externo') : 'Nómina Propia'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">${c.tarifa_viaje_usd || 0}</td>
                    <td className="px-4 py-3">
                      <Badge variant={c.activo ? 'success' : 'slate'}>
                        {c.activo ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* 3. Viajes */}
      {tab === 'viajes' && (
        <Card className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-slate-800">Órdenes de Ruta y Viajes</h2>
            <Button variant="primary" size="sm" onClick={() => setModalViaje(true)} leftIcon={Plus}>
              Nueva Ruta
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Número</th>
                  <th className="px-4 py-3">Conductor</th>
                  <th className="px-4 py-3">Ruta</th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Categoría</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {viajes.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono font-medium text-brand-700">{v.numero}</td>
                    <td className="px-4 py-3">{v.conductor_nombre}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 font-medium text-slate-800">
                        <span>{v.origen}</span>
                        <span>→</span>
                        <span>{v.destino}</span>
                      </div>
                      {v.cliente && <p className="text-xs text-slate-400">{v.cliente}</p>}
                    </td>
                    <td className="px-4 py-3">{v.fecha_salida}</td>
                    <td className="px-4 py-3"><Badge variant="outline">{v.categoria_viaje}</Badge></td>
                    <td className="px-4 py-3 font-semibold text-slate-900">${v.monto_total_usd}</td>
                    <td className="px-4 py-3">
                      <Badge variant={
                        v.estado === 'completado' ? 'success' :
                        v.estado === 'en_ruta' ? 'warning' :
                        v.estado === 'liquidado' ? 'info' : 'slate'
                      }>
                        {v.estado}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {v.estado === 'programado' && (
                        <button
                          onClick={() => cambiarEstadoViaje(v.id, 'en_ruta')}
                          className="text-xs text-brand-600 hover:underline font-medium"
                        >
                          Iniciar Ruta
                        </button>
                      )}
                      {v.estado === 'en_ruta' && (
                        <button
                          onClick={() => cambiarEstadoViaje(v.id, 'completado')}
                          className="text-xs text-emerald-600 hover:underline font-medium"
                        >
                          Finalizar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* 4. Viáticos */}
      {tab === 'viaticos' && (
        <Card className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-slate-800">Viáticos y Gastos en Ruta</h2>
            <Button variant="primary" size="sm" onClick={() => setModalViatico(true)} leftIcon={Plus}>
              Nuevo Viático
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Concepto</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Monto (USD)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {viaticos.map((vt) => (
                  <tr key={vt.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">{vt.fecha}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{vt.concepto}</td>
                    <td className="px-4 py-3">
                      <Badge variant={vt.tipo === 'anticipo' ? 'warning' : 'info'}>{vt.tipo}</Badge>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">${vt.monto_usd}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* 5. Liquidaciones */}
      {tab === 'pagos' && (
        <Card className="p-4">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Historial de Liquidaciones de Choferes</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Recibo</th>
                  <th className="px-4 py-3">Conductor</th>
                  <th className="px-4 py-3">Total Viajes</th>
                  <th className="px-4 py-3">Monto Total</th>
                  <th className="px-4 py-3">Fecha Pago</th>
                  <th className="px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pagos.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono font-medium text-brand-700">{p.numero}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{p.conductor_nombre}</td>
                    <td className="px-4 py-3">{p.total_viajes}</td>
                    <td className="px-4 py-3 font-semibold text-emerald-700">${p.total_usd}</td>
                    <td className="px-4 py-3">{p.fecha_pago}</td>
                    <td className="px-4 py-3"><Badge variant="success">{p.estado}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modal Nuevo Conductor */}
      <Modal abierto={modalConductor} alCerrar={() => setModalConductor(false)} titulo="Registrar Nuevo Conductor">
        <form onSubmit={guardarConductor} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Nombre *"
              value={formConductor.nombre}
              onChange={(e) => setFormConductor({ ...formConductor, nombre: e.target.value })}
              required
            />
            <Input
              label="Apellido"
              value={formConductor.apellido}
              onChange={(e) => setFormConductor({ ...formConductor, apellido: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Cédula"
              value={formConductor.cedula}
              onChange={(e) => setFormConductor({ ...formConductor, cedula: e.target.value })}
            />
            <Input
              label="Teléfono"
              value={formConductor.telefono}
              onChange={(e) => setFormConductor({ ...formConductor, telefono: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              type="number"
              label="Tarifa por viaje (USD)"
              value={formConductor.tarifa_viaje_usd}
              onChange={(e) => setFormConductor({ ...formConductor, tarifa_viaje_usd: e.target.value })}
            />
            <Input
              type="date"
              label="Vencimiento Licencia"
              value={formConductor.licencia_vence}
              onChange={(e) => setFormConductor({ ...formConductor, licencia_vence: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="externo"
              checked={formConductor.externo}
              onChange={(e) => setFormConductor({ ...formConductor, externo: e.target.checked })}
              className="rounded text-brand-600"
            />
            <label htmlFor="externo" className="text-sm font-medium text-slate-700">
              Es Chofer Externo (Transportista subcontratado)
            </label>
          </div>
          {formConductor.externo && (
            <Input
              label="Empresa Externa"
              value={formConductor.empresa_externa}
              onChange={(e) => setFormConductor({ ...formConductor, empresa_externa: e.target.value })}
            />
          )}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setModalConductor(false)} type="button">Cancelar</Button>
            <Button variant="primary" type="submit" disabled={guardando}>Guardar Conductor</Button>
          </div>
        </form>
      </Modal>

      {/* Modal Nueva Orden de Viaje */}
      <Modal abierto={modalViaje} alCerrar={() => setModalViaje(false)} titulo="Nueva Orden de Ruta / Viaje">
        <form onSubmit={guardarViaje} className="space-y-4">
          <Select
            label="Conductor Asignado"
            value={formViaje.conductor_id}
            onChange={(e) => {
              const chofer = conductores.find((c) => c.id === e.target.value);
              setFormViaje({
                ...formViaje,
                conductor_id: e.target.value,
                tarifa_usd: chofer ? chofer.tarifa_viaje_usd : formViaje.tarifa_usd,
              });
            }}
          >
            <option value="">-- Seleccionar chofer --</option>
            {conductores.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre} {c.apellido} ({c.externo ? 'Externo' : 'Propio'})</option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Origen *"
              placeholder="Ej: Planta Principal"
              value={formViaje.origen}
              onChange={(e) => setFormViaje({ ...formViaje, origen: e.target.value })}
              required
            />
            <Input
              label="Destino *"
              placeholder="Ej: Puerto Ordaz"
              value={formViaje.destino}
              onChange={(e) => setFormViaje({ ...formViaje, destino: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Cliente / Destinatario"
              value={formViaje.cliente}
              onChange={(e) => setFormViaje({ ...formViaje, cliente: e.target.value })}
            />
            <Input
              type="date"
              label="Fecha Salida"
              value={formViaje.fecha_salida}
              onChange={(e) => setFormViaje({ ...formViaje, fecha_salida: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Categoría de Viaje"
              value={formViaje.categoria_viaje}
              onChange={(e) => setFormViaje({ ...formViaje, categoria_viaje: e.target.value })}
            >
              <option value="VIAJE CORTO">VIAJE CORTO</option>
              <option value="VIAJE LARGO">VIAJE LARGO</option>
              <option value="VIAJE INTERNO">VIAJE INTERNO</option>
            </Select>
            <Input
              type="number"
              label="Tarifa USD"
              value={formViaje.tarifa_usd}
              onChange={(e) => setFormViaje({ ...formViaje, tarifa_usd: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setModalViaje(false)} type="button">Cancelar</Button>
            <Button variant="primary" type="submit" disabled={guardando}>Crear Orden de Viaje</Button>
          </div>
        </form>
      </Modal>

      {/* Modal Nuevo Viático */}
      <Modal abierto={modalViatico} alCerrar={() => setModalViatico(false)} titulo="Registrar Viático en Ruta">
        <form onSubmit={guardarViatico} className="space-y-4">
          <Select
            label="Conductor *"
            value={formViatico.conductor_id}
            onChange={(e) => setFormViatico({ ...formViatico, conductor_id: e.target.value })}
            required
          >
            <option value="">-- Seleccionar chofer --</option>
            {conductores.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre} {c.apellido}</option>
            ))}
          </Select>
          <Input
            label="Concepto *"
            placeholder="Ej: Combustible en ruta / Peajes"
            value={formViatico.concepto}
            onChange={(e) => setFormViatico({ ...formViatico, concepto: e.target.value })}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              type="number"
              label="Monto (USD) *"
              value={formViatico.monto_usd}
              onChange={(e) => setFormViatico({ ...formViatico, monto_usd: e.target.value })}
              required
            />
            <Select
              label="Tipo"
              value={formViatico.tipo}
              onChange={(e) => setFormViatico({ ...formViatico, tipo: e.target.value })}
            >
              <option value="anticipo">Anticipo</option>
              <option value="gasto">Gasto Realizado</option>
              <option value="reembolso">Reembolso</option>
              <option value="devolucion">Devolución</option>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setModalViatico(false)} type="button">Cancelar</Button>
            <Button variant="primary" type="submit" disabled={guardando}>Registrar Viático</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
