import React, { useState } from 'react';
import {
  AlertTriangle,
  ArchiveRestore,
  RefreshCw,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import { Badge, Button, ConfirmDialog, Modal } from './ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * Papelera Universal estilo Golden Touch (GT)
 * Permite listar registros eliminados lógicamente, restaurarlos o vaciarlos permanentemente.
 */
export default function PapeleraModal({
  abierto,
  alCerrar,
  titulo = 'Papelera de Reciclaje',
  tipo = 'personal',
  registros = [],
  alRestaurar,
  alVaciar,
  cargando = false,
}) {
  const { role } = useAuth();
  const esAdmin = role === 'admin';
  const [confirmarVaciar, setConfirmarVaciar] = useState(false);
  const [textoConfirmacion, setTextoConfirmacion] = useState('');
  const [procesando, setProcesando] = useState(false);

  if (!abierto) return null;

  const ejecutarRestaurar = async (registro) => {
    if (!alRestaurar) return;
    setProcesando(true);
    try {
      await alRestaurar(registro);
    } finally {
      setProcesando(false);
    }
  };

  const ejecutarVaciar = async () => {
    if (!alVaciar) return;
    if (textoConfirmacion.trim().toUpperCase() !== 'BORRAR') return;
    setProcesando(true);
    try {
      await alVaciar();
      setConfirmarVaciar(false);
      setTextoConfirmacion('');
    } finally {
      setProcesando(false);
    }
  };

  return (
    <>
      <Modal
        open={abierto}
        onClose={alCerrar}
        title={titulo}
        description="Los registros en la papelera no se muestran en las operaciones activas. Puedes restaurarlos o purgarlos permanentemente."
        size="lg"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between w-full">
            <Button variant="outline" onClick={alCerrar} disabled={procesando}>
              Cerrar
            </Button>
            {esAdmin && registros.length > 0 && (
              <Button
                variant="danger"
                leftIcon={Trash2}
                onClick={() => setConfirmarVaciar(true)}
                disabled={procesando}
              >
                Vaciar papelera
              </Button>
            )}
          </div>
        }
      >
        <div className="space-y-4">
          {cargando ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400">
              <RefreshCw className="h-7 w-7 animate-spin text-[#ff8a00] mb-2" />
              <p className="text-sm">Cargando elementos de la papelera…</p>
            </div>
          ) : registros.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center rounded-2xl border border-dashed border-slate-700/60 bg-slate-900/30 p-6">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800 text-slate-400 mb-3">
                <Trash2 className="h-6 w-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-200">La papelera está vacía</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                No hay elementos eliminados recientemente en esta sección.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#111418]">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">Registro</th>
                    <th className="py-3 px-4">Tipo / Cargo</th>
                    <th className="py-3 px-4">Fecha Eliminación</th>
                    <th className="py-3 px-4 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {registros.map((reg) => (
                    <tr key={reg.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-100">
                          {reg.nombres ? `${reg.nombres} ${reg.apellidos || ''}` : reg.nombre || reg.titulo || reg.id}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {reg.codigo || reg.cedula || 'ID: ' + reg.id.slice(0, 8)}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge tone="naranja">
                          {reg.categoria ? reg.categoria.toUpperCase() : reg.cargo || tipo.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {reg.eliminado_at
                          ? new Date(reg.eliminado_at).toLocaleDateString('es-VE', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'Reciente'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          leftIcon={ArchiveRestore}
                          onClick={() => ejecutarRestaurar(reg)}
                          disabled={procesando}
                        >
                          Restaurar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal de confirmación para vaciar papelera estilo Golden Touch */}
      <Modal
        open={confirmarVaciar}
        onClose={() => setConfirmarVaciar(false)}
        title="¿Vaciar la papelera de forma definitiva?"
        description="Esta acción eliminará permanentemente todos los elementos de la papelera. Esta operación NO se puede deshacer."
        size="md"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end w-full">
            <Button variant="outline" onClick={() => setConfirmarVaciar(false)} disabled={procesando}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              disabled={textoConfirmacion.trim().toUpperCase() !== 'BORRAR' || procesando}
              onClick={ejecutarVaciar}
              loading={procesando}
            >
              Vaciar papelera
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-4 text-xs text-rose-200 flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-rose-300">Confirmación de seguridad requerida</p>
              <p className="mt-1 leading-relaxed">
                Para confirmar la eliminación permanente de {registros.length} registro(s), escribe la palabra{' '}
                <strong className="text-white underline">BORRAR</strong> a continuación:
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
              Escribe BORRAR para confirmar
            </label>
            <input
              type="text"
              value={textoConfirmacion}
              onChange={(e) => setTextoConfirmacion(e.target.value.toLocaleUpperCase("es"))}
              placeholder="BORRAR"
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500 font-mono font-bold"
            />
          </div>
        </div>
      </Modal>
    </>
  );
}
