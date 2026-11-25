-- =====================================================================
-- Sistema de Escoltas — Tiempo real (Supabase Realtime)
-- Proyecto: rznkopetlmitfxcixjcr
--
-- Publica las tablas en `supabase_realtime` y ajusta la identidad de
-- replicación para que los eventos UPDATE/DELETE incluyan la fila anterior.
-- La seguridad NO se relaja: Realtime respeta las mismas políticas RLS
-- que ya están definidas en la migración inicial. Un escolta sigue
-- recibiendo únicamente eventos de sus propios registros.
--
-- Idempotente: se puede volver a ejecutar sin duplicar publicaciones.
-- Idioma de comentarios: español.
-- =====================================================================

DO $do$
DECLARE
  v_tabla text;
  v_tablas text[] := ARRAY[
    'profiles',
    'escoltas',
    'grados',
    'clientes',
    'turnos',
    'tipos_permiso',
    'asignaciones',
    'asistencias',
    'permisos',
    'periodos_nomina',
    'nomina_detalles',
    'pagos',
    'auditoria'
  ];
BEGIN
  -- En proyectos Supabase la publicación ya existe; la comprobación evita
  -- fallos si la migración se aplica en un Postgres vacío.
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH v_tabla IN ARRAY v_tablas LOOP
      IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = v_tabla
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', v_tabla);
      END IF;
    END LOOP;
  END IF;
END
$do$;

-- Con REPLICA IDENTITY FULL, los eventos UPDATE y DELETE transportan la
-- fila completa anterior. Esto permite al frontend recalcular filtros y
-- al backend saber qué escolta tenía asignado un registro antes del cambio.
-- Se aplica solo a tablas operativas (no a catálogos pequeños ni auditoría).
ALTER TABLE public.asignaciones    REPLICA IDENTITY FULL;
ALTER TABLE public.asistencias     REPLICA IDENTITY FULL;
ALTER TABLE public.permisos        REPLICA IDENTITY FULL;
ALTER TABLE public.nomina_detalles REPLICA IDENTITY FULL;
ALTER TABLE public.pagos           REPLICA IDENTITY FULL;
ALTER TABLE public.escoltas        REPLICA IDENTITY FULL;

-- Los permisos de lectura ya existentes (SELECT para authenticated) son
-- suficientes para Realtime: no se crea ninguna política nueva aquí.
COMMENT ON TABLE public.asignaciones IS
  'Distribución de escoltas. Publicada en supabase_realtime; eventos filtrados por RLS.';
COMMENT ON TABLE public.permisos IS
  'Solicitudes de permiso. Realtime respeta RLS: el escolta solo ve las suyas.';
COMMENT ON TABLE public.pagos IS
  'Pagos de nómina. Realtime solo entrega filas permitidas por RLS (staff).';
