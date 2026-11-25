-- =====================================================================
-- Sistema de Escoltas — Datos semilla (catálogos y ejemplos)
-- Proyecto: rznkopetlmitfxcixjcr
--
-- Se puede ejecutar todas las veces que se quiera: todos los INSERT
-- usan ON CONFLICT ... DO NOTHING y no crean usuarios en auth.users.
-- Los usuarios se crean desde Authentication (ver README.md).
-- Idioma: español.
-- =====================================================================

SET search_path = public, extensions;

-- Grados.
INSERT INTO public.grados (nombre, nivel, activo) VALUES
  ('Escolta', 1, true),
  ('Supervisor de escoltas', 2, true),
  ('Jefe de escoltas', 3, true)
ON CONFLICT (nombre) DO NOTHING;

-- Turnos.
INSERT INTO public.turnos (nombre, hora_inicio, hora_fin, horas_base, activo) VALUES
  ('Mañana', TIME '08:00', TIME '16:00', 8, true),
  ('Tarde',  TIME '16:00', TIME '00:00', 8, true),
  ('Noche',  TIME '00:00', TIME '08:00', 8, true)
ON CONFLICT (nombre) DO NOTHING;

-- Tipos de permiso.
INSERT INTO public.tipos_permiso (nombre, descripcion, requiere_comprobante, activo) VALUES
  ('Vacaciones', 'Descanso programado de varios días.', false, true),
  ('Permiso médico', 'Ausencia por consulta, tratamiento o incapacidad médica.', true, true),
  ('Permiso personal', 'Ausencia por asunto personal breve.', false, true),
  ('Licencia', 'Licencia formal remunerada o no remunerada.', true, true)
ON CONFLICT (nombre) DO NOTHING;

-- Clientes de ejemplo.
INSERT INTO public.clientes (nombre, ruc, direccion, contacto, telefono, activo, color) VALUES
  ('Banco Nacional', '12345678-9', 'Av. Central 100, Ciudad', 'María Pérez', '021-555-0101', true, '#2563EB'),
  ('Corporación Andina', '87654321-0', 'Calle Sur 245, Ciudad', 'Carlos Ruiz', '021-555-0102', true, '#16A34A'),
  ('Grupo Logística del Sur', '11223344-5', 'Km. 5 Carretera Sur, Ciudad', 'Lucía Mendoza', '021-555-0103', true, '#DC2626')
ON CONFLICT (ruc) DO NOTHING;

-- Escoltas de ejemplo. user_id queda NULL a propósito: se vincula
-- después desde el dashboard cuando se cree el usuario de Auth.
INSERT INTO public.escoltas (
  codigo, nombres, apellidos, cedula, telefono, direccion,
  fecha_ingreso, grado_id, estado, notas
)
SELECT
  x.codigo,
  x.nombres,
  x.apellidos,
  x.cedula,
  x.telefono,
  x.direccion,
  x.fecha_ingreso::date,
  g.id,
  'activo',
  'Ficha de ejemplo creada por seed.sql.'
FROM (VALUES
  ('ESC-001', 'Juan',  'Ramírez', '00000001', '021-555-1001', 'Av. Norte 12',  '2025-02-01'::date, 'Escolta'),
  ('ESC-002', 'Ana',   'Torres',  '00000002', '021-555-1002', 'Calle Este 34', '2025-05-10'::date, 'Escolta'),
  ('ESC-003', 'Luis',  'Flores',  '00000003', '021-555-1003', 'Jr. Oeste 56',  '2025-08-20'::date, 'Supervisor de escoltas')
) AS x(codigo, nombres, apellidos, cedula, telefono, direccion, fecha_ingreso, grado_nombre)
JOIN public.grados AS g ON g.nombre = x.grado_nombre
ON CONFLICT (codigo) DO NOTHING;

-- Periodo de nómina abierto (quincena de noviembre de 2026).
INSERT INTO public.periodos_nomina (nombre, fecha_inicio, fecha_fin, estado)
VALUES ('Nómina quincena 01-15 noviembre 2026', DATE '2026-11-01', DATE '2026-11-15', 'abierto')
ON CONFLICT (nombre) DO NOTHING;

-- Detalles de nómina de ejemplo. El campo total es GENERATED, por eso
-- no aparece en la sentencia: se calcula solo en la base de datos.
INSERT INTO public.nomina_detalles (
  periodo_id, escolta_id, dias_trabajados, horas_extras,
  sueldo_base, bonos, descuentos, estado, notas
)
SELECT
  pn.id,
  e.id,
  15,
  CASE e.codigo WHEN 'ESC-001' THEN 4 ELSE 0 END,
  CASE e.codigo WHEN 'ESC-003' THEN 1800.00 ELSE 1500.00 END,
  CASE e.codigo WHEN 'ESC-002' THEN 50.00 ELSE 0.00 END,
  0.00,
  'pendiente',
  'Detalle de ejemplo generado por seed.sql.'
FROM public.periodos_nomina AS pn
CROSS JOIN public.escoltas AS e
WHERE pn.nombre = 'Nómina quincena 01-15 noviembre 2026'
  AND e.codigo IN ('ESC-001', 'ESC-002', 'ESC-003')
ON CONFLICT (periodo_id, escolta_id) DO NOTHING;

-- Fin del seed.
