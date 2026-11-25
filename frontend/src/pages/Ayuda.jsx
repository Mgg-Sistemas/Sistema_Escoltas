import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BadgeHelp,
  BookOpen,
  ChevronDown,
  CircleHelp,
  ClipboardCheck,
  CreditCard,
  CalendarCheck2,
  CalendarRange,
  ShieldCheck,
  UsersRound,
  WalletCards,
} from 'lucide-react';
import { Badge, Card, Input } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useRealtime } from '../context/RealtimeContext.jsx';
import { ROLES, ROLES_DESCRIPCION, ROLES_LABELS } from '../lib/constants.js';

const FLUJO = [
  { icono: UsersRound, titulo: '1. Registra al personal', texto: 'Alta de escoltas con cédula, contacto, grado y estado.', ruta: '/escoltas' },
  { icono: CalendarRange, titulo: '2. Distribuye turnos', texto: 'Asigna escoltas a clientes en un rango de fechas.', ruta: '/distribucion' },
  { icono: CalendarCheck2, titulo: '3. Controla la asistencia', texto: 'Registro de entrada/salida y cálculo automático de horas.', ruta: '/asistencias' },
  { icono: ClipboardCheck, titulo: '4. Gestiona permisos', texto: 'Solicitud, aprobación o rechazo con nota de revisión.', ruta: '/permisos' },
  { icono: WalletCards, titulo: '5. Cierra la nómina', texto: 'Sueldo, bonos, descuentos y totales por escolta.', ruta: '/nomina' },
  { icono: CreditCard, titulo: '6. Registra pagos', texto: 'Montos, referencias y confirmación de cada desembolso.', ruta: '/pagos' },
];

const GLOSARIO = [
  { termino: 'Escolta', definicion: 'Persona contratada para brindar protección. Su ficha concentra identificación, contacto y estado.' },
  { termino: 'Asignación', definicion: 'Relación entre un escolta, un cliente y un turno durante un rango de fechas.' },
  { termino: 'Turno', definicion: 'Franja de cobertura (mañana, tarde, noche u otra configuración).' },
  { termino: 'Permiso', definicion: 'Ausencia solicitada y aprobada previamente. Puede requerir comprobante.' },
  { termino: 'Asistencia', definicion: 'Registro diario de entrada y salida. De ella se obtienen las horas trabajadas.' },
  { termino: 'Periodo de nómina', definicion: 'Rango de fechas que se liquidará en conjunto (por ejemplo, un mes).' },
  { termino: 'Detalle de nómina', definicion: 'Cálculo individual por escolta: sueldo base, bonos, extras y descuentos.' },
  { termino: 'Comprobante', definicion: 'Referencia o documento que respalda un permiso o un pago.' },
];

const FAQ = [
  {
    pregunta: '¿Qué hace "Mantener la sesión activa"?',
    respuesta: 'Si la dejas marcada, el sistema recuerda tu ingreso en este dispositivo y no te pedirá la clave cada vez. Si la desactivas, la sesión se cierra al cerrar el navegador. Esta opción no cambia tus permisos: siguen siendo los de tu rol.',
  },
  {
    pregunta: '¿Necesito un correo para entrar?',
    respuesta: 'No. Ingresas con el usuario que te asignó el administrador y tu contraseña. El correo existe sólo de forma interna para enviar los enlaces de recuperación.',
  },
  {
    pregunta: 'No puedo ver Nómina ni Pagos, ¿es un error?',
    respuesta: 'No. Esos módulos son exclusivos de administradores y contadores. Si crees que te falta acceso, pide al administrador que revise tu rol en Usuarios.',
  },
  {
    pregunta: 'Olvidé mi contraseña, ¿qué hago?',
    respuesta: 'En la pantalla de ingreso toca «¿Olvidaste tu contraseña?», escribe tu usuario y abre el enlace que llegue a tu correo interno. Allí crea la nueva clave y confírmala dos veces. Si no llega, pide al administrador que te envíe un restablecimiento desde Usuarios.',
  },
  {
    pregunta: 'Me pidieron cambiar la clave al entrar, ¿por qué?',
    respuesta: 'Tu cuenta usa una clave temporal (123456 para el administrador inicial o es-123 para usuarios nuevos). Por seguridad el sistema te lleva a Cambiar clave y no permite usar el menú hasta que escribas la nueva dos veces y coincidan.',
  },
  {
    pregunta: 'No puedo ver Roles y permisos ni Ajustes',
    respuesta: 'Esos módulos son exclusivos del administrador. Si necesitas cambiar la matriz de acceso o la clave inicial de los usuarios, pídele al administrador que los abra desde el menú.',
  },
  {
    pregunta: '¿Cómo se calculan las horas?',
    respuesta: 'Se resta la hora de entrada de la de salida en cada registro de asistencia. Si editas alguna hora, el total se recalcula automáticamente al guardar.',
  },
  {
    pregunta: '¿Cuándo debo cerrar un periodo?',
    respuesta: 'Cuando ya verificaste todas las fichas, asistencias y totales. El cierre deja el periodo listo para la etapa de pagos y evita cambios accidentales.',
  },
  {
    pregunta: 'Un registro no aparece en la lista, ¿qué reviso?',
    respuesta: 'Revisa los filtros de búsqueda y estado, y confirma que elegiste la fecha correcta en Asistencias. Si sigue sin aparecer, actualiza la página.',
  },
];

export default function Ayuda() {
  const { role } = useAuth();
  const { conectado } = useRealtime();
  const [busqueda, setBusqueda] = useState('');
  const [faqAbierta, setFaqAbierta] = useState(0);

  const texto = busqueda.trim().toLowerCase();
  const glosarioFiltrado = GLOSARIO.filter((item) =>
    !texto || `${item.termino} ${item.definicion}`.toLowerCase().includes(texto),
  );
  const faqFiltrada = FAQ.filter((item) =>
    !texto || `${item.pregunta} ${item.respuesta}`.toLowerCase().includes(texto),
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Centro de ayuda</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">
          Guía práctica para usar el sistema sin confusiones. Busca un término, revisa el paso a paso
          de tu rol y consulta las preguntas frecuentes.
        </p>
      </header>

      <Card title="Buscar en la ayuda" subtitle="Escribe una palabra como «permiso», «pago» o «asistencia»">
        <Input
          type="search"
          value={busqueda}
          onChange={(evento) => setBusqueda(evento.target.value)}
          placeholder="¿Qué necesitas saber?"
          aria-label="Buscar en la ayuda"
        />
      </Card>

      <Card title="Tu rol y sus responsabilidades" subtitle="El menú ya está adaptado a tu perfil">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {ROLES.map((rol) => {
            const Icono = rol === 'escolta' ? ShieldCheck : rol === 'contador' ? WalletCards : rol === 'supervisor' ? CalendarRange : UsersRound;
            const esActual = rol === role;
            return (
              <div
                key={rol}
                className={`rounded-xl border p-4 ${esActual ? 'border-brand-400 bg-brand-50 ring-2 ring-brand-100' : 'border-slate-200 bg-white'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <Icono className="h-5 w-5 text-brand-700" aria-hidden="true" />
                  {esActual && <Badge tone="azul">Tu rol</Badge>}
                </div>
                <p className="mt-3 text-sm font-bold text-slate-900">{ROLES_LABELS[rol]}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">{ROLES_DESCRIPCION[rol]}</p>
              </div>
            );
          })}
        </div>
      </Card>

      <Card title="Flujo recomendado" subtitle="Sigue este orden para mantener la información consistente">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {FLUJO.map((paso) => {
            const Icono = paso.icono;
            return (
              <Link
                key={paso.titulo}
                to={paso.ruta}
                className="flex min-h-28 gap-3 rounded-xl border border-slate-200 p-4 transition-colors hover:border-brand-300 hover:bg-brand-50/40"
              >
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                  <Icono className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-slate-900">{paso.titulo}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-slate-600">{paso.texto}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </Card>

      <Card title="Datos en tiempo real" subtitle="No necesitas recargar la página para ver cambios">
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center">
          <span
            className={`inline-flex h-3 w-3 shrink-0 rounded-full ${conectado ? 'bg-emerald-500' : 'bg-amber-500'}`}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900">
              {conectado ? 'Sincronización activa' : 'Reconectando…'}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              Cuando otro usuario aprueba un permiso, registra una asistencia o confirma un pago,
              las listas se actualizan solas. El puntito verde de la esquina superior indica que
              estás conectado. Si ves ámbar, espera unos segundos: la conexión se restablece sola.
              Solo recibes cambios que tu rol tiene permiso para ver.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card title="Glosario" subtitle="Términos que aparecen en el sistema">
          {glosarioFiltrado.length ? (
            <dl className="space-y-3">
              {glosarioFiltrado.map((item) => (
                <div key={item.termino} className="rounded-xl bg-slate-50 p-3">
                  <dt className="text-sm font-bold text-slate-900">{item.termino}</dt>
                  <dd className="mt-1 text-sm leading-relaxed text-slate-600">{item.definicion}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm text-slate-500">No hay términos que coincidan con la búsqueda.</p>
          )}
        </Card>

        <Card title="Preguntas frecuentes" subtitle="Respuestas rápidas a dudas comunes">
          {faqFiltrada.length ? (
            <div className="divide-y divide-slate-100">
              {faqFiltrada.map((item, indice) => {
                const abierta = faqAbierta === indice;
                return (
                  <div key={item.pregunta}>
                    <button
                      type="button"
                      onClick={() => setFaqAbierta(abierta ? -1 : indice)}
                      aria-expanded={abierta}
                      className="flex w-full min-h-12 items-center justify-between gap-3 py-3 text-left text-sm font-semibold text-slate-800"
                    >
                      {item.pregunta}
                      <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${abierta ? 'rotate-180' : ''}`} aria-hidden="true" />
                    </button>
                    {abierta && <p className="pb-4 text-sm leading-relaxed text-slate-600">{item.respuesta}</p>}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No hay preguntas que coincidan con la búsqueda.</p>
          )}
        </Card>
      </div>

      <div className="flex flex-col items-start gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-5 text-brand-900 sm:flex-row sm:items-center">
        <BadgeHelp className="h-8 w-8 shrink-0" aria-hidden="true" />
        <div className="flex-1">
          <p className="font-bold">¿Necesitas más apoyo?</p>
          <p className="mt-1 text-sm leading-relaxed text-brand-800">
            Comunica el problema al administrador indicando el módulo, la fecha y el mensaje de error
            que apareció en la notificación. Eso acelera la revisión.
          </p>
        </div>
        <BookOpen className="hidden h-6 w-6 sm:block" aria-hidden="true" />
      </div>

      <p className="flex items-center gap-2 text-xs text-slate-400">
        <CircleHelp className="h-4 w-4" aria-hidden="true" />
        Los botones grandes y las ayudas están pensados para usarse desde el celular con una sola mano.
      </p>
    </div>
  );
}
