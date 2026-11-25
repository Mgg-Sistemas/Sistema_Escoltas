# Paleta corporativa – Sistema de Escoltas

Seguridad, vigilancia y autoridad: naranja, dorado, gris metálico y negro, con
degradados metálicos y acabados cromados. Los colores se definen de forma
centralizada en `frontend/tailwind.config.js`; no se usan valores sueltos en
los componentes.

## Tonalidades

| Grupo | Color | Hex | Uso principal |
| --- | --- | --- | --- |
| Naranja | Intenso | `#FF6600` | Acción primaria, foco, acentos |
| Naranja | Brillante | `#FF8C00` | Inicio del degradado de botones |
| Naranja | Oscuro | `#CC4400` | Fin del degradado, estados activos |
| Dorado | Dorado | `#FFB800` | Brillo ambiental del panel |
| Dorado | Amarillo dorado | `#FFD700` | Énfasis sobre fondo oscuro |
| Dorado | Amarillo luminoso | `#FFEB80` | Selección de texto |
| Gris | Cromado | `#C0C0C0` | Bordes, scrollbars |
| Gris | Plata | `#D9D9D9` | Separadores y superficies |
| Gris | Metálico | `#A6A6A6` | Texto del titular sobre negro |
| Gris | Medio | `#808080` | Texto secundario |
| Gris | Oscuro | `#404040` | Texto de apoyo |
| Gris | Grafito | `#25282B` | Inicio del degradado oscuro |
| Negro | Carbón | `#141414` | Paneles oscuros |
| Negro | Profundo | `#050505` | Fin del degradado oscuro |
| Negro | Absoluto | `#000000` | Contraste máximo |
| Blanco | Puro | `#FFFFFF` | Fondo de tarjetas |
| Blanco | Metálico | `#F2F2F2` | Fondo general |

## Degradados

- `bg-metal-oscuro`: `#25282B → #141414 → #050505`, panel institucional del login.
- `bg-metal-claro`: `#FFFFFF → #F2F2F2 → #D9D9D9`, tarjeta de acceso con acabado cromado.
- `bg-naranja-cromado`: `#FF8C00 → #FF6600 → #CC4400`, botones principales
  con `shadow-cromado` (brillo interno superior).

La escala `slate` se reemplaza por grises neutros de esta paleta, de modo que
el texto y los bordes no conserven el tinte azulado de Tailwind. El color
`emblem.gray` (`#A6A6A6`) mantiene legible el titular sobre el panel negro.

> BACKEND, RLS y SUPABASE no se modifican: la paleta afecta únicamente al FRONT.
