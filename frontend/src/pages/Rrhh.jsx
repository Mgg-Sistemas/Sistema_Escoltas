import ReporteModulo from "../components/ReporteModulo.jsx";
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  Briefcase,
  Building2,
  Calendar,
  Clock,
  Coins,
  Download,
  FileSpreadsheet,
  FileText,
  History,
  Layers,
  Plus,
  QrCode,
  Search,
  TrendingUp,
  UserCheck,
  UserPlus,
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
  { id: 'personal', label: 'Personal', icon: Users, desc: 'Fichas y expedientes' },
  { id: 'anticipos', label: 'Anticipos / Préstamos', icon: Banknote, desc: 'Adelantos y cuotas' },
  { id: 'nomina', label: 'Nómina', icon: FileSpreadsheet, desc: 'Resumen y periodos' },
  { id: 'descansos', label: 'Descansos / Vacaciones', icon: Calendar, desc: 'Control de días' },
  { id: 'administrativo', label: 'Tabulador y Cargos', icon: Layers, desc: 'Escala y movimientos' },
];

const FORM_PERSONAL_INICIAL = {
  empresa: 'ESC',
  ficha_nro: '',
  nombre: '',
  apellido: '',
  cedula: '',
  rif: '',
  cargo: 'Escolta de Seguridad',
  departamento: 'Operaciones',
  sueldo_base: 350,
  moneda_sueldo: 'USD',
  telefono: '',
  correo: '',
  direccion: '',
  activo: true,
};

export default function Rrhh({ soloPersonal = false }) {
  const toast = useToast();
  const [pestanaRrhh, setPestanaActiva] = useState('anticipos');
  const pestanaActiva = soloPersonal ? 'personal' : pestanaRrhh;
  const [empresaFiltro, setEmpresaFiltro] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [personal, setPersonal] = useState([]);
  const [anticipos, setAnticipos] = useState([]);
  const [exportandoAnticipos, setExportandoAnticipos] = useState(false);
  const [tabulador, setTabulador] = useState([]);
  const [cargando, setCargando] = useState(true);

  // Modales
  const [modalPersonalAbierto, setModalPersonalAbierto] = useState(false);
  const [formPersonal, setFormPersonal] = useState(FORM_PERSONAL_INICIAL);
  const [editandoPersonalId, setEditandoPersonalId] = useState(null);

  const [modalSueldoAbierto, setModalSueldoAbierto] = useState(false);
  const [sueldoTarget, setSueldoTarget] = useState(null);
  const [formSueldo, setFormSueldo] = useState({ nuevo_sueldo: '', motivo: '' });

  const [modalAnticipoAbierto, setModalAnticipoAbierto] = useState(false);
  const [formAnticipo, setFormAnticipo] = useState({
    personal_id: '',
    tipo: 'anticipo',
    monto_total: '',
    cuotas: 1,
    motivo: '',
  });

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    try {
      if (soloPersonal) {
        const fichas = await api.listarPersonal({ empresa: empresaFiltro || undefined, q: busqueda || undefined });
        setPersonal(fichas || []);
        return;
      }
      const [resPersonal, resAnticipos, resTabulador] = await Promise.all([
        api.listarPersonal({ empresa: empresaFiltro || undefined, q: busqueda || undefined }),
        api.listarAnticipos(),
        api.listarTabulador(),
      ]);
      setPersonal(resPersonal || []);
      setAnticipos(resAnticipos || []);
      setTabulador(resTabulador || []);
    } catch (err) {
      toast.error('Error al cargar datos de RRHH: ' + (err.message || 'Error de conexión'));
    } finally {
      setCargando(false);
    }
  }, [empresaFiltro, busqueda, soloPersonal, toast]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // Manejadores
  const handleGuardarPersonal = async (e) => {
    e.preventDefault();
    try {
      if (editandoPersonalId) {
        await api.actualizarPersonal(editandoPersonalId, formPersonal);
        toast.success('Ficha de personal actualizada');
      } else {
        await api.crearPersonal(formPersonal);
        toast.success('Nueva ficha de personal creada');
      }
      setModalPersonalAbierto(false);
      setEditandoPersonalId(null);
      setFormPersonal(FORM_PERSONAL_INICIAL);
      cargarDatos();
    } catch (err) {
      toast.error(err.message || 'Error al guardar personal');
    }
  };

  const handleCambiarSueldo = async (e) => {
    e.preventDefault();
    if (!sueldoTarget) return;
    try {
      await api.cambiarSueldoPersonal(sueldoTarget.id, formSueldo);
      toast.success('Sueldo actualizado con registro histórico');
      setModalSueldoAbierto(false);
      setSueldoTarget(null);
      setFormSueldo({ nuevo_sueldo: '', motivo: '' });
      cargarDatos();
    } catch (err) {
      toast.error(err.message || 'Error al actualizar sueldo');
    }
  };

  const descargarAnticipos = async (registros, individual = false) => {
    setExportandoAnticipos(true);
    try {
      const { construirAnticiposPdf } = await import('../lib/anticiposPdf.js');
      const porId = new Map(personal.map((persona) => [persona.id, persona]));
      const datos = registros.map((registro) => ({
        ...registro,
        personal: registro.personal ?? porId.get(registro.personal_id),
      }));
      const pdf = await construirAnticiposPdf(datos, { individual });
      pdf.save(individual ? 'escoltas-ficha-anticipo-prestamo.pdf' : 'escoltas-anticipos-prestamos.pdf');
    } catch (error) {
      toast.error(error.message || 'No se pudo preparar el PDF.');
    } finally {
      setExportandoAnticipos(false);
    }
  };

  const handleGuardarAnticipo = async (e) => {
    e.preventDefault();
    try {
      await api.crearAnticipo(formAnticipo);
      toast.success('Anticipo/Préstamo registrado');
      setModalAnticipoAbierto(false);
      setFormAnticipo({ personal_id: '', tipo: 'anticipo', monto_total: '', cuotas: 1, motivo: '' });
      cargarDatos();
    } catch (err) {
      toast.error(err.message || 'Error al registrar anticipo');
    }
  };

  const personalFiltrado = useMemo(() => {
    return personal.filter((p) => {
      if (empresaFiltro && p.empresa !== empresaFiltro) return false;
      if (!busqueda) return true;
      const b = busqueda.toLowerCase();
      return (
        p.nombre?.toLowerCase().includes(b) ||
        p.apellido?.toLowerCase().includes(b) ||
        p.cedula?.toLowerCase().includes(b) ||
        p.ficha_nro?.toLowerCase().includes(b) ||
        p.cargo?.toLowerCase().includes(b)
      );
    });
  }, [personal, empresaFiltro, busqueda]);

  const columnasPersonal = [
    {
      encabezado: 'Ficha / Persona',
      clave: 'persona',
      render: (fila) => (
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold text-brand-400 bg-brand-950/60 px-1.5 py-0.5 rounded border border-brand-800/40">
              {fila.ficha_nro || 'S/F'}
            </span>
            <span className="font-semibold text-slate-100">{fila.nombre} {fila.apellido}</span>
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            C.I: {fila.cedula || 'N/A'} · {fila.empresa || 'ESC'}
          </div>
        </div>
      ),
    },
    {
      encabezado: 'Cargo / Departamento',
      clave: 'cargo',
      render: (fila) => (
        <div>
          <div className="text-sm font-medium text-slate-200">{fila.cargo || 'Sin cargo'}</div>
          <div className="text-xs text-slate-400">{fila.departamento || 'Operaciones'}</div>
        </div>
      ),
    },
    {
      encabezado: 'Sueldo Base',
      clave: 'sueldo',
      render: (fila) => (
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-sm font-semibold text-emerald-400">
            {formatoDinero(fila.sueldo_base || 0)} <span className="text-xs text-slate-400">USD</span>
          </span>
          <button
            type="button"
            onClick={() => {
              setSueldoTarget(fila);
              setFormSueldo({ nuevo_sueldo: fila.sueldo_base || '', motivo: '' });
              setModalSueldoAbierto(true);
            }}
            className="text-xs text-brand-400 hover:text-brand-300 underline font-medium"
          >
            Ajustar
          </button>
        </div>
      ),
    },
    {
      encabezado: 'Contacto',
      clave: 'contacto',
      render: (fila) => (
        <div className="text-xs text-slate-300">
          <div>{fila.telefono || 'Sin teléfono'}</div>
          <div className="text-slate-400 truncate max-w-[150px]">{fila.correo || '—'}</div>
        </div>
      ),
    },
    {
      encabezado: 'Estado',
      clave: 'estado',
      render: (fila) => (
        <Badge tone={fila.activo ? 'verde' : 'gris'}>
          {fila.activo ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
    {
      encabezado: 'Acciones',
      clave: 'acciones',
      render: (fila) => (
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setEditandoPersonalId(fila.id);
              setFormPersonal({ ...FORM_PERSONAL_INICIAL, ...fila });
              setModalPersonalAbierto(true);
            }}
          >
            Editar
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {soloPersonal ? (
        <ReporteModulo titulo="Fichas administrativas" archivo="fichas-administrativas"
          columnas={['Ficha', 'Nombre', 'Cargo', 'Estado']}
          filas={personalFiltrado.map((r) => [r.ficha_nro, [r.nombre, r.apellido].filter(Boolean).join(' '), r.cargo, r.activo ? 'Activo' : 'Inactivo'])} deshabilitado={cargando} />
      ) : pestanaActiva === 'anticipos' ? (
        <ReporteModulo titulo="Anticipos y préstamos" archivo="anticipos-prestamos"
          columnas={['Personal', 'Tipo', 'Moneda', 'Otorgado', 'Cuotas', 'Saldo', 'Estado']}
          filas={anticipos.map((r) => {
            const persona = r.personal ?? personal.find((p) => p.id === r.personal_id);
            return [[persona?.nombre, persona?.apellido].filter(Boolean).join(' '), r.tipo, r.moneda ?? 'USD',
              Number(r.monto_total), Number(r.cuotas), r.saldo_pendiente == null ? null : Number(r.saldo_pendiente), r.estado];
          })}
          pdfPersonalizado={() => descargarAnticipos(anticipos)} deshabilitado={cargando} />
      ) : (
        <ReporteModulo titulo="Recursos humanos" archivo="rrhh"
          columnas={['Ficha', 'Nombre', 'Estado']}
          filas={personalFiltrado.map((r) => [r.ficha_nro, [r.nombre, r.apellido].filter(Boolean).join(' '), r.activo ? 'Activo' : 'Inactivo'])}
          deshabilitado={cargando} />
      )}
      {/* Encabezado */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">{soloPersonal ? "Fichas administrativas" : "Recursos Humanos"}</h1>
        </div>

        {pestanaActiva === 'personal' && (
          <Button
            variant="primary"
            leftIcon={UserPlus}
            onClick={() => {
              setEditandoPersonalId(null);
              setFormPersonal(FORM_PERSONAL_INICIAL);
              setModalPersonalAbierto(true);
            }}
          >
            Nuevo Personal
          </Button>
        )}
        {pestanaActiva === 'anticipos' && (
          <Button
            variant="primary"
            leftIcon={Plus}
            onClick={() => setModalAnticipoAbierto(true)}
          >
            Registrar Anticipo
          </Button>
        )}
      </div>

      {!soloPersonal && <div className="flex flex-wrap gap-2 border-b border-slate-700/60 pb-3">
        {PESTANAS.filter(({ id }) => id !== "personal").map((pestana) => {
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
      </div>}

      {/* Fichas administrativas, desde Personal */}
      {pestanaActiva === 'personal' && (
        <Card bodyClassName="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
            <div className="relative w-full sm:max-w-lg">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <Input
                type="search"
                aria-label="Buscar fichas administrativas"
                className="pl-10"
                placeholder="Nombre, cédula, ficha o cargo"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
            <div className="w-full sm:w-auto sm:shrink-0">
              <Select
                aria-label="Filtrar por empresa"
                value={empresaFiltro}
                onChange={(e) => setEmpresaFiltro(e.target.value)}
                options={[
                  { value: '', label: 'Todas las empresas' },
                  { value: 'ESC', label: 'ESC · Escoltas' },
                  { value: 'GT', label: 'GT · Golden Touch' },
                  { value: 'MTO', label: 'MTO · Transporte' },
                ]}
              />
            </div>
          </div>

          <DataTable
            columnas={columnasPersonal}
            filas={personalFiltrado}
            cargando={cargando}
            mensajeVacio="No se encontraron trabajadores en este criterio."
          />
        </Card>
      )}

      {/* PESTAÑA 2: ANTICIPOS Y PRÉSTAMOS */}
      {pestanaActiva === 'anticipos' && (
        <Card bodyClassName="space-y-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-100">Anticipos y préstamos</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-800/80 text-xs uppercase text-slate-400 border-b border-slate-700">
                <tr>
                  <th className="py-3 px-4">Trabajador</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Monto Total</th>
                  <th className="py-3 px-4">Cuotas</th>
                  <th className="py-3 px-4">Saldo Pendiente</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4">PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {anticipos.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No hay anticipos ni préstamos registrados.
                    </td>
                  </tr>
                ) : (
                  anticipos.map((ant) => (
                    <tr key={ant.id} className="hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-medium text-slate-200">
                        {ant.personal?.nombre} {ant.personal?.apellido} ({ant.personal?.ficha_nro || 'S/F'})
                      </td>
                      <td className="py-3 px-4 capitalize">{ant.tipo}</td>
                      <td className="py-3 px-4 font-mono font-semibold text-slate-100">
                        {formatoDinero(ant.monto_total)} USD
                      </td>
                      <td className="py-3 px-4 font-mono">
                        {ant.cuotas} cuota(s) de {formatoDinero(ant.monto_cuota)} USD
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-amber-400">
                        {formatoDinero(ant.saldo_pendiente)} USD
                      </td>
                      <td className="py-3 px-4">
                        <Badge tone={ant.estado === 'activo' ? 'amarillo' : 'verde'}>
                          {ant.estado}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <Button type="button" size="sm" variant="outline" leftIcon={Download}
                          disabled={exportandoAnticipos} onClick={() => descargarAnticipos([ant], true)}>
                          Ficha PDF
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* PESTAÑA 3: NÓMINA */}
      {pestanaActiva === 'nomina' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card bodyClassName="space-y-2">
            <span className="text-xs uppercase font-medium text-slate-400">Plantilla Activa</span>
            <p className="text-2xl font-bold text-slate-100">{personal.filter((p) => p.activo).length}</p>
            <p className="text-xs text-slate-400">Personal en nómina corriente</p>
          </Card>
          <Card bodyClassName="space-y-2">
            <span className="text-xs uppercase font-medium text-slate-400">Total Sueldo Base Mensual</span>
            <p className="text-2xl font-bold text-emerald-400">
              {formatoDinero(personal.filter((p) => p.activo).reduce((sum, p) => sum + (Number(p.sueldo_base) || 0), 0))} USD
            </p>
            <p className="text-xs text-slate-400">Monto global base estimado</p>
          </Card>
          <Card bodyClassName="space-y-2">
            <span className="text-xs uppercase font-medium text-slate-400">Anticipos Activos</span>
            <p className="text-2xl font-bold text-amber-400">
              {formatoDinero(anticipos.filter((a) => a.estado === 'activo').reduce((sum, a) => sum + (Number(a.saldo_pendiente) || 0), 0))} USD
            </p>
            <p className="text-xs text-slate-400">Saldo pendiente por deducir</p>
          </Card>
        </div>
      )}

      {/* PESTAÑA 4: DESCANSOS */}
      {pestanaActiva === 'descansos' && (
        <Card bodyClassName="space-y-4">
          <h2 className="text-lg font-semibold text-slate-100">Control de Descansos y Vacaciones</h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            Módulo homologado con Golden Touch: cálculo automático de 15 días anuales reglamentarios, cómputo de vacaciones acumuladas y programación de descansos por turnos rotativos.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
            <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4">
              <span className="text-xs text-slate-400">Días Reglamentarios</span>
              <p className="text-xl font-bold text-slate-100 mt-1">15 días/año</p>
            </div>
            <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4">
              <span className="text-xs text-slate-400">Tope Rotativo</span>
              <p className="text-xl font-bold text-slate-100 mt-1">2 días libres / semana</p>
            </div>
            <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4">
              <span className="text-xs text-slate-400">En Descanso Hoy</span>
              <p className="text-xl font-bold text-brand-400 mt-1">Operativo</p>
            </div>
            <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4">
              <span className="text-xs text-slate-400">Vacaciones Planificadas</span>
              <p className="text-xl font-bold text-emerald-400 mt-1">Al día</p>
            </div>
          </div>
        </Card>
      )}

      {/* PESTAÑA 5: TABULADOR Y CARGOS */}
      {pestanaActiva === 'administrativo' && (
        <Card bodyClassName="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-100">Tabulador Salarial Vigente</h2>
            <div className="text-xs text-slate-400">Escala de sueldos de referencia</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-800/80 text-xs uppercase text-slate-400 border-b border-slate-700">
                <tr>
                  <th className="py-3 px-4">Cargo</th>
                  <th className="py-3 px-4">Nivel</th>
                  <th className="py-3 px-4">Sueldo Base</th>
                  <th className="py-3 px-4">Vigencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {tabulador.map((tab) => (
                  <tr key={tab.id} className="hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-medium text-slate-200">{tab.cargo}</td>
                    <td className="py-3 px-4 font-mono font-semibold text-brand-400">{tab.nivel}</td>
                    <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                      {formatoDinero(tab.sueldo_base)} {tab.moneda}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-400">{formatoFecha(tab.vigencia_desde)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* MODAL PERSONAL */}
      <Modal
        abierto={modalPersonalAbierto}
        alCerrar={() => setModalPersonalAbierto(false)}
        titulo={editandoPersonalId ? 'Editar Ficha de Personal' : 'Nueva Ficha de Personal'}
      >
        <form onSubmit={handleGuardarPersonal} className="space-y-4 text-slate-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Nombre" formato="nombre"
              required
              value={formPersonal.nombre}
              onChange={(e) => setFormPersonal({ ...formPersonal, nombre: e.target.value })}
            />
            <Input
              label="Apellido" formato="nombre"
              required
              value={formPersonal.apellido}
              onChange={(e) => setFormPersonal({ ...formPersonal, apellido: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Cédula" formato="cedula"
              required
              placeholder="12345678"
              value={formPersonal.cedula}
              onChange={(e) => setFormPersonal({ ...formPersonal, cedula: e.target.value })}
            />
            <Input
              label="Nº Ficha (Código)" maxLength={50}
              placeholder="001 o GT-01"
              value={formPersonal.ficha_nro}
              onChange={(e) => setFormPersonal({ ...formPersonal, ficha_nro: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Empresa"
              value={formPersonal.empresa}
              onChange={(e) => setFormPersonal({ ...formPersonal, empresa: e.target.value })}
              options={[
                { value: 'ESC', label: 'ESC · Escoltas' },
                { value: 'GT', label: 'GT · Golden Touch' },
                { value: 'MTO', label: 'MTO · Transporte' },
              ]}
            />
            <Input
              label="Cargo" maxLength={120}
              value={formPersonal.cargo}
              onChange={(e) => setFormPersonal({ ...formPersonal, cargo: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Sueldo Base Mensual (USD)"
              type="number"
              step="0.01"
              required
              value={formPersonal.sueldo_base}
              onChange={(e) => setFormPersonal({ ...formPersonal, sueldo_base: e.target.value })}
            />
            <Input
              label="Teléfono" type="tel"
              placeholder="+58 412..."
              value={formPersonal.telefono}
              onChange={(e) => setFormPersonal({ ...formPersonal, telefono: e.target.value })}
            />
          </div>

          <Input
            label="Correo Electrónico"
            type="email"
            value={formPersonal.correo}
            onChange={(e) => setFormPersonal({ ...formPersonal, correo: e.target.value })}
          />

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" type="button" onClick={() => setModalPersonalAbierto(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit">
              Guardar Ficha
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL SUELDO */}
      <Modal
        abierto={modalSueldoAbierto}
        alCerrar={() => setModalSueldoAbierto(false)}
        titulo={`Ajuste Salarial · ${sueldoTarget?.nombre} ${sueldoTarget?.apellido}`}
      >
        <form onSubmit={handleCambiarSueldo} className="space-y-4 text-slate-200">
          <p className="text-xs text-slate-400">
            Sueldo actual: <strong className="text-slate-100">{formatoDinero(sueldoTarget?.sueldo_base || 0)} USD</strong>.
            Cada ajuste queda registrado en el histórico auditado.
          </p>
          <Input
            label="Nuevo Sueldo Base Mensual (USD)"
            type="number"
            step="0.01"
            required
            value={formSueldo.nuevo_sueldo}
            onChange={(e) => setFormSueldo({ ...formSueldo, nuevo_sueldo: e.target.value })}
          />
          <Input
            label="Motivo del Ajuste" maxLength={500}
            required
            placeholder="Aumento por desempeño, reestructuración, etc."
            value={formSueldo.motivo}
            onChange={(e) => setFormSueldo({ ...formSueldo, motivo: e.target.value })}
          />
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" type="button" onClick={() => setModalSueldoAbierto(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit">
              Confirmar Sueldo
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL ANTICIPO */}
      <Modal
        abierto={modalAnticipoAbierto}
        alCerrar={() => setModalAnticipoAbierto(false)}
        titulo="Registrar Anticipo o Préstamo"
      >
        <form onSubmit={handleGuardarAnticipo} className="space-y-4 text-slate-200">
          <Select
            label="Personal Solicitante"
            required
            value={formAnticipo.personal_id}
            onChange={(e) => setFormAnticipo({ ...formAnticipo, personal_id: e.target.value })}
            options={[
              { value: '', label: 'Seleccionar trabajador...' },
              ...personal.map((p) => ({
                value: p.id,
                label: `${p.nombre} ${p.apellido} (${p.ficha_nro || p.cedula || 'S/F'})`,
              })),
            ]}
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Tipo"
              value={formAnticipo.tipo}
              onChange={(e) => setFormAnticipo({ ...formAnticipo, tipo: e.target.value })}
              options={[
                { value: 'anticipo', label: 'Anticipo' },
                { value: 'prestamo', label: 'Préstamo' },
              ]}
            />
            <Input
              label="Monto Total (USD)"
              type="number"
              step="0.01"
              required
              value={formAnticipo.monto_total}
              onChange={(e) => setFormAnticipo({ ...formAnticipo, monto_total: e.target.value })}
            />
          </div>
          <Input
            label="Número de Cuotas" max={120} step="1"
            type="number"
            min="1"
            value={formAnticipo.cuotas}
            onChange={(e) => setFormAnticipo({ ...formAnticipo, cuotas: e.target.value })}
          />
          <Input
            label="Motivo / Observación" maxLength={500}
            value={formAnticipo.motivo}
            onChange={(e) => setFormAnticipo({ ...formAnticipo, motivo: e.target.value })}
          />
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" type="button" onClick={() => setModalAnticipoAbierto(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit">
              Guardar Anticipo
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
