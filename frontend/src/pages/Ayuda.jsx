import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, CircleHelp, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const GUIA = [
  {
    titulo: 'Ingresar o recuperar mi contraseña',
    pasos: [
      'Entra con el usuario asignado y tu contraseña. Si te piden cambiarla, escribe la nueva y confírmala.',
      'Si olvidaste la clave, usa «¿Olvidaste tu contraseña?» en el ingreso. Si el enlace no llega, contacta al administrador.',
    ],
  },
  {
    titulo: 'Usar el sistema desde el teléfono',
    pasos: [
      'Abre el acceso del módulo que necesitas. Usa «Más» para ver las demás opciones disponibles.',
      'En cada módulo, usa la acción rápida o abre el historial, el directorio o el desglose cuando lo necesites.',
    ],
  },
  {
    titulo: 'Consultar o registrar personal',
    modulo: 'escoltas', ruta: '/escoltas', destino: 'Personal',
    pasos: [
      'Busca por nombre, cédula o código y abre la ficha para consultar los datos o ver el carnet.',
      'Si puedes registrar personal, abre el formulario de alta, completa los campos obligatorios y guarda.',
    ],
  },
  {
    titulo: 'Consultar o asignar un turno',
    modulo: 'distribucion', ruta: '/distribucion', destino: 'Turnos y distribución',
    pasos: [
      'Abre la matriz semanal o la lista y busca la asignación por persona o fecha.',
      'Si puedes asignar turnos, toca «Nueva asignación», elige personal, cliente, turno y fechas, y guarda.',
    ],
  },
  {
    titulo: 'Marcar entrada o salida',
    modulo: 'asistencias', ruta: '/asistencias', destino: 'Asistencias',
    pasos: [
      'Elige la fecha y busca la asignación. Pulsa «Entrada» cuando inicie la guardia.',
      'Pulsa «Salida» al terminar. Revisa que el sistema muestre ambas horas y el total.',
    ],
  },
  {
    titulo: 'Solicitar o revisar un permiso',
    modulo: 'permisos', ruta: '/permisos', destino: 'Descansos y permisos',
    pasos: [
      'Abre «Nueva solicitud», elige el tipo, indica las fechas y envía. Consulta el estado en el historial.',
      'Si te corresponde revisar, abre la solicitud pendiente, comprueba las fechas y registra tu decisión.',
    ],
  },
  {
    titulo: 'Consultar nómina, pagos y recibos',
    modulo: 'nomina', ruta: '/nomina', destino: 'Nómina, pagos y recibos',
    pasos: [
      'Selecciona el periodo y abre el desglose o «Recibos y comprobantes».',
      'Si gestionas la nómina, revisa los totales antes de cerrar el periodo. Al registrar un pago, verifica el monto y la referencia.',
    ],
  },
  {
    titulo: 'Administrar usuarios y permisos',
    modulo: 'usuarios', ruta: '/usuarios', destino: 'Usuarios y seguridad',
    pasos: [
      'En «Usuarios», busca la cuenta para revisar su rol y estado.',
      'En «Roles y permisos», selecciona el rol, marca los accesos necesarios y guarda los cambios.',
    ],
  },
];

function normalizar(texto) {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

export default function Ayuda() {
  const { puede } = useAuth();
  const [busqueda, setBusqueda] = useState('');
  const termino = normalizar(busqueda);
  const tareas = GUIA.filter(({ titulo, pasos, modulo }) =>
    (!modulo || puede(modulo)) && normalizar([titulo, ...pasos].join(' ')).includes(termino),
  );

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-slate-100 sm:text-3xl">Manual de usuario</h1>
        <p className="mt-1 text-sm text-slate-300">Busca una tarea o tócala para ver los pasos.</p>
      </header>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-3.5 h-5 w-5 text-brand-400" aria-hidden="true" />
        <input
          type="search"
          value={busqueda}
          onChange={(evento) => setBusqueda(evento.target.value)}
          placeholder="Buscar turno, permiso, recibo…"
          aria-label="Buscar en el manual"
          className="min-h-12 w-full rounded-xl border border-slate-700 bg-slate-900 pl-11 pr-4 text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-400"
        />
      </div>

      <div className="space-y-2">
        {tareas.map(({ titulo, pasos, ruta, destino }) => (
          <details key={titulo} className="group rounded-xl border border-slate-700 bg-slate-900/60">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-400 [&::-webkit-details-marker]:hidden">
              {titulo}
              <ChevronDown className="h-4 w-4 shrink-0 text-brand-400 group-open:rotate-180" aria-hidden="true" />
            </summary>
            <div className="space-y-3 px-4 pb-4">
              <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-slate-300">
                {pasos.map((paso) => <li key={paso}>{paso}</li>)}
              </ol>
              {ruta && (
                <Link to={ruta} className="inline-flex min-h-11 items-center rounded-lg border border-brand-500/40 px-3 text-sm font-semibold text-brand-300 hover:bg-brand-950/50">
                  Abrir {destino}
                </Link>
              )}
            </div>
          </details>
        ))}
        {!tareas.length && <p role="status" className="text-sm text-slate-300">No encontramos esa tarea. Prueba con otra palabra.</p>}
      </div>

      <p className="flex items-start gap-2 border-t border-slate-700 pt-4 text-sm text-slate-300">
        <CircleHelp className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" aria-hidden="true" />
        Si falta una opción o aparece un error, informa al administrador qué módulo estabas usando, la fecha y el mensaje mostrado.
      </p>
    </div>
  );
}
