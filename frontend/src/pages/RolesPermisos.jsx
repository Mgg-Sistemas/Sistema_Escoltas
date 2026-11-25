import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCheck, KeyRound, ShieldCheck, UserCog } from 'lucide-react';
import { Badge, Button, Card, HelpTip, useToast } from '../components/ui.jsx';
import { useRealtimeRecarga } from '../hooks/useRealtime.js';
import { api } from '../lib/api.js';
import {
  MODULOS_SISTEMA,
  NIVELES_PERMISO,
  ROLES,
  ROLES_DESCRIPCION,
  ROLES_LABELS,
} from '../lib/constants.js';

const MATRIZ_VACIA = Object.fromEntries(
  MODULOS_SISTEMA.map((modulo) => [
    modulo.key,
    { lectura: false, escritura: false, full: false },
  ]),
);

function normalizar(matriz = {}) {
  return Object.fromEntries(
    MODULOS_SISTEMA.map((modulo) => {
      const actual = matriz[modulo.key] ?? {};
      return [
        modulo.key,
        {
          lectura: actual.lectura === true,
          escritura: actual.escritura === true,
          full: actual.full === true,
        },
      ];
    }),
  );
}

export default function RolesPermisos() {
  const toast = useToast();
  const [roles, setRoles] = useState([]);
  const [matrices, setMatrices] = useState({});
  const [rolActivo, setRolActivo] = useState('admin');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [hayCambios, setHayCambios] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const datos = await api.obtenerRoles();
      const porRol = Object.fromEntries(
        (datos?.matriz ?? []).map((fila) => [fila.role, normalizar(fila.permisos)]),
      );
      for (const rol of ROLES) {
        if (!porRol[rol]) porRol[rol] = { ...MATRIZ_VACIA };
      }
      setRoles(datos?.roles ?? []);
      setMatrices(porRol);
      setHayCambios(false);
    } catch (error) {
      toast.error('No se pudieron cargar los permisos', error.message);
    } finally {
      setCargando(false);
    }
  }, [toast]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useRealtimeRecarga(cargar, { tablas: ['roles', 'permisos_sistema', 'rol_permisos', 'roles_permisos'] });

  const matriz = matrices[rolActivo] ?? MATRIZ_VACIA;

  const alternar = (modulo, nivel) => {
    setMatrices((actual) => {
      const permisosRol = { ...(actual[rolActivo] ?? MATRIZ_VACIA) };
      const niveles = { ...(permisosRol[modulo] ?? {}) };
      const nuevoValor = !niveles[nivel];

      if (nivel === 'full') {
        niveles.full = nuevoValor;
        if (nuevoValor) {
          niveles.lectura = true;
          niveles.escritura = true;
        }
      } else {
        niveles[nivel] = nuevoValor;
        if (niveles.lectura && niveles.escritura) niveles.full = true;
        else niveles.full = false;
      }

      permisosRol[modulo] = niveles;
      return { ...actual, [rolActivo]: permisosRol };
    });
    setHayCambios(true);
  };

  const guardar = async () => {
    try {
      setGuardando(true);
      await api.guardarPermisosRol({
        role: rolActivo,
        permisos: matriz,
        vistas_telefono: [],
        solo_telefono: false,
      });
      toast.success(
        'Permisos guardados',
        `La matriz de ${ROLES_LABELS[rolActivo]} se actualizó para todos los usuarios con ese rol.`,
      );
      setHayCambios(false);
    } catch (error) {
      toast.error('No se pudieron guardar los permisos', error.message);
    } finally {
      setGuardando(false);
    }
  };

  const totales = useMemo(() => {
    const activos = Object.values(matriz).filter(
      (niveles) => niveles.lectura || niveles.escritura || niveles.full,
    ).length;
    return { activos, total: MODULOS_SISTEMA.length };
  }, [matriz]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Roles y permisos</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">
          Define qué puede ver y modificar cada rol. Los cambios se aplican de inmediato al menú y a
          las operaciones permitidas por el backend. Marca <strong>Control total</strong> cuando el rol
          deba administrar por completo un módulo.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {ROLES.map((rol) => {
          const activo = rol === rolActivo;
          return (
            <button
              key={rol}
              type="button"
              onClick={() => {
                setRolActivo(rol);
                setHayCambios(false);
              }}
              className={`min-h-24 rounded-2xl border p-4 text-left transition-colors ${
                activo
                  ? 'border-brand-400 bg-brand-50 ring-2 ring-brand-100'
                  : 'border-slate-200 bg-white hover:border-brand-300 hover:bg-brand-50/40'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <UserCog className={`h-5 w-5 ${activo ? 'text-brand-700' : 'text-slate-400'}`} aria-hidden="true" />
                {activo && <Badge tone="naranja">Editando</Badge>}
              </div>
              <p className="mt-2 text-sm font-bold text-slate-900">{ROLES_LABELS[rol]}</p>
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{ROLES_DESCRIPCION[rol]}</p>
            </button>
          );
        })}
      </div>

      <Card
        title={`Matriz de ${ROLES_LABELS[rolActivo]}`}
        subtitle={`${totales.activos} de ${totales.total} módulos con algún acceso`}
        actions={
          <HelpTip title="Cómo funciona">
            Lectura permite consultar, Escritura permite crear y editar, y Control total incluye acciones
            sensibles como eliminar, cerrar nómina o confirmar pagos.
          </HelpTip>
        }
      >
        {cargando ? (
          <p className="py-8 text-center text-sm text-slate-500">Cargando permisos…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-separate border-spacing-y-2 text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Módulo</th>
                  {NIVELES_PERMISO.map((nivel) => (
                    <th key={nivel.key} className="w-32 px-3 py-2 text-center">{nivel.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MODULOS_SISTEMA.map((modulo) => {
                  const niveles = matriz[modulo.key] ?? {};
                  return (
                    <tr key={modulo.key} className="bg-slate-50/80">
                      <td className="rounded-l-xl px-3 py-3">
                        <p className="font-bold text-slate-900">{modulo.label}</p>
                        <p className="text-xs text-slate-500">{modulo.descripcion}</p>
                      </td>
                      {NIVELES_PERMISO.map((nivel) => (
                        <td key={nivel.key} className="px-3 py-3 text-center">
                          <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 px-2">
                            <input
                              type="checkbox"
                              checked={niveles[nivel.key] === true}
                              onChange={() => alternar(modulo.key, nivel.key)}
                              aria-label={`${nivel.label} en ${modulo.label} para ${ROLES_LABELS[rolActivo]}`}
                              className="h-5 w-5 rounded border-slate-300 text-brand-600 focus:ring-brand-400"
                            />
                          </label>
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-500">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
            El backend y las políticas RLS verifican estos permisos; ocultar un botón nunca es la única barrera.
          </p>
          <Button
            variant="primary"
            size="lg"
            loading={guardando}
            disabled={!hayCambios || cargando}
            leftIcon={CheckCheck}
            onClick={guardar}
            className="w-full sm:w-auto"
          >
            {hayCambios ? 'Guardar cambios' : 'Sin cambios pendientes'}
          </Button>
        </div>
      </Card>

      <Card title="Permisos granulares del sistema" subtitle="Códigos usados por la API y las políticas de seguridad">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {MODULOS_SISTEMA.map((modulo) => (
            <div key={modulo.key} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs">
              <KeyRound className="h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" />
              <span className="font-semibold text-slate-700">{modulo.label}</span>
              <span className="ml-auto font-mono text-slate-400">{modulo.key}.*</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
