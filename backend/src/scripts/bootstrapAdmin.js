/**
 * Crea (una sola vez) el primer usuario administrador.
 *
 *   npm run bootstrap:admin
 *
 * Correo: ADMIN_EMAIL (por defecto administrador@escoltas.local)
 * Clave:  PASSWORD_INICIAL_ADMIN (por defecto 123456)
 *
 * Si la cuenta ya existe, NO cambia su contraseña: solo garantiza que el perfil
 * tenga rol admin. La bandera `must_change_password` se respeta para no obligar
 * a cambiar de nuevo una clave que ya fue actualizada.
 */
import { config } from '../config.js';
import { supabase } from '../lib/supabase.js';

const EMAIL = config.adminEmail;
const NOMBRE = 'ADMINISTRADOR';

async function buscarUsuarioAuth() {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  return (data?.users ?? []).find((usuario) => usuario.email?.toLowerCase() === EMAIL);
}

async function main() {
  const { data: perfil, error: perfilError } = await supabase
    .from('profiles')
    .select('id,role,must_change_password')
    .eq('email', EMAIL)
    .maybeSingle();
  if (perfilError) throw perfilError;

  let id = perfil?.id ?? null;
  let creado = false;

  if (!id) {
    const existente = await buscarUsuarioAuth();
    if (existente) id = existente.id;
  }

  if (!id) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: EMAIL,
      password: config.passwordInicialAdmin,
      email_confirm: true,
      user_metadata: { usuario: NOMBRE, full_name: NOMBRE, role: 'admin' },
    });
    if (error) throw error;
    id = data.user.id;
    creado = true;
  }

  const { data: roleRow } = await supabase.from('roles').select('id').eq('nombre', 'admin').maybeSingle();
  const datosPerfil = {
    id,
    usuario: NOMBRE,
    email: EMAIL,
    full_name: NOMBRE,
    role: 'admin',
    role_id: roleRow?.id ?? null,
    active: true,
    must_change_password: creado ? true : perfil?.must_change_password !== false,
  };

  let { error: upsertError } = await supabase
    .from('profiles')
    .upsert(datosPerfil, { onConflict: 'id' });

  // Si la migración de login por usuario aún no se aplicó, seguimos sin esa columna.
  if (upsertError && /usuario|column/i.test(upsertError.message ?? '')) {
    delete datosPerfil.usuario;
    ({ error: upsertError } = await supabase
      .from('profiles')
      .upsert(datosPerfil, { onConflict: 'id' }));
  }
  if (upsertError) throw upsertError;

  if (creado) {
    console.log('[BOOTSTRAP] Administrador creado correctamente.');
    console.log(`  Usuario: ${NOMBRE}`);
    console.log(`  Correo interno: ${EMAIL}`);
    console.log(`  Clave temporal: ${config.passwordInicialAdmin}`);
    console.log('  El sistema exigirá cambiar la contraseña en el primer ingreso.');
  } else {
    console.log('[BOOTSTRAP] El administrador ya existía; se conservó su contraseña actual.');
  }
}

main().catch((error) => {
  console.error('[BOOTSTRAP] No se pudo crear el administrador:', error.message);
  process.exitCode = 1;
});
