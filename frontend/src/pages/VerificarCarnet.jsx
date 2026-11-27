import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Building,
  Calendar,
  CheckCircle2,
  IdCard,
  ShieldAlert,
  ShieldCheck,
  User,
} from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import { Button, Card, Skeleton } from '../components/ui.jsx';
import { formatearFecha, nombreCompleto } from '../lib/data.js';

export default function VerificarCarnet() {
  const [searchParams] = useSearchParams();
  const idOrCodigo = searchParams.get('id');

  const [escolta, setEscolta] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let activo = true;

    async function buscar() {
      if (!idOrCodigo) {
        setError('No se especificó un código o identificador para validar.');
        setCargando(false);
        return;
      }

      try {
        // Consultar el endpoint público seguro (sin necesidad de sesión)
        const resp = await fetch(`/api/public/verificar-carnet/${encodeURIComponent(idOrCodigo)}`);
        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({}));
          throw new Error(errData.error || 'Credencial no encontrada o no válida.');
        }

        const data = await resp.json();
        if (!activo) return;

        setEscolta({
          codigo: data.codigo,
          nombres: data.titular,
          apellidos: '',
          cedula: data.cedula,
          cargo: data.cargo,
          area: data.area,
          turno: data.turno,
          estado: data.estado,
          foto_url: data.foto_url,
          vigencia: data.vigencia,
        });
      } catch (e) {
        if (activo) setError(e.message || 'Error al validar credencial.');
      } finally {
        if (activo) setCargando(false);
      }
    }

    buscar();
    return () => {
      activo = false;
    };
  }, [idOrCodigo]);

  return (
    <div className="min-h-screen bg-[#0e1217] text-slate-100 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md space-y-4">
        {/* Cabecera Oficial */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ff8a00] to-[#ffd54a] p-0.5 shadow-lg">
            <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-[#14171c]">
              <ShieldCheck className="h-7 w-7 text-[#ff8a00]" />
            </div>
          </div>
          <h1 className="text-xl font-black tracking-tight text-white uppercase italic">
            ESCOLTAS · VERIFICACIÓN OFICIAL
          </h1>
          <p className="text-xs text-[#ff8a00] font-bold tracking-wider uppercase">
            Sistema Central de Validación de Credenciales
          </p>
        </div>

        {cargando ? (
          <Card className="p-6" bodyClassName="space-y-4">
            <Skeleton className="h-20 w-20 rounded-full mx-auto" />
            <Skeleton className="h-5 w-3/4 mx-auto" />
            <Skeleton className="h-4 w-1/2 mx-auto" />
          </Card>
        ) : error ? (
          <Card className="p-6 text-center border-rose-500/30 bg-rose-950/20" bodyClassName="space-y-3">
            <ShieldAlert className="h-12 w-12 text-rose-400 mx-auto" />
            <h2 className="text-lg font-bold text-rose-200">Credencial no verificada</h2>
            <p className="text-sm text-slate-400">{error}</p>
            <Link to="/login" className="inline-block pt-2">
              <Button variant="outline" size="sm" leftIcon={ArrowLeft}>
                Ir al inicio
              </Button>
            </Link>
          </Card>
        ) : (
          <Card className="p-6 border-emerald-500/40 bg-[#161a22]" bodyClassName="space-y-5">
            {/* Estado de validación */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs font-bold text-slate-400">ESTADO REGISTRAL</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-0.5 text-xs font-black text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                ACREDITADO / ACTIVO
              </span>
            </div>

            {/* Datos del Custodio */}
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-slate-800 border-2 border-[#ff8a00] overflow-hidden flex items-center justify-center shrink-0">
                {escolta.foto_url ? (
                  <img src={escolta.foto_url} alt={nombreCompleto(escolta)} className="h-full w-full object-cover" />
                ) : (
                  <User className="h-8 w-8 text-slate-400" />
                )}
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-black text-white uppercase truncate">
                  {nombreCompleto(escolta)}
                </h2>
                <p className="text-xs font-bold text-[#ffd54a] mt-0.5">
                  {escolta.cargo}
                </p>
                <p className="font-mono text-xs text-slate-400 mt-1">
                  C.I. {escolta.cedula || '—'} · ID: {escolta.codigo}
                </p>
              </div>
            </div>

            {/* Cuadrícula de Datos Operativos */}
            <div className="grid grid-cols-2 gap-2 text-xs pt-2">
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-2.5">
                <span className="text-[9px] font-bold text-slate-400 uppercase block">Área Asignada</span>
                <strong className="text-slate-200 block mt-0.5 truncate">{escolta.area}</strong>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-2.5">
                <span className="text-[9px] font-bold text-slate-400 uppercase block">Turno</span>
                <strong className="text-slate-200 block mt-0.5">{escolta.turno}</strong>
              </div>
            </div>

            <div className="text-[10px] text-slate-500 text-center pt-2 leading-relaxed">
              Esta credencial ha sido validada directamente en los servidores de ESCOLTAS – Seguridad y Vigilancia.
            </div>

            <div className="pt-2">
              <Link to="/login" className="w-full block">
                <Button variant="outline" fullWidth size="sm">
                  Acceso al Sistema
                </Button>
              </Link>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
