import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Clock,
  Database,
  Filter,
  History,
  RefreshCw,
  Search,
  ShieldCheck,
  User,
} from 'lucide-react';
import { Badge, Button, Card, HelpTip, Pagination, useToast } from '../components/ui.jsx';
import { apiFetch } from '../lib/api.js';
import { formatearFecha, TABLAS } from '../lib/data.js';

export default function Auditoria() {
  const toast = useToast();
  const [registros, setRegistros] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroTabla, setFiltroTabla] = useState('todas');
  const [filtroOperacion, setFiltroOperacion] = useState('todas');
  const [pagina, setPagina] = useState(1);
  const [registroSeleccionado, setRegistroSeleccionado] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const data = await apiFetch('/auditoria');
      setRegistros(Array.isArray(data) ? data : data?.data || []);
    } catch (error) {
      toast.error('No se pudo cargar la bitácora de auditoría', error.message);
    } finally {
      setCargando(false);
    }
  }, [toast]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Tablas únicas presentes en auditoría
  const tablasDisponibles = useMemo(() => {
    const set = new Set(registros.map((r) => r.tabla).filter(Boolean));
    return Array.from(set).sort();
  }, [registros]);

  // Filtrado
  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return registros.filter((reg) => {
      const coincideTabla = filtroTabla === 'todas' || reg.tabla === filtroTabla;
      const coincideOperacion = filtroOperacion === 'todas' || reg.operacion === filtroOperacion;
      const coincideTexto =
        !texto ||
        [reg.tabla, reg.operacion, reg.registro_id, JSON.stringify(reg.cambios || {})].some((val) =>
          String(val || '').toLowerCase().includes(texto),
        );
      return coincideTabla && coincideOperacion && coincideTexto;
    });
  }, [registros, filtroTabla, filtroOperacion, busqueda]);

  const porPagina = 12;
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / porPagina));
  const visibles = filtrados.slice((pagina - 1) * porPagina, pagina * porPagina);

  const toneOperacion = (op) => {
    switch (op) {
      case 'INSERT':
        return 'verde';
      case 'UPDATE':
        return 'azul';
      case 'DELETE':
        return 'rojo';
      default:
        return 'gris';
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#ff8a00] to-[#ffd54a] p-0.5 shadow-md">
              <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-[#14171c]">
                <History className="h-5 w-5 text-[#ff8a00]" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                Bitácora de Auditoría
              </h1>
              <p className="text-xs font-bold text-[#ff8a00] uppercase tracking-wider">
                Control y Trazabilidad Operativa
              </p>
            </div>
          </div>
          <p className="mt-2 text-sm text-slate-400 max-w-2xl">
            Registro cronológico inmutable de operaciones, modificaciones y accesos en las tablas del sistema.
          </p>
        </div>

        <Button size="md" variant="outline" leftIcon={RefreshCw} onClick={cargar} loading={cargando}>
          Actualizar Bitácora
        </Button>
      </header>

      <Card
        title="Historial de Transacciones"
        subtitle={`${filtrados.length} eventos registrados`}
        actions={
          <HelpTip title="Auditoría del Sistema">
            Cada creación, edición o eliminación en la base de datos genera automáticamente un registro con el usuario, fecha y valores modificados.
          </HelpTip>
        }
      >
        {/* Filtros */}
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setPagina(1);
              }}
              placeholder="Buscar por tabla, ID o contenido…"
              className="block min-h-11 w-full rounded-xl border border-slate-700 bg-slate-900/80 pl-10 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-[#ff8a00] focus:outline-none focus:ring-2 focus:ring-[#ff8a00]/20"
            />
          </div>

          <div className="relative">
            <Database className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-slate-400" aria-hidden="true" />
            <select
              value={filtroTabla}
              onChange={(e) => {
                setFiltroTabla(e.target.value);
                setPagina(1);
              }}
              className="block min-h-11 w-full appearance-none rounded-xl border border-slate-700 bg-slate-900/80 pl-10 pr-3 text-sm text-slate-100 focus:border-[#ff8a00] focus:outline-none focus:ring-2 focus:ring-[#ff8a00]/20"
            >
              <option value="todas">Todas las tablas</option>
              {tablasDisponibles.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className="relative">
            <Filter className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-slate-400" aria-hidden="true" />
            <select
              value={filtroOperacion}
              onChange={(e) => {
                setFiltroOperacion(e.target.value);
                setPagina(1);
              }}
              className="block min-h-11 w-full appearance-none rounded-xl border border-slate-700 bg-slate-900/80 pl-10 pr-3 text-sm text-slate-100 focus:border-[#ff8a00] focus:outline-none focus:ring-2 focus:ring-[#ff8a00]/20"
            >
              <option value="todas">Todas las operaciones</option>
              <option value="INSERT">INSERT (Creaciones)</option>
              <option value="UPDATE">UPDATE (Modificaciones)</option>
              <option value="DELETE">DELETE (Eliminaciones)</option>
            </select>
          </div>
        </div>

        {/* Tabla de Registros */}
        {cargando ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <RefreshCw className="h-8 w-8 animate-spin text-[#ff8a00] mb-2" />
            <p className="text-sm">Consultando bitácora de auditoría…</p>
          </div>
        ) : filtrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center rounded-2xl border border-dashed border-slate-700 bg-slate-900/30 p-6">
            <History className="h-8 w-8 text-slate-500 mb-2" />
            <p className="text-sm font-bold text-slate-300">No se encontraron eventos</p>
            <p className="text-xs text-slate-500 mt-1">Prueba con otros términos de búsqueda.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#111418]">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">ID</th>
                  <th className="py-3 px-4">Operación</th>
                  <th className="py-3 px-4">Tabla</th>
                  <th className="py-3 px-4">Registro Afectado</th>
                  <th className="py-3 px-4">Fecha y Hora</th>
                  <th className="py-3 px-4 text-right">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {visibles.map((reg) => (
                  <tr key={reg.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-400">#{reg.id}</td>
                    <td className="py-3 px-4">
                      <Badge tone={toneOperacion(reg.operacion)}>
                        {reg.operacion}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-100 flex items-center gap-1.5">
                      <Database className="h-3.5 w-3.5 text-[#ff8a00]" />
                      {reg.tabla}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                      {reg.registro_id ? String(reg.registro_id).slice(0, 16) + '…' : '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      {reg.created_at
                        ? new Date(reg.created_at).toLocaleString('es-VE', {
                            dateStyle: 'short',
                            timeStyle: 'medium',
                          })
                        : '—'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setRegistroSeleccionado(reg)}
                      >
                        Ver Cambios
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4">
          <Pagination page={pagina} totalPages={totalPaginas} totalItems={filtrados.length} onChange={setPagina} />
        </div>
      </Card>

      {/* Modal de Detalle de Cambios */}
      {registroSeleccionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="relative w-full max-w-2xl rounded-2xl bg-[#14171c] border border-slate-700 p-5 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Badge tone={toneOperacion(registroSeleccionado.operacion)}>
                  {registroSeleccionado.operacion}
                </Badge>
                <h3 className="text-sm font-bold text-white">
                  Auditoría #{registroSeleccionado.id} · Tabla: {registroSeleccionado.tabla}
                </h3>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setRegistroSeleccionado(null)}>
                Cerrar
              </Button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-800 bg-[#1e222a] p-3">
                  <span className="text-slate-400 block font-bold uppercase text-[10px]">Registro ID</span>
                  <span className="font-mono text-slate-200 mt-1 block truncate">
                    {registroSeleccionado.registro_id || 'No disponible'}
                  </span>
                </div>
                <div className="rounded-xl border border-slate-800 bg-[#1e222a] p-3">
                  <span className="text-slate-400 block font-bold uppercase text-[10px]">Fecha / Hora</span>
                  <span className="text-slate-200 mt-1 block">
                    {new Date(registroSeleccionado.created_at).toLocaleString('es-VE')}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 block font-bold uppercase text-[10px] mb-1">
                  Valores y Carga Útil (Payload)
                </span>
                <pre className="rounded-xl border border-slate-800 bg-black/60 p-4 font-mono text-[11px] text-emerald-400 overflow-x-auto max-h-72">
                  {JSON.stringify(registroSeleccionado.cambios || {}, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
