# Phase 2 — Navigation Restructure + New Modules (ATC Digital Claro Guatemala)

**Agent**: Code (Z.ai Code)
**Date**: Phase 2 implementation
**Task ID**: phase2-navigation-modules

## Resumen

Implementacion de la Fase 2 (reestructuracion de navegacion del asesor + nuevos modulos)
para ATC Digital Claro Guatemala v3.3.0. Se anaden 5 secciones de navegacion para el asesor
(tNPS · Metricas · Nomina · Novedades/WFM · Mi espacio) y 2 modulos nuevos para admin/supervisor
(Validacion de Tiempos y Gestion WFM).

## Archivos modificados

### 1. Store (Tipos de tabs)
- `src/lib/store.ts`
  - Anadidos 11 nuevos `TabId` al union type:
    `tnps-resumen`, `tnps-encuestas`, `tnps-calculadora`,
    `metricas-adherencia-detalle`, `metricas-productividad`,
    `nomina-consolidado`, `nomina-validacion`,
    `novedades-reporte`, `wfm-sugerencia`,
    `admin-validacion`, `admin-wfm`.

### 2. Sidebar Navigation
- `src/components/tnps/sidebar-navigation.tsx`
  - Reestructurado el array `TABS` con la nueva estructura de 5 secciones para asesor.
  - Eliminados los tabs antiguos del asesor: `mis-encuestas`, `mis-metricas`,
    `calculadora`, `aprendizaje`, `streaks`, `podio-global` (para asesor; se conserva
    para admin), `metricas` (antiguo, se conserva para admin).
  - Anadidos imports: `ClipboardCheck`, `CalendarClock`, `Clock`, `AlertTriangle`, `Activity`.
  - Anadidos 2 tabs nuevos para admin/supervisor:
    `admin-validacion` (Validacion de Tiempos) y `admin-wfm` (Gestion WFM).

### 3. Routing principal
- `src/app/page.tsx`
  - Anadidos imports para los 11 nuevos componentes de vista.
  - Anadidas 11 lineas de routing condicional por tab.
  - Eliminados los routings antiguos: `mis-encuestas`, `mis-metricas`, `calculadora`,
    `aprendizaje`, `streaks`.
  - Eliminados imports no usados (`MisEncuestasView`, `MisMetricasView`, `CalculadoraTNPS`,
    `FormulariosAsesorView`, `StreaksView`).

### 4. Inicio panel (mejoras)
- `src/components/tnps/inicio-panel.tsx`
  - Anadida seccion "Mi perfil" con avatar, nombre, cedula, LOB/campana, supervisor,
    usuario y cargo.
  - Anadida grilla de KPIs operativos: tNPS, % Adherencia, TMO, PPH, % Ausentismo,
    Llegadas tarde (mas badges de excesos Break/Bano/Capa).
  - Anadida tabla "Dias trabajados" con Fecha, Turno, Entrada, Salida, Asistencia y
    Cumplimiento (progress bar + porcentaje).
  - Anadido selector de dia (`SelectorDiaAdherencia`).
  - Actualizados atajos para apuntar a las nuevas vistas (`tnps-resumen`,
    `metricas-adherencia-detalle`, `nomina-consolidado`, `novedades-reporte`).
  - Eliminado el uso de `miWallet` y `useATCStore` (no se usaban fuera de los atajos).

## Archivos creados (11 nuevos componentes en `src/components/tnps/`)

### 5. `tnps-resumen-view.tsx`
- Vista de resumen tNPS del asesor.
- HERO con score tNPS, total encuestas, score promedio y escala (Excelencia/Muy bueno/Mejorable/etc.).
- KPI cards: Promotores / Pasivos / Detractores con conteo y porcentaje.
- Distribucion visual con barras de progreso.
- Tendencia acumulada usando `TrendChart`.
- Atajos a "Ver mis encuestas" y "Calculadora de promotores".

### 6. `tnps-encuestas-view.tsx`
- Tabla de historial de encuestas: ID caso, Fecha, Calificacion, Comentarios,
  Tipificacion (nivel1/nivel2).
- Filtro por grupo tNPS (Promotor / Pasivo / Detractor / Todas).
- Filtro por rango de fechas (desde / hasta).
- KPI cards (tNPS, P/Pa/D, score promedio).
- Popup de detalle al hacer clic en una fila (`EncuestaDetalleDialog`).

### 7. `tnps-calculadora-view.tsx` (CRITICO: count-based)
- Calculadora basada en conteos (no porcentajes).
- Muestra la base actual: Total encuestas, Promotores, Detractores, tNPS actual.
- Input: Meta de tNPS objetivo (numero).
- Formula: `x = (X*N - 100*P + 100*D) / (100 - X)` donde x = promotores consecutivos nuevos.
- Validaciones:
  - Si meta >= 100: "Meta invalida".
  - Si x <= 0: "Ya superaste la meta con tu tNPS actual".
  - x se redondea hacia arriba (Math.ceil).
- Muestra resultado claro: "Necesitas ganar X promotores consecutivos nuevos".
- Chips rapidos para metas comunes (75, 50, 25, 0, -10).
- Desglose de totales finales (Total, Promotores, Pasivos, Detractores).

### 8. `metricas-adherencia-detalle-view.tsx`
- Tabla detallada de adherencia por dia: Fecha, Turno, Conectado (UTL), Auxiliares,
  Exceso Break, Exceso Baño, Exceso Capa, % Adh.
- KPIs agregados: % Adherencia prom, TMO prom, Interacciones, Excesos totales.
- Selector de dia.
- Filtra por `perfilAsesor.documento`.
- Exceso badges con colores (verde si OK, amber si tiene exceso).

### 9. `metricas-productividad-view.tsx`
- KPIs productividad: Interacciones, TMO prom, PPH prom, Dias con datos.
- KPIs asistencia: % Ausentismo, Llegadas tarde, A tiempo, Total dias.
- Tabla por dia: Fecha, Interacciones, TMO, PPH, Asistencia, Llegada, Ausente.
- Selector de dia.

### 10. `nomina-consolidado-view.tsx`
- Total horas laboradas (suma de `horasFact`), Horas UTL, Tiempo ajustado (novedades aprobadas),
  Valor acumulado (Q15/hora tarifa configurable).
- Desglose por dia: Fecha, Horas fact., Horas UTL, Ajuste, Efectivas, Valor dia.
- Listado de novedades con estado (Pendiente / Aprobada / Rechazada).
- Conteo por estado en badges.
- Nota informativa sobre la tarifa de referencia.

### 11. `nomina-validacion-view.tsx`
- Desglose diario: Fecha, Horas Programadas, Horas Robot (horasFact), Tiempo Faltante,
  Tiempo Ajustado (novedades aprobadas), Efectivas, Valor dia, Novedad.
- KPIs consolidados: Horas programadas, Robot, Faltante, Valor total.
- Fila de totales al final de la tabla.
- Carga novedades via `leerNovedades(documento)`.

### 12. `novedades-reporte-view.tsx` (FORMULARIO)
- Campos: Fecha (date), Hora inicio, Hora fin (auto-calcula duracion en segundos),
  Tipo de novedad (6 opciones), Numero de Ticket/Caso (condicionalmente requerido para
  fallas tecnicas), Descripcion (textarea), Evidencia (file input, solo guarda el nombre).
- Submit: `guardarNovedad({ id: crypto.randomUUID(), documento, nombre, fecha, horaInicio,
  horaFin, duracion, tipo, ticket, descripcion, evidenciaUrl, estado: 'pendiente' })`.
- Toast de exito, reset del formulario y recarga del listado.
- Listado de novedades previas con estado badges.
- Validaciones claras (fecha, horas, tipo, ticket condicional, descripcion).

### 13. `wfm-sugerencia-view.tsx` (FORMULARIO)
- Banner sticky con word-wrap: break-word (aviso: "Las sugerencias de turno las toma en
  cuenta el area de WFM...").
- Cedula: select con busqueda (Command/Popover) usando lista predefinida de 19 cedulas.
- Turno Sugerido: select con 24 opciones predefinidas (formato HH:MM:SS-HH:MM:SS).
- Descanso: select con 7 opciones (LUNES a DOMINGO).
- Tipo de Restriccion: ESTUDIO, EMBARAZO, OTROS.
- Prioridad: PRIORIDAD DESCANSO, PRIORIDAD TURNO.
- Comentario (textarea opcional).
- Submit: `guardarSugerenciaTurno({ id, documento, nombre, turnoSugerido, descanso,
  tipoRestriccion, prioridad, comentario, semana: semanaISOActual(), estado: 'pendiente' })`.
- Semana ISO calculada con funcion custom (YYYY-Www).
- Listado de sugerencias previas del asesor.

### 14. `admin-validacion-view.tsx` (PANEL ADMIN)
- Tabla de validacion de tiempos: Documento, Nombre, Fecha, Horas Programadas, Horas Robot,
  Tiempo Faltante, Exceso Auxiliares, Novedad (estado), Valor dia, Accion.
- KPIs: Total registros, Con tiempo faltante, Ajustados, Pendientes.
- Filtros: busqueda (doc/nombre), fecha, "solo faltantes".
- Boton "Ajustar" por fila: llama `actualizarNominaDiaria(documento, fecha,
  tiempoAjustadoSeg, valorMonetario, 'ajustado')`.
- Boton "Exportar" a Excel (usa `exportarTablaAExcel`).

### 15. `admin-wfm-view.tsx` (PANEL ADMIN)
- Tabla de todas las sugerencias de turno enviadas por asesores.
- Filtros: semana, prioridad, tipo de restriccion, busqueda.
- Columnas: Documento, Nombre, Semana, Turno Sugerido, Descanso, Restriccion, Prioridad,
  Comentario, Estado, Acciones.
- Acciones: Aprobar / Rechazar (solo si estado === 'pendiente').
- Boton Exportar a Excel.
- KPIs: Total, Pendientes, Aprobadas, Rechazadas.

## Build

- `bun run build` exitoso (sin errores TypeScript).
- Compilado en 13.5s con Turbopack.
- Generadas 6 paginas estaticas sin errores.
- Lint: los warnings de `react-hooks/set-state-in-effect` son consistentes con el resto
  del codebase (bd-status-panel, login-panel, memory.tsx, etc.) y no bloquean el build.

## Dependencias usadas
- `crypto.randomUUID()` para IDs.
- `leerNovedades`, `guardarNovedad`, `actualizarNovedad` (de `firestore-data`).
- `leerSugerenciasTurno`, `guardarSugerenciaTurno`, `actualizarSugerenciaTurno`.
- `leerNominaDiaria`, `guardarNominaDiaria`, `actualizarNominaDiaria`.
- `exportarTablaAExcel` (de `excel-export`).
- `TrendChart`, `KPICard`, `AsesorAvatarGradient`, `CumpleanosCard`.
- shadcn/ui: Card, Button, Badge, Table, Select, Input, Textarea, Progress, Tabs, Popover, Command.
- lucide-react icons.
- framer-motion (animaciones).
- sonner (toast).
