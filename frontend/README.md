# Sistema de Escoltas · Frontend

Interfaz web responsive (móvil primero) para el control de escoltas: fichas, distribución de turnos, permisos, asistencias, nómina y pagos.

## Tecnologías

- React 18 + Vite 5
- React Router v6 (rutas protegidas por autenticación y por rol)
- Supabase JS v2 (autenticación, sesión y CRUD con RLS)
- Tailwind CSS 3.4 + PostCSS + Autoprefixer
- Lucide React (iconos)

## Puesta en marcha

```bash
cd frontend
npm install
cp .env.example .env   # en Windows: copy .env.example .env
```

Edita `.env` y completa:

```env
VITE_SUPABASE_URL=https://rznkopetlmitfxcixjcr.supabase.co
VITE_SUPABASE_ANON_KEY=tu_clave_anon_publica
VITE_API_URL=http://localhost:4000
```

> Nunca coloques la clave `service_role` en el frontend: la clave anon trabaja junto a RLS.

Luego:

```bash
npm run dev      # servidor local en http://localhost:5173
npm run build    # compilación de producción en dist/
npm run preview  # vista previa de la compilación
```

## Estructura

```
src/
├── main.jsx                 # entrada: Router + AuthProvider + ToastProvider
├── App.jsx                  # rutas, guard de sesión, pantalla "Sin permiso"
├── index.css                # Tailwind + estilos base y focus visible
├── lib/
│   ├── supabase.js          # cliente Supabase
│   ├── api.js               # fetch al backend Node con Bearer token
│   ├── data.js              # helpers CRUD + formateo de fecha/moneda/horas
│   └── constants.js         # roles, estados, colores y opciones
├── context/AuthContext.jsx  # sesión, perfil, rol, signIn/signOut
├── components/
│   ├── ui.jsx               # botones, tarjetas, modales, toasts, tabla auxiliar…
│   ├── Layout.jsx           # cabecera, sidebar, drawer y barra inferior móvil
│   └── DataTable.jsx        # tabla en md+ / tarjetas en móvil
└── pages/                   # Login, Dashboard, Escoltas, Distribución, Permisos,
                             # Asistencias, Nómina, Pagos, Usuarios, Ayuda
```

## Roles y permisos de interfaz

| Módulo | Roles con acceso |
| --- | --- |
| Inicio, Permisos, Ayuda | Todos |
| Escoltas, Asistencias | admin, supervisor, escolta (el escolta solo ve lo suyo) |
| Distribución | admin, supervisor |
| Nómina, Pagos | admin, contador |
| Usuarios | solo admin |

Si un usuario entra a una ruta no permitida ve una pantalla amigable de **«Sin permiso»** con explicación y accesos para volver. El backend y RLS siguen siendo la autoridad real: el frontend solo oculta lo que no corresponde.

## Decisiones importante

- **CRUD directo con Supabase** para catálogos y registros; **backend `/api`** solo para acciones privilegiadas (resumen, revisión de permisos, cierre/pago de nómina y pagos). Todas las peticiones al backend envían `Authorization: Bearer <access_token>`.
- **Manejo de errores**: `src/lib/data.js` traduce errores frecuentes de Postgres; `api.js` lanza `ApiError` con el mensaje del backend; las páginas muestran notificaciones (toasts) claras de éxito/error.
- **Didáctica**: textos de ayuda en cada formulario, `HelpTip`, estados vacíos con botón de acción, guía «Primeros pasos» en el inicio, resúmenes calculados y centro de ayuda con glosario y FAQ.
- **Responsive**: una columna en móvil, grids `md`/`xl`, tabla solo en `md+`, tarjetas táctiles en móvil, barra inferior con `safe-area-inset-bottom` y botones de al menos 44 px.
- **Moneda y fechas**: formato `es-VE` con `VES` por defecto (parámetro configurable en `formatearMoneda`) y fechas interpretadas en hora local para evitar desfases de zona horaria.

## Requisitos previos

- Backend Node escuchando en `VITE_API_URL` para los módulos privilegiados.
- Proyecto Supabase con el esquema indicado y políticas RLS activas.
- Usuarios creados en Supabase Auth con su fila correspondiente en `profiles`.
