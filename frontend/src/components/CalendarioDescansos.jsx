import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button, Card, Select } from './ui.jsx';
import { useRealtimeRecarga } from '../hooks/useRealtime.js';
import { listar, nombreCompleto, TABLAS } from '../lib/data.js';

const MESES = new Intl.DateTimeFormat('es-VE', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const HOY = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Caracas' });
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const ESTADOS = {
  desconocido: { nombre: 'Sin confirmar', corto: '…', estilo: 'bg-slate-900/50 text-slate-400' },
  libre: { nombre: 'Libre', corto: 'L', estilo: 'bg-emerald-950/60 text-emerald-300' },
  trabajo: { nombre: 'Trabajando', corto: 'T', estilo: 'bg-amber-950/60 text-amber-300' },
  pendiente: { nombre: 'Sin programación', corto: '—', estilo: 'bg-slate-900/50 text-slate-400' },
};

function cubre(registro, fecha, indefinido = false) {
  return registro.fecha_inicio && registro.fecha_inicio <= fecha
    && (registro.fecha_fin || (indefinido ? '9999-12-31' : registro.fecha_inicio)) >= fecha;
}

export default function CalendarioDescansos({ escoltas, permisos }) {
  const hoy = HOY.format(new Date());
  const [mes, setMes] = useState(() => new Date(hoy.slice(0, 7) + '-01T00:00:00Z'));
  const [seleccion, setSeleccion] = useState('');
  const [consulta, setConsulta] = useState(null);
  const ultimaConsulta = useRef(0);
  const escoltaId = escoltas.find(({ id }) => id === seleccion)?.id || escoltas[0]?.id;
  const anio = mes.getUTCFullYear();
  const mesIndice = mes.getUTCMonth();
  const ultimoDia = new Date(Date.UTC(anio, mesIndice + 1, 0)).getUTCDate();
  const prefijo = mes.toISOString().slice(0, 7);
  const clave = escoltaId + '/' + prefijo;
  const cargarTurnos = useCallback(async () => {
    const solicitud = ++ultimaConsulta.current;
    if (!escoltaId) return;
    try {
      const filas = await listar(TABLAS.asignaciones, {
        select: 'fecha_inicio,fecha_fin,estado',
        filtros: [
          { column: 'escolta_id', value: escoltaId },
          { column: 'fecha_inicio', op: 'lte', value: prefijo + '-' + ultimoDia },
        ],
        ordenarPor: 'fecha_inicio',
        ascendente: false,
      });
      if (solicitud === ultimaConsulta.current) setConsulta({ clave, filas });
    } catch {
      if (solicitud === ultimaConsulta.current) setConsulta({ clave, error: true });
    }
  }, [clave, escoltaId, prefijo, ultimoDia]);

  useEffect(() => { cargarTurnos(); }, [cargarTurnos]);
  useRealtimeRecarga(cargarTurnos, { tablas: ['asignaciones'] });

  const listado = consulta?.clave === clave ? consulta : null;
  const descansos = permisos.filter((p) => p.escolta_id === escoltaId && p.estado === 'aprobado');
  const asignaciones = (listado?.filas || []).filter((a) => ['activa', 'activo', 'planificada', 'finalizada'].includes(a.estado));
  const cambiarMes = (paso) => setMes(new Date(Date.UTC(anio, mesIndice + paso, 1)));

  return (
    <Card title="Calendario de descansos y trabajo">
      {escoltaId ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <Select label="Escolta" value={escoltaId} onChange={(e) => setSeleccion(e.target.value)}>
              {escoltas.map((item) => <option key={item.id} value={item.id}>{nombreCompleto(item)}</option>)}
            </Select>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" aria-label="Mes anterior" onClick={() => cambiarMes(-1)}><ChevronLeft size={16} /></Button>
              <span className="min-w-32 text-center text-sm font-semibold capitalize" aria-live="polite">{MESES.format(mes)}</span>
              <Button size="sm" variant="outline" aria-label="Mes siguiente" onClick={() => cambiarMes(1)}><ChevronRight size={16} /></Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {[ESTADOS.libre, ESTADOS.trabajo, ESTADOS.pendiente].map(({ nombre, corto, estilo }) => (
              <span key={nombre} className={`rounded-md px-2 py-1 text-xs font-semibold ${estilo}`}>{corto} · {nombre}</span>
            ))}
          </div>
          {!listado && <p role="status">Cargando asignaciones…</p>}
          {listado?.error && <p role="status">No se pudieron cargar las asignaciones.</p>}
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {DIAS.map((dia) => <span key={dia} className="text-center text-xs font-semibold text-slate-400">{dia}</span>)}
            {Array.from({ length: (mes.getUTCDay() + 6) % 7 }, (_, i) => <span key={i} aria-hidden="true" />)}
            {Array.from({ length: ultimoDia }, (_, i) => {
              const fecha = prefijo + '-' + String(i + 1).padStart(2, '0');
              const estado = descansos.some((p) => cubre(p, fecha)) ? ESTADOS.libre
                : asignaciones.some((a) => cubre(a, fecha, a.estado !== 'finalizada')) ? ESTADOS.trabajo
                : listado?.filas ? ESTADOS.pendiente : ESTADOS.desconocido;
              return (
                <div key={fecha} title={estado.nombre} className={`flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-lg border border-slate-800 py-1 text-center ${estado.estilo} ${fecha === hoy ? 'ring-1 ring-inset ring-brand-500' : ''}`}>
                  <time dateTime={fecha} aria-current={fecha === hoy ? 'date' : undefined} className="text-xs font-bold">{i + 1}</time>
                  <span className="sr-only lg:not-sr-only lg:text-xs">{estado.nombre}</span>
                  <span aria-hidden="true" className="text-[10px] lg:hidden">{estado.corto}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : <p className="text-sm text-slate-400">El calendario estará disponible cuando haya un escolta registrado.</p>}
    </Card>
  );
}
