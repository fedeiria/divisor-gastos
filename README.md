# Divisor de Gastos Express

App web para dividir gastos de eventos cortos sin registro ni contraseñas. Supabase (PostgreSQL + Realtime) como backend.

## Setup

1. Crear un proyecto en [Supabase](https://supabase.com).
2. En el **SQL Editor** de Supabase, ejecutar el contenido de `supabase/migrations/0001_init.sql`.
3. Copiar la **Project URL** y la **anon public key** desde *Project Settings → API* y pegarlas en:
   - `src/environments/environment.ts`
   - `src/environments/environment.prod.ts`

## Desarrollo

```bash
npm install
ng serve
```

Abrir `http://localhost:4200/`.

## Tests

```bash
ng test
```

## Build

```bash
ng build
```

El artefacto de producción queda en `dist/divisor-gastos`.

## Estructura

- `src/app/core/` — servicios (`SupabaseService`, `GroupStateService`) y lógica pura (`expense-utils`).
- `src/app/models/` — interfaces de dominio.
- `src/app/pages/` — `create-group` y `group-page`.
- `src/app/components/` — `identity-modal`, `expense-modal`.
- `supabase/migrations/` — esquema SQL, RLS y realtime.
