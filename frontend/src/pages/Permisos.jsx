import ReporteModulo from "../components/ReporteModulo.jsx";
import { useOutletContext } from 'react-router-dom';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRealtimeRecarga } from '../hooks/useRealtime.js';
import {
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  FileCheck2,
  Filter,
  Paperclip,
  Plus,
  Search,
  XCircle,
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
  Textarea,
  useToast,
} from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { crear, formatearFecha, listar, nombreCompleto, TABLAS } from '../lib/data.js';
import { estadoLabel, estadoTone, OPCIONES_ESTADO_PERMISO } from '../lib/constants.js';

const FORM_VACIO = {
  escolta_id: '',
  tipo_id: '',
  fecha_inicio: '',
  fecha_fin: '',
  motivo: '',
  comprobante_url: '',
};

const nombreTipo = (tipo) => tipo?.nombre || tipo?.descripcion || 'Tipo sin nombre';

export default function Permisos() {
  const telefono = useOutletContext()?.telefono === true;
  const { role, user } = useAuth();
  const toast = useToast();
  const puedeRevisar = ['admin', 'supervisor'].includes(role);
  const puedeSolicitar = ['admin', 'supervisor', 'escolta'].includes(role);

  const [permisos, setPermisos] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [escoltas, setEscoltas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [modalSolicitud, setModalSolicitud] = useState(false);
  const [formulario, setFormulario] = useState(FORM_VACIO);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [mostrarHistorialMobile, setMostrarHistorialMobile] = useState(false);
  const [revision, setRevision] = useState(null);
  const [notasRevision, setNotasRevision] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const resultados = await Promise.allSettled([
        listar(TABLAS.permisos, { ordenarPor: 'fecha_inicio', ascendente: false }),
        listar(TABLAS.tiposPermiso, { ordenarPor: 'nombre', ascendente: true }),
        listar(TABLAS.escoltas, { ordenarPor: 'nombres', ascendente: true }),
      ]);

      const escoltasCargadas = resultados[2].status === 'fulfilled' ? resultados[2].value : [];
      if (resultados[0].status === 'fulfilled') {
        const datos = resultados[0].value;
        const propio = role === 'escolta' ? escoltasCargadas.find((item) => item.user_id === user?.id) : null;
        setPermisos(role === 'escolta' ? datos.filter((permiso) => permiso.escolta_id === propio?.id) : datos);
      } else {
        toast.error('No se pudo cargar la lista de permisos', resultados[0].reason?.message);
      }
      if (resultados[1].status === 'fulfilled') setTipos(resultados[1].value);
      if (resultados[2].status === 'fulfilled') {
        setEscoltas(role === 'escolta' ? escoltasCargadas.filter((item) => item.user_id === user?.id) : escoltasCargadas);
      }
    } finally {
      setCargando(false);
    }
  }, [role, user?.id, toast]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useRealtimeRecarga(cargar, { tablas: ['permisos', 'tipos_permiso', 'escoltas'] });

  const mapas = useMemo(() => ({
    escoltas: Object.fromEntries(escoltas.map((item) => [item.id, item])),
    tipos: Object.fromEntries(tipos.map((item) => [item.id, item])),
  }), [escoltas, tipos]);

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return permisos.filter((permiso) => {
      const escolta = mapas.escoltas[permiso.escolta_id];
      const tipo = mapas.tipos[permiso.tipo_id];
      const coincideTexto = !texto || [
        nombreCompleto(escolta), nombreTipo(tipo), permiso.motivo,
      ].some((valor) => String(valor || '').toLowerCase().includes(texto));
      const coincideEstado = filtroEstado === 'todos' || permiso.estado === filtroEstado;
      return coincideTexto && coincideEstado;
    });
  }, [permisos, mapas, busqueda, filtroEstado]);

  const abrirSolicitud = () => {
    const propio = escoltas.find((escolta) => escolta.user_id === user?.id);
    if (role === 'escolta' && !propio) {
      toast.warning('No encontramos tu ficha de escolta', 'Pide al administrador que relacione tu usuario con tu ficha.');
      return;
    }
    setFormulario({ ...FORM_VACIO, escolta_id: role === 'escolta' ? propio.id : '' });
    setErrores({});
    setModalSolicitud(true);
  };

  const cambiar = (campo, valor) => setFormulario((actual) => ({ ...actual, [campo]: valor }));

  const guardarSolicitud = async () => {
    const nuevosErrores = {};
    if (!formulario.escolta_id) nuevosErrores.escolta_id = 'Selecciona el escolta solicitante.';
    if (!formulario.tipo_id) nuevosErrores.tipo_id = 'Selecciona el tipo de permiso.';
    if (!formulario.fecha_inicio) nuevosErrores.fecha_inicio = 'Indica la fecha de inicio.';
    if (!formulario.motivo.trim()) nuevosErrores.motivo = 'Explica brevemente el motivo.';
    if (formulario.fecha_fin && formulario.fecha_inicio && formulario.fecha_fin < formulario.fecha_inicio) {
      nuevosErrores.fecha_fin = 'La fecha de fin no puede ser anterior al inicio.';
    }
    if (Object.keys(nuevosErrores).length) {
      setErrores(nuevosErrores);
      toast.warning('Revisa los campos marcados');
      return;
    }

    const valores = {
      escolta_id: formulario.escolta_id,
      tipo_id: formulario.tipo_id,
      fecha_inicio: formulario.fecha_inicio,
      fecha_fin: formulario.fecha_fin || null,
      motivo: formulario.motivo.trim(),
      comprobante_url: formulario.comprobante_url.trim() || null,
      estado: 'pendiente',
      solicitado_por: user?.id ?? null,
      notas_revision: null,
    };

    try {
      setGuardando(true);
      await crear(TABLAS.permisos, valores);
      toast.success('Solicitud enviada', 'Quedó pendiente de revisión por supervisor o administración.');
      setModalSolicitud(false);
      await cargar();
    } catch (error) {
      toast.error('No se pudo registrar la solicitud', error.message);
    } finally {
      setGuardando(false);
    }
  };

  const abrirRevision = (permiso, estado) => {
    setRevision({ permiso, estado });
    setNotasRevision('');
  };

  const confirmarRevision = async () => {
    if (!revision) return;
    if (revision.estado === 'rechazado' && !notasRevision.trim()) {
      toast.warning('Agrega el motivo del rechazo', 'El escolta necesita saber por qué no se aprobó.');
      return;
    }
    try {
      setGuardando(true);
      await api.revisarPermiso(revision.permiso.id, revision.estado, notasRevision.trim());
      toast.success(
        revision.estado === 'aprobado' ? 'Permiso aprobado' : 'Permiso rechazado',
        'La decisión quedó registrada con la nota de revisión.',
      );
      setRevision(null);
      await cargar();
    } catch (error) {
      toast.error('No se pudo registrar la revisión', error.message);
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
          <p className="text-xs text-slate-500">{nombreTipo(mapas.tipos[fila.tipo_id])}</p>
        </div>
      ),
    },
    {
      key: 'fechas',
      label: 'Periodo',
      render: (fila) => (
        <span>
          {formatearFecha(fila.fecha_inicio)}
          {fila.fecha_fin ? ` → ${formatearFecha(fila.fecha_fin)}` : ''}
        </span>
      ),
    },
    { key: 'motivo', label: 'Motivo', render: (fila) => <span className="block max-w-xs truncate">{fila.motivo || '—'}</span>, mobile: false },
    { key: 'estado', label: 'Estado', render: (fila) => <Badge tone={estadoTone(fila.estado)}>{estadoLabel(fila.estado)}</Badge> },
  ];

  const pendientes = filtrados.filter((permiso) => permiso.estado === 'pendiente').length;

  return (
    <div className="space-y-6">
      <ReporteModulo titulo="Descansos y permisos" archivo="permisos" columnas={["Personal","Tipo","Inicio","Fin","Estado"]}
        filas={filtrados.map((r) => [nombreCompleto(mapas.escoltas[r.escolta_id]), nombreTipo(mapas.tipos[r.tipo_id]), r.fecha_inicio, r.fecha_fin, r.estado])} indicadores={[["Pendientes", pendientes]]} deshabilitado={cargando} />
      {/* Vista resumida de acción rápida para teléfonos */}
      <div className={telefono ? 'space-y-3' : 'space-y-3 md:hidden'}>
        <div className="rounded-2xl border border-slate-800 bg-[#161a22] p-4 shadow-md space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-[#ff8a00]" />
              <span className="text-xs font-black uppercase text-slate-200">Resumen de Permisos</span>
            </div>
            <span className="text-xs font-bold text-slate-400">{pendientes} pendientes</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Última Petición</span>
              <strong className="text-xs font-black text-white truncate block">
                {filtrados[0] ? `${nombreTipo(mapas.tipos[filtrados[0].tipo_id])} (${estadoLabel(filtrados[0].estado)})` : 'Sin solicitudes'}
              </strong>
            </div>
            {puedeSolicitar && (
              <Button size="sm" variant="primary" leftIcon={Plus} onClick={abrirSolicitud}>
                Nueva Solicitud
              </Button>
            )}
          </div>
        </div>

        {/* Botón para desplegar historial bajo demanda */}
        <button
          type="button"
          onClick={() => setMostrarHistorialMobile((prev) => !prev)}
          className="w-full flex items-center justify-between p-3.5 rounded-xl border border-slate-800 bg-[#14171c] hover:bg-slate-800/80 text-xs font-bold text-slate-200 shadow-sm transition-all"
        >
          <span className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-[#ff8a00]" />
            {mostrarHistorialMobile ? 'Ocultar historial de permisos' : `Ver historial de solicitudes (${filtrados.length})`}
          </span>
          <span className="text-slate-400 font-mono text-xs">{mostrarHistorialMobile ? '▲ Ocultar' : '▼ Expandir'}</span>
        </button>
      </div>

      {/* Contenedor completo: visible en desktop (md:block) o bajo demanda en móvil */}
      <div className={mostrarHistorialMobile ? 'space-y-6 block' : (telefono ? 'hidden' : 'hidden md:block') + ' space-y-6'}>
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-100 sm:text-3xl">Permisos</h1>
          </div>
          {puedeSolicitar && (
            <Button size="lg" leftIcon={Plus} onClick={abrirSolicitud} className="self-start">
              Solicitar permiso
            </Button>
          )}
        </header>

        {pendientes > 0 && puedeRevisar && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-950/40 p-4 text-amber-200">
            <CalendarClock className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div>
              <p className="text-sm font-bold text-amber-100">{pendientes} {pendientes === 1 ? 'solicitud pendiente' : 'solicitudes pendientes'}</p>
              <p className="mt-1 text-xs leading-relaxed text-amber-200/90">Respóndelas a la brevedad para que el escolta pueda planificar su jornada.</p>
            </div>
          </div>
        )}

        <Card
          title="Solicitudes registradas"
          subtitle={`${filtrados.length} ${filtrados.length === 1 ? 'resultado' : 'resultados'}`}
          actions={<HelpTip title="Comprobantes">Si el permiso requiere soporte (por ejemplo, un certificado médico), adjunta un enlace al comprobante al crear la solicitud.</HelpTip>}
        >
          <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-slate-400" aria-hidden="true" />
              <input
                type="search"
                value={busqueda}
                onChange={(evento) => setBusqueda(evento.target.value.toLocaleUpperCase("es"))}
                placeholder="Buscar por escolta, tipo o motivo…"
                aria-label="Buscar permisos"
                className="min-h-11 w-full rounded-xl border border-slate-700 bg-slate-900/80 pl-10 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
            <div className="relative">
              <Filter className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-slate-400" aria-hidden="true" />
              <select
                value={filtroEstado}
                onChange={(evento) => setFiltroEstado(evento.target.value)}
                aria-label="Filtrar permisos por estado"
                className="min-h-11 w-full rounded-xl border border-slate-700 bg-slate-900/80 pl-10 pr-3 text-sm text-slate-100 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              >
                <option value="todos">Todos los estados</option>
                {OPCIONES_ESTADO_PERMISO.map((opcion) => (
                  <option key={opcion.value} value={opcion.value}>{opcion.label}</option>
                ))}
              </select>
            </div>
          </div>

          <DataTable
            columns={columnas}
            data={filtrados}
            loading={cargando}
            emptyTitle="No hay solicitudes por aquí"
            emptyDescription={busqueda || filtroEstado !== 'todos'
              ? 'Cambia los filtros para ver otras solicitudes.'
              : 'Cuando se solicite un permiso aparecerá aquí con su estado y comprobante.'}
            emptyActionLabel={puedeSolicitar && !busqueda && filtroEstado === 'todos' ? 'Solicitar el primero' : undefined}
            onEmptyAction={puedeSolicitar ? abrirSolicitud : undefined}
            emptyIcon={FileCheck2}
            actions={(fila) => (
              <>
                {fila.comprobante_url && (
                  <a
                    href={fila.comprobante_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                  >
                    <Paperclip className="h-3.5 w-3.5" aria-hidden="true" /> Ver comprobante
                  </a>
                )}
                {puedeRevisar && fila.estado === 'pendiente' && (
                  <>
                    <Button variant="success" size="sm" leftIcon={CheckCircle2} onClick={() => abrirRevision(fila, 'aprobado')}>Aprobar</Button>
                    <Button variant="danger" size="sm" leftIcon={XCircle} onClick={() => abrirRevision(fila, 'rechazado')}>Rechazar</Button>
                  </>
                )}
              </>
            )}
          />

          {!cargando && filtrados.some((permiso) => permiso.notas_revision) && (
            <div className="mt-5 space-y-2">
              <h3 className="text-sm font-bold text-slate-200">Notas de revisión recientes</h3>
              {filtrados.filter((permiso) => permiso.notas_revision).slice(0, 3).map((permiso) => (
                <div key={permiso.id} className="rounded-xl border border-slate-800 bg-[#0e1217] p-3 text-sm text-slate-300">
                  <strong className="text-slate-100">{nombreCompleto(mapas.escoltas[permiso.escolta_id])}:</strong> {permiso.notas_revision}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Modal
        open={modalSolicitud}
        onClose={() => setModalSolicitud(false)}
        title="Nueva solicitud de permiso"
        description="Cuéntanos qué permiso necesitas y las fechas. El supervisor revisará la solicitud."
        size="lg"
        footer={
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <Button onClick={guardarSolicitud} loading={guardando} fullWidth className="sm:w-auto">Enviar solicitud</Button>
            <Button variant="outline" onClick={() => setModalSolicitud(false)} disabled={guardando} fullWidth className="sm:w-auto">Cancelar</Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label="Escolta" required value={formulario.escolta_id} error={errores.escolta_id}
            onChange={(evento) => cambiar('escolta_id', evento.target.value)}
            disabled={role === 'escolta'}
            help={role === 'escolta' ? 'Se selecciona automáticamente tu ficha.' : undefined}
          >
            <option value="">Selecciona un escolta</option>
            {escoltas.map((escolta) => (
              <option key={escolta.id} value={escolta.id}>{nombreCompleto(escolta)}</option>
            ))}
          </Select>
          <Select
            label="Tipo de permiso" required value={formulario.tipo_id} error={errores.tipo_id}
            onChange={(evento) => cambiar('tipo_id', evento.target.value)}
            help={tipos.length ? undefined : 'Aún no hay tipos de permiso configurados.'}
          >
            <option value="">Selecciona un tipo</option>
            {tipos.map((tipo) => (
              <option key={tipo.id} value={tipo.id}>{nombreTipo(tipo)}</option>
            ))}
          </Select>
          <Input
            label="Fecha de inicio" type="date" required value={formulario.fecha_inicio} error={errores.fecha_inicio}
            onChange={(evento) => cambiar('fecha_inicio', evento.target.value)}
          />
          <Input
            label="Fecha de fin" type="date" value={formulario.fecha_fin} error={errores.fecha_fin}
            onChange={(evento) => cambiar('fecha_fin', evento.target.value)}
            help="Para un solo día puedes dejarla igual o vacía."
          />
          <Input
            label="Enlace del comprobante" type="url" value={formulario.comprobante_url} containerClassName="sm:col-span-2"
            onChange={(evento) => cambiar('comprobante_url', evento.target.value)}
            placeholder="https://…"
            help="Opcional. Ejemplo: enlace a un certificado o justificativo."
          />
          <Textarea
            label="Motivo" required value={formulario.motivo} error={errores.motivo} containerClassName="sm:col-span-2"
            onChange={(evento) => cambiar('motivo', evento.target.value)}
            placeholder="Explica por qué necesitas el permiso…"
          />
        </div>
      </Modal>

      <Modal
        open={Boolean(revision)}
        onClose={() => setRevision(null)}
        title={revision?.estado === 'aprobado' ? 'Aprobar permiso' : 'Rechazar permiso'}
        description={revision ? `${nombreCompleto(mapas.escoltas[revision.permiso.escolta_id])} · ${nombreTipo(mapas.tipos[revision.permiso.tipo_id])}` : ''}
        size="sm"
        footer={
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <Button
              variant={revision?.estado === 'aprobado' ? 'success' : 'danger'}
              onClick={confirmarRevision}
              loading={guardando}
              fullWidth
              className="sm:w-auto"
            >
              Confirmar {revision?.estado === 'aprobado' ? 'aprobación' : 'rechazo'}
            </Button>
            <Button variant="outline" onClick={() => setRevision(null)} disabled={guardando} fullWidth className="sm:w-auto">Cancelar</Button>
          </div>
        }
      >
        {revision && (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-800 bg-[#0e1217] p-3 text-sm text-slate-300">
              <p><strong>Periodo:</strong> {formatearFecha(revision.permiso.fecha_inicio)} {revision.permiso.fecha_fin ? `→ ${formatearFecha(revision.permiso.fecha_fin)}` : ''}</p>
              <p className="mt-1"><strong>Motivo:</strong> {revision.permiso.motivo}</p>
              {revision.permiso.comprobante_url && (
                <a href={revision.permiso.comprobante_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 font-semibold text-brand-400 hover:underline">
                  <ExternalLink className="h-4 w-4" aria-hidden="true" /> Abrir comprobante
                </a>
              )}
            </div>
            <Textarea
              label="Notas de revisión"
              value={notasRevision}
              onChange={(evento) => setNotasRevision(evento.target.value)}
              placeholder={revision.estado === 'rechazado' ? 'Indica el motivo del rechazo…' : 'Observaciones para el escolta (opcional)'}
              help={revision.estado === 'rechazado' ? 'Obligatorio para que el escolta entienda la decisión.' : 'Se guardarán junto con tu decisión.'}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
