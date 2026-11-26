import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCheck,
  KeyRound,
  Plus,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Trash2,
  UserCog,
} from 'lucide-react';
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
import { useRealtimeRecarga } from '../hooks/useRealtime.js';
import { api } from '../lib/api.js';
import {
  MODULOS_SISTEMA,
  NIVELES_PERMISO,
  ROLES,
  ROLES_DESCRIPCION,
  ROLES_LABELS,
} from '../lib/constants.js';

export default function RolesPermisos() {
  const toast = useToast();
  const [roles, setRoles] = useState([]);
  const [customRoles, setCustomRoles] = useState([]);
  const [matrices, setMatrices] = useState({});
  const [telefonoConfig, setTelefonoConfig] = useState({});
  const [rolActivo, setRolActivo] = useState('admin');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  // Modal nuevo rol
  const [modalNuevoRol, setModalNuevoRol] = useState(false);
  const [formNuevoRol, setFormNuevoRol] = useState({ key: '', label: '', descripcion: '', color: '#cc4400' });

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [datos, custom] = await Promise.all([
        api.obtenerRoles(),
        api.listarRolesPersonalizados().catch(() => []),
      ]);

      const porRol = Object.fromEntries(
        (datos?.matriz || []).map((fila) => [fila.role, fila.permisos ?? {}]),
      );
      const tel = Object.fromEntries(
        (datos?.matriz || []).map((fila) => [
          fila.role,
          { solo_telefono: fila.solo_telefono || false, vistas_telefono: fila.vistas_telefono || [] },
        ]),
      );

      setMatrices(porRol);
      setTelefonoConfig(tel);
      setRoles(datos?.roles ?? []);
      setCustomRoles(custom ?? []);
    } catch (error) {
      toast.error(error.message || 'No fue posible cargar roles y permisos.');
    } finally {
      setCargando(false);
    }
  }, [toast]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const listaRolesCompleta = useMemo(() => {
    const baseKeys = new Set(ROLES);
    const combinados = [...ROLES];
    customRoles.forEach((cr) => {
      if (!baseKeys.has(cr.key)) {
        combinados.push(cr.key);
      }
    });
    return combinados;
  }, [customRoles]);

  const matrizActiva = useMemo(() => {
    const actual = matrices[rolActivo] ?? {};
    return Object.fromEntries(
      MODULOS_SISTEMA.map((m) => [
        m.key,
        {
          lectura: actual[m.key]?.lectura === true || actual[m.key]?.full === true,
          escritura: actual[m.key]?.escritura === true || actual[m.key]?.full === true,
          full: actual[m.key]?.full === true || rolActivo === 'admin',
        },
      ]),
    );
  }, [matrices, rolActivo]);

  const handleToggle = (moduloKey, nivel) => {
    if (rolActivo === 'admin') return;
    setMatrices((prev) => {
      const actualRol = prev[rolActivo] ?? {};
      const actualMod = actualRol[moduloKey] ?? { lectura: false, escritura: false, full: false };
      const nuevoValor = !actualMod[nivel];
      const actualizado = { ...actualMod, [nivel]: nuevoValor };

      if (nivel === 'full' && nuevoValor) {
        actualizado.lectura = true;
        actualizado.escritura = true;
      }
      if (nivel === 'escritura' && nuevoValor) {
        actualizado.lectura = true;
      }
      if (nivel === 'lectura' && !nuevoValor) {
        actualizado.escritura = false;
        actualizado.full = false;
      }

      return {
        ...prev,
        [rolActivo]: {
          ...actualRol,
          [moduloKey]: actualizado,
        },
      };
    });
  };

  const handleGuardar = async () => {
    setGuardando(true);
    try {
      const tel = telefonoConfig[rolActivo] || { solo_telefono: false, vistas_telefono: [] };
      await api.guardarPermisosRol({
        role: rolActivo,
        permisos: matrices[rolActivo] ?? {},
        solo_telefono: tel.solo_telefono,
        vistas_telefono: tel.vistas_telefono,
      });
      toast.success(`Matriz y accesos de "${ROLES_LABELS[rolActivo] || rolActivo}" guardados.`);
    } catch (error) {
      toast.error(error.message || 'No fue posible guardar la matriz.');
    } finally {
      setGuardando(false);
    }
  };

  const handleCrearNuevoRol = async (e) => {
    e.preventDefault();
    try {
      await api.guardarRolPersonalizado(formNuevoRol);
      toast.success(`Rol "${formNuevoRol.label}" registrado con éxito.`);
      setModalNuevoRol(false);
      setFormNuevoRol({ key: '', label: '', descripcion: '', color: '#cc4400' });
      await cargar();
    } catch (err) {
      toast.error(err.message || 'Error al crear rol');
    }
  };

  const handleEliminarRol = async (key) => {
    if (ROLES.includes(key)) {
      toast.error('No se pueden eliminar los roles base del sistema.');
      return;
    }
    try {
      await api.eliminarRolPersonalizado(key);
      toast.success('Rol personalizado eliminado.');
      setRolActivo('admin');
      await cargar();
    } catch (err) {
      toast.error(err.message || 'Error al eliminar rol');
    }
  };

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">Matriz de Roles y Permisos</h1>
          <p className="mt-1 text-sm text-slate-400">
            Estructura heredada de Golden Touch (GT): lectura, escritura o control total por módulo, vistas móviles y roles personalizados.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" leftIcon={Plus} onClick={() => setModalNuevoRol(true)}>
            Nuevo Rol
          </Button>
          <Button variant="primary" leftIcon={CheckCheck} onClick={handleGuardar} disabled={guardando}>
            {guardando ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </div>
      </div>

      {/* Selector de rol con badges interactivos */}
      <div className="flex flex-wrap gap-2">
        {listaRolesCompleta.map((r) => {
          const activo = rolActivo === r;
          const esCustom = !ROLES.includes(r);
          return (
            <button
              key={r}
              type="button"
              onClick={() => setRolActivo(r)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
                activo
                  ? 'bg-brand-600 text-white shadow-lg ring-2 ring-brand-400/40'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700/80 hover:text-slate-100 border border-slate-700/60'
              }`}
            >
              <span>{ROLES_LABELS[r] || r}</span>
              {esCustom && (
                <button
                  type="button"
                  title="Eliminar rol personalizado"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEliminarRol(r);
                  }}
                  className="hover:text-rose-400 ml-1"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </button>
          );
        })}
      </div>

      {/* Panel de permisos del rol seleccionado */}
      <Card className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-700/60 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-brand-400" />
              <span>Permisos para: {ROLES_LABELS[rolActivo] || rolActivo}</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {ROLES_DESCRIPCION[rolActivo] || 'Rol personalizado del sistema.'}
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400" /> Control Total
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-blue-400" /> Escritura
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-400" /> Lectura
            </span>
          </div>
        </div>

        {/* Tabla matriz */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-800/80 text-xs uppercase text-slate-400 border-b border-slate-700">
              <tr>
                <th className="py-3 px-4">Módulo Funcional</th>
                <th className="py-3 px-4 text-center">Lectura</th>
                <th className="py-3 px-4 text-center">Escritura</th>
                <th className="py-3 px-4 text-center">Control Total (Full)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {MODULOS_SISTEMA.map((modulo) => {
                const fila = matrizActiva[modulo.key] ?? {};
                return (
                  <tr key={modulo.key} className="hover:bg-slate-800/40">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-100">{modulo.label}</div>
                      <div className="text-xs text-slate-400">{modulo.descripcion}</div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-brand-600 focus:ring-brand-500 cursor-pointer"
                        checked={fila.lectura}
                        disabled={rolActivo === 'admin'}
                        onChange={() => handleToggle(modulo.key, 'lectura')}
                      />
                    </td>
                    <td className="py-3 px-4 text-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-brand-600 focus:ring-brand-500 cursor-pointer"
                        checked={fila.escritura}
                        disabled={rolActivo === 'admin'}
                        onChange={() => handleToggle(modulo.key, 'escritura')}
                      />
                    </td>
                    <td className="py-3 px-4 text-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-brand-600 focus:ring-brand-500 cursor-pointer"
                        checked={fila.full}
                        disabled={rolActivo === 'admin'}
                        onChange={() => handleToggle(modulo.key, 'full')}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* MODAL NUEVO ROL */}
      <Modal abierto={modalNuevoRol} alCerrar={() => setModalNuevoRol(false)} titulo="Crear Rol Personalizado">
        <form onSubmit={handleCrearNuevoRol} className="space-y-4 text-slate-200">
          <Input
            label="Identificador Clave (sin espacios)"
            required
            placeholder="ej. jefe_seguridad"
            value={formNuevoRol.key}
            onChange={(e) => setFormNuevoRol({ ...formNuevoRol, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
          />
          <Input
            label="Etiqueta / Nombre Visible"
            required
            placeholder="Jefe de Seguridad y Patrullaje"
            value={formNuevoRol.label}
            onChange={(e) => setFormNuevoRol({ ...formNuevoRol, label: e.target.value })}
          />
          <Input
            label="Descripción del Rol"
            placeholder="Responsable de supervisión y respuesta inmediata..."
            value={formNuevoRol.descripcion}
            onChange={(e) => setFormNuevoRol({ ...formNuevoRol, descripcion: e.target.value })}
          />
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" type="button" onClick={() => setModalNuevoRol(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit">
              Registrar Rol
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
