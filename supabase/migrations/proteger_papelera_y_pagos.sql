-- =====================================================================
-- Migración: Atomicidad e Integridad de Historial y Pagos
-- Módulos: Papelera de Escoltas y Registro de Pagos de Nómina
-- =====================================================================

SET search_path = public, extensions;

-- 1. Restricción de unicidad para evitar pagos duplicados ante reintentos o concurrencia
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
     WHERE conname = 'pagos_periodo_escolta_uq'
  ) THEN
    ALTER TABLE public.pagos 
      ADD CONSTRAINT pagos_periodo_escolta_uq UNIQUE (periodo_id, escolta_id);
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 2. Función atómica para vaciado de papelera protegiendo historial
CREATE OR REPLACE FUNCTION public.vaciar_papelera_escoltas(p_actor_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_candidato RECORD;
  v_purgados integer := 0;
  v_protegidos integer := 0;
  v_ids_purgados text[] := ARRAY[]::text[];
  v_tiene_deps boolean;
BEGIN
  -- Validar autorización: permite p_actor_id verificado en perfiles o sesión auth.uid
  IF p_actor_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE id = p_actor_id AND role = 'admin'
    ) THEN
      RAISE EXCEPTION 'Acceso denegado: El actor indicado no tiene rol administrador';
    END IF;
  ELSE
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'Acceso denegado: Solo administradores pueden vaciar la papelera';
    END IF;
  END IF;

  -- Seleccionar EXCLUSIVAMENTE registros marcados explícitamente en papelera (evita tocar bajas laborales inactivas)
  FOR v_candidato IN 
    SELECT id, nombres, apellidos, cedula 
      FROM public.escoltas 
     WHERE notas ILIKE '%[PAPELERA:true]%'
       FOR UPDATE SKIP LOCKED
  LOOP
    -- Comprobación estricta de cualquier dependencia histórica, operativa o financiera
    SELECT EXISTS (
      SELECT 1 FROM public.asignaciones WHERE escolta_id = v_candidato.id
      UNION ALL
      SELECT 1 FROM public.nomina_detalles WHERE escolta_id = v_candidato.id
      UNION ALL
      SELECT 1 FROM public.asistencias WHERE escolta_id = v_candidato.id
      UNION ALL
      SELECT 1 FROM public.permisos WHERE escolta_id = v_candidato.id
      UNION ALL
      SELECT 1 FROM public.pagos WHERE escolta_id = v_candidato.id
    ) INTO v_tiene_deps;

    -- Si existen las tablas de ampliación RRHH / Choferes, comprobar también
    IF NOT v_tiene_deps THEN
      BEGIN
        SELECT EXISTS (
          SELECT 1 FROM public.personal WHERE cedula = v_candidato.cedula
          UNION ALL
          SELECT 1 FROM public.choferes_conductores WHERE personal_id = v_candidato.id
        ) INTO v_tiene_deps;
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;

    IF v_tiene_deps THEN
      v_protegidos := v_protegidos + 1;
    ELSE
      DELETE FROM public.escoltas WHERE id = v_candidato.id;
      v_purgados := v_purgados + 1;
      v_ids_purgados := array_append(v_ids_purgados, v_candidato.id::text);
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'purgados', v_purgados,
    'protegidos', v_protegidos,
    'ids', v_ids_purgados
  );
END;
$$;

-- 3. Función atómica para registro de pagos de nómina
CREATE OR REPLACE FUNCTION public.registrar_pago_nomina_periodo(
  p_periodo_id uuid,
  p_metodo text DEFAULT 'transferencia',
  p_referencia text DEFAULT NULL,
  p_fecha_pago date DEFAULT current_date,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_periodo RECORD;
  v_detalle RECORD;
  v_pagos_creados integer := 0;
  v_total_pagado numeric(12,2) := 0;
  v_pago_id uuid;
BEGIN
  -- Validar autorización: permite p_user_id verificado en perfiles o sesión auth.uid
  IF p_user_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE id = p_user_id AND role IN ('admin', 'contador')
    ) THEN
      RAISE EXCEPTION 'Acceso denegado: El usuario indicado no tiene rol administrador o contador';
    END IF;
  ELSE
    IF NOT (public.is_admin() OR public.is_contador()) THEN
      RAISE EXCEPTION 'Acceso denegado: Solo administradores o contadores pueden procesar pagos de nómina';
    END IF;
  END IF;

  -- Bloquear el periodo para evitar pagos concurrentes simultáneos
  SELECT * INTO v_periodo
    FROM public.periodos_nomina
   WHERE id = p_periodo_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Periodo de nómina no encontrado';
  END IF;

  IF v_periodo.estado NOT IN ('abierto', 'cerrado') THEN
    RAISE EXCEPTION 'El periodo no está en estado procesable para pago (estado actual: %)', v_periodo.estado;
  END IF;

  -- Procesar detalles pendientes
  FOR v_detalle IN
    SELECT * FROM public.nomina_detalles
     WHERE periodo_id = p_periodo_id
       AND estado = 'pendiente'
       FOR UPDATE
  LOOP
    -- Insertar pago evitando duplicados mediante ON CONFLICT DO NOTHING
    INSERT INTO public.pagos (
      periodo_id, escolta_id, monto, fecha_pago, metodo, referencia, estado, registrado_por
    ) VALUES (
      p_periodo_id, v_detalle.escolta_id, v_detalle.total, p_fecha_pago, p_metodo, p_referencia, 'registrado', p_user_id
    )
    ON CONFLICT (periodo_id, escolta_id) DO NOTHING
    RETURNING id INTO v_pago_id;

    -- Actualizar el estado del detalle
    UPDATE public.nomina_detalles
       SET estado = 'pagado',
           pagado_at = now(),
           pago_referencia = p_referencia
     WHERE id = v_detalle.id;

    v_pagos_creados := v_pagos_creados + 1;
    v_total_pagado := v_total_pagado + coalesce(v_detalle.total, 0);
  END LOOP;

  -- Actualizar el estado del periodo
  UPDATE public.periodos_nomina
     SET estado = 'pagado',
         updated_at = now()
   WHERE id = p_periodo_id;

  RETURN jsonb_build_object(
    'periodo_id', p_periodo_id,
    'estado', 'pagado',
    'pagos_registrados', v_pagos_creados,
    'total_pagado', v_total_pagado
  );
END;
$$;

-- Restricciones de ejecución a nivel de base de datos
REVOKE ALL ON FUNCTION public.vaciar_papelera_escoltas() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vaciar_papelera_escoltas() TO authenticated;

REVOKE ALL ON FUNCTION public.registrar_pago_nomina_periodo(uuid, text, text, date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_pago_nomina_periodo(uuid, text, text, date, uuid) TO authenticated;

