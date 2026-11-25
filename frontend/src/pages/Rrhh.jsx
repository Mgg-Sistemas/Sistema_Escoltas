import React, { useCallback, useEffect, useState } from 'react';
import {
  Briefcase,
  Calendar,
  CheckCircle2,
  DollarSign,
  FileText,
  Plus,
  RefreshCw,
  Search,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { Badge, Button, Card, Input, Modal, Select, useToast } from '../components/ui.jsx';
import { apiFetch } from '../lib/api.js';

export default function Rrhh() {
  const toast = useToast();
  const [tab, setTab] = useState('personal');
  const [cargando, setCargando] = useState(true);

  const [personal, setPersonal] = useState([]);
  const [cargos, setCargos] = useState([]);
  const [anticipos, setAnticipos] = useState([]);
  const [eventos, setEventos] = useState([]);

  // Modales
  const [modalPersonal, setModalPersonal] = useState(false);
  const [formPersonal, setFormPersonal] = useState({
    nombre: '',
    apellido: '',
    cedula: '',
    cargo: '',
    departamento: '',
    sueldo_base: 0,
    telefono: '',
    correo: '',
    direccion: '',
    fecha_ingreso: new Date().toISOString().split('T')[0],
  });

  const [modalAnticipo, setModalAnticipo] = useState(false);
  const [formAnticipo, setFormAnticipo] = useState({
    personal_id: '',
    tipo: 'anticipo',
    monto_total: 0,
    cuota_sugerida: 0,
    motivo: '',
  });

  const [modalEvento, setModalEvento] = useState(false);
  const [formEvento, setFormEvento] = useState({
    personal_id: '',
    tipo: 'vacaciones',
    fecha_inicio: new Date().toISOString().split('T')[0],
    fecha_fin: new Date().toISOString().split('T')[0],
    dias: 15,
    remunerado: true,
    descripcion: '',
  });

  const [modalAbono, setModalAbono] = useState(false);
  const [itemAbono, setItemAbono] = useState(null);
  const [montoAbono, setMontoAbono] = useState('');

  const [guardando, setGuardando] = useState(false);

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    try {
      const [pRes, cRes, aRes, eRes] = await Promise.all([
        apiFetch('/rrhh/personal').catch(() => []),
        apiFetch('/rrhh/cargos').catch(() => []),
        apiFetch('/rrhh/anticipos').catch(() => []),
        apiFetch('/rrhh/eventos').catch(() => []),
      ]);
      setPersonal(pRes || []);
      setCargos(cRes || []);
      setAnticipos(aRes || []);
      setEventos(eRes || []);
    } catch {
      toast.error('Error al cargar datos de Recursos Humanos');
    } finally {
      setCargando(false);
    }
  }, [toast]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // Guardar Personal
  const guardarPersonal = async (e) => {
    e.preventDefault();
    if (!formPersonal.nombre.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }
    setGuardando(true);
    try {
      await apiFetch('/rrhh/personal', {
        method: 'POST',
        body: formPersonal,
      });
      toast.success('Ficha de personal creada exitosamente');
      setModalPersonal(false);
      setFormPersonal({
        nombre: '',
        apellido: '',
        cedula: '',
        cargo: '',
        departamento: '',
        sueldo_base: 0,
        telefono: '',
        correo: '',
        direccion: '',
        fecha_ingreso: new Date().toISOString().split('T')[0],
      });
      cargarDatos();
    } catch (err) {
      toast.error(err.message || 'Error al guardar personal');
    } finally {
      setGuardando(false);
    }
  };

  // Guardar Anticipo
  const guardarAnticipo = async (e) => {
    e.preventDefault();
    if (!formAnticipo.personal_id || !formAnticipo.monto_total) {
      toast.error('Completa los campos obligatorios');
      return;
    }
    setGuardando(true);
    try {
      await apiFetch('/rrhh/anticipos', {
        method: 'POST',
        body: formAnticipo,
      });
      toast.success('Solicitud registrada');
      setModalAnticipo(false);
      setFormAnticipo({
        personal_id: '',
        tipo: 'anticipo',
        monto_total: 0,
        cuota_sugerida: 0,
        motivo: '',
      });
      cargarDatos();
    } catch (err) {
      toast.error(err.message || 'Error al registrar anticipo');
    } finally {
      setGuardando(false);
    }
  };

  // Registrar Abono
  const registrarAbono = async (e) => {
    e.preventDefault();
    if (!itemAbono || !montoAbono) return;
    setGuardando(true);
    try {
      await apiFetch(`/rrhh/anticipos/${itemAbono.id}/abonar`, {
        method: 'PATCH',
        body: { monto_abono: Number(montoAbono) },
      });
      toast.success('Abono registrado correctamente');
      setModalAbono(false);
      setItemAbono(null);
      setMontoAbono('');
      cargarDatos();
    } catch (err) {
      toast.error(err.message || 'Error al registrar abono');
    } finally {
      setGuardando(false);
    }
  };

  // Guardar Evento / Permiso / Vacación
  const guardarEvento = async (e) => {
    e.preventDefault();
    if (!formEvento.personal_id) {
      toast.error('Selecciona el empleado');
      return;
    }
    setGuardando(true);
    try {
      await apiFetch('/rrhh/eventos', {
        method: 'POST',
        body: formEvento,
      });
      toast.success('Evento registrado');
      setModalEvento(false);
      cargarDatos();
    } catch (err) {
      toast.error(err.message || 'Error al registrar evento');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-purple-500/10 p-2 text-purple-600">
              <Users className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Recursos Humanos (RRHH)</h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Expedientes de personal, anticipos y préstamos, vacaciones, permisos laborales y catálogo de cargos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={cargarDatos} leftIcon={RefreshCw} disabled={cargando}>
            Actualizar
          </Button>
          <Button variant="primary" size="sm" onClick={() => setModalPersonal(true)} leftIcon={UserPlus}>
            Nuevo Empleado
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        {[
          { id: 'personal', label: `Personal (${personal.length})` },
          { id: 'anticipos', label: `Anticipos y Préstamos (${anticipos.length})` },
          { id: 'eventos', label: `Vacaciones y Permisos (${eventos.length})` },
          { id: 'cargos', label: `Cargos (${cargos.length})` },
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

      {/* 1. Personal */}
      {tab === 'personal' && (
        <Card className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-slate-800">Ficha de Personal</h2>
            <Button variant="primary" size="sm" onClick={() => setModalPersonal(true)} leftIcon={Plus}>
              Agregar Empleado
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Empleado</th>
                  <th className="px-4 py-3">Cédula</th>
                  <th className="px-4 py-3">Cargo / Depto</th>
                  <th className="px-4 py-3">Sueldo Base</th>
                  <th className="px-4 py-3">Fecha Ingreso</th>
                  <th className="px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {personal.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{p.nombre} {p.apellido}</td>
                    <td className="px-4 py-3">{p.cedula || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-800">{p.cargo || 'Sin cargo'}</span>
                      {p.departamento && <span className="text-xs text-slate-400 block">{p.departamento}</span>}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">${p.sueldo_base || 0}</td>
                    <td className="px-4 py-3">{p.fecha_ingreso || '—'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={p.activo ? 'success' : 'slate'}>{p.activo ? 'Activo' : 'Inactivo'}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* 2. Anticipos y Préstamos */}
      {tab === 'anticipos' && (
        <Card className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-slate-800">Anticipos y Préstamos al Personal</h2>
            <Button variant="primary" size="sm" onClick={() => setModalAnticipo(true)} leftIcon={Plus}>
              Nueva Solicitud
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Empleado</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Monto Total</th>
                  <th className="px-4 py-3">Saldo Pendiente</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {anticipos.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {a.personal ? `${a.personal.nombre} ${a.personal.apellido || ''}` : 'Empleado'}
                    </td>
                    <td className="px-4 py-3"><Badge variant={a.tipo === 'prestamo' ? 'purple' : 'info'}>{a.tipo}</Badge></td>
                    <td className="px-4 py-3 font-semibold text-slate-900">${a.monto_total}</td>
                    <td className="px-4 py-3 font-semibold text-amber-700">${a.saldo}</td>
                    <td className="px-4 py-3"><Badge variant={a.estado === 'activo' ? 'warning' : 'success'}>{a.estado}</Badge></td>
                    <td className="px-4 py-3">
                      {a.estado === 'activo' && (
                        <button
                          onClick={() => {
                            setItemAbono(a);
                            setModalAbono(true);
                          }}
                          className="text-xs text-brand-600 font-medium hover:underline"
                        >
                          Abonar Cuota
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

      {/* 3. Vacaciones y Permisos */}
      {tab === 'eventos' && (
        <Card className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-slate-800">Vacaciones, Reposos y Permisos</h2>
            <Button variant="primary" size="sm" onClick={() => setModalEvento(true)} leftIcon={Plus}>
              Registrar Ausencia
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Empleado</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Desde</th>
                  <th className="px-4 py-3">Hasta</th>
                  <th className="px-4 py-3">Días</th>
                  <th className="px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {eventos.map((ev) => (
                  <tr key={ev.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {ev.personal ? `${ev.personal.nombre} ${ev.personal.apellido || ''}` : 'Empleado'}
                    </td>
                    <td className="px-4 py-3"><Badge variant="outline">{ev.tipo}</Badge></td>
                    <td className="px-4 py-3">{ev.fecha_inicio}</td>
                    <td className="px-4 py-3">{ev.fecha_fin}</td>
                    <td className="px-4 py-3 font-semibold">{ev.dias} días</td>
                    <td className="px-4 py-3"><Badge variant="success">{ev.estado}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* 4. Cargos */}
      {tab === 'cargos' && (
        <Card className="p-4">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Catálogo de Puestos y Cargos</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cargos.map((c) => (
              <div key={c.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-brand-600" />
                  <h3 className="font-semibold text-slate-900">{c.nombre}</h3>
                </div>
                {c.departamento && <p className="text-xs text-slate-500 mt-1">Dpto: {c.departamento}</p>}
                {c.sueldo_sugerido > 0 && <p className="text-xs text-emerald-600 font-medium mt-1">Sugerido: ${c.sueldo_sugerido}</p>}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Modal Nuevo Empleado */}
      <Modal abierto={modalPersonal} alCerrar={() => setModalPersonal(false)} titulo="Registrar Ficha de Personal">
        <form onSubmit={guardarPersonal} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Nombre *"
              value={formPersonal.nombre}
              onChange={(e) => setFormPersonal({ ...formPersonal, nombre: e.target.value })}
              required
            />
            <Input
              label="Apellido"
              value={formPersonal.apellido}
              onChange={(e) => setFormPersonal({ ...formPersonal, apellido: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Cédula"
              value={formPersonal.cedula}
              onChange={(e) => setFormPersonal({ ...formPersonal, cedula: e.target.value })}
            />
            <Input
              label="Teléfono"
              value={formPersonal.telefono}
              onChange={(e) => setFormPersonal({ ...formPersonal, telefono: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Cargo"
              value={formPersonal.cargo}
              onChange={(e) => setFormPersonal({ ...formPersonal, cargo: e.target.value })}
            />
            <Input
              label="Departamento"
              value={formPersonal.departamento}
              onChange={(e) => setFormPersonal({ ...formPersonal, departamento: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              type="number"
              label="Sueldo Base (USD)"
              value={formPersonal.sueldo_base}
              onChange={(e) => setFormPersonal({ ...formPersonal, sueldo_base: e.target.value })}
            />
            <Input
              type="date"
              label="Fecha Ingreso"
              value={formPersonal.fecha_ingreso}
              onChange={(e) => setFormPersonal({ ...formPersonal, fecha_ingreso: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setModalPersonal(false)} type="button">Cancelar</Button>
            <Button variant="primary" type="submit" disabled={guardando}>Crear Ficha</Button>
          </div>
        </form>
      </Modal>

      {/* Modal Nuevo Anticipo */}
      <Modal abierto={modalAnticipo} alCerrar={() => setModalAnticipo(false)} titulo="Registrar Anticipo o Préstamo">
        <form onSubmit={guardarAnticipo} className="space-y-4">
          <Select
            label="Empleado *"
            value={formAnticipo.personal_id}
            onChange={(e) => setFormAnticipo({ ...formAnticipo, personal_id: e.target.value })}
            required
          >
            <option value="">-- Seleccionar empleado --</option>
            {personal.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre} {p.apellido}</option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Tipo *"
              value={formAnticipo.tipo}
              onChange={(e) => setFormAnticipo({ ...formAnticipo, tipo: e.target.value })}
            >
              <option value="anticipo">Anticipo de Sueldo</option>
              <option value="prestamo">Préstamo Institucional</option>
            </Select>
            <Input
              type="number"
              label="Monto Total (USD) *"
              value={formAnticipo.monto_total}
              onChange={(e) => setFormAnticipo({ ...formAnticipo, monto_total: e.target.value })}
              required
            />
          </div>
          <Input
            label="Motivo"
            value={formAnticipo.motivo}
            onChange={(e) => setFormAnticipo({ ...formAnticipo, motivo: e.target.value })}
          />
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setModalAnticipo(false)} type="button">Cancelar</Button>
            <Button variant="primary" type="submit" disabled={guardando}>Guardar Solicitud</Button>
          </div>
        </form>
      </Modal>

      {/* Modal Abonar Cuota */}
      <Modal abierto={modalAbono} alCerrar={() => setModalAbono(false)} titulo="Abonar a Anticipo / Préstamo">
        <form onSubmit={registrarAbono} className="space-y-4">
          <p className="text-sm text-slate-600">
            Saldo pendiente actual: <strong className="text-amber-700">${itemAbono?.saldo}</strong>
          </p>
          <Input
            type="number"
            label="Monto a abonar (USD) *"
            value={montoAbono}
            onChange={(e) => setMontoAbono(e.target.value)}
            required
          />
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setModalAbono(false)} type="button">Cancelar</Button>
            <Button variant="primary" type="submit" disabled={guardando}>Registrar Abono</Button>
          </div>
        </form>
      </Modal>

      {/* Modal Nueva Ausencia */}
      <Modal abierto={modalEvento} alCerrar={() => setModalEvento(false)} titulo="Registrar Vacaciones o Permiso">
        <form onSubmit={guardarEvento} className="space-y-4">
          <Select
            label="Empleado *"
            value={formEvento.personal_id}
            onChange={(e) => setFormEvento({ ...formEvento, personal_id: e.target.value })}
            required
          >
            <option value="">-- Seleccionar empleado --</option>
            {personal.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre} {p.apellido}</option>
            ))}
          </Select>
          <Select
            label="Tipo de Ausencia"
            value={formEvento.tipo}
            onChange={(e) => setFormEvento({ ...formEvento, tipo: e.target.value })}
          >
            <option value="vacaciones">Vacaciones Anuales</option>
            <option value="permiso">Permiso Laboral</option>
            <option value="reposo">Reposo Médico</option>
            <option value="otro">Otro</option>
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input
              type="date"
              label="Desde"
              value={formEvento.fecha_inicio}
              onChange={(e) => setFormEvento({ ...formEvento, fecha_inicio: e.target.value })}
              required
            />
            <Input
              type="date"
              label="Hasta"
              value={formEvento.fecha_fin}
              onChange={(e) => setFormEvento({ ...formEvento, fecha_fin: e.target.value })}
              required
            />
          </div>
          <Input
            type="number"
            label="Días Totales"
            value={formEvento.dias}
            onChange={(e) => setFormEvento({ ...formEvento, dias: e.target.value })}
          />
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setModalEvento(false)} type="button">Cancelar</Button>
            <Button variant="primary" type="submit" disabled={guardando}>Guardar Ausencia</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
