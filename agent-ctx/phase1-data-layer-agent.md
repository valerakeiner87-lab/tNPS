# Phase 1 — Data Layer Changes (ATC Digital Claro Guatemala)

**Agent**: Code (Z.ai Code)
**Date**: Phase 1 implementation
**Task ID**: phase1-data-layer

## Resumen

Implementacion de la Fase 1 (cambios de capa de datos) para ATC Digital Claro Guatemala v3.3.0.

## Archivos modificados

### 1. Filtro de LOBs y fix de mapeo de Adherencia
- `src/lib/excel-parser.ts`
  - Agregada constante `LOBS_PERMITIDOS` (4 LOBs) y helper `esLobPermitido()`.
  - `parsearHC`: filtro `if (lob && !esLobPermitido(lob)) continue;` despues de leer `lob`.
  - `parsearAdherencia`: filtro `if (!esLobPermitido(lob)) continue;` despues de leer `lob`.
  - `parsearAdherencia`: cambiado `loginNormalizado: normalizarLogin(nombre || String(documento))` -> `loginNormalizado: String(documento).trim()` (usa documento como clave de matching).
  - `areaDeLob`: documentada la compatibilidad con `'telefonico'` (string, no Area type).
  - `parsearQualtricsTelefonico`: cambiado `area: 'telefonico'` -> `area: 'digital'` (unicamente Area valido).

### 2. Bug fix matching por documento (no por loginNormalizado)
- `src/components/tnps/metricas-adherencia-view.tsx`
  - Filtro cambiado de `m.loginNormalizado !== login` -> `m.documento !== docAsesor`.
  - Header description cambiado a usar `perfilAsesor?.documento || perfil?.documento`.
- `src/components/tnps/inicio-panel.tsx`
  - `AdherenciaResumenCard`: prop cambiada `loginAsesor` -> `docAsesor`, filtro por `m.documento === docAsesor`.

### 3. Remocion del area Telefonico
- `src/lib/types.ts`
  - `Area` cambiado de `'digital' | 'telefonico'` -> `'digital'`.
  - `TMOAsesorDaily.area`: cambiado de `Area | ''` a `'digital' | 'telefonico' | ''` (inline, preserva compatibilidad con datos historicos TMO).
- `src/lib/session.ts`
  - `AuthSession.area`: cambiado de `'digital' | 'telefonico'` -> `'digital'`.
  - `getSession`/`verifySessionFromToken`: devuelven `area: 'digital'` siempre.
- `src/app/api/auth/login/route.ts`
  - Removido `area` del destructuring del body.
  - `sessionData.area`: hardcoded `'digital' as const`.
- `src/app/actions/auth-actions.ts`
  - `UserInfo.area`, `loginAction(area)`, `createSupervisorAction(_area)`: cambiados a `'digital'` (o `_area: 'digital'` para mantener API).
  - `area` en `db.user.upsert`: hardcoded `'digital'`.
- `src/lib/store.ts`
  - `apiLogin(area)`: tipo `'digital'`.
  - Removido `cargarSoloQualtricsTelefonico` de interfaz `EstadoPrincipal` y su implementacion.
  - Removido import de `parsearQualtricsTelefonico`.
  - `setAreaActiva`: siempre asigna `'digital'`.
  - `recalcularDatosFiltrados`: removido el filtro por area (solo hay Digital).
- `src/components/tnps/login-panel.tsx`
  - Removidos botones de area (Digital/Telefonico) y estado `area`.
  - Hardcoded `area: 'digital'` en el POST.
  - `tituloApp = 'ATC Digital'` (sin ternario).
  - Removidos imports no usados: `Headset`, `MessageSquare`, `Area`, `cn`.
- `src/app/page.tsx`
  - Removido `areaActiva` del store hook.
  - Reemplazados 4 ternarios `areaActiva === 'digital' ? 'Digital' : 'Telefonico'` por `'Digital'`.
- `src/components/tnps/upload-panel.tsx`
  - Removido `cargarSoloQualtricsTelefonico` del store hook.
  - Removida la rama telefonico del boton "Solo Qualtrics" (siempre llama a `cargarSoloQualtrics`).
  - Boton "Solo Qualtrics Digital" (sin switch Digital/Telefonico).
  - Removido import `Headset` no usado.
- `src/components/tnps/admin-view.tsx`
  - Removido boton "Cargar Qualtrics Telefonico" del panel admin.
- `src/components/tnps/encuesta-detalle-dialog.tsx`
  - Prop `area?: Area` cambiada a `area?: 'digital'`.
  - Removida rama `area === 'telefonico'` en la seleccion de indices (siempre TIEMPO/CONOCIMIENTO/SOLUCION).
  - Removido import `Area` no usado.
- `src/components/tnps/asesor-perfil-supervisor.tsx`
  - Removidos castings `as Area` y rama `areaUsuario === 'telefonico'`.
  - `getRendimientoAsesor` siempre recibe `'digital'`.
  - Removido import `Area` no usado.
- `src/components/tnps/dashboard-ejecutivo.tsx`
  - `comparativaAreas`: ahora solo retorna Digital (sin Telefonico).

### 4. Nuevos modelos Prisma (v3.3.0)
- `prisma/schema.prisma` y `prisma/schema.postgres.prisma`
  - `Novedad` (id, documento, fecha, horas, tipo, ticket, evidencia, estado, etc.).
  - `SugerenciaTurno` (id, documento, turnoSugerido, descanso, restriccion, semana, estado).
  - `NominaDiaria` (id, documento, fecha, horas, tiempoAjustado, valorMonetario, @@unique([documento, fecha])).

### 5. Funciones en neon-data.ts
- Tipos exportados: `Novedad`, `SugerenciaTurno`, `NominaDiaria`.
- Mappers: `mapNovedad`, `mapSugerenciaTurno`, `mapNominaDiaria`.
- `leerNovedadesNeon(documento?)`, `guardarNovedadNeon(novedad)`, `actualizarNovedadNeon(id, estado, procesadoPor?, respuesta?)`.
- `leerSugerenciasTurnoNeon(semana?)`, `guardarSugerenciaTurnoNeon(sugerencia)`, `actualizarSugerenciaTurnoNeon(id, estado)`.
- `leerNominaDiariaNeon(documento?)`, `guardarNominaDiariaNeon(registro)` (upsert por `documento_fecha`), `actualizarNominaDiariaNeon(documento, fecha, tiempoAjustado, valorMonetario, estado, procesadoPor?)`.
- Uso de `cachedRead` + `invalidatePattern` siguiendo el patron existente.

### 6. Server Actions en neon-actions.ts
- Importados tipos y funciones de `@/lib/neon-data`.
- `getNovedades(documento?)`, `saveNovedad(novedad)`, `actualualizarNovedad(id, estado, respuesta?)`.
- `getSugerenciasTurno(semana?)`, `saveSugerenciaTurno(sugerencia)`, `actualizarSugerenciaTurno(id, estado)`.
- `getNominaDiaria(documento?)`, `saveNominaDiaria(registro)`, `actualizarNominaDiaria(documento, fecha, tiempoAjustado, valorMonetario, estado)`.
- Todas validan session (`getSession`) y rol (`ADMIN`/`SUPERVISOR`) para escritura.

### 7. Wrappers en firestore-data.ts
- Importados tipos `Novedad`, `SugerenciaTurno`, `NominaDiaria` desde `./neon-data` (type-only).
- Wrappers `leerNovedades`, `guardarNovedad`, `actualizarNovedad`, `leerSugerenciasTurno`, `guardarSugerenciaTurno`, `actualizarSugerenciaTurno`, `leerNominaDiaria`, `guardarNominaDiaria`, `actualizarNominaDiaria` que delegan a las server actions via dynamic import.

## Prisma Client
- `npx prisma generate` ejecutado correctamente (v6.19.3).
- Generado en `./node_modules/@prisma/client`.

## Build
- `npm run build` completado con exito.
- Compilacion en 10.5s, TypeScript check en 9.0s.
- 6 paginas estaticas generadas.
- Sin errores de TypeScript.

## Errores encontrados y como se resolvieron

1. **`Type '"telefonico"' is not assignable to type '"digital"'`** en `auth-actions.ts` (areas con `'digital' | 'telefonico'`):
   - Fix: cambiados todos los tipos inline a `'digital'` y hardcodeado `area: 'digital'` en sesion y DB.

2. **`Property 'cargarSoloQualtricsTelefonico' does not exist on type 'EstadoPrincipal'`** en `admin-view.tsx`:
   - Fix: removido el boton "Cargar Qualtrics Telefonico" del panel admin.

3. **`Comparison '"digital" | undefined' and '"telefonico"' has no overlap`** en `dashboard-ejecutivo.tsx`:
   - Fix: `comparativaAreas` ahora solo retorna Digital (no compara con telefonico).

4. **`Cannot find name 'Headset'`** en `upload-panel.tsx`:
   - Fix: import `Headset` fue removido; reemplazado el uso en el ternario por `MessageSquare` (queda incondicional Digital).

5. **`Type '"telefonico"' is not assignable to type '"digital"'`** en `excel-parser.ts` (linea 799, parsearQualtricsTelefonico):
   - Fix: cambiado `area: 'telefonico'` -> `area: 'digital'` (solo Area valido ahora).

6. **`Type '"" | "digital" | "telefonico"' is not assignable to type '"" | "digital"'`** en `excel-parser.ts` (linea 1295, TMOAsesorDaily):
   - Fix: cambiado el tipo de `TMOAsesorDaily.area` de `Area | ''` a `'digital' | 'telefonico' | ''` (inline, preserva compatibilidad con datos TMO historicos que pueden incluir LOBs telefonicos).

## Notas
- `parsearQualtricsTelefonico` se mantiene en `excel-parser.ts` como funcion muerta (no se invoca desde store.ts), por compatibilidad con scripts externos y tests.
- `areaDeLob()` mantiene su return type `'digital' | 'telefonico' | ''` (string literal, no Area type) — no causa errores.
- Componentes que usan tipos inline `'digital' | 'telefonico'` (perfil-view, podio-global, torneos-view, billeteras-admin-view, tmo-config-view, config-juegos-view, formularios-admin-view, gestion-usuarios-view, admin-view, neon-data.ts LINEAS_DEFAULT, calcularRendimientoAsesorNeon, getRendimientoAsesor) siguen compilando bien porque no referencian el tipo `Area` de `types.ts`.
- Lint: 28 errores `react-hooks/set-state-in-effect` preexistentes en archivos como carousel.tsx, use-mobile.ts, login-panel.tsx (linea 40 — setModoHabilitado dentro del useEffect que NO fue modificado), page.tsx (linea 198 — cargarUltimaActualizacion dentro de useEffect). Ninguno fue introducido por esta fase.
