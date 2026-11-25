# Metodología GitFlow

Este repositorio usa **GitFlow**. El objetivo es tener siempre `main` estable y poder
desarrollar, probar y corregir sin mezclar trabajos.

## Ramas principales

| Rama | Propósito | Se mergea desde |
| --- | --- | --- |
| `main` | Código en producción. Cada commit es una versión entregable. | `release/*`, `hotfix/*` |
| `develop` | Integración de todo el trabajo en curso. | `feature/*`, `release/*`, `hotfix/*` |

## Ramas de soporte

| Rama | Cuándo | Se crea desde | Se mergea a |
| --- | --- | --- | --- |
| `feature/<nombre>` | Nueva funcionalidad o mejora. | `develop` | `develop` |
| `release/<version>` | Preparar una versión (solo correcciones y documentación). | `develop` | `main` y `develop` |
| `hotfix/<nombre>` | Corregir un problema urgente en producción. | `main` | `main` y `develop` |

## Reglas de oro

1. **Nunca** committer ni hacer push directamente a `main` ni a `develop`.
2. Toda tarea empieza con una rama `feature/*` desde `develop` actualizado.
3. Una rasa de feature vive poco tiempo: se integra apenas pase la revisión.
4. Antes de abrir un PR, actualiza tu rama con `develop` (`git fetch && git rebase origin/develop`).
5. Los commits son descriptivos: `feat(permisos): aprobar solicitudes con notas`.
6. Prefix habituales: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `rls`, `db`.
7. Los secretos (`.env`, service role key) **jamás** entran al repositorio.
8. **No subir a Git hasta que el usuario diga literalmente `SUBELO`.**

## Comandos con el ayudante

Los scripts están en `scripts/gitflow.ps1`.

```powershell
# Inicializar main + develop y subir ambas (solo cuando se indique SUBELO)
powershell -File scripts/gitflow.ps1 -Action init

# Crear una feature
powershell -File scripts/gitflow.ps1 -Action feature -Name "modulo-escoltas"

# Crear un release
powershell -File scripts/gitflow.ps1 -Action release -Name "1.0.0"

# Crear un hotfix
powershell -File scripts/gitflow.ps1 -Action hotfix -Name "login-redirect"

# Ver el estado
powershell -File scripts/gitflow.ps1 -Action status
```

El script **no hace commit**: crea/actualiza ramas y deja los cambios en el working tree.
El commit y el push se ejecutan únicamente con la instrucción explícita `SUBELO`.

## Comandos equivalentes a mano

```powershell
# Feature
git checkout develop
git pull origin develop
git checkout -b feature/modulo-escoltas
# ... trabajar ...
git add .
git commit -m "feat(escoltas): alta y edición de expediente"

# Integrar feature en develop
git checkout develop
git merge --no-ff feature/modulo-escoltas

# Release
git checkout -b release/1.0.0 develop
# ... ajustes finales ...
git checkout main
git merge --no-ff release/1.0.0
git tag -a v1.0.0 -m "Versión 1.0.0"
git checkout develop
git merge --no-ff release/1.0.0

# Hotfix
git checkout -b hotfix/login-redirect main
# ... corrección ...
git checkout main
git merge --no-ff hotfix/login-redirect
git checkout develop
git merge --no-ff hotfix/login-redirect
```

## Flujo de trabajo de este proyecto

Cada petición del usuario se entrega **siempre** en cuatro capas:

1. **BACKEND** — endpoints y reglas de negocio privilegiadas.
2. **FRONTEND** — interfaz responsive y didáctica.
3. **RLS** — políticas de seguridad en la base de datos.
4. **SUPABASE** — migraciones, vistas, storage y datos.

Después se introduce el cambio en una rama `feature/*` sobre `develop`, y se sube solo
cuando se indique `SUBELO`.
