import ReporteModulo from "../components/ReporteModulo.jsx";
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  Car,
  CheckCircle2,
  Clock,
  Compass,
  FileBadge,
  FileCheck2,
  FileText,
  Gauge,
  MapPin,
  Navigation,
  Plus,
  Route,
  Search,
  ShieldAlert,
  Tag,
  Truck,
  User,
  Users,
} from 'lucide-react';
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
import DataTable from '../components/DataTable.jsx';
import { api } from '../lib/api.js';
import { formatoDinero, formatoFecha } from '../lib/data.js';

const PESTANAS = [
  { id: 'tablero', label: 'Tablero', icon: Gauge, desc: 'Estado general' },
  { id: 'conductores', label: 'Expedientes', icon: Users, desc: 'Conductores y licencias' },
  { id: 'viajes', label: 'Rutas y Viajes', icon: Route, desc: 'Órdenes de ruta VJ' },
  { id: 'viaticos', label: 'Viáticos', icon: Banknote, desc: 'Gastos y anticipos' },
  { id: 'pagos', label: 'Pagos / Recibos', icon: FileCheck2, desc: 'Recibos RV y liquidación' },
  { id: 'flota', label: 'Flota Vehicular', icon: Truck, desc: 'Unidades y mantenimiento' },
  { id: 'clasificaciones', label: 'Tarifas', icon: Tag, desc: 'Clasificaciones de viaje' },
];

export default function Choferes() {
  const toast = useToast();
  const [pestanaActiva, setPestanaActiva] = useState('tablero');
  const [conductores, setConductores] = useState([]);
  const [viajes, setViajes] = useState([]);
  const [viaticos, setViaticos] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [flota, setFlota] = useState([]);
  const [clasificaciones, setClasificaciones] = useState([]);
  const [personal, setPersonal] = useState([]);
  const [cargando, setCargando] = useState(true);

  // Modales
  const [modalConductorAbierto, setModalConductorAbierto] = useState(false);
  const [formConductor, setFormConductor] = useState({
    personal_id: '',
    licencia_grado: '5to Grado',
    licencia_numero: '',
    licencia_vence: '',
    certificado_medico_vence: '',
    tarifa_viaje_usd: 25,
    vehiculo_asignado_id: '',
    observaciones: '',
  });

  const [modalViajeAbierto, setModalViajeAbierto] = useState(false);
  const [formViaje, setFormViaje] = useState({
    chofer_id: '',
    vehiculo_id: '',
    origen: 'Base Operaciones Guayana',
    destino: '',
    carga: 'Custodia / Material Logístico',
    categoria_viaje: 'VIAJE CORTO',
    tarifa_usd: 25,
    km_salida: '',
    nota: '',
  });

  const [modalViaticoAbierto, setModalViaticoAbierto] = useState(false);
  const [formViatico, setFormViatico] = useState({
    chofer_id: '',
    viaje_id: '',
    tipo: 'anticipo',
    concepto: 'Combustible y peaje en ruta',
    monto_usd: 30,
    moneda: 'USD',
  });

  const [modalFlotaAbierto, setModalFlotaAbierto] = useState(false);
  const [formFlota, setFormFlota] = useState({
    placa: '',
    alias: '',
    tipo: 'camioneta',
    marca: 'Toyota',
    modelo: 'Hilux',
    anio: 2023,
    color: 'Negro',
    estado_flota: 'operativo',
  });

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    try {
      const [resCond, resViajes, resViaticos, resPagos, resFlota, resClasif, resPersonal] =
        await Promise.all([
          api.listarConductores(),
          api.listarViajes(),
          api.listarViaticos(),
          api.listarPagosChoferes(),
          api.listarFlota(),
          api.listarClasificacionesViaje(),
          api.listarPersonal({ activo: 'true' }),
        ]);
      setConductores(resCond || []);
      setViajes(resViajes || []);
      setViaticos(resViaticos || []);
      setPagos(resPagos || []);
      setFlota(resFlota || []);
      setClasificaciones(resClasif || []);
      setPersonal(resPersonal || []);
    } catch (err) {
      toast.error('Error al cargar datos de choferes: ' + (err.message || 'Error'));
    } finally {
      setCargando(false);
    }
  }, [toast]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // Handlers
  const handleGuardarConductor = async (e) => {
    e.preventDefault();
    try {
      await api.crearConductor(formConductor);
      toast.success('Expediente de chofer registrado');
      setModalConductorAbierto(false);
      cargarDatos();
    } catch (err) {
      toast.error(err.message || 'Error al guardar chofer');
    }
  };

  const handleGuardarViaje = async (e) => {
    e.preventDefault();
    try {
      await api.crearViaje(formViaje);
      toast.success('Orden de viaje / ruta programada (VJ)');
      setModalViajeAbierto(false);
      cargarDatos();
    } catch (err) {
      toast.error(err.message || 'Error al programar viaje');
    }
  };

  const handleCambiarEstadoViaje = async (id, estado, kmLlegada = null) => {
    try {
      await api.cambiarEstadoViaje(id, { estado, km_llegada: kmLlegada });
      toast.success(`Viaje actualizado a estado: ${estado}`);
      cargarDatos();
    } catch (err) {
      toast.error(err.message || 'Error al actualizar viaje');
    }
  };

  const handleGuardarViatico = async (e) => {
    e.preventDefault();
    try {
      await api.crearViatico(formViatico);
      toast.success('Viático / Anticipo de ruta registrado');
      setModalViaticoAbierto(false);
      cargarDatos();
    } catch (err) {
      toast.error(err.message || 'Error al registrar viático');
    }
  };

  const handleGuardarFlota = async (e) => {
    e.preventDefault();
    try {
      await api.crearFlota(formFlota);
      toast.success('Vehículo registrado en la flota');
      setModalFlotaAbierto(false);
      cargarDatos();
    } catch (err) {
      toast.error(err.message || 'Error al registrar unidad');
    }
  };

  // Métricas para Tablero
  const metricas = useMemo(() => {
    const totalChoferes = conductores.length;
    const activos = conductores.filter((c) => c.activo).length;
    const enRuta = viajes.filter((v) => v.estado === 'en_ruta').length;
    const finalizados = viajes.filter((v) => v.estado === 'finalizado').length;
    const unidadesOperativas = flota.filter((f) => f.estado_flota === 'operativo').length;
    return { totalChoferes, activos, enRuta, finalizados, unidadesOperativas };
  }, [conductores, viajes, flota]);

  return (
    <div className="space-y-6">
      <ReporteModulo titulo="Choferes y viajes" archivo="choferes" columnas={["Origen","Destino","Salida","Estado"]}
        filas={viajes.map((r) => [r.origen, r.destino, r.fecha_salida, r.estado])} deshabilitado={cargando} />
      {/* Encabezado */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">Choferes y Flota Vehicular</h1>
          <p className="mt-1 text-sm text-slate-400">
            Control de expedientes de conductores, órdenes de ruta VJ, viáticos, recibos de viaje RV y flota estilo GT.
          </p>
        </div>

        {pestanaActiva === 'conductores' && (
          <Button variant="primary" leftIcon={Plus} onClick={() => setModalConductorAbierto(true)}>
            Nuevo Expediente
          </Button>
        )}
        {pestanaActiva === 'viajes' && (
          <Button variant="primary" leftIcon={Plus} onClick={() => setModalViajeAbierto(true)}>
            Programar Viaje
          </Button>
        )}
        {pestanaActiva === 'viaticos' && (
          <Button variant="primary" leftIcon={Plus} onClick={() => setModalViaticoAbierto(true)}>
            Registrar Viático
          </Button>
        )}
        {pestanaActiva === 'flota' && (
          <Button variant="primary" leftIcon={Plus} onClick={() => setModalFlotaAbierto(true)}>
            Nueva Unidad
          </Button>
        )}
      </div>

      {/* Navegación por pestañas */}
      <div className="flex flex-wrap gap-2 border-b border-slate-700/60 pb-3">
        {PESTANAS.map((pestana) => {
          const Icon = pestana.icon;
          const activa = pestanaActiva === pestana.id;
          return (
            <button
              key={pestana.id}
              type="button"
              onClick={() => setPestanaActiva(pestana.id)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                activa
                  ? 'bg-brand-600 text-white shadow-md'
                  : 'bg-slate-800/60 text-slate-300 hover:bg-slate-700/60 hover:text-slate-100'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{pestana.label}</span>
            </button>
          );
        })}
      </div>

      {/* PESTAÑA 1: TABLERO */}
      {pestanaActiva === 'tablero' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card className="space-y-2">
              <span className="text-xs uppercase font-medium text-slate-400">Choferes Registrados</span>
              <p className="text-2xl font-bold text-slate-100">{metricas.totalChoferes}</p>
              <p className="text-xs text-slate-400">{metricas.activos} en servicio activo</p>
            </Card>
            <Card className="space-y-2">
              <span className="text-xs uppercase font-medium text-slate-400">Viajes en Ruta Hoy</span>
              <p className="text-2xl font-bold text-amber-400">{metricas.enRuta}</p>
              <p className="text-xs text-slate-400">En tránsito activo</p>
            </Card>
            <Card className="space-y-2">
              <span className="text-xs uppercase font-medium text-slate-400">Viajes Completados</span>
              <p className="text-2xl font-bold text-emerald-400">{metricas.finalizados}</p>
              <p className="text-xs text-slate-400">Listos para liquidación</p>
            </Card>
            <Card className="space-y-2">
              <span className="text-xs uppercase font-medium text-slate-400">Flota Operativa</span>
              <p className="text-2xl font-bold text-slate-100">{metricas.unidadesOperativas} / {flota.length}</p>
              <p className="text-xs text-slate-400">Vehículos disponibles</p>
            </Card>
            <Card className="space-y-2">
              <span className="text-xs uppercase font-medium text-slate-400">Recibos de Pago RV</span>
              <p className="text-2xl font-bold text-brand-400">{pagos.length}</p>
              <p className="text-xs text-slate-400">Generados en el sistema</p>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-100">Últimos Viajes Registrados</h2>
                <span className="text-xs text-slate-400">Órdenes VJ</span>
              </div>
              <div className="space-y-2">
                {viajes.slice(0, 5).map((v) => (
                  <div key={v.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-800/40 border border-slate-700/60">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-brand-400">{v.numero || 'VJ-PROG'}</span>
                        <span className="font-medium text-sm text-slate-200">{v.origen} → {v.destino}</span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        Chofer: {v.chofer?.personal?.nombre} {v.chofer?.personal?.apellido} · {formatoFecha(v.fecha_salida)}
                      </div>
                    </div>
                    <Badge tone={v.estado === 'en_ruta' ? 'amarillo' : v.estado === 'finalizado' ? 'verde' : 'azul'}>
                      {v.estado}
                    </Badge>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-100">Estado de la Flota</h2>
                <span className="text-xs text-slate-400">Unidades asignables</span>
              </div>
              <div className="space-y-2">
                {flota.slice(0, 5).map((f) => (
                  <div key={f.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-800/40 border border-slate-700/60">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-brand-950/60 border border-brand-800/40 text-brand-400">
                        <Car className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-semibold text-sm text-slate-100">{f.marca} {f.modelo} ({f.alias || f.placa})</div>
                        <div className="text-xs text-slate-400 font-mono">Placa: {f.placa} · Color: {f.color || 'N/A'}</div>
                      </div>
                    </div>
                    <Badge tone={f.estado_flota === 'operativo' ? 'verde' : 'rojo'}>
                      {f.estado_flota}
                    </Badge>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* PESTAÑA 2: CONDUCTORES */}
      {pestanaActiva === 'conductores' && (
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-100">Padrón de Conductores y Expedientes</h2>
            <div className="text-xs text-slate-400">Vinculados a la ficha de personal</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-800/80 text-xs uppercase text-slate-400 border-b border-slate-700">
                <tr>
                  <th className="py-3 px-4">Conductor</th>
                  <th className="py-3 px-4">Licencia</th>
                  <th className="py-3 px-4">Vencimiento Licencia</th>
                  <th className="py-3 px-4">Certificado Médico</th>
                  <th className="py-3 px-4">Tarifa por Viaje</th>
                  <th className="py-3 px-4">Unidad Asignada</th>
                  <th className="py-3 px-4">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {conductores.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No hay expedientes de chofer registrados.
                    </td>
                  </tr>
                ) : (
                  conductores.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-semibold text-slate-100">
                        {c.personal?.nombre} {c.personal?.apellido}
                        <div className="text-xs font-normal text-slate-400">
                          Ficha: {c.personal?.ficha_nro || 'S/F'} · Tel: {c.personal?.telefono || 'N/A'}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono text-xs bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                          {c.licencia_grado || '5to'} · Nº {c.licencia_numero || 'S/N'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs font-mono">
                        {formatoFecha(c.licencia_vence) || 'Sin registrar'}
                      </td>
                      <td className="py-3 px-4 text-xs font-mono">
                        {formatoFecha(c.certificado_medico_vence) || 'Sin registrar'}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                        {formatoDinero(c.tarifa_viaje_usd)} USD
                      </td>
                      <td className="py-3 px-4 text-xs">
                        {c.vehiculo ? `${c.vehiculo.marca} ${c.vehiculo.modelo} (${c.vehiculo.placa})` : 'Sin asignar'}
                      </td>
                      <td className="py-3 px-4">
                        <Badge tone={c.activo ? 'verde' : 'gris'}>
                          {c.activo ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* PESTAÑA 3: RUTAS Y VIAJES */}
      {pestanaActiva === 'viajes' && (
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-100">Órdenes de Ruta y Viajes (VJ)</h2>
            <div className="text-xs text-slate-400">Control de kilometraje y salidas</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-800/80 text-xs uppercase text-slate-400 border-b border-slate-700">
                <tr>
                  <th className="py-3 px-4">Nº Orden</th>
                  <th className="py-3 px-4">Conductor</th>
                  <th className="py-3 px-4">Ruta (Origen → Destino)</th>
                  <th className="py-3 px-4">Clasificación / Tarifa</th>
                  <th className="py-3 px-4">Salida</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {viajes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No hay órdenes de viaje registradas.
                    </td>
                  </tr>
                ) : (
                  viajes.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-mono font-bold text-brand-400">
                        {v.numero || 'VJ-PROG'}
                      </td>
                      <td className="py-3 px-4 text-slate-200">
                        {v.chofer?.personal?.nombre} {v.chofer?.personal?.apellido}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-100">
                        {v.origen} → {v.destino}
                      </td>
                      <td className="py-3 px-4 font-mono text-emerald-400 font-semibold">
                        {v.categoria_viaje} (${formatoDinero(v.tarifa_usd)})
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-400 font-mono">
                        {formatoFecha(v.fecha_salida)}
                      </td>
                      <td className="py-3 px-4">
                        <Badge tone={v.estado === 'en_ruta' ? 'amarillo' : v.estado === 'finalizado' ? 'verde' : 'azul'}>
                          {v.estado}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          {v.estado === 'programado' && (
                            <Button size="sm" variant="outline" onClick={() => handleCambiarEstadoViaje(v.id, 'en_ruta')}>
                              Iniciar Ruta
                            </Button>
                          )}
                          {v.estado === 'en_ruta' && (
                            <Button size="sm" variant="primary" onClick={() => handleCambiarEstadoViaje(v.id, 'finalizado')}>
                              Finalizar
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* PESTAÑA 4: VIÁTICOS */}
      {pestanaActiva === 'viaticos' && (
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-100">Viáticos y Gastos en Ruta</h2>
            <div className="text-xs text-slate-400">Anticipos de caja chica y rendición de cuentas</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-800/80 text-xs uppercase text-slate-400 border-b border-slate-700">
                <tr>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Chofer</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Concepto</th>
                  <th className="py-3 px-4">Monto USD</th>
                  <th className="py-3 px-4">Moneda / Tasa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {viaticos.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No hay viáticos registrados.
                    </td>
                  </tr>
                ) : (
                  viaticos.map((vt) => (
                    <tr key={vt.id} className="hover:bg-slate-800/40">
                      <td className="py-3 px-4 text-xs font-mono">{formatoFecha(vt.fecha)}</td>
                      <td className="py-3 px-4 font-medium text-slate-200">
                        {vt.chofer?.personal?.nombre} {vt.chofer?.personal?.apellido}
                      </td>
                      <td className="py-3 px-4 capitalize font-semibold text-brand-400">{vt.tipo}</td>
                      <td className="py-3 px-4 text-slate-300">{vt.concepto}</td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                        {formatoDinero(vt.monto_usd)} USD
                      </td>
                      <td className="py-3 px-4 text-xs font-mono text-slate-400">
                        {vt.moneda} {vt.tasa ? `(Tasa: ${vt.tasa})` : ''}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* PESTAÑA 5: PAGOS / RECIBOS */}
      {pestanaActiva === 'pagos' && (
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-100">Recibos de Pago por Viajes (RV)</h2>
            <div className="text-xs text-slate-400">Liquidación de viajes y saldo de viáticos</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-800/80 text-xs uppercase text-slate-400 border-b border-slate-700">
                <tr>
                  <th className="py-3 px-4">Nº Recibo</th>
                  <th className="py-3 px-4">Conductor</th>
                  <th className="py-3 px-4">Tarifas USD</th>
                  <th className="py-3 px-4">Reembolsos</th>
                  <th className="py-3 px-4">Deducciones</th>
                  <th className="py-3 px-4">Neto a Pagar</th>
                  <th className="py-3 px-4">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {pagos.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No hay recibos de pago generados.
                    </td>
                  </tr>
                ) : (
                  pagos.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-mono font-bold text-brand-400">{p.numero || 'RV-PROG'}</td>
                      <td className="py-3 px-4 font-medium text-slate-200">
                        {p.chofer?.personal?.nombre} {p.chofer?.personal?.apellido}
                      </td>
                      <td className="py-3 px-4 font-mono">{formatoDinero(p.tarifas_usd)} USD</td>
                      <td className="py-3 px-4 font-mono text-emerald-400">+{formatoDinero(p.reembolsos_usd)}</td>
                      <td className="py-3 px-4 font-mono text-rose-400">-{formatoDinero(p.deducciones_usd)}</td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-100">
                        {formatoDinero(p.neto_usd)} USD {p.neto_bs ? `(${formatoDinero(p.neto_bs)} Bs)` : ''}
                      </td>
                      <td className="py-3 px-4">
                        <Badge tone={p.estado === 'pagado' ? 'verde' : 'amarillo'}>
                          {p.estado}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* PESTAÑA 6: FLOTA */}
      {pestanaActiva === 'flota' && (
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-100">Catálogo de Flota Vehicular</h2>
            <div className="text-xs text-slate-400">Camionetas blindadas, camiones y vans</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-800/80 text-xs uppercase text-slate-400 border-b border-slate-700">
                <tr>
                  <th className="py-3 px-4">Placa</th>
                  <th className="py-3 px-4">Alias / Unidad</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Marca y Modelo</th>
                  <th className="py-3 px-4">Año</th>
                  <th className="py-3 px-4">Color</th>
                  <th className="py-3 px-4">Estado Flota</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {flota.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-mono font-bold text-brand-400">{f.placa}</td>
                    <td className="py-3 px-4 font-semibold text-slate-100">{f.alias || '—'}</td>
                    <td className="py-3 px-4 capitalize">{f.tipo}</td>
                    <td className="py-3 px-4 text-slate-200">{f.marca} {f.modelo}</td>
                    <td className="py-3 px-4 font-mono">{f.anio || '—'}</td>
                    <td className="py-3 px-4 text-slate-400">{f.color || '—'}</td>
                    <td className="py-3 px-4">
                      <Badge tone={f.estado_flota === 'operativo' ? 'verde' : 'rojo'}>
                        {f.estado_flota}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* PESTAÑA 7: TARIFAS Y CLASIFICACIONES */}
      {pestanaActiva === 'clasificaciones' && (
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-100">Clasificaciones de Viaje y Tarifas Base</h2>
            <div className="text-xs text-slate-400">Tarifas por defecto según destino o naturaleza</div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {clasificaciones.map((cl) => (
              <div key={cl.id} className="p-4 rounded-xl border border-slate-700/60 bg-slate-800/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-2xl">{cl.icono}</span>
                  <span className="font-mono text-lg font-bold text-emerald-400">${formatoDinero(cl.tarifa_usd)}</span>
                </div>
                <h3 className="font-bold text-slate-100 text-sm">{cl.nombre}</h3>
                <p className="font-mono text-xs text-brand-400">{cl.clave}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* MODAL CONDUCTOR */}
      <Modal abierto={modalConductorAbierto} alCerrar={() => setModalConductorAbierto(false)} titulo="Nuevo Expediente de Chofer">
        <form onSubmit={handleGuardarConductor} className="space-y-4 text-slate-200">
          <Select
            label="Personal de la Empresa"
            required
            value={formConductor.personal_id}
            onChange={(e) => setFormConductor({ ...formConductor, personal_id: e.target.value })}
            options={[
              { value: '', label: 'Seleccionar trabajador de personal...' },
              ...personal.map((p) => ({
                value: p.id,
                label: `${p.nombre} ${p.apellido} (${p.ficha_nro || p.cedula || 'S/F'})`,
              })),
            ]}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Grado de Licencia"
              value={formConductor.licencia_grado}
              onChange={(e) => setFormConductor({ ...formConductor, licencia_grado: e.target.value })}
            />
            <Input
              label="Nº de Licencia"
              value={formConductor.licencia_numero}
              onChange={(e) => setFormConductor({ ...formConductor, licencia_numero: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Vencimiento Licencia"
              type="date"
              value={formConductor.licencia_vence}
              onChange={(e) => setFormConductor({ ...formConductor, licencia_vence: e.target.value })}
            />
            <Input
              label="Vencimiento Certificado Médico"
              type="date"
              value={formConductor.certificado_medico_vence}
              onChange={(e) => setFormConductor({ ...formConductor, certificado_medico_vence: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Tarifa Base por Viaje (USD)"
              type="number"
              step="0.01"
              value={formConductor.tarifa_viaje_usd}
              onChange={(e) => setFormConductor({ ...formConductor, tarifa_viaje_usd: Number(e.target.value) })}
            />
            <Select
              label="Unidad Vehicular Asignada"
              value={formConductor.vehiculo_asignado_id}
              onChange={(e) => setFormConductor({ ...formConductor, vehiculo_asignado_id: e.target.value })}
              options={[
                { value: '', label: 'Ninguna por defecto' },
                ...flota.map((f) => ({
                  value: f.id,
                  label: `${f.marca} ${f.modelo} (${f.placa})`,
                })),
              ]}
            />
          </div>
          <Input
            label="Observaciones"
            value={formConductor.observaciones}
            onChange={(e) => setFormConductor({ ...formConductor, observaciones: e.target.value })}
          />
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" type="button" onClick={() => setModalConductorAbierto(false)}>Cancelar</Button>
            <Button variant="primary" type="submit">Guardar Expediente</Button>
          </div>
        </form>
      </Modal>

      {/* MODAL VIAJE */}
      <Modal abierto={modalViajeAbierto} alCerrar={() => setModalViajeAbierto(false)} titulo="Programar Orden de Ruta / Viaje (VJ)">
        <form onSubmit={handleGuardarViaje} className="space-y-4 text-slate-200">
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Conductor Asignado"
              required
              value={formViaje.chofer_id}
              onChange={(e) => setFormViaje({ ...formViaje, chofer_id: e.target.value })}
              options={[
                { value: '', label: 'Seleccionar chofer...' },
                ...conductores.map((c) => ({
                  value: c.id,
                  label: `${c.personal?.nombre} ${c.personal?.apellido}`,
                })),
              ]}
            />
            <Select
              label="Vehículo / Unidad"
              value={formViaje.vehiculo_id}
              onChange={(e) => setFormViaje({ ...formViaje, vehiculo_id: e.target.value })}
              options={[
                { value: '', label: 'Seleccionar vehículo...' },
                ...flota.map((f) => ({
                  value: f.id,
                  label: `${f.marca} ${f.modelo} (${f.placa})`,
                })),
              ]}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Punto de Origen"
              required
              value={formViaje.origen}
              onChange={(e) => setFormViaje({ ...formViaje, origen: e.target.value })}
            />
            <Input
              label="Punto de Destino"
              required
              placeholder="Minas El Callao / Puerto Ordaz..."
              value={formViaje.destino}
              onChange={(e) => setFormViaje({ ...formViaje, destino: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Clasificación de Viaje"
              value={formViaje.categoria_viaje}
              onChange={(e) => {
                const sel = clasificaciones.find((c) => c.clave === e.target.value);
                setFormViaje({
                  ...formViaje,
                  categoria_viaje: e.target.value,
                  tarifa_usd: sel ? sel.tarifa_usd : formViaje.tarifa_usd,
                });
              }}
              options={clasificaciones.map((c) => ({ value: c.clave, label: `${c.nombre} ($${c.tarifa_usd})` }))}
            />
            <Input
              label="Tarifa del Viaje (USD)"
              type="number"
              step="0.01"
              value={formViaje.tarifa_usd}
              onChange={(e) => setFormViaje({ ...formViaje, tarifa_usd: Number(e.target.value) })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Descripción de Carga / Custodia"
              value={formViaje.carga}
              onChange={(e) => setFormViaje({ ...formViaje, carga: e.target.value })}
            />
            <Input
              label="Kilometraje Salida"
              type="number"
              value={formViaje.km_salida}
              onChange={(e) => setFormViaje({ ...formViaje, km_salida: e.target.value })}
            />
          </div>
          <Input
            label="Notas Adicionales"
            value={formViaje.nota}
            onChange={(e) => setFormViaje({ ...formViaje, nota: e.target.value })}
          />
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" type="button" onClick={() => setModalViajeAbierto(false)}>Cancelar</Button>
            <Button variant="primary" type="submit">Generar Orden VJ</Button>
          </div>
        </form>
      </Modal>

      {/* MODAL VIATICO */}
      <Modal abierto={modalViaticoAbierto} alCerrar={() => setModalViaticoAbierto(false)} titulo="Registrar Viático en Ruta">
        <form onSubmit={handleGuardarViatico} className="space-y-4 text-slate-200">
          <Select
            label="Chofer"
            required
            value={formViatico.chofer_id}
            onChange={(e) => setFormViatico({ ...formViatico, chofer_id: e.target.value })}
            options={[
              { value: '', label: 'Seleccionar chofer...' },
              ...conductores.map((c) => ({
                value: c.id,
                label: `${c.personal?.nombre} ${c.personal?.apellido}`,
              })),
            ]}
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Tipo de Movimiento"
              value={formViatico.tipo}
              onChange={(e) => setFormViatico({ ...formViatico, tipo: e.target.value })}
              options={[
                { value: 'anticipo', label: 'Anticipo' },
                { value: 'gasto', label: 'Gasto en Ruta' },
                { value: 'devolucion', label: 'Devolución' },
              ]}
            />
            <Input
              label="Monto (USD)"
              type="number"
              step="0.01"
              required
              value={formViatico.monto_usd}
              onChange={(e) => setFormViatico({ ...formViatico, monto_usd: Number(e.target.value) })}
            />
          </div>
          <Input
            label="Concepto"
            required
            value={formViatico.concepto}
            onChange={(e) => setFormViatico({ ...formViatico, concepto: e.target.value })}
          />
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" type="button" onClick={() => setModalViaticoAbierto(false)}>Cancelar</Button>
            <Button variant="primary" type="submit">Guardar Viático</Button>
          </div>
        </form>
      </Modal>

      {/* MODAL FLOTA */}
      <Modal abierto={modalFlotaAbierto} alCerrar={() => setModalFlotaAbierto(false)} titulo="Nueva Unidad de la Flota">
        <form onSubmit={handleGuardarFlota} className="space-y-4 text-slate-200">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Placa del Vehículo"
              required
              placeholder="A12BC3D"
              value={formFlota.placa}
              onChange={(e) => setFormFlota({ ...formFlota, placa: e.target.value.toUpperCase() })}
            />
            <Input
              label="Alias / Nombre Código"
              placeholder="UNIDAD-06"
              value={formFlota.alias}
              onChange={(e) => setFormFlota({ ...formFlota, alias: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Select
              label="Tipo"
              value={formFlota.tipo}
              onChange={(e) => setFormFlota({ ...formFlota, tipo: e.target.value })}
              options={[
                { value: 'camioneta', label: 'Camioneta 4x4' },
                { value: 'camion', label: 'Camión' },
                { value: 'van', label: 'Van / Buseta' },
                { value: 'automovil', label: 'Automóvil' },
                { value: 'moto', label: 'Moto' },
              ]}
            />
            <Input
              label="Marca"
              value={formFlota.marca}
              onChange={(e) => setFormFlota({ ...formFlota, marca: e.target.value })}
            />
            <Input
              label="Modelo"
              value={formFlota.modelo}
              onChange={(e) => setFormFlota({ ...formFlota, modelo: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Año"
              type="number"
              value={formFlota.anio}
              onChange={(e) => setFormFlota({ ...formFlota, anio: e.target.value })}
            />
            <Input
              label="Color"
              value={formFlota.color}
              onChange={(e) => setFormFlota({ ...formFlota, color: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" type="button" onClick={() => setModalFlotaAbierto(false)}>Cancelar</Button>
            <Button variant="primary" type="submit">Registrar Unidad</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
