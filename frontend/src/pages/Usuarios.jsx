import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyRound,
  LockKeyhole,
  RotateCcw,
  Search,
  ShieldAlert,
  Unlock,
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
import { ROLES, ROLES_DESCRIPCION, ROLES_LABELS } from '../lib/constants.js';
import { listar, TABLAS } from '../lib/data.js';

const FORMULARIO_VACIO = {
  correo: '',
  nombre: '',
  apellido: '',
  telefono: '',
  role: 'escolta',
  escolta_id: '',
};

export default function Usuarios() {
  const { user: usuarioActual } = useAuth();
  const toast = useToast();
  const [perfiles, setPerfiles] = useState([]);
  const [escoltas, setEscoltas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [creando, setCreando] = useState(false);
  const [formulario, setFormulario] = useState(FORMULARIO_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [credencial, setCredencial] = useState(null);
  const [cambio, setCambio] = useState(null);
  const [accion, setAccion] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [listaUsuarios, listaEscoltas] = await Promise.all([
        api.listarUsuarios(),
        listar(TABLAS.escoltas, { ordenarPor: 'nombre_completo', ascendente: true }),
      ]);
      setPerfiles(Array.isArray(listaUsuarios) ? listaUsuarios : []);
      setEscoltas(Array.isArray(listaEscoltas) ? listaEscoltas : []);
    } catch (error) {
      toast.error('No se pudo cargar la lista de usuarios', error.message);
    } finally {
      setCargando(false);
    }
  }, [toast]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useRealtimeRecarga(cargar, { tablas: ['profiles', 'escoltas'] });

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return perfiles;
    return perfiles.filter((perfil) =>
      [perfil.full_name, perfil.email, ROLES_LABELS[perfil.role]]
        .some((valor) => String(valor || '').toLowerCase().includes(texto)),
    );
  }, [perfiles, busqueda]);

  const actualizarCampo = (campo, valor) =>
    setFormulario((actual) => ({ ...actual, [campo]: valor }));

  const crear = async (evento) => {
    evento.preventDefault();
    if (!formulario.correo.trim() || !formulario.nombre.trim()) {
      toast.error('Faltan datos', 'El correo y el nombre son obligatorios.');
      return;
    }
    try {
      setGuardando(true);
      const datos = await api.crearUsuario({
        correo: formulario.correo.trim(),
        nombre: formulario.nombre.trim(),
        apellido: formulario.apellido.trim() || undefined,
        telefono: formulario.telefono.trim() || undefined,
        role: formulario.role,
        escolta_id: formulario.escolta_id || undefined,
      });
      setCredencial(datos);
      setCreando(false);
      setFormulario(FORMULARIO_VACIO);
      await cargar();
      toast.success('Usuario creado', 'Entrega la clave temporal al usuario de forma privada.');
    } catch (error) {
      toast.error('No se pudo crear el usuario', error.message);
    } finally {
      setGuardando(false);
    }
  };

  const aplicarCambio = async () => {
    if (!cambio) return;
    try {
      setGuardando(true);
      await api.actualizarUsuario(cambio.perfil.id, { [cambio.campo]: cambio.valor });
      toast.success(
        cambio.campo === 'role' ? 'Rol actualizado' : 'Estado del usuario actualizado',
        `${cambio.perfil.full_name || cambio.perfil.email} ahora es ${
          cambio.campo === 'role' ? ROLES_LABELS[cambio.valor] : cambio.valor ? 'activo' : 'inactivo'
        }.`,
      );
      setCambio(null);
      await cargar();
    } catch (error) {
      toast.error('No se pudo actualizar el usuario', error.message);
    } finally {
      setGuardando(false);
    }
  };

  const ejecutarAccion = async () => {
    if (!accion) return;
    try {
      setGuardando(true);
      if (accion.tipo === 'restablecer') {
        await api.restablecerClaveUsuario(accion.perfil.id);
        toast.success('Correo enviado', 'El usuario recibirá un enlace para crear una contraseña nueva.');
      } else {
        await api.desbloquearUsuario(accion.perfil.id);
        toast.success('Cuenta desbloqueada', 'Los intentos fallidos se reiniciaron.');
      }
      setAccion(null);
      await cargar();
    } catch (error) {
      toast.error('No se pudo completar la acción', error.message);
    } finally {
      setGuardando(false);
    }
  };

  const columnas = [
    {
      key: 'usuario',
      label: 'Usuario',
      primary: true,
      render: (fila) => (
        <div className="min-w-0">
          <p className="truncate font-bold text-slate-900">{fila.full_name || 'Sin nombre'}</p>
          <p className="truncate text-xs text-slate-500">{fila.email || 'Sin correo'}</p>
        </div>
      ),
    },
    {
      key: 'role',
      label: 'Rol actual',
      render: (fila) => <Badge tone="azul">{ROLES_LABELS[fila.role] || fila.role || 'Sin rol'}</Badge>,
    },
    {
      key: 'estado',
      label: 'Estado',
      render: (fila) => (
        <div className="flex flex-wrap gap-1">
          <Badge tone={fila.active ? 'verde' : 'gris'}>{fila.active ? 'Activo' : 'Inactivo'}</Badge>
          {fila.must_change_password && <Badge tone="naranja">Clave temporal</Badge>}
        </div>
      ),
    },
  ];

  const conteoPorRol = ROLES.map((rol) => ({
    rol,
    cantidad: perfiles.filter((perfil) => perfil.role === rol).length,
  }));

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Usuarios y roles</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
            Crea cuentas con una clave temporal, asigna un rol y controla quién puede entrar. En el
            primer ingreso el usuario deberá cambiar su clave y confirmarla dos veces.
          </p>
        </div>
        <Button variant="primary" size="lg" leftIcon={UserPlus} onClick={() => setCreando(true)} className="w-full sm:w-auto">
          Nuevo usuario
        </Button>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {conteoPorRol.map(({ rol, cantidad }) => (
          <div key={rol} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-500">{ROLES_LABELS[rol]}</p>
              <Badge tone={rol === 'admin' ? 'morado' : rol === 'escolta' ? 'verde' : 'azul'}>{cantidad}</Badge>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-500">{ROLES_DESCRIPCION[rol]}</p>
          </div>
        ))}
      </div>

      <Card
        title="Lista de usuarios"
        subtitle={`${filtrados.length} cuentas registradas`}
        actions={
          <HelpTip title="Cambios con cuidado">
            Un rol incorrecto puede dar acceso a nómina o quitar permisos de revisión. Confirma siempre el cambio.
          </HelpTip>
        }
      >
        <div className="mb-5 relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            value={busqueda}
            onChange={(evento) => setBusqueda(evento.target.value)}
            placeholder="Buscar por nombre, correo o rol…"
            aria-label="Buscar usuarios"
            className="min-h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
        </div>

        <DataTable
          columns={columnas}
          data={filtrados}
          loading={cargando}
          emptyTitle="No hay usuarios para mostrar"
          emptyDescription={busqueda ? 'Prueba con otro texto de búsqueda.' : 'Crea el primer usuario con el botón «Nuevo usuario».'}
          emptyIcon={UsersRound}
          actions={(fila) => {
            const esActual = fila.id === usuarioActual?.id;
            return (
              <div className="flex flex-wrap justify-end gap-1.5">
                <Select
                  aria-label={`Rol de ${fila.full_name || fila.email}`}
                  value={fila.role || 'escolta'}
                  onChange={(evento) =>
                    setCambio({ perfil: fila, campo: 'role', valor: evento.target.value })
                  }
                  className="min-h-9 w-32 px-2 py-1 text-xs"
                  disabled={esActual}
                >
                  {ROLES.map((rol) => (
                    <option key={rol} value={rol}>{ROLES_LABELS[rol]}</option>
                  ))}
                </Select>
                <Button
                  variant={fila.active ? 'outline' : 'success'}
                  size="sm"
                  onClick={() => setCambio({ perfil: fila, campo: 'active', valor: !fila.active })}
                  disabled={esActual}
                >
                  {fila.active ? 'Desactivar' : 'Activar'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  title="Restablecer contraseña"
                  aria-label={`Restablecer contraseña de ${fila.full_name || fila.email}`}
                  onClick={() => setAccion({ tipo: 'restablecer', perfil: fila })}
                  disabled={esActual}
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  title="Desbloquear cuenta"
                  aria-label={`Desbloquear cuenta de ${fila.full_name || fila.email}`}
                  onClick={() => setAccion({ tipo: 'desbloquear', perfil: fila })}
                  disabled={esActual}
                >
                  <Unlock className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            );
          }}
        />
        <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-slate-500">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
          No puedes modificar tu propio rol o estado desde esta pantalla para evitar dejar la cuenta sin administrador.
        </p>
      </Card>

      <Card title="Qué puede hacer cada rol" subtitle="Guía rápida para decidir un cambio">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {ROLES.map((rol) => (
            <div key={rol} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-brand-700" aria-hidden="true" />
                <p className="text-sm font-bold text-slate-800">{ROLES_LABELS[rol]}</p>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{ROLES_DESCRIPCION[rol]}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Alta de usuarios */}
      <Modal
        open={creando}
        onClose={() => setCreando(false)}
        title="Crear usuario"
        description="Se creará la cuenta con una clave temporal. El usuario deberá cambiarla al ingresar."
        size="lg"
        footer={
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <Button type="submit" form="formulario-usuario" variant="primary" loading={guardando} fullWidth className="sm:w-auto">
              Crear cuenta
            </Button>
            <Button variant="outline" onClick={() => setCreando(false)} disabled={guardando} fullWidth className="sm:w-auto">
              Cancelar
            </Button>
          </div>
        }
      >
        <form id="formulario-usuario" onSubmit={crear} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Correo electrónico"
            type="email"
            autoComplete="email"
            placeholder="nombre@empresa.com"
            value={formulario.correo}
            onChange={(evento) => actualizarCampo('correo', evento.target.value)}
            required
          />
          <Input
            label="Nombre"
            placeholder="Nombre del usuario"
            value={formulario.nombre}
            onChange={(evento) => actualizarCampo('nombre', evento.target.value)}
            required
          />
          <Input
            label="Apellido"
            placeholder="Opcional"
            value={formulario.apellido}
            onChange={(evento) => actualizarCampo('apellido', evento.target.value)}
          />
          <Input
            label="Teléfono"
            placeholder="Opcional"
            value={formulario.telefono}
            onChange={(evento) => actualizarCampo('telefono', evento.target.value)}
          />
          <Select
            label="Rol"
            value={formulario.role}
            onChange={(evento) => actualizarCampo('role', evento.target.value)}
          >
            {ROLES.map((rol) => (
              <option key={rol} value={rol}>{ROLES_LABELS[rol]}</option>
            ))}
          </Select>
          <Select
            label="Vincular a escolta (opcional)"
            value={formulario.escolta_id}
            onChange={(evento) => actualizarCampo('escolta_id', evento.target.value)}
          >
            <option value="">Sin vincular</option>
            {escoltas.map((escolta) => (
              <option key={escolta.id} value={escolta.id}>
                {escolta.nombre_completo || escolta.nombre || 'Escolta'}
              </option>
            ))}
          </Select>
          <div className="sm:col-span-2 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>La clave inicial por defecto es <strong>es-123</strong>. Puedes cambiarla en Ajustes.</p>
          </div>
        </form>
      </Modal>

      {/* Credencial temporal */}
      <Modal
        open={Boolean(credencial)}
        onClose={() => setCredencial(null)}
        title="Cuenta creada"
        description="Guarda estos datos y entrégalos al usuario por un canal privado."
        size="sm"
        footer={
          <Button variant="primary" onClick={() => setCredencial(null)} fullWidth>
            Entendido
          </Button>
        }
      >
        <div className="space-y-3 rounded-xl bg-slate-50 p-4 text-sm">
          <p><span className="font-semibold text-slate-500">Correo:</span> {credencial?.email}</p>
          <p>
            <span className="font-semibold text-slate-500">Clave temporal:</span>{' '}
            <code className="rounded bg-white px-2 py-1 font-bold text-brand-700 ring-1 ring-slate-200">
              {credencial?.clave_temporal}
            </code>
          </p>
          <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-500">
            <UserCog className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            Al iniciar sesión, el sistema obligará a crear una contraseña nueva y confirmarla dos veces.
          </p>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(cambio)}
        onClose={() => setCambio(null)}
        title={cambio?.campo === 'role' ? '¿Cambiar el rol?' : '¿Cambiar el estado?'}
        description={cambio ? (
          cambio.campo === 'role'
            ? `${cambio.perfil.full_name || cambio.perfil.email} pasará de ${ROLES_LABELS[cambio.perfil.role] || cambio.perfil.role} a ${ROLES_LABELS[cambio.valor]}. Verifica que sea correcto.`
            : `${cambio.perfil.full_name || cambio.perfil.email} quedará ${cambio.valor ? 'activo' : 'inactivo'}.`
        ) : ''}
        confirmLabel="Confirmar cambio"
        onConfirm={aplicarCambio}
        loading={guardando}
        variant={cambio?.campo === 'role' ? 'primary' : 'success'}
      />

      <ConfirmDialog
        open={Boolean(accion)}
        onClose={() => setAccion(null)}
        title={accion?.tipo === 'restablecer' ? '¿Enviar enlace de restablecimiento?' : '¿Desbloquear la cuenta?'}
        description={accion ? (
          accion.tipo === 'restablecer'
            ? `Se enviará un correo a ${accion.perfil.email} con un enlace para crear una contraseña nueva. La clave temporal seguirá vigente hasta que se complete el cambio.`
            : `Se reiniciarán los intentos fallidos de ${accion.perfil.full_name || accion.perfil.email}.`
        ) : ''}
        confirmLabel={accion?.tipo === 'restablecer' ? 'Enviar correo' : 'Desbloquear'}
        onConfirm={ejecutarAccion}
        loading={guardando}
        variant="primary"
      />
    </div>
  );
}
