import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRealtimeRecarga } from '../hooks/useRealtime.js';
import {
  BadgeCheck,
  Camera,
  Filter,
  IdCard,
  MapPin,
  Pencil,
  Phone,
  Search,
  UserPlus,
  UsersRound,
} from 'lucide-react';
import DataTable from '../components/DataTable.jsx';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Field,
  HelpTip,
  Input,
  Modal,
  Select,
  Textarea,
  useToast,
} from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { actualizar, crear, eliminar, formatearFecha, listar, nombreCompleto, TABLAS } from '../lib/data.js';
import { estadoLabel, estadoTone, OPCIONES_ESTADO_ESCOLTA } from '../lib/constants.js';

const FORM_VACIO = {
  codigo: '',
  nombres: '',
  apellidos: '',
  cedula: '',
  telefono: '',
  direccion: '',
  fecha_ingreso: '',
  grado_id: '',
  estado: 'activo',
  notas: '',
  foto_url: '',
};

export default function Escoltas() {
  const { role, user } = useAuth();
  const toast = useToast();
  const puedeEditar = ['admin', 'supervisor'].includes(role);

  const [escoltas, setEscoltas] = useState([]);
  const [grados, setGrados] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [pagina, setPagina] = useState(1);
  const [formulario, setFormulario] = useState(FORM_VACIO);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [errores, setErrores] = useState({});
  const [confirmarEliminar, setConfirmarEliminar] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [resultadoEscoltas, resultadoGrados] = await Promise.allSettled([
        listar(TABLAS.escoltas, { ordenarPor: 'nombres', ascendente: true }),
        listar(TABLAS.grados, { ordenarPor: 'nombre', ascendente: true }),
      ]);

      if (resultadoEscoltas.status === 'fulfilled') {
        const datos = resultadoEscoltas.value;
        setEscoltas(role === 'escolta' ? datos.filter((item) => item.user_id === user?.id) : datos);
      } else {
        toast.error('No se pudo cargar la lista de escoltas', resultadoEscoltas.reason?.message);
      }

      if (resultadoGrados.status === 'fulfilled') setGrados(resultadoGrados.value);
    } finally {
      setCargando(false);
    }
  }, [role, user?.id, toast]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useRealtimeRecarga(cargar, { tablas: ['escoltas', 'grados', 'profiles'] });

  const gradosPorId = useMemo(
    () => Object.fromEntries(grados.map((grado) => [grado.id, grado.nombre || grado.descripcion || 'Sin grado'])),
    [grados],
  );

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return escoltas.filter((escolta) => {
      const coincideEstado = filtroEstado === 'todos' || escolta.estado === filtroEstado;
      const coincideTexto = !texto || [
        escolta.nombres, escolta.apellidos, escolta.codigo, escolta.cedula, escolta.telefono,
      ].some((valor) => String(valor || '').toLowerCase().includes(texto));
      return coincideEstado && coincideTexto;
    });
  }, [escoltas, busqueda, filtroEstado]);

  useEffect(() => {
    setPagina(1);
  }, [busqueda, filtroEstado]);

  const porPagina = 8;
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / porPagina));
  const visibles = filtrados.slice((pagina - 1) * porPagina, pagina * porPagina);

  const abrirNuevo = () => {
    setEditando(null);
    setFormulario(FORM_VACIO);
    setErrores({});
    setModalAbierto(true);
  };

  const abrirEdicion = (escolta) => {
    setEditando(escolta);
    setFormulario({
      codigo: escolta.codigo || '',
      nombres: escolta.nombres || '',
      apellidos: escolta.apellidos || '',
      cedula: escolta.cedula || '',
      telefono: escolta.telefono || '',
      direccion: escolta.direccion || '',
      fecha_ingreso: escolta.fecha_ingreso || '',
      grado_id: escolta.grado_id || '',
      estado: escolta.estado || 'activo',
      notas: escolta.notas || '',
      foto_url: escolta.foto_url || '',
    });
    setErrores({});
    setModalAbierto(true);
  };

  const cambiarCampo = (campo, valor) => setFormulario((actual) => ({ ...actual, [campo]: valor }));

  const guardar = async () => {
    const nuevosErrores = {};
    if (!formulario.nombres.trim()) nuevosErrores.nombres = 'Escribe los nombres del escolta.';
    if (!formulario.apellidos.trim()) nuevosErrores.apellidos = 'Escribe los apellidos del escolta.';
    if (!formulario.cedula.trim()) nuevosErrores.cedula = 'La cédula es obligatoria para identificarlo.';
    if (!formulario.codigo.trim()) nuevosErrores.codigo = 'Asigna un código único (por ejemplo, ESC-001).';
    if (Object.keys(nuevosErrores).length) {
      setErrores(nuevosErrores);
      toast.warning('Revisa los campos marcados antes de continuar');
      return;
    }

    const valores = {
      ...formulario,
      codigo: formulario.codigo.trim(),
      nombres: formulario.nombres.trim(),
      apellidos: formulario.apellidos.trim(),
      cedula: formulario.cedula.trim(),
      telefono: formulario.telefono.trim() || null,
      direccion: formulario.direccion.trim() || null,
      fecha_ingreso: formulario.fecha_ingreso || null,
      grado_id: formulario.grado_id || null,
      notas: formulario.notas.trim() || null,
      foto_url: formulario.foto_url.trim() || null,
    };
    if (!editando && role === 'escolta') valores.user_id = user?.id;

    try {
      setGuardando(true);
      if (editando) {
        await actualizar(TABLAS.escoltas, editando.id, valores);
        toast.success('Ficha actualizada', 'Los cambios ya están disponibles para el equipo.');
      } else {
        await crear(TABLAS.escoltas, valores);
        toast.success('Escolta registrado', 'Ya puedes asignarlo a un cliente o turno.');
      }
      setModalAbierto(false);
      await cargar();
    } catch (error) {
      toast.error('No se pudo guardar la ficha', error.message);
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async () => {
    if (!confirmarEliminar) return;
    try {
      setGuardando(true);
      await eliminar(TABLAS.escoltas, confirmarEliminar.id);
      toast.success('Escolta eliminado de la lista');
      setConfirmarEliminar(null);
      setPerfil(null);
      await cargar();
    } catch (error) {
      toast.error('No se pudo eliminar el escolta', error.message);
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
        <div className="flex items-center gap-3">
          {fila.foto_url ? (
            <img src={fila.foto_url} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
          ) : (
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-800">
              {nombreCompleto(fila).split(' ').map((palabra) => palabra[0]).slice(0, 2).join('')}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate font-bold text-slate-900">{nombreCompleto(fila)}</p>
            <p className="text-xs text-slate-500">Cód. {fila.codigo || '—'}</p>
          </div>
        </div>
      ),
    },
    { key: 'cedula', label: 'Cédula', render: (fila) => fila.cedula || '—' },
    { key: 'telefono', label: 'Teléfono', render: (fila) => fila.telefono || '—', mobile: false },
    { key: 'grado', label: 'Grado', render: (fila) => gradosPorId[fila.grado_id] || '—', mobile: false },
    { key: 'estado', label: 'Estado', render: (fila) => <Badge tone={estadoTone(fila.estado)}>{estadoLabel(fila.estado)}</Badge> },
    { key: 'fecha_ingreso', label: 'Ingreso', render: (fila) => formatearFecha(fila.fecha_ingreso), mobile: false },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 sm:text-3xl">Escoltas</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400 sm:text-base">
            Aquí se concentra la ficha de cada escolta: identificación, contacto, grado y estado.
            {!puedeEditar && ' Tu rol permite consultar la información; si algo está desactualizado, avisa a supervisor o administración.'}
          </p>
        </div>
        {puedeEditar && (
          <Button size="lg" leftIcon={UserPlus} onClick={abrirNuevo} className="self-start">
            Registrar escolta
          </Button>
        )}
      </header>

      <Card
        title="Listado de personal"
        subtitle={`${filtrados.length} ${filtrados.length === 1 ? 'registro encontrado' : 'registros encontrados'}`}
        actions={<HelpTip title="Búsqueda flexible">Puedes buscar por nombre, apellido, código, cédula o teléfono. Combínalo con el filtro de estado.</HelpTip>}
      >
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              value={busqueda}
              onChange={(evento) => setBusqueda(evento.target.value)}
              placeholder="Buscar por nombre, cédula o código…"
              aria-label="Buscar escoltas"
              className="block min-h-11 w-full rounded-xl border border-slate-700 bg-slate-900/80 pl-10 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>
          <div className="relative">
            <Filter className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-slate-400" aria-hidden="true" />
            <select
              value={filtroEstado}
              onChange={(evento) => setFiltroEstado(evento.target.value)}
              aria-label="Filtrar por estado"
              className="block min-h-11 w-full appearance-none rounded-xl border border-slate-700 bg-slate-900/80 pl-10 pr-3 text-sm text-slate-100 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            >
              <option value="todos">Todos los estados</option>
              {OPCIONES_ESTADO_ESCOLTA.map((opcion) => (
                <option key={opcion.value} value={opcion.value}>{opcion.label}</option>
              ))}
            </select>
          </div>
        </div>

        <DataTable
          columns={columnas}
          data={visibles}
          loading={cargando}
          emptyTitle={busqueda || filtroEstado !== 'todos' ? 'No hay resultados con esos filtros' : 'Aún no hay escoltas registrados'}
          emptyDescription={busqueda || filtroEstado !== 'todos'
            ? 'Prueba con otro texto o selecciona «Todos los estados».'
            : 'Registra al primer escolta para comenzar a organizar turnos, permisos y nómina.'}
          emptyActionLabel={puedeEditar && !busqueda && filtroEstado === 'todos' ? 'Registrar primer escolta' : undefined}
          onEmptyAction={puedeEditar ? abrirNuevo : undefined}
          emptyIcon={UsersRound}
          onRowClick={(fila) => setPerfil(fila)}
          actions={(fila) => (
            <>
              <Button variant="ghost" size="sm" onClick={() => setPerfil(fila)}>Ver</Button>
              {puedeEditar && (
                <Button variant="outline" size="sm" leftIcon={Pencil} onClick={() => abrirEdicion(fila)}>Editar</Button>
              )}
            </>
          )}
        />
        <div className="mt-4">
          <Pagination page={pagina} totalPages={totalPaginas} totalItems={filtrados.length} onChange={setPagina} />
        </div>
      </Card>

      {/* Formulario alto / edición */}
      <Modal
        open={modalAbierto}
        onClose={() => setModalAbierto(false)}
        title={editando ? 'Editar ficha del escolta' : 'Registrar nuevo escolta'}
        description="Completa los datos obligatorios (*). Podrás actualizarlos más adelante."
        size="lg"
        footer={
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <Button onClick={guardar} loading={guardando} fullWidth className="sm:w-auto">
              {editando ? 'Guardar cambios' : 'Registrar escolta'}
            </Button>
            <Button variant="outline" onClick={() => setModalAbierto(false)} disabled={guardando} fullWidth className="sm:w-auto">
              Cancelar
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Nombres" required value={formulario.nombres} error={errores.nombres}
            onChange={(evento) => cambiarCampo('nombres', evento.target.value)} placeholder="Ej. Juan Carlos"
          />
          <Input
            label="Apellidos" required value={formulario.apellidos} error={errores.apellidos}
            onChange={(evento) => cambiarCampo('apellidos', evento.target.value)} placeholder="Ej. Pérez García"
          />
          <Input
            label="Código interno" required value={formulario.codigo} error={errores.codigo}
            onChange={(evento) => cambiarCampo('codigo', evento.target.value)} placeholder="Ej. ESC-001"
            help="Identificador corto y único que facilita buscar al escolta."
          />
          <Input
            label="Cédula de identidad" required value={formulario.cedula} error={errores.cedula}
            onChange={(evento) => cambiarCampo('cedula', evento.target.value)} placeholder="Ej. 12345678"
          />
          <Input
            label="Teléfono" type="tel" inputMode="tel" value={formulario.telefono}
            onChange={(evento) => cambiarCampo('telefono', evento.target.value)} placeholder="Ej. 0412-1234567"
          />
          <Input
            label="Fecha de ingreso" type="date" value={formulario.fecha_ingreso}
            onChange={(evento) => cambiarCampo('fecha_ingreso', evento.target.value)}
            help="Fecha en la que se incorporó a la empresa."
          />
          <Select
            label="Grado" value={formulario.grado_id}
            onChange={(evento) => cambiarCampo('grado_id', evento.target.value)}
            help={grados.length ? undefined : 'Aún no hay grados configurados en el sistema.'}
          >
            <option value="">Sin grado asignado</option>
            {grados.map((grado) => (
              <option key={grado.id} value={grado.id}>{grado.nombre || grado.descripcion || 'Grado'}</option>
            ))}
          </Select>
          <Select
            label="Estado" value={formulario.estado}
            onChange={(evento) => cambiarCampo('estado', evento.target.value)}
            options={OPCIONES_ESTADO_ESCOLTA}
            help="Un escolta inactivo o suspendido no debería recibir nuevas asignaciones."
          />
          <Input
            label="URL de la foto" type="url" value={formulario.foto_url} containerClassName="sm:col-span-2"
            onChange={(evento) => cambiarCampo('foto_url', evento.target.value)} placeholder="https://…"
            help="Opcional. Enlace público a una foto reciente del escolta."
          />
          <Textarea
            label="Notas internas" value={formulario.notas} containerClassName="sm:col-span-2"
            onChange={(evento) => cambiarCampo('notas', evento.target.value)}
            placeholder="Observaciones relevantes (opcional)"
          />
        </div>
      </Modal>

      {/* Perfil */}
      <Modal
        open={Boolean(perfil)}
        onClose={() => setPerfil(null)}
        title={perfil ? nombreCompleto(perfil) : ''}
        description={perfil ? `Código ${perfil.codigo || '—'} · ${estadoLabel(perfil.estado)}` : ''}
        size="lg"
        footer={
          perfil && puedeEditar ? (
            <div className="flex flex-col gap-2 sm:flex-row-reverse">
              <Button leftIcon={Pencil} onClick={() => { abrirEdicion(perfil); setPerfil(null); }} fullWidth className="sm:w-auto">
                Editar ficha
              </Button>
              <Button variant="danger" onClick={() => setConfirmarEliminar(perfil)} fullWidth className="sm:w-auto">
                Eliminar registro
              </Button>
            </div>
          ) : undefined
        }
      >
        {perfil && (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              {perfil.foto_url ? (
                <img src={perfil.foto_url} alt={`Foto de ${nombreCompleto(perfil)}`} className="h-20 w-20 rounded-2xl object-cover" />
              ) : (
                <div className="inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-brand-100 text-brand-800">
                  <Camera className="h-8 w-8" aria-hidden="true" />
                </div>
              )}
              <div>
                <Badge tone={estadoTone(perfil.estado)}>{estadoLabel(perfil.estado)}</Badge>
                <p className="mt-2 text-sm text-slate-600">Grado: <strong>{gradosPorId[perfil.grado_id] || 'No asignado'}</strong></p>
              </div>
            </div>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                { icono: IdCard, etiqueta: 'Cédula', valor: perfil.cedula },
                { icono: Phone, etiqueta: 'Teléfono', valor: perfil.telefono },
                { icono: MapPin, etiqueta: 'Dirección', valor: perfil.direccion },
                { icono: BadgeCheck, etiqueta: 'Ingreso', valor: formatearFecha(perfil.fecha_ingreso) },
              ].map((dato) => {
                const Icono = dato.icono;
                return (
                  <div key={dato.etiqueta} className="flex items-start gap-3 rounded-xl border border-slate-800 bg-[#0e1217]/70 p-3">
                    <Icono className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" aria-hidden="true" />
                    <div>
                      <dt className="text-xs font-medium text-slate-400">{dato.etiqueta}</dt>
                      <dd className="mt-0.5 text-sm font-semibold text-slate-200">{dato.valor || 'No registrado'}</dd>
                    </div>
                  </div>
                );
              })}
            </dl>
            {perfil.notas && (
              <Field label="Notas internas">
                <p className="rounded-xl border border-slate-800 bg-[#0e1217]/60 p-3 text-sm leading-relaxed text-slate-300">{perfil.notas}</p>
              </Field>
            )}
            <div className="rounded-xl border border-brand-500/20 bg-brand-950/30 p-4 text-sm text-brand-200">
              <p className="font-semibold text-brand-100">Siguiente paso recomendado</p>
              <p className="mt-1 leading-relaxed text-brand-200/90">
                Revisa que tenga asignación activa en <strong>Distribución</strong> y que su asistencia se registre diariamente.
              </p>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmarEliminar)}
        onClose={() => setConfirmarEliminar(null)}
        title="¿Eliminar este escolta?"
        description={confirmarEliminar ? `Se eliminará la ficha de ${nombreCompleto(confirmarEliminar)}. Las asignaciones relacionadas podrían verse afectadas.` : ''}
        confirmLabel="Sí, eliminar"
        onConfirm={eliminar}
        loading={guardando}
      />
    </div>
  );
}
