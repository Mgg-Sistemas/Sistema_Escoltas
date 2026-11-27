import MatrizRoles, { normalizarNiveles } from "../components/MatrizRoles.jsx";
import ReporteModulo from "../components/ReporteModulo.jsx";
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { VISTAS_TELEFONO } from '../lib/vistasTelefono.js';
import { useSearchParams } from 'react-router-dom';
import {
  CheckCheck,
  KeyRound,
  LockKeyhole,
  RotateCcw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Unlock,
  UserCheck,
  UserCog,
  UserPlus,
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
  useToast,
} from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useRealtimeRecarga } from '../hooks/useRealtime.js';
import { api } from '../lib/api.js';
import { MODULOS_SISTEMA, ROLES_LABELS } from '../lib/constants.js';
import { listar, nombreCompleto, TABLAS } from '../lib/data.js';

const ROL_ADMINISTRACION = 'administracion';
const ROLES_INICIALES = ['admin', 'escolta', ROL_ADMINISTRACION];
const ROLES_HISTORICOS = new Set(['supervisor', 'contador', 'rrhh', 'chofer']);
const FORM_ROL = { key: '', label: '', descripcion: '' };
const MODULOS_OPERACION = ['dashboard', 'escoltas', 'distribucion', 'permisos', 'asistencias'];
const MODULOS_GESTION = ['nomina', 'pagos', 'rrhh'];
const GRUPOS_PERMISOS = [
  { etiqueta: 'Operación', incluye: ({ key }) => MODULOS_OPERACION.includes(key) },
  { etiqueta: 'Gestión', incluye: ({ key }) => MODULOS_GESTION.includes(key) },
  { etiqueta: 'Sistema', incluye: ({ key }) => !MODULOS_OPERACION.includes(key) && !MODULOS_GESTION.includes(key) },
];

const FORMULARIO_VACIO = {
  usuario: '',
  nombre: '',
  apellido: '',
  telefono: '',
  role: 'admin',
  escolta_id: '',
};

export default function Usuarios() {
  const { user: usuarioActual } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabActual = searchParams.get('tab');

  const [vista, setVista] = useState(() => {
    if (tabActual === 'roles') return 'roles';
    if (tabActual === 'autorizados') return 'autorizados';
    return 'usuarios';
  });

  useEffect(() => {
    if (tabActual === 'roles' || tabActual === 'autorizados' || tabActual === 'usuarios') {
      setVista(tabActual);
    }
  }, [tabActual]);

  const cambiarVista = (nuevaVista) => {
    setVista(nuevaVista);
    setSearchParams({ tab: nuevaVista });
  };
  const [perfiles, setPerfiles] = useState([]);
  const [escoltas, setEscoltas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [creando, setCreando] = useState(false);
  const [formulario, setFormulario] = useState(FORMULARIO_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [credencial, setCredencial] = useState(null);

  // Roles y Permisos (Estilo GT)
  const [roles, setRoles] = useState([]);
  const [matrices, setMatrices] = useState({});
  const [configTelefono, setConfigTelefono] = useState({});
  const [rolActivo, setRolActivo] = useState('');
  const [rolesPersonalizados, setRolesPersonalizados] = useState([]);
  const [asignacionPersonalizada, setAsignacionPersonalizada] = useState({ habilitado: false, roles: [] });
  const [edicionRol, setEdicionRol] = useState(null);
  const [modalRol, setModalRol] = useState(false);
  const [nuevoRol, setNuevoRol] = useState(FORM_ROL);
  const [creandoRol, setCreandoRol] = useState(false);
  const clavesVisibles = new Set(ROLES_INICIALES);
  for (const { key } of [...rolesPersonalizados, ...asignacionPersonalizada.roles]) {
    if (!ROLES_HISTORICOS.has(key)) clavesVisibles.add(key);
  }
  const catalogoRoles = [...clavesVisibles].flatMap((clave) => {
    const registro = roles.find(({ nombre }) => nombre === clave);
    const ficha = rolesPersonalizados.find(({ key }) => key === clave);
    const asignable = asignacionPersonalizada.roles.find(({ key }) => key === clave);
    const personalizado = clave !== 'admin' && clave !== 'escolta';
    if (personalizado && !ficha && !asignable) return [];
    return [{
      value: clave,
      label: clave === ROL_ADMINISTRACION ? 'Administración' : (asignable?.label ?? ficha?.label ?? ROLES_LABELS[clave]),
      descripcion: ficha?.descripcion ?? asignable?.descripcion ?? registro?.descripcion ?? '',
      personalizado,
      pendiente: personalizado && !asignable,
    }];
  });
  const opcionesRoles = catalogoRoles.filter(({ pendiente }) => !pendiente)
    .map(({ value, label }) => ({ value, label }));

  const rolPersonalizado = Boolean(catalogoRoles.find(({ value }) => value === rolActivo)?.personalizado);
  const permiteLectura = () => true;
  const nombreRol = (clave) => catalogoRoles.find(({ value }) => value === clave)?.label || ROLES_LABELS[clave] || clave;
  const telefonoRol = configTelefono[rolActivo] ?? { vistas_telefono: [], solo_telefono: false };

  const actualizarTelefonoRol = (cambios) => {
    setConfigTelefono((prev) => ({ ...prev, [rolActivo]: { ...telefonoRol, ...cambios } }));
  };
  const [guardandoPermisos, setGuardandoPermisos] = useState(false);

  // Usuarios Autorizados
  const [autorizados, setAutorizados] = useState([]);
  const [modalAutorizado, setModalAutorizado] = useState(false);
  const [formAutorizado, setFormAutorizado] = useState({ usuario_id: '', modulo: 'pagos', accion: 'aprobar' });

  // Dialogo de confirmación
  const [dialogo, setDialogo] = useState({
    abierto: false,
    titulo: '',
    mensaje: '',
    peligro: false,
    accion: null,
  });

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [listaPerfiles, listaEscoltas, datosRoles, listaAut, catalogoPersonalizado, habilitacion] = await Promise.all([
        api.listarUsuarios(),
        listar(TABLAS.escoltas, { select: 'id,nombres,apellidos,cedula,codigo', ordenarPor: 'nombres', ascendente: true }).catch(() => []),
        api.obtenerRoles().catch(() => ({ roles: [], matriz: [] })),
        api.listarAutorizados().catch(() => []),
        api.listarRolesPersonalizados().catch(() => []),
        api.listarRolesPersonalizadosAsignables().catch(() => ({ habilitado: false, roles: [] })),
      ]);

      setPerfiles(listaPerfiles || []);
      setEscoltas(listaEscoltas || []);
      setAutorizados(listaAut || []);
      setAsignacionPersonalizada(habilitacion);
      setRolesPersonalizados((catalogoPersonalizado ?? []).filter((rol) => !rol.sistema));

      if (datosRoles?.matriz) {
        const porRol = Object.fromEntries(
          datosRoles.matriz.map((fila) => [fila.role, fila.permisos ?? {}]),
        );
        setMatrices(porRol);
        setConfigTelefono(Object.fromEntries(datosRoles.matriz.map((fila) => [
          fila.role,
          { vistas_telefono: fila.vistas_telefono ?? [], solo_telefono: fila.solo_telefono === true },
        ])));
      }
      if (datosRoles?.roles) {
        setRoles(datosRoles.roles);
      }
    } catch (error) {
      toast.error(error.message || 'No fue posible cargar los datos de usuarios.');
    } finally {
      setCargando(false);
    }
  }, [toast]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useRealtimeRecarga(TABLAS.profiles, cargar);

  const perfilesFiltrados = useMemo(() => {
    if (!busqueda) return perfiles;
    const termino = busqueda.toLowerCase();
    return perfiles.filter(
      (perfil) =>
        (perfil.full_name || perfil.nombre_completo || perfil.usuario || '').toLowerCase().includes(termino) ||
        perfil.email?.toLowerCase().includes(termino) ||
        perfil.usuario?.toLowerCase().includes(termino) ||
        perfil.username?.toLowerCase().includes(termino) ||
        perfil.role?.toLowerCase().includes(termino),
    );
  }, [perfiles, busqueda]);

  const handleCrearUsuario = async (evento) => {
    evento.preventDefault();
    setGuardando(true);
    try {
      const payload = {
        usuario: formulario.usuario.trim(),
        nombre: formulario.nombre.trim(),
        apellido: formulario.apellido.trim(),
        telefono: formulario.telefono.trim(),
        role: formulario.role,
        escolta_id: formulario.role === 'escolta' && formulario.escolta_id ? formulario.escolta_id : null,
      };

      const creado = await api.crearUsuario(payload);
      toast.success('Usuario @' + creado.usuario + ' creado.');
      setCredencial({ usuario: creado.usuario, password_temporal: creado.clave_temporal });
      setCreando(false);
      setFormulario(FORMULARIO_VACIO);
      await cargar();
    } catch (error) {
      toast.error(error.message || 'No fue posible crear el usuario.');
    } finally {
      setGuardando(false);
    }
  };

  const handleRestablecerClave = (perfil) => {
    setDialogo({
      abierto: true,
      titulo: 'Restablecer contraseña',
      mensaje: `Se generará una clave temporal para @${perfil.username} y se obligará al cambio en el próximo inicio.`,
      peligro: false,
      accion: async () => {
        try {
          const resultado = await api.restablecerClaveUsuario(perfil.id);
          toast.success('Contraseña restablecida con éxito.');
          setCredencial(resultado.credencial_temporal);
        } catch (error) {
          toast.error(error.message || 'No fue posible restablecer la contraseña.');
        }
      },
    });
  };

  const handleDesbloquear = (perfil) => {
    setDialogo({
      abierto: true,
      titulo: 'Desbloquear acceso',
      mensaje: `¿Deseas reactivar el acceso y limpiar intentos fallidos de @${perfil.username}?`,
      peligro: false,
      accion: async () => {
        try {
          await api.desbloquearUsuario(perfil.id);
          toast.success(`Usuario @${perfil.username} desbloqueado.`);
          await cargar();
        } catch (error) {
          toast.error(error.message || 'No fue posible desbloquear al usuario.');
        }
      },
    });
  };

  const handleTogglePermiso = (moduloKey, nivel) => {
    setMatrices((actuales) => {
      const actualRol = actuales[rolActivo] ?? {};
      const actualModulo = normalizarNiveles(actualRol[moduloKey]);
      const nuevoValor = !actualModulo[nivel];
      const actualizado = { ...actualModulo, [nivel]: nuevoValor };

      if (nivel === 'full') {
        if (nuevoValor) {
          actualizado.lectura = true;
          actualizado.escritura = true;
          actualizado.full = true;
        } else {
          actualizado.full = false;
        }
      } else if (nivel === 'escritura') {
        if (nuevoValor) {
          actualizado.lectura = true;
          actualizado.escritura = true;
        } else {
          actualizado.escritura = false;
          actualizado.full = false;
        }
      } else if (nivel === 'lectura') {
        if (!nuevoValor) {
          actualizado.lectura = false;
          actualizado.escritura = false;
          actualizado.full = false;
        } else {
          actualizado.lectura = true;
        }
      }

      return {
        ...actuales,
        [rolActivo]: {
          ...actualRol,
          [moduloKey]: actualizado,
        },
      };
    });
  };

  const crearRol = async (evento) => {
    evento.preventDefault();
    setCreandoRol(true);
    try {
      const creado = await api.guardarRolPersonalizado(nuevoRol);
      setRolesPersonalizados((prev) => [...prev, creado]);
      if (asignacionPersonalizada.habilitado) {
        setAsignacionPersonalizada((prev) => ({ ...prev, roles: [...prev.roles, creado] }));
      }
      setRolActivo(creado.key);
      setModalRol(false);
      setNuevoRol(FORM_ROL);
      toast.success('Rol registrado en el catálogo.');
    } catch (error) {
      toast.error(error.message || 'No fue posible crear el rol.');
    } finally {
      setCreandoRol(false);
    }
  };

  const cambiarRolUsuario = async (evento) => {
    evento.preventDefault();
    setGuardando(true);
    try {
      const { id, role, escoltaId } = edicionRol;
      await api.actualizarUsuario(id, { role, ...(role === 'escolta' && escoltaId ? { escolta_id: escoltaId } : {}) });
      toast.success('Rol del usuario actualizado.');
      setEdicionRol(null);
      await cargar();
    } catch (error) {
      toast.error(error.message || 'No fue posible asignar el rol.');
    } finally {
      setGuardando(false);
    }
  };

  const handleGuardarPermisos = async () => {
    setGuardandoPermisos(true);
    try {
      const permisosRaw = matrices[rolActivo] ?? {};
      const permisosNormalizados = {};
      for (const mod of MODULOS_SISTEMA) {
        permisosNormalizados[mod.key] = normalizarNiveles(permisosRaw[mod.key]);
      }

      await api.guardarPermisosRol({
        role: rolActivo,
        permisos: permisosNormalizados,
        ...telefonoRol,
        vistas_telefono: telefonoRol.vistas_telefono ?? [],
      });
      toast.success(`Matriz de permisos de "${ROLES_LABELS[rolActivo] || rolActivo}" guardada.`);
    } catch (error) {
      toast.error(error.message || 'No fue posible guardar la matriz.');
    } finally {
      setGuardandoPermisos(false);
    }
  };

  const handleCrearAutorizado = async (e) => {
    e.preventDefault();
    try {
      await api.crearAutorizado(formAutorizado);
      toast.success('Usuario autorizado registrado');
      setModalAutorizado(false);
      const res = await api.listarAutorizados();
      setAutorizados(res || []);
    } catch (err) {
      toast.error(err.message || 'Error al autorizar');
    }
  };

  const handleEliminarAutorizado = async (id) => {
    try {
      await api.eliminarAutorizado(id);
      toast.success('Autorización revocada');
      setAutorizados((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      toast.error(err.message || 'Error al revocar');
    }
  };

  const columnas = [
    {
      encabezado: 'Usuario',
      clave: 'usuario',
      render: (fila) => (
        <div>
          <div className="font-semibold text-slate-100 flex items-center gap-1.5">
            <span>{fila.full_name || fila.nombre_completo || fila.usuario || 'Sin nombre'}</span>
            {fila.id === usuarioActual?.id && (
              <span className="text-[10px] bg-brand-500/20 text-brand-400 font-bold px-1.5 py-0.2 rounded">TÚ</span>
            )}
          </div>
          <div className="text-xs text-slate-400 font-mono">@{fila.usuario || fila.username || 'usuario'}</div>
        </div>
      ),
    },
    {
      encabezado: 'Rol del Sistema',
      clave: 'role',
      render: (fila) => (
        <Badge tone={fila.role === 'admin' ? 'naranja' : fila.role === 'contador' ? 'verde' : fila.role === 'supervisor' ? 'azul' : 'morado'}>
          {nombreRol(fila.role)}
        </Badge>
      ),
    },
    {
      encabezado: 'Estado de Cuenta',
      clave: 'active',
      render: (fila) => {
        const estaActivo = fila.active !== false;
        const bloqueadoTemporal = Boolean(fila.bloqueado_hasta && new Date(fila.bloqueado_hasta) > new Date());

        return (
          <div className="flex flex-col gap-1 items-start">
            <Badge tone={bloqueadoTemporal ? 'naranja' : estaActivo ? 'verde' : 'rojo'}>
              {bloqueadoTemporal ? 'Bloqueo temporal' : estaActivo ? 'Activo' : 'Bloqueado'}
            </Badge>
            {fila.must_change_password && (
              <span className="text-[10px] font-medium text-amber-400 flex items-center gap-0.5">
                <KeyRound className="h-2.5 w-2.5" /> Clave temporal
              </span>
            )}
          </div>
        );
      },
    },
    {
      encabezado: 'Acciones',
      clave: 'acciones',
      render: (fila) => {
        const estaActivo = fila.active !== false;
        const bloqueadoTemporal = Boolean(fila.bloqueado_hasta && new Date(fila.bloqueado_hasta) > new Date());

        return (
          <div className="flex flex-wrap items-center gap-2">
            {fila.id !== usuarioActual?.id && (
              <Button size="sm" variant="outline" onClick={() => setEdicionRol({ id: fila.id, role: opcionesRoles.some(({ value }) => value === fila.role) ? fila.role : '', escoltaId: '' })}>
                Cambiar rol
              </Button>
            )}
            {!estaActivo || bloqueadoTemporal ? (
              <Button size="sm" variant="outline" leftIcon={Unlock} onClick={() => handleDesbloquear(fila)}>
                Desbloquear
              </Button>
            ) : (
              <Button size="sm" variant="ghost" leftIcon={RotateCcw} onClick={() => handleRestablecerClave(fila)}>
                Nueva Clave
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <ReporteModulo titulo="Usuarios y seguridad" archivo="usuarios" columnas={["Usuario","Nombre","Rol","Estado"]}
        filas={perfilesFiltrados.map((r) => [r.usuario, r.full_name, r.role, r.active ? 'Activo' : 'Inactivo'])} deshabilitado={cargando} />
      {/* Encabezado */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">Usuarios y Seguridad</h1>
        </div>

        {vista === 'usuarios' && (
          <Button variant="primary" leftIcon={UserPlus} onClick={() => setCreando(true)}>
            Nuevo Usuario
          </Button>
        )}
        {vista === 'autorizados' && (
          <Button variant="primary" leftIcon={ShieldCheck} onClick={() => setModalAutorizado(true)}>
            Nueva Autorización
          </Button>
        )}
      </div>

      {/* Selector de subvista estilo GT */}
      <div className="flex flex-wrap gap-2 border-b border-slate-700/60 pb-3">
        <button
          type="button"
          onClick={() => cambiarVista('usuarios')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
            vista === 'usuarios'
              ? 'bg-[#ff8a00] text-black shadow-md'
              : 'bg-slate-800/60 text-slate-300 hover:bg-slate-700/60'
          }`}
        >
          <UsersRound className="h-4 w-4" />
          <span>Usuarios</span>
        </button>

        <button
          type="button"
          onClick={() => cambiarVista('roles')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
            vista === 'roles'
              ? 'bg-[#ff8a00] text-black shadow-md'
              : 'bg-slate-800/60 text-slate-300 hover:bg-slate-700/60'
          }`}
        >
          <KeyRound className="h-4 w-4" />
          <span>Roles y permisos</span>
        </button>

        <button
          type="button"
          onClick={() => cambiarVista('autorizados')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
            vista === 'autorizados'
              ? 'bg-[#ff8a00] text-black shadow-md'
              : 'bg-slate-800/60 text-slate-300 hover:bg-slate-700/60'
          }`}
        >
          <ShieldCheck className="h-4 w-4" />
          <span>Usuarios autorizados</span>
        </button>
      </div>

      {/* VISTA 1: USUARIOS */}
      {vista === 'usuarios' && (
        <Card bodyClassName="space-y-5">
          <div className="relative w-full sm:max-w-lg">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <Input
              type="search"
              aria-label="Buscar usuarios"
              className="pl-10"
              placeholder="Buscar por nombre, usuario o correo"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>

          <DataTable
            columnas={columnas}
            filas={perfilesFiltrados}
            cargando={cargando}
            mensajeVacio="No se encontraron usuarios registrados."
          />
        </Card>
      )}

      {/* VISTA 2: ROLES Y PERMISOS */}
      <Modal open={Boolean(edicionRol)} onClose={() => setEdicionRol(null)} title="Cambiar rol del usuario">
        {edicionRol && (
          <form className="space-y-4" onSubmit={cambiarRolUsuario}>
            <Select label="Rol del usuario" value={edicionRol.role} options={[{ value: "", label: "Selecciona un rol" }, ...opcionesRoles]}
              onChange={(e) => setEdicionRol((prev) => ({ ...prev, role: e.target.value }))} />
            {edicionRol.role === 'escolta' && (
              <Select label="Vincular ficha de escolta" value={edicionRol.escoltaId}
                options={[{ value: '', label: 'Conservar vínculo actual' }, ...escoltas.map((fila) => ({ value: fila.id, label: nombreCompleto(fila) }))]}
                onChange={(e) => setEdicionRol((prev) => ({ ...prev, escoltaId: e.target.value }))} />
            )}
            <Button type="submit" disabled={guardando || !edicionRol.role}>Guardar rol</Button>
          </form>
        )}
      </Modal>

      <Modal open={modalRol} onClose={() => setModalRol(false)} title="Nuevo rol personalizado">
        <form onSubmit={crearRol} className="space-y-4">
          <Input label="Clave del rol" value={nuevoRol.key} conservarFormato maxLength={40} required
            pattern="[a-z][a-z0-9_]{1,39}" onChange={(e) => setNuevoRol((prev) => ({
              ...prev, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''),
            }))} placeholder="jefe_operaciones" />
          <Input label="Nombre del rol" value={nuevoRol.label} maxLength={120} required
            onChange={(e) => setNuevoRol((prev) => ({ ...prev, label: e.target.value }))} />
          <Input label="Descripción" value={nuevoRol.descripcion} maxLength={500}
            onChange={(e) => setNuevoRol((prev) => ({ ...prev, descripcion: e.target.value }))} />
          <Button type="submit" disabled={creandoRol}>{creandoRol ? 'Guardando…' : 'Crear rol'}</Button>
        </form>
      </Modal>

      {vista === 'roles' && (
        <MatrizRoles
          roles={catalogoRoles} seleccionado={rolActivo} onSeleccionar={setRolActivo}
          onNuevo={() => setModalRol(true)}
          perfiles={perfiles} matrices={matrices}
          telefono={telefonoRol} grupos={GRUPOS_PERMISOS} modulos={MODULOS_SISTEMA}
          vistas={VISTAS_TELEFONO} cargando={cargando} guardando={guardandoPermisos}
          permiteLectura={permiteLectura} onPermiso={handleTogglePermiso}
          onTelefono={actualizarTelefonoRol} onGuardar={handleGuardarPermisos}
        />
      )}

      {/* VISTA 3: USUARIOS AUTORIZADOS */}
      {vista === 'autorizados' && (
        <Card bodyClassName="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-100">Usuarios con Permiso de Aprobación</h2>
            <div className="text-xs text-slate-400">Aprobación de pagos, compras y firmas operativas</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-800/80 text-xs uppercase text-slate-400 border-b border-slate-700">
                <tr>
                  <th className="py-3 px-4">Usuario</th>
                  <th className="py-3 px-4">Módulo Autorizado</th>
                  <th className="py-3 px-4">Acción</th>
                  <th className="py-3 px-4">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {autorizados.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400">
                      No hay usuarios autorizados registrados.
                    </td>
                  </tr>
                ) : (
                  autorizados.map((aut) => (
                    <tr key={aut.id} className="hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-semibold text-slate-100">
                        {aut.usuario?.full_name || aut.usuario?.nombre_completo || aut.usuario?.usuario || 'Usuario'}
                      </td>
                      <td className="py-3 px-4 uppercase font-mono font-bold text-brand-400">{aut.modulo}</td>
                      <td className="py-3 px-4 capitalize">{aut.accion}</td>
                      <td className="py-3 px-4">
                        <Button size="sm" variant="danger" onClick={() => handleEliminarAutorizado(aut.id)}>
                          Revocar
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

      {/* MODAL CREAR USUARIO */}
      <Modal abierto={creando} alCerrar={() => setCreando(false)} titulo="Crear Nuevo Usuario">
        <form onSubmit={handleCrearUsuario} className="space-y-4 text-slate-200">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Nombre" formato="nombre"
              required
              value={formulario.nombre}
              onChange={(e) => setFormulario({ ...formulario, nombre: e.target.value })}
            />
            <Input
              label="Apellido" formato="nombre"
              required
              value={formulario.apellido}
              onChange={(e) => setFormulario({ ...formulario, apellido: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Nombre de Usuario (Login)" maxLength={120}
              required
              placeholder="ej. jleiva"
              value={formulario.usuario}
              onChange={(e) => setFormulario({ ...formulario, usuario: e.target.value.toLocaleUpperCase('es').replace(/[^A-Z0-9._-]/g, '') })}
            />
            <Input
              label="Teléfono" type="tel"
              value={formulario.telefono}
              onChange={(e) => setFormulario({ ...formulario, telefono: e.target.value })}
            />
          </div>

          <Select
            label="Rol del Sistema"
            value={formulario.role}
            onChange={(e) => setFormulario({ ...formulario, role: e.target.value })}
            options={opcionesRoles}
          />

          {formulario.role === 'escolta' && (
            <Select
              label="Vincular con Escolta (Opcional)"
              value={formulario.escolta_id}
              onChange={(e) => setFormulario({ ...formulario, escolta_id: e.target.value })}
              options={[
                { value: '', label: 'Sin vincular' },
                ...escoltas.map((esc) => ({
                  value: esc.id,
                  label: `${nombreCompleto(esc)} (C.I: ${esc.cedula || 'N/A'})`,
                })),
              ]}
            />
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" type="button" onClick={() => setCreando(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={guardando}>
              {guardando ? 'Creando...' : 'Crear Usuario'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL CREAR AUTORIZADO */}
      <Modal abierto={modalAutorizado} alCerrar={() => setModalAutorizado(false)} titulo="Autorizar Usuario para Aprobaciones">
        <form onSubmit={handleCrearAutorizado} className="space-y-4 text-slate-200">
          <Select
            label="Usuario"
            required
            value={formAutorizado.usuario_id}
            onChange={(e) => setFormAutorizado({ ...formAutorizado, usuario_id: e.target.value })}
            options={[
              { value: '', label: 'Seleccionar usuario...' },
              ...perfiles.map((p) => ({
                value: p.id,
                label: `${p.full_name || p.nombre_completo || p.usuario} (@${p.usuario || p.username || ''})`,
              })),
            ]}
          />
          <Select
            label="Módulo"
            value={formAutorizado.modulo}
            onChange={(e) => setFormAutorizado({ ...formAutorizado, modulo: e.target.value })}
            options={[
              { value: 'pagos', label: 'Pagos y Comprobantes' },
              { value: 'nomina', label: 'Cierre de Nómina' },
              { value: 'rrhh', label: 'Recursos Humanos y Sueldos' },
              { value: 'compras', label: 'Órdenes de Compra' },
            ]}
          />
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" type="button" onClick={() => setModalAutorizado(false)}>Cancelar</Button>
            <Button variant="primary" type="submit">Guardar Autorización</Button>
          </div>
        </form>
      </Modal>

      {/* MODAL DE CREDENCIAL TEMPORAL */}
      <Modal abierto={Boolean(credencial)} alCerrar={() => setCredencial(null)} titulo="Credencial Temporal">
        <div className="space-y-4 text-slate-200">
          <div className="rounded-xl border border-amber-700/60 bg-amber-950/40 p-4 text-amber-200 space-y-2">
            <p className="text-sm font-semibold">Copia y entrega estos datos de acceso al usuario:</p>
            <div className="font-mono text-sm space-y-1 bg-black/40 p-3 rounded-lg border border-amber-800/40">
              <div>Usuario: <strong className="text-white">@{credencial?.usuario}</strong></div>
              <div>Contraseña temporal: <strong className="text-emerald-400">{credencial?.password_temporal}</strong></div>
            </div>
            <p className="text-xs text-amber-300">El sistema solicitará el cambio de contraseña al iniciar sesión por primera vez.</p>
          </div>
          <div className="flex justify-end">
            <Button variant="primary" onClick={() => setCredencial(null)}>Cerrar y Continuar</Button>
          </div>
        </div>
      </Modal>

      {/* DIÁLOGO DE CONFIRMACIÓN */}
      <ConfirmDialog
        abierto={dialogo.abierto}
        alCerrar={() => setDialogo({ ...dialogo, abierto: false })}
        titulo={dialogo.titulo}
        mensaje={dialogo.mensaje}
        peligro={dialogo.peligro}
        alConfirmar={() => {
          setDialogo({ ...dialogo, abierto: false });
          dialogo.accion?.();
        }}
      />
    </div>
  );
}
