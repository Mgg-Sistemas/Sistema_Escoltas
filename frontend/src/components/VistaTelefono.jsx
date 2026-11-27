import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarCheck2,
  CalendarRange,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  CreditCard,
  IdCard,
  Menu,
  Plus,
  Shield,
  ShieldCheck,
  User,
  UsersRound,
  WalletCards,
} from 'lucide-react';
import { listar, nombreCompleto, TABLAS } from '../lib/data.js';

export default function VistaTelefono({ items, alNavegar, alAbrirMenu, rol = 'escolta' }) {
  const [turnoActual, setTurnoActual] = useState(null);
  const [proximoTurno, setProximoTurno] = useState(null);
  const [asistenciaHoy, setAsistenciaHoy] = useState(null);
  const [ultimoPermiso, setUltimoPermiso] = useState(null);
  const [personalActivo, setPersonalActivo] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activo = true;

    async function cargarResumen() {
      try {
        const [turnosRes, asisRes, permRes, personalRes] = await Promise.allSettled([
          listar(TABLAS.turnos),
          listar(TABLAS.asistencias, { limite: 1, ordenarPor: 'created_at', ascendente: false }),
          listar(TABLAS.permisos, { limite: 1, ordenarPor: 'created_at', ascendente: false }),
          listar(TABLAS.escoltas, { limite: 1, ordenarPor: 'created_at', ascendente: false }),
        ]);

        if (!activo) return;

        if (turnosRes.status === 'fulfilled' && turnosRes.value.length > 0) {
          setTurnoActual(turnosRes.value[0]);
          setProximoTurno(turnosRes.value[1] || turnosRes.value[0]);
        }
        if (asisRes.status === 'fulfilled' && asisRes.value.length > 0) {
          setAsistenciaHoy(asisRes.value[0]);
        }
        if (permRes.status === 'fulfilled' && permRes.value.length > 0) {
          setUltimoPermiso(permRes.value[0]);
        }
        if (personalRes.status === 'fulfilled' && personalRes.value.length > 0) {
          setPersonalActivo(personalRes.value[0]);
        }
      } catch (err) {
        console.error('Error cargando resumen para móvil:', err);
      } finally {
        if (activo) setCargando(false);
      }
    }

    cargarResumen();
    return () => {
      activo = false;
    };
  }, []);

  return (
    <section className="mx-auto w-full max-w-md space-y-4 pb-20 select-none" aria-label="Operación móvil">
      {/* Cabecera Móvil Oficial */}
      <header className="rounded-2xl border border-slate-800 bg-gradient-to-r from-[#1c222b] via-[#14181f] to-[#1c222b] p-4 shadow-lg flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#ff8a00] to-[#ffd54a] p-0.5 shadow-md">
            <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-[#0e1217]">
              <ShieldCheck className="h-6 w-6 text-[#ff8a00]" />
            </div>
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-white leading-none">
              ESCOLTAS
            </h1>
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#ff8a00] mt-0.5">
              Control Operativo Móvil
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={alAbrirMenu}
          className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs font-bold text-slate-200 hover:border-[#ff8a00]"
        >
          <Menu className="h-4 w-4 text-[#ff8a00]" />
          <span>Más</span>
        </button>
      </header>

      {/* 1. SECCIÓN TURNOS: Turno Actual y Próximo */}
      <div className="rounded-2xl border border-slate-800 bg-[#161a22] p-4 shadow-md">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
          <div className="flex items-center gap-2">
            <CalendarRange className="h-4 w-4 text-[#ff8a00]" />
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-200">
              Turnos Operativos
            </h2>
          </div>
          <Link to="/distribucion" onClick={alNavegar} className="text-[11px] font-bold text-[#ff8a00] flex items-center">
            Ver Cobertura <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-2.5">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">
              TURNO ACTUAL
            </span>
            <strong className="text-sm font-black text-white block mt-0.5">
              {turnoActual?.nombre || 'Diurno'}
            </strong>
            <span className="text-[10px] text-[#ff8a00] font-mono font-bold block mt-0.5">
              {turnoActual ? `${turnoActual.hora_inicio?.slice(0, 5)} - ${turnoActual.hora_fin?.slice(0, 5)}` : '08:00 - 16:00'}
            </span>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-2.5">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">
              PRÓXIMO TURNO
            </span>
            <strong className="text-sm font-black text-slate-300 block mt-0.5">
              {proximoTurno?.nombre || 'Nocturno'}
            </strong>
            <span className="text-[10px] text-slate-400 font-mono font-bold block mt-0.5">
              {proximoTurno ? `${proximoTurno.hora_inicio?.slice(0, 5)} - ${proximoTurno.hora_fin?.slice(0, 5)}` : '16:00 - 00:00'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. SECCIÓN ASISTENCIA: Estado de Hoy y Acción Rápida */}
      <div className="rounded-2xl border border-slate-800 bg-[#161a22] p-4 shadow-md">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
          <div className="flex items-center gap-2">
            <CalendarCheck2 className="h-4 w-4 text-[#ff8a00]" />
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-200">
              Disponibilidad y Asistencia
            </h2>
          </div>
          <Link to="/asistencias" onClick={alNavegar} className="text-[11px] font-bold text-[#ff8a00] flex items-center">
            Historial <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/80 p-3">
          <div>
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">
              ESTADO DE HOY
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <strong className="text-xs font-black text-emerald-400">
                {asistenciaHoy ? 'Guardia en Curso' : 'Turno Operativo Abierto'}
              </strong>
            </div>
          </div>
          <Link
            to="/asistencias"
            onClick={alNavegar}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#ff8a00] to-[#e67a00] px-3 py-2 text-xs font-black text-black shadow-md shadow-[#ff8a00]/20"
          >
            <CheckCircle2 className="h-4 w-4" />
            Marcar Check-in
          </Link>
        </div>
      </div>

      {/* 3. SECCIÓN PERMISOS: Última Solicitud y Nueva */}
      <div className="rounded-2xl border border-slate-800 bg-[#161a22] p-4 shadow-md">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-[#ff8a00]" />
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-200">
              Permisos y Descansos
            </h2>
          </div>
          <Link to="/permisos" onClick={alNavegar} className="text-[11px] font-bold text-[#ff8a00] flex items-center">
            Ver Todos <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/80 p-3">
          <div className="min-w-0 flex-1 pr-2">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">
              ÚLTIMA SOLICITUD
            </span>
            <strong className="text-xs font-bold text-slate-200 truncate block mt-0.5">
              {ultimoPermiso ? `${ultimoPermiso.estado?.toUpperCase()} · ${ultimoPermiso.fecha_inicio}` : 'Sin permisos pendientes'}
            </strong>
          </div>
          <Link
            to="/permisos"
            onClick={alNavegar}
            className="flex items-center gap-1 rounded-xl border border-[#ff8a00] px-3 py-2 text-xs font-black text-[#ff8a00] hover:bg-[#ff8a00]/10"
          >
            <Plus className="h-3.5 w-3.5" />
            Solicitar
          </Link>
        </div>
      </div>

      {/* 4. SECCIÓN PERSONAL Y CARNET DIGITAL */}
      <div className="rounded-2xl border border-slate-800 bg-[#161a22] p-4 shadow-md">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
          <div className="flex items-center gap-2">
            <UsersRound className="h-4 w-4 text-[#ff8a00]" />
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-200">
              Credencial y Personal
            </h2>
          </div>
          <Link to="/escoltas" onClick={alNavegar} className="text-[11px] font-bold text-[#ff8a00] flex items-center">
            Ver Fichas <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/80 p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 border border-slate-700 text-[#ff8a00]">
              <IdCard className="h-5 w-5" />
            </div>
            <div>
              <strong className="text-xs font-black text-white block">
                {personalActivo ? nombreCompleto(personalActivo) : 'Credencial Oficial'}
              </strong>
              <span className="text-[10px] text-slate-400 font-mono block">
                {personalActivo?.codigo || 'ESC-0147'} · {personalActivo?.cedula || 'V-20.458.763'}
              </span>
            </div>
          </div>
          <Link
            to="/escoltas"
            onClick={alNavegar}
            className="rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs font-black text-[#ff8a00] hover:border-[#ff8a00]"
          >
            Ver Carnet
          </Link>
        </div>
      </div>

      {/* 5. SECCIÓN NÓMINA Y PAGOS */}
      <div className="rounded-2xl border border-slate-800 bg-[#161a22] p-4 shadow-md">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
          <div className="flex items-center gap-2">
            <WalletCards className="h-4 w-4 text-[#ff8a00]" />
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-200">
              Nómina y Pagos
            </h2>
          </div>
          <Link to="/nomina" onClick={alNavegar} className="text-[11px] font-bold text-[#ff8a00] flex items-center">
            Detalles <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
        <p className="text-[11px] text-slate-400">
          Consulta tu recibo de pago oficial y el estado del periodo en curso.
        </p>
      </div>
    </section>
  );
}
