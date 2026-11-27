import React, { useState } from 'react';
import { ArrowLeft, ChevronDown, KeyRound, Plus, Search, Smartphone, UsersRound } from 'lucide-react';
import { Badge, Button, Card, Input } from './ui.jsx';

const NIVELES = [
  { clave: 'lectura', etiqueta: 'Lectura' },
  { clave: 'escritura', etiqueta: 'Escritura' },
  { clave: 'full', etiqueta: 'Control total' },
];

export function normalizarNiveles(val) {
  if (!val) return { lectura: false, escritura: false, full: false };
  if (typeof val === 'string') {
    return {
      lectura: val === 'lectura' || val === 'escritura' || val === 'full',
      escritura: val === 'escritura' || val === 'full',
      full: val === 'full',
    };
  }
  return {
    lectura: Boolean(val.lectura || val.full),
    escritura: Boolean(val.escritura || val.full),
    full: Boolean(val.full),
  };
}

function alcance(modulos, permisos, administrador) {
  return modulos.filter(({ key }) => {
    if (administrador) return true;
    const niveles = normalizarNiveles(permisos[key]);
    return niveles.lectura || niveles.escritura || niveles.full;
  }).length;
}

export default function MatrizRoles({
  roles, seleccionado, onSeleccionar, onNuevo, perfiles, matrices, telefono, grupos, modulos, vistas,
  cargando, guardando, permiteLectura, onPermiso, onTelefono, onGuardar,
}) {
  const [busqueda, setBusqueda] = useState('');
  const [vista, setVista] = useState('modulos');
  const rol = roles.find(({ value }) => value === seleccionado);
  const administrador = seleccionado === 'admin';
  const permisos = matrices[seleccionado] ?? {};
  const usuariosPorRol = perfiles.reduce((conteo, perfil) => {
    conteo.set(perfil.role, (conteo.get(perfil.role) ?? 0) + 1);
    return conteo;
  }, new Map());

  if (!rol) {
    const termino = busqueda.trim().toLocaleLowerCase('es');
    const visibles = roles.filter(({ label, descripcion }) =>
      (label + ' ' + (descripcion ?? '')).toLocaleLowerCase('es').includes(termino),
    );
    return (
      <Card bodyClassName="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Roles del sistema</h2>
          <Button type="button" variant="outline" leftIcon={Plus} onClick={onNuevo}>Nuevo rol</Button>
        </div>
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-brand-400" aria-hidden="true" />
          <Input type="search" aria-label="Buscar rol" className="pl-10" placeholder="Buscar rol"
            value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </div>
        {cargando ? <p role="status">Cargando roles…</p> : !visibles.length ? <p role="status">No hay roles que coincidan con la búsqueda.</p> : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visibles.map((opcion) => {
              const accesos = alcance(modulos, matrices[opcion.value] ?? {}, opcion.value === 'admin');
              return (
                <button key={opcion.value} type="button"
                  className="space-y-3 rounded-xl border border-slate-700 bg-slate-900/40 p-4 text-left transition-colors hover:border-brand-400"
                  onClick={() => { setVista('modulos'); onSeleccionar(opcion.value); }}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex items-center gap-2 break-all font-semibold">
                      <KeyRound className="h-4 w-4 shrink-0 text-brand-400" aria-hidden="true" /> {opcion.label}
                    </span>
                    <Badge tone={opcion.pendiente ? 'amarillo' : opcion.personalizado ? 'morado' : 'gris'}>
                      {opcion.pendiente ? 'Pendiente' : opcion.personalizado ? 'Personalizado' : 'Sistema'}
                    </Badge>
                  </div>
                  {opcion.descripcion && <p className="break-words text-sm">{opcion.descripcion}</p>}
                  <span className="flex items-center gap-2 text-sm">
                    <UsersRound className="h-4 w-4" aria-hidden="true" /> {usuariosPorRol.get(opcion.value) ?? 0} cuentas
                  </span>
                  <span className="block text-xs">{accesos} de {modulos.length} módulos con acceso</span>
                  <progress className="block h-2 w-full accent-brand-500" value={accesos} max={modulos.length}
                    aria-label={'Acceso a módulos de ' + opcion.label} />
                </button>
              );
            })}
          </div>
        )}
      </Card>
    );
  }

  return (
    <Card bodyClassName="space-y-5">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-700 pb-4">
        <Button type="button" size="sm" variant="outline" leftIcon={ArrowLeft} onClick={() => onSeleccionar('')}>Roles</Button>
        <div className="min-w-0 flex-1">
          <h2 className="break-words text-lg font-semibold">{rol.label}</h2>
          <p className="text-sm">{usuariosPorRol.get(rol.value) ?? 0} cuentas asignadas</p>
        </div>
        {!rol.pendiente && <Button type="button" variant="primary" onClick={onGuardar} disabled={guardando}>Guardar cambios</Button>}
      </div>
      {rol.descripcion && <p className="break-words text-sm">{rol.descripcion}</p>}
      {rol.pendiente ? (
        <p role="status" className="rounded-xl border border-brand-500/40 p-4 text-sm">El rol está registrado. La asignación y la edición se habilitan al activar la migración en la base de datos.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2" aria-label="Configuración del rol">
            <Button type="button" variant={vista === 'modulos' ? 'primary' : 'outline'} size="sm"
              aria-pressed={vista === 'modulos'} onClick={() => setVista('modulos')}>Módulos</Button>
            <Button type="button" variant={vista === 'telefono' ? 'primary' : 'outline'} size="sm" leftIcon={Smartphone}
              aria-pressed={vista === 'telefono'} onClick={() => setVista('telefono')}>Teléfono</Button>
          </div>

          {vista === 'modulos' ? (
            <div className="space-y-3">
              {grupos.map((grupo, indice) => {
                const lista = modulos.filter(grupo.incluye);
                return (
                  <details key={rol.value + grupo.etiqueta} open={indice === 0} className="group rounded-xl border border-slate-700">
                    <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4">
                      <ChevronDown className="h-4 w-4 -rotate-90 text-brand-400 group-open:rotate-0" aria-hidden="true" />
                      <span className="font-semibold">{grupo.etiqueta}</span>
                      <span className="ml-auto text-sm">{alcance(lista, permisos, administrador)} de {lista.length}</span>
                    </summary>
                    <div className="overflow-x-auto border-t border-slate-700">
                      <table className="w-full min-w-[34rem] text-left text-sm">
                        <thead><tr>
                          <th scope="col" className="px-4 py-2">Módulo</th>
                          {NIVELES.map(({ clave, etiqueta }) => <th key={clave} scope="col" className="px-3 py-2 text-center">{etiqueta}</th>)}
                        </tr></thead>
                        <tbody>
                          {lista.map((modulo) => {
                            const niveles = normalizarNiveles(permisos[modulo.key]);
                            return (
                              <tr key={modulo.key}>
                                <th scope="row" className="px-4 py-3 font-medium">{modulo.label}</th>
                                {NIVELES.map(({ clave, etiqueta }) => (
                                  <td key={clave} className="px-3 py-3 text-center">
                                    <input type="checkbox" className="h-4 w-4 accent-brand-500 cursor-pointer disabled:cursor-not-allowed"
                                      aria-label={etiqueta + ' en ' + modulo.label}
                                      checked={Boolean(administrador || niveles[clave] || (clave !== 'full' && niveles.full))}
                                      disabled={administrador}
                                      onChange={() => onPermiso(modulo.key, clave)} />
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </details>
                );
              })}
            </div>
          ) : (
            <fieldset className="space-y-4 rounded-xl border border-slate-700 p-4">
              <legend className="px-2 font-semibold">Pantallas de teléfono</legend>
              <p className="text-sm">Cada pantalla requiere permiso de lectura en su módulo.</p>
              <div className="flex flex-wrap gap-x-6 gap-y-3">
                {vistas.map(({ modulo, etiqueta }) => {
                  const niveles = normalizarNiveles(permisos[modulo]);
                  const tieneLectura = administrador || niveles.lectura || niveles.full;
                  return (
                    <label key={modulo} className="flex min-h-10 items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" className="accent-brand-500 cursor-pointer"
                        checked={Boolean(administrador || (telefono.vistas_telefono || []).includes(modulo))}
                        disabled={administrador || !tieneLectura}
                        onChange={(e) => onTelefono({
                          vistas_telefono: e.target.checked
                            ? [...(telefono.vistas_telefono || []), modulo]
                            : (telefono.vistas_telefono || []).filter((item) => item !== modulo)
                        })} />
                      {etiqueta}
                    </label>
                  );
                })}
              </div>
              {!administrador && (
                <label className="flex min-h-10 items-center gap-2 text-sm">
                  <input type="checkbox" className="accent-brand-500 cursor-pointer" checked={telefono.solo_telefono}
                    onChange={(e) => onTelefono({ solo_telefono: e.target.checked })} />
                  Solo teléfono
                </label>
              )}
            </fieldset>
          )}
        </>
      )}
    </Card>
  );
}
