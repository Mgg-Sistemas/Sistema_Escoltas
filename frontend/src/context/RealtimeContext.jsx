import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAuth } from './AuthContext.jsx';
import { useToast } from '../components/ui.jsx';
import { cerrarCanal, crearCanal } from '../lib/realtime.js';

const RealtimeContext = createContext(null);

/** Qué tablas puede observar cada rol. RLS decide qué filas llegan. */
const TABLAS_POR_ROL = {
  admin: [
    'profiles', 'escoltas', 'grados', 'clientes', 'turnos', 'tipos_permiso',
    'asignaciones', 'asistencias', 'permisos', 'periodos_nomina',
    'nomina_detalles', 'pagos', 'auditoria',
    'roles', 'permisos_sistema', 'rol_permisos', 'roles_permisos', 'ajustes_sistema',
  ],
  supervisor: [
    'profiles', 'escoltas', 'grados', 'clientes', 'turnos', 'tipos_permiso',
    'asignaciones', 'asistencias', 'permisos', 'periodos_nomina',
    'roles', 'permisos_sistema', 'rol_permisos', 'roles_permisos', 'ajustes_sistema',
  ],
  contador: [
    'profiles', 'escoltas', 'periodos_nomina', 'nomina_detalles', 'pagos',
    'roles', 'permisos_sistema', 'rol_permisos', 'roles_permisos', 'ajustes_sistema',
  ],
  escolta: [
    'profiles', 'asignaciones', 'asistencias', 'permisos', 'nomina_detalles',
    'periodos_nomina', 'roles', 'permisos_sistema', 'rol_permisos',
    'roles_permisos', 'ajustes_sistema',
  ],
};

/** Avisos breves para cambios importantes ocurridos en otro dispositivo. */
function notificarCambioCritico(evento, usuarioId, toast) {
  const { tabla, tipo, nuevo, anterior } = evento;
  if (!nuevo) return;

  if (tabla === 'permisos' && tipo === 'UPDATE' && anterior?.estado === 'pendiente') {
    if (nuevo.estado === 'aprobado' || nuevo.estado === 'rechazado') {
      if (nuevo.aprobado_por && nuevo.aprobado_por !== usuarioId) {
        toast.info(
          nuevo.estado === 'aprobado' ? 'Permiso aprobado' : 'Permiso rechazado',
          'Una solicitud cambió de estado en tiempo real.',
        );
      }
    }
  }

  if (tabla === 'pagos' && tipo === 'UPDATE' && nuevo.estado === 'confirmado' && anterior?.estado !== 'confirmado') {
    if (nuevo.registrado_por && nuevo.registrado_por !== usuarioId) {
      toast.success('Pago confirmado', 'El registro se actualizó en tiempo real.');
    }
  }

  if (tabla === 'periodos_nomina' && tipo === 'UPDATE' && anterior?.estado !== nuevo.estado) {
    if (nuevo.estado === 'cerrado' || nuevo.estado === 'pagado') {
      toast.info('Nómina actualizada', `El periodo ahora está ${nuevo.estado}.`);
    }
  }
}

export function RealtimeProvider({ children }) {
  const { autenticado, loading, role, user } = useAuth();
  const toast = useToast();
  const [estado, setEstado] = useState('desconectado');
  const [ultimoEvento, setUltimoEvento] = useState(null);
  const listeners = useRef(new Set());

  /**
   * Suscribe un callback a todos los cambios recibidos. Devuelve una
   * función para darse de baja; los hooks de pantalla la usan para recargar.
   */
  const suscribirseCambios = useCallback((callback) => {
    listeners.current.add(callback);
    return () => listeners.current.delete(callback);
  }, []);

  useEffect(() => {
    if (loading || !autenticado) {
      setEstado('desconectado');
      return undefined;
    }

    const tablas = TABLAS_POR_ROL[role] || TABLAS_POR_ROL.escolta;
    setEstado('conectando');

    const canal = crearCanal({
      nombre: `escoltas-${role}-${user?.id || 'anon'}`,
      tablas,
      onCambio: (evento) => {
        setUltimoEvento(evento);
        listeners.current.forEach((callback) => {
          try { callback(evento); } catch { /* un listener no debe romper a los demás */ }
        });
        notificarCambioCritico(evento, user?.id, toast);
      },
    });

    canal.subscribe((estadoCanal) => {
      if (estadoCanal === 'SUBSCRIBED') setEstado('conectado');
      else if (estadoCanal === 'CHANNEL_ERROR' || estadoCanal === 'TIMED_OUT') setEstado('reconectando');
      else setEstado('conectando');
    });

    return () => {
      cerrarCanal(canal);
      setEstado('desconectado');
    };
  }, [autenticado, loading, role, user?.id, toast]);

  const valor = useMemo(
    () => ({
      estado,
      conectado: estado === 'conectado',
      ultimoEvento,
      suscribirseCambios,
    }),
    [estado, ultimoEvento, suscribirseCambios],
  );

  return <RealtimeContext.Provider value={valor}>{children}</RealtimeContext.Provider>;
}

export function useRealtime() {
  const contexto = useContext(RealtimeContext);
  if (!contexto) throw new Error('useRealtime debe usarse dentro de RealtimeProvider.');
  return contexto;
}
