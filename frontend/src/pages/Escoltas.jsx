import ReporteModulo from "../components/ReporteModulo.jsx";
import { Link, useOutletContext } from 'react-router-dom';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRealtimeRecarga } from '../hooks/useRealtime.js';
import {
  ArchiveRestore,
  BadgeCheck,
  Building,
  Camera,
  Car,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Filter,
  IdCard,
  MapPin,
  Pencil,
  Phone,
  Printer,
  QrCode,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  UsersRound,
} from 'lucide-react';
import DataTable from '../components/DataTable.jsx';
import CarnetPersonal from '../components/CarnetPersonal.jsx';
import PapeleraModal from '../components/PapeleraModal.jsx';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Field,
  HelpTip,
  Input,
  Modal,
  Pagination,
  Select,
  Textarea,
  useToast,
} from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { apiFetch } from '../lib/api.js';
import { actualizar, crear, eliminar, formatearFecha, listar, nombreCompleto, TABLAS } from '../lib/data.js';
import { estadoLabel, estadoTone, OPCIONES_ESTADO_ESCOLTA } from '../lib/constants.js';

// Categorías oficiales dentro de Personal de Seguridad
export const CATEGORIAS_PERSONAL = [
  { id: 'todos', label: 'Todos los Equipos', icon: UsersRound, countKey: 'todos' },
  { id: 'escolta', label: 'Escoltas VIP / Custodia', icon: Shield, countKey: 'escolta' },
  { id: 'seguridad', label: 'Seguridad y Vigilancia', icon: ShieldCheck, countKey: 'seguridad' },
  { id: 'chofer', label: 'Choferes de Seguridad', icon: Car, countKey: 'chofer' },
];

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
  categoria: 'escolta', // 'escolta' | 'seguridad' | 'chofer'
  cargo: 'Escolta VIP / Custodia',
  area: 'Presidencia / Seguridad Operativa',
  turno: 'Diurno (08:00 - 20:00)',
  notas: '',
  foto_url: '',
};

export default function Escoltas() {
  const telefono = useOutletContext()?.telefono === true;
  const { role, user } = useAuth();
  const toast = useToast();
  const puedeEditar = ['admin', 'supervisor'].includes(role);

  const [personal, setPersonal] = useState([]);
  const [papelera, setPapelera] = useState([]);
  const [grados, setGrados] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [categoriaActiva, setCategoriaActiva] = useState('todos');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [pagina, setPagina] = useState(1);

  // Modales
  const [formulario, setFormulario] = useState(FORM_VACIO);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [perfilFicha, setPerfilFicha] = useState(null);
  const [modalPapelera, setModalPapelera] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errores, setErrores] = useState({});
  const [confirmarEliminar, setConfirmarEliminar] = useState(null);
  const [mostrarDirectorioMobile, setMostrarDirectorioMobile] = useState(false);

  // Cargar datos exclusivamente desde Supabase
  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [resultadoEscoltas, resultadoGrados] = await Promise.allSettled([
        listar(TABLAS.escoltas, { ordenarPor: 'nombres', ascendente: true }),
        listar(TABLAS.grados, { ordenarPor: 'nombre', ascendente: true }),
      ]);

      if (resultadoEscoltas.status === 'rejected') {
        throw new Error(resultadoEscoltas.reason?.message || 'Error al conectar con la tabla escoltas');
      }

      const datos = resultadoEscoltas.value || [];

      // Procesar y parsear metadatos operativos guardados en Supabase
      const procesados = datos.map((item) => {
        const notasTexto = String(item.notas || '');
        const catTag = notasTexto.match(/\[CAT:([^\]]+)\]/)?.[1];
        const cargoTag = notasTexto.match(/\[CARGO:([^\]]+)\]/)?.[1];
        const areaTag = notasTexto.match(/\[AREA:([^\]]+)\]/)?.[1];
        const turnoTag = notasTexto.match(/\[TURNO:([^\]]+)\]/)?.[1];

        let cat = catTag || 'escolta';
        if (!catTag) {
          if (item.codigo?.startsWith('SEG')) cat = 'seguridad';
          if (item.codigo?.startsWith('CHO')) cat = 'chofer';
        }

        return {
          ...item,
          categoria: cat,
          cargo: cargoTag || (cat === 'seguridad' ? 'Seguridad y Vigilancia' : cat === 'chofer' ? 'Chofer de Seguridad' : 'Escolta VIP / Custodia'),
          area: areaTag || 'Presidencia / Seguridad Operativa',
          turno: turnoTag || 'Diurno',
        };
      });

      // Separar activos/bajas operativas de la papelera real
      // Solo es papelera si tiene el marcador explícito [PAPELERA:true] en notas
      const procesadosConPapelera = procesados.map((p) => ({
        ...p,
        enPapelera: (p.notas || '').includes('[PAPELERA:true]'),
      }));

      const activos = procesadosConPapelera.filter((p) => !p.enPapelera);
      const enPapelera = procesadosConPapelera.filter((p) => p.enPapelera);

      setPersonal(activos);
      setPapelera(enPapelera);

      if (resultadoGrados.status === 'fulfilled') {
        setGrados(resultadoGrados.value || []);
      }
    } catch (err) {
      toast.error('No se pudo cargar la lista de personal', err.message);
    } finally {
      setCargando(false);
    }
  }, [toast]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useRealtimeRecarga(cargar, { tablas: ['escoltas', 'grados', 'profiles'] });

  const gradosPorId = useMemo(
    () => Object.fromEntries(grados.map((g) => [g.id, g.nombre || g.descripcion || 'Sin grado'])),
    [grados],
  );

  // Conteo de personal por categoría
  const conteoPorCategoria = useMemo(() => {
    const conteo = { todos: personal.length, escolta: 0, seguridad: 0, chofer: 0 };
    personal.forEach((p) => {
      const cat = p.categoria || 'escolta';
      if (conteo[cat] !== undefined) conteo[cat]++;
    });
    return conteo;
  }, [personal]);

  // Filtrado
  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return personal.filter((p) => {
      const coincideCat = categoriaActiva === 'todos' || (p.categoria || 'escolta') === categoriaActiva;
      const coincideEstado = filtroEstado === 'todos' || p.estado === filtroEstado;
      const coincideTexto =
        !texto ||
        [p.nombres, p.apellidos, p.codigo, p.cedula, p.telefono, p.cargo, p.area].some((val) =>
          String(val || '').toLowerCase().includes(texto),
        );
      return coincideCat && coincideEstado && coincideTexto;
    });
  }, [personal, categoriaActiva, filtroEstado, busqueda]);

  useEffect(() => {
    setPagina(1);
  }, [busqueda, categoriaActiva, filtroEstado]);

  const porPagina = 8;
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / porPagina));
  const visibles = filtrados.slice((pagina - 1) * porPagina, pagina * porPagina);

  const abrirNuevo = () => {
    setEditando(null);
    const prefijo = categoriaActiva === 'seguridad' ? 'SEG' : categoriaActiva === 'chofer' ? 'CHO' : 'ESC';
    setFormulario({
      ...FORM_VACIO,
      codigo: `${prefijo}-${String(personal.length + 150).padStart(4, '0')}`,
      categoria: categoriaActiva === 'todos' ? 'escolta' : categoriaActiva,
    });
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
      categoria: escolta.categoria || 'escolta',
      cargo: escolta.cargo || 'Escolta Operativo',
      area: escolta.area || 'Seguridad y Vigilancia',
      turno: escolta.turno || 'Diurno',
      estado: escolta.estado || 'activo',
      notas: (escolta.notas || '').replace(/\[(CAT|CARGO|AREA|TURNO):[^\]]+\]/g, '').trim(),
      foto_url: escolta.foto_url || '',
    });
    setErrores({});
    setModalAbierto(true);
  };

  const cambiarCampo = (campo, valor) => setFormulario((prev) => ({ ...prev, [campo]: valor }));

  const guardar = async () => {
    const nuevosErrores = {};
    if (!formulario.nombres.trim()) nuevosErrores.nombres = 'Escribe los nombres.';
    if (!formulario.apellidos.trim()) nuevosErrores.apellidos = 'Escribe los apellidos.';
    if (!formulario.cedula.trim()) nuevosErrores.cedula = 'La cédula es obligatoria.';
    if (!formulario.codigo.trim()) nuevosErrores.codigo = 'Asigna un código (ej. ESC-0147).';

    if (Object.keys(nuevosErrores).length) {
      setErrores(nuevosErrores);
      toast.warning('Revisa los campos obligatorios antes de continuar');
      return;
    }

    const notasLimpias = (formulario.notas || '').replace(/\[(CAT|CARGO|AREA|TURNO):[^\]]+\]/g, '').trim();
    const notasConMetadatos = `${notasLimpias} [CAT:${formulario.categoria}] [CARGO:${formulario.cargo}] [AREA:${formulario.area}] [TURNO:${formulario.turno}]`.trim();

    const valores = {
      codigo: formulario.codigo.trim(),
      nombres: formulario.nombres.trim(),
      apellidos: formulario.apellidos.trim(),
      cedula: formulario.cedula.trim(),
      telefono: formulario.telefono.trim() || null,
      direccion: formulario.direccion.trim() || null,
      fecha_ingreso: formulario.fecha_ingreso || null,
      grado_id: formulario.grado_id || null,
      estado: formulario.estado || 'activo',
      foto_url: formulario.foto_url.trim() || null,
      notas: notasConMetadatos,
    };

    try {
      setGuardando(true);
      if (editando) {
        await actualizar(TABLAS.escoltas, editando.id, valores);
        toast.success('Ficha actualizada');
      } else {
        await crear(TABLAS.escoltas, valores);
        toast.success('Personal registrado');
      }

      setModalAbierto(false);
      await cargar();
    } catch (error) {
      toast.error('Error al guardar en la base de datos', error.message);
    } finally {
      setGuardando(false);
    }
  };

  // Enviar a la Papelera directamente en Supabase (con etiqueta explícita de papelera)
  const enviarAPapelera = async (registro) => {
    try {
      setGuardando(true);
      const notasActuales = (registro.notas || '').replace(/\[PAPELERA:[^\]]+\]/g, '').trim();
      const notasConPapelera = `${notasActuales} [PAPELERA:true]`.trim();

      await actualizar(TABLAS.escoltas, registro.id, {
        notas: notasConPapelera,
      });
      toast.success(
        'Movido a la papelera',
        `${nombreCompleto(registro)} fue enviado a la papelera. Su historial laboral se conserva.`,
      );
      setPerfilFicha(null);
      setConfirmarEliminar(null);
      await cargar();
    } catch (error) {
      toast.error('No se pudo mover a la papelera', error.message);
    } finally {
      setGuardando(false);
    }
  };

  // Restaurar desde la papelera directamente en Supabase
  const restaurarDePapelera = async (registro) => {
    try {
      setGuardando(true);
      const notasSinPapelera = (registro.notas || '').replace(/\[PAPELERA:[^\]]+\]/g, '').trim();

      await actualizar(TABLAS.escoltas, registro.id, {
        notas: notasSinPapelera,
      });
      toast.success('Registro restaurado', `${nombreCompleto(registro)} vuelve a estar disponible.`);
      await cargar();
    } catch (error) {
      toast.error('No se pudo restaurar el registro', error.message);
    } finally {
      setGuardando(false);
    }
  };

  // Vaciar papelera permanentemente mediante endpoint atómico que protege el historial
  const vaciarPapeleraDefinitivo = async () => {
    if (!puedeEditar) {
      toast.error('No autorizado', 'Solo administradores pueden vaciar la papelera.');
      return;
    }

    try {
      setGuardando(true);
      const res = await apiFetch('/escoltas/vaciar-papelera', { method: 'POST' });
      const { purgados = 0, protegidos = 0 } = res?.data || res || {};

      setModalPapelera(false);
      await cargar();

      if (protegidos > 0) {
        toast.warning(
          `${purgados} purgado(s), ${protegidos} protegido(s)`,
          'Los registros con asignaciones o recibos de nómina históricos se mantienen automáticamente para preservar la integridad.',
        );
      } else if (purgados > 0) {
        toast.success('Papelera vaciada con éxito', `${purgados} registro(s) eliminados definitivamente.`);
      } else {
        toast.info('No se eliminaron registros', 'La papelera está vacía o todos los registros tienen dependencias protegidas.');
      }
    } catch (error) {
      toast.error('Error al procesar el vaciado de papelera', error.message);
    } finally {
      setGuardando(false);
    }
  };

  const columnas = [
    {
      key: 'escolta',
      label: 'Personal / Integrante',
      primary: true,
      render: (fila) => (
        <div className="flex items-center gap-3">
          {fila.foto_url ? (
            <img src={fila.foto_url} alt="" className="h-10 w-10 shrink-0 rounded-xl object-cover border border-slate-700 shadow-sm" />
          ) : (
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#ff8a00] to-[#ffd54a] text-xs font-bold text-black shadow-sm">
              {nombreCompleto(fila).split(' ').map((p) => p[0]).slice(0, 2).join('')}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate font-bold text-slate-100 flex items-center gap-2">
              {nombreCompleto(fila)}
            </p>
            <p className="text-xs text-slate-400 font-mono">
              {fila.codigo || 'S/C'} · {fila.cargo || 'Seguridad'}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'categoria',
      label: 'Categoría',
      render: (fila) => {
        const cat = fila.categoria || 'escolta';
        const config = {
          escolta: { label: 'ESCOLTA VIP', tone: 'naranja' },
          seguridad: { label: 'SEGURIDAD', tone: 'azul' },
          chofer: { label: 'CHOFER', tone: 'verde' },
        }[cat] || { label: 'PERSONAL', tone: 'gris' };

        return <Badge tone={config.tone}>{config.label}</Badge>;
      },
    },
    { key: 'cedula', label: 'Cédula', render: (fila) => fila.cedula || '—' },
    { key: 'telefono', label: 'Contacto', render: (fila) => fila.telefono || '—', mobile: false },
    { key: 'turno', label: 'Turno', render: (fila) => fila.turno || 'Diurno', mobile: false },
    { key: 'estado', label: 'Estado', render: (fila) => <Badge tone={estadoTone(fila.estado)}>{estadoLabel(fila.estado)}</Badge> },
  ];

  return (
    <div className="space-y-6">
      <ReporteModulo titulo="Personal" archivo="personal" columnas={["Código","Nombre","Categoría","Cargo","Estado"]}
        filas={filtrados.map((r) => [r.codigo, nombreCompleto(r), r.categoria, r.cargo, r.estado])} indicadores={[["Activos", filtrados.filter((r) => r.estado === "activo").length]]} deshabilitado={cargando} />
      {/* Cabecera Principal con Identidad Corporativa */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#ff8a00] to-[#ffd54a] p-0.5 shadow-md">
              <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-[#14171c]">
                <ShieldCheck className="h-5 w-5 text-[#ff8a00]" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                Personal y Escoltas
              </h1>
              <p className="text-xs font-bold text-[#ff8a00] uppercase tracking-wider">
                Custodia VIP · Seguridad y Vigilancia · Choferes
              </p>
            </div>
          </div>
          <p className="mt-2 text-sm text-slate-400 max-w-2xl">
            Expediente digital, emisión de carnet institucional con QR escaneable y código de barras y ficha oficial en PDF.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-center">
          {/* Botón Papelera estilo GT */}
          <Button
            variant="outline"
            size="md"
            leftIcon={Trash2}
            onClick={() => setModalPapelera(true)}
            className="relative"
          >
            Papelera
            {papelera.length > 0 && (
              <span className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-black border border-rose-500/40">
                {papelera.length}
              </span>
            )}
          </Button>

          {puedeEditar && (
            <Button size="md" variant="primary" leftIcon={UserPlus} onClick={abrirNuevo}>
              Registrar Personal
            </Button>
          )}
        </div>
      </header>

      {!telefono && ['admin', 'supervisor', 'contador', 'rrhh'].includes(role) && (
        <Link to="/escoltas/administrativo" className="inline-flex min-h-11 items-center rounded-xl border border-brand-500/40 px-4 text-sm font-semibold text-brand-400">
          Fichas administrativas
        </Link>
      )}

      {/* Vista resumida de acción rápida para teléfonos */}
      <div className={telefono ? 'space-y-3' : 'space-y-3 md:hidden'}>
        <div className="rounded-2xl border border-slate-800 bg-[#161a22] p-4 shadow-md space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#ff8a00]" />
              <span className="text-xs font-black uppercase text-slate-200">Personal Operativo</span>
            </div>
            <span className="text-xs font-mono font-bold text-slate-400">
              {personal.filter((persona) => persona.estado === 'activo').length} activos
            </span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-2 text-xs">
              <span className="px-2 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300">
                VIP: <strong className="text-white">{conteoPorCategoria.escolta || 0}</strong>
              </span>
              <span className="px-2 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300">
                Chofer: <strong className="text-white">{conteoPorCategoria.chofer || 0}</strong>
              </span>
            </div>
            {puedeEditar && (
              <Button size="sm" variant="primary" leftIcon={UserPlus} onClick={abrirNuevo}>
                Nuevo
              </Button>
            )}
          </div>
        </div>

        {/* Botón para desplegar directorio completo bajo demanda en teléfonos */}
        <button
          type="button"
          onClick={() => setMostrarDirectorioMobile((prev) => !prev)}
          className="w-full flex items-center justify-between p-3.5 rounded-xl border border-slate-800 bg-[#14171c] hover:bg-slate-800/80 text-xs font-bold text-slate-200 shadow-sm transition-all"
        >
          <span className="flex items-center gap-2">
            <UsersRound className="h-4 w-4 text-[#ff8a00]" />
            {mostrarDirectorioMobile ? 'Ocultar directorio de personal' : `Ver lista completa (${filtrados.length})`}
          </span>
          <span className="text-slate-400 font-mono text-xs">{mostrarDirectorioMobile ? '▲ Ocultar' : '▼ Expandir'}</span>
        </button>
      </div>

      {/* Contenedor completo: visible en desktop (md:block) o bajo demanda en móvil */}
      <div className={mostrarDirectorioMobile ? 'space-y-6 block' : (telefono ? 'hidden' : 'hidden md:block') + ' space-y-6'}>
        {/* Pestañas de Selección de Categoría (Escoltas / Seguridad / Choferes) */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl border border-slate-800 bg-[#0e1217]">
        {CATEGORIAS_PERSONAL.map((cat) => {
          const Icono = cat.icon;
          const activa = categoriaActiva === cat.id;
          const cantidad = conteoPorCategoria[cat.countKey] || 0;

          return (
            <button
              key={cat.id}
              onClick={() => setCategoriaActiva(cat.id)}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activa
                  ? 'bg-gradient-to-r from-[#ff8a00] to-[#e67a00] text-black shadow-lg shadow-[#ff8a00]/20 font-black'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Icono className={`h-4 w-4 ${activa ? 'text-black' : 'text-[#ff8a00]'}`} />
              <span>{cat.label}</span>
              <span
                className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                  activa ? 'bg-black/20 text-black' : 'bg-slate-800 text-slate-300 border border-slate-700'
                }`}
              >
                {cantidad}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tarjeta de Lista con Filtros */}
      <Card
        title={`Listado: ${CATEGORIAS_PERSONAL.find((c) => c.id === categoriaActiva)?.label || 'Personal'}`}
        subtitle={`${filtrados.length} integrantes registrados en base de datos`}
        actions={
          <HelpTip title="Gestión de Personal">
            Selecciona una fila para abrir la ficha, emitir el carnet o imprimir el expediente.
          </HelpTip>
        }
      >
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre, código, cédula, cargo o área…"
              className="block min-h-11 w-full rounded-xl border border-slate-700 bg-slate-900/80 pl-10 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-[#ff8a00] focus:outline-none focus:ring-2 focus:ring-[#ff8a00]/20"
            />
          </div>
          <div className="relative">
            <Filter className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-slate-400" aria-hidden="true" />
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="block min-h-11 w-full appearance-none rounded-xl border border-slate-700 bg-slate-900/80 pl-10 pr-3 text-sm text-slate-100 focus:border-[#ff8a00] focus:outline-none focus:ring-2 focus:ring-[#ff8a00]/20"
            >
              <option value="todos">Todos los estados operativos</option>
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
          emptyTitle="No hay integrantes en esta sección"
          emptyDescription="Puedes cambiar de pestaña o registrar un nuevo integrante."
          emptyActionLabel={puedeEditar ? 'Registrar Personal' : undefined}
          onEmptyAction={puedeEditar ? abrirNuevo : undefined}
          emptyIcon={UsersRound}
          onRowClick={(fila) => setPerfilFicha(fila)}
          actions={(fila) => (
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <Button
                variant="primary"
                size="sm"
                leftIcon={IdCard}
                onClick={() => setPerfilFicha(fila)}
                title="Ver Carnet y Ficha Oficial"
                className="whitespace-nowrap px-3 text-xs font-bold"
              >
                Carnet
              </Button>
              {puedeEditar && (
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={Pencil}
                  onClick={() => abrirEdicion(fila)}
                  title="Editar"
                />
              )}
            </div>
          )}
        />

        <div className="mt-4">
          <Pagination page={pagina} totalPages={totalPaginas} totalItems={filtrados.length} onChange={setPagina} />
        </div>
      </Card>
      </div>

      {/* Modal Ficha Técnica y Carnet Oficial */}
      <Modal
        open={Boolean(perfilFicha)}
        onClose={() => setPerfilFicha(null)}
        title={perfilFicha ? `Expediente: ${nombreCompleto(perfilFicha)}` : ''}
        description={perfilFicha ? `Código ${perfilFicha.codigo} · ${perfilFicha.cargo || 'Personal de Seguridad'}` : ''}
        size="xl"
        footer={
          perfilFicha && (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between w-full">
              <div className="flex items-center gap-2">
                {puedeEditar && (
                  <Button
                    variant="danger"
                    size="sm"
                    leftIcon={Trash2}
                    onClick={() => {
                      setConfirmarEliminar(perfilFicha);
                    }}
                  >
                    Enviar a Papelera
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPerfilFicha(null)}>
                  Cerrar
                </Button>
                {puedeEditar && (
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={Pencil}
                    onClick={() => {
                      const sel = perfilFicha;
                      setPerfilFicha(null);
                      abrirEdicion(sel);
                    }}
                  >
                    Editar Ficha
                  </Button>
                )}
              </div>
            </div>
          )
        }
      >
        {perfilFicha && (
          <div className="space-y-6">
            {/* Componente de Carnet Digital Integrado (Frente y Reverso sin hueco central, QR Real) */}
            <CarnetPersonal escolta={perfilFicha} grado={perfilFicha.cargo} />

            {/* Datos detallados de expediente */}
            <div className="border-t border-slate-800 pt-5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#ff8a00] mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4" /> Expediente Operativo y Ubicación
              </h4>
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-800 bg-[#14171c] p-3">
                  <dt className="text-[11px] font-bold text-slate-400 uppercase">Cédula</dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-100">{perfilFicha.cedula || 'No registrada'}</dd>
                </div>
                <div className="rounded-xl border border-slate-800 bg-[#14171c] p-3">
                  <dt className="text-[11px] font-bold text-slate-400 uppercase">Teléfono de Contacto</dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-100">{perfilFicha.telefono || 'No registrado'}</dd>
                </div>
                <div className="rounded-xl border border-slate-800 bg-[#14171c] p-3">
                  <dt className="text-[11px] font-bold text-slate-400 uppercase">Turno Asignado</dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-100">{perfilFicha.turno || 'Diurno'}</dd>
                </div>
                <div className="rounded-xl border border-slate-800 bg-[#14171c] p-3 sm:col-span-2">
                  <dt className="text-[11px] font-bold text-slate-400 uppercase">Dirección de Residencia</dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-100">{perfilFicha.direccion || 'No registrada'}</dd>
                </div>
                <div className="rounded-xl border border-slate-800 bg-[#14171c] p-3">
                  <dt className="text-[11px] font-bold text-slate-400 uppercase">Fecha de Ingreso</dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-100">{formatearFecha(perfilFicha.fecha_ingreso)}</dd>
                </div>
              </dl>
              {perfilFicha.notas && (
                <div className="mt-3 rounded-xl border border-slate-800 bg-[#14171c] p-3 text-xs text-slate-300">
                  <span className="font-bold text-[#ffd54a] block mb-1">Notas y Acreditaciones:</span>
                  {(perfilFicha.notas || '').replace(/\[(CAT|CARGO|AREA|TURNO):[^\]]+\]/g, '').trim()}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Formulario Registro / Edición */}
      <Modal
        open={modalAbierto}
        onClose={() => setModalAbierto(false)}
        title={editando ? 'Editar Ficha de Personal' : 'Registrar Nuevo Integrante'}
        description="Completa la información del personal."
        size="lg"
        footer={
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <Button onClick={guardar} loading={guardando} fullWidth className="sm:w-auto">
              {editando ? 'Guardar Cambios' : 'Registrar Personal'}
            </Button>
            <Button variant="outline" onClick={() => setModalAbierto(false)} disabled={guardando} fullWidth className="sm:w-auto">
              Cancelar
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Selector de Categoría Principal */}
          <div className="sm:col-span-2 rounded-xl border border-[#ff8a00]/30 bg-[#ff8a00]/10 p-3">
            <label className="block text-xs font-bold text-[#ff8a00] uppercase mb-1.5">
              Categoría / Especialidad de Servicio *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'escolta', label: 'Escolta VIP' },
                { id: 'seguridad', label: 'Seguridad' },
                { id: 'chofer', label: 'Chofer' },
              ].map((opt) => (
                <button
                  type="button"
                  key={opt.id}
                  onClick={() => {
                    cambiarCampo('categoria', opt.id);
                    if (opt.id === 'escolta') cambiarCampo('cargo', 'Escolta VIP / Custodia Directa');
                    if (opt.id === 'seguridad') cambiarCampo('cargo', 'Vigilante / Seguridad de Instalaciones');
                    if (opt.id === 'chofer') cambiarCampo('cargo', 'Conductor de Seguridad Blindada');
                  }}
                  className={`py-2 px-3 rounded-xl text-xs font-black transition-all ${
                    formulario.categoria === opt.id
                      ? 'bg-[#ff8a00] text-black shadow-md'
                      : 'bg-slate-900 border border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <Input
            label="Nombres" required value={formulario.nombres} error={errores.nombres}
            onChange={(e) => cambiarCampo('nombres', e.target.value)} placeholder="Ej. Carlos Alberto"
          />
          <Input
            label="Apellidos" required value={formulario.apellidos} error={errores.apellidos}
            onChange={(e) => cambiarCampo('apellidos', e.target.value)} placeholder="Ej. Méndez García"
          />
          <Input
            label="Código Interno" required value={formulario.codigo} error={errores.codigo}
            onChange={(e) => cambiarCampo('codigo', e.target.value)} placeholder="Ej. ESC-0147"
          />
          <Input
            label="Cédula de Identidad" required value={formulario.cedula} error={errores.cedula}
            onChange={(e) => cambiarCampo('cedula', e.target.value)} placeholder="Ej. V-20.458.763"
          />
          <Input
            label="Cargo / Función Específica" value={formulario.cargo}
            onChange={(e) => cambiarCampo('cargo', e.target.value)} placeholder="Ej. Escolta VIP / Presidencia"
          />
          <Input
            label="Área / Sede Asignada" value={formulario.area}
            onChange={(e) => cambiarCampo('area', e.target.value)} placeholder="Ej. Presidencia / Sede Principal"
          />
          <Input
            label="Teléfono Móvil" type="tel" value={formulario.telefono}
            onChange={(e) => cambiarCampo('telefono', e.target.value)} placeholder="Ej. 0414-1234567"
          />
          <Input
            label="Turno Habitual" value={formulario.turno}
            onChange={(e) => cambiarCampo('turno', e.target.value)} placeholder="Ej. Diurno (08:00 - 20:00)"
          />
          <Input
            label="Fecha de Ingreso" type="date" value={formulario.fecha_ingreso}
            onChange={(e) => cambiarCampo('fecha_ingreso', e.target.value)}
          />
          <Select
            label="Estado Operativo" value={formulario.estado}
            onChange={(e) => cambiarCampo('estado', e.target.value)}
            options={OPCIONES_ESTADO_ESCOLTA}
          />
          <Input
            label="URL de la Foto" type="url" value={formulario.foto_url} containerClassName="sm:col-span-2"
            onChange={(e) => cambiarCampo('foto_url', e.target.value)} placeholder="https://…"
            help="Opcional. Foto oficial para el carnet y expediente."
          />
          <Input
            label="Dirección de Residencia" value={formulario.direccion} containerClassName="sm:col-span-2"
            onChange={(e) => cambiarCampo('direccion', e.target.value)} placeholder="Ciudad, Urbanización o Sector"
          />
          <Textarea
            label="Notas Internas y Acreditaciones" value={formulario.notas} containerClassName="sm:col-span-2"
            onChange={(e) => cambiarCampo('notas', e.target.value)}
            placeholder="Cursos tácticos, manejo defensivo, porte de arma, etc."
          />
        </div>
      </Modal>

      {/* Modal Papelera Universal estilo Golden Touch conectado a Supabase */}
      <PapeleraModal
        abierto={modalPapelera}
        alCerrar={() => setModalPapelera(false)}
        titulo="Papelera de Personal y Escoltas"
        tipo="personal"
        registros={papelera}
        alRestaurar={restaurarDePapelera}
        alVaciar={vaciarPapeleraDefinitivo}
        cargando={guardando}
      />

      {/* Diálogo de Confirmación para mover a Papelera */}
      <ConfirmDialog
        open={Boolean(confirmarEliminar)}
        onClose={() => setConfirmarEliminar(null)}
        title="¿Enviar a la papelera?"
        description={
          confirmarEliminar
            ? `Se moverá la ficha de ${nombreCompleto(confirmarEliminar)} a la papelera. Podrás restaurarla en cualquier momento.`
            : ''
        }
        confirmLabel="Sí, mover a papelera"
        onConfirm={() => enviarAPapelera(confirmarEliminar)}
        loading={guardando}
      />
    </div>
  );
}
