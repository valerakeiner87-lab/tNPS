// ============================================================
// tNPS Digital Claro Guatemala — Métricas y KPIs
// Archivo: src/lib/metrics.ts
// Fórmula: tNPS = ((Promotores - Detractores) / Total) * 100
// Promotor: 9-10 | Pasivo: 7-8 | Detractor: 0-6
// ============================================================
import type {
  AsesorConsolidado,
  AsesorHC,
  Encuesta,
  FiltroFecha,
  FranjaKPI,
  Granularidad,
  Insight,
  KPIS,
  Linea,
  PuntoTendencia,
  TipificacionKPI,
} from './types';
import { FRANJAS, LINEAS } from './types';

/** Calcula los KPIs a partir de un array de encuestas */
export function calcularKPIs(encuestas: Encuesta[]): KPIS {
  const total = encuestas.length;
  if (total === 0) {
    return {
      total: 0,
      promotores: 0,
      pasivos: 0,
      detractores: 0,
      tNPS: 0,
      scorePromedio: 0,
      pctPromotores: 0,
      pctPasivos: 0,
      pctDetractores: 0,
    };
  }

  let promotores = 0;
  let pasivos = 0;
  let detractores = 0;
  let sumaScore = 0;

  for (const e of encuestas) {
    sumaScore += e.tnps;
    if (e.grupo === 'Promotor') promotores++;
    else if (e.grupo === 'Pasivo') pasivos++;
    else detractores++;
  }

  const tNPS = ((promotores - detractores) / total) * 100;

  return {
    total,
    promotores,
    pasivos,
    detractores,
    tNPS: Math.round(tNPS * 10) / 10,
    scorePromedio: Math.round((sumaScore / total) * 100) / 100,
    pctPromotores: Math.round((promotores / total) * 1000) / 10,
    pctPasivos: Math.round((pasivos / total) * 1000) / 10,
    pctDetractores: Math.round((detractores / total) * 1000) / 10,
  };
}

/**
 * Cruza las encuestas con el HC para crear asesores consolidados
 * con métricas tNPS individuales.
 */
export function consolidarAsesores(encuestas: Encuesta[], hc: AsesorHC[]): AsesorConsolidado[] {
  // 1. Índice de HC por usuarioCic (login normalizado)
  const hcPorLogin = new Map<string, AsesorHC>();
  for (const a of hc) {
    const login = a.usuarioCic || a.loginNormalizado;
    if (login) hcPorLogin.set(login.toLowerCase(), a);
  }

  // 2. Agrupar encuestas por loginNormalizado
  const encuestasPorLogin = new Map<string, Encuesta[]>();
  for (const e of encuestas) {
    if (!e.loginNormalizado) continue;
    const lista = encuestasPorLogin.get(e.loginNormalizado) ?? [];
    lista.push(e);
    encuestasPorLogin.set(e.loginNormalizado, lista);
  }

  const consolidados: AsesorConsolidado[] = [];

  for (const [login, encsAsesor] of encuestasPorLogin.entries()) {
    const registroHC = hcPorLogin.get(login);

    // 3. Determinar línea: la del HC, salvo que el 60%+ de sus encuestas sean de otra línea
    let linea: Linea = 'Fijo Soporte';
    if (registroHC?.linea) linea = registroHC.linea;

    const conteoLineas = new Map<Linea, number>();
    for (const e of encsAsesor) {
      conteoLineas.set(e.linea, (conteoLineas.get(e.linea) ?? 0) + 1);
    }
    for (const [lin, n] of conteoLineas.entries()) {
      if (n / encsAsesor.length >= 0.6) {
        linea = lin;
        break;
      }
    }
    // Si no hay registro HC, usar la línea mayoritaria de sus encuestas
    if (!registroHC) {
      let max = 0;
      for (const [lin, n] of conteoLineas.entries()) {
        if (n > max) {
          max = n;
          linea = lin;
        }
      }
    }

    const alertas = encsAsesor.filter((e) => e.alertaAgresiva).length;

    consolidados.push({
      loginNormalizado: login,
      nombre: registroHC?.nombre || encsAsesor[0]?.usuario || login,
      documento: registroHC?.documento || '',
      linea,
      supervisor: registroHC?.supervisor || 'Sin supervisor',
      sede: registroHC?.sede || '—',
      lob: registroHC?.lob || '—',
      cargo: registroHC?.cargo || '—',
      fechaIngreso: registroHC?.fechaIngreso || '—',
      origenHC: Boolean(registroHC),
      encuestas: encsAsesor,
      kpis: calcularKPIs(encsAsesor),
      alertas,
      tieneAlertas: alertas > 0,
    });
  }

  // 4. Ordenar por tNPS descendente
  consolidados.sort((a, b) => b.kpis.tNPS - a.kpis.tNPS || b.kpis.total - a.kpis.total);
  return consolidados;
}

/** Etiqueta del período según granularidad */
function etiquetaPeriodo(fecha: string, gran: Granularidad): string {
  switch (gran) {
    case 'dia':
      return fecha;
    case 'semana': {
      // Semana ISO: YYYY-Www
      const [y, m, d] = fecha.split('-').map(Number);
      const date = new Date(Date.UTC(y, m - 1, d));
      const diaSem = date.getUTCDay() || 7;
      date.setUTCDate(date.getUTCDate() + 4 - diaSem);
      const inicioAnio = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
      const semana = Math.ceil(((date.getTime() - inicioAnio.getTime()) / 86400000 + 1) / 7);
      return `${date.getUTCFullYear()}-W${semana.toString().padStart(2, '0')}`;
    }
    case 'mes':
      return fecha.slice(0, 7);
  }
}

/**
 * Tendencia por período: cada punto muestra el tNPS de SOLO las
 * encuestas de ese día/semana/mes (período independiente).
 */
export function calcularTendencia(encuestas: Encuesta[], gran: Granularidad = 'dia'): PuntoTendencia[] {
  const porPeriodo = new Map<string, Encuesta[]>();
  for (const e of encuestas) {
    if (!e.fechaDia) continue;
    const etiqueta = etiquetaPeriodo(e.fechaDia, gran);
    const lista = porPeriodo.get(etiqueta) ?? [];
    lista.push(e);
    porPeriodo.set(etiqueta, lista);
  }

  const puntos: PuntoTendencia[] = [];
  const claves = Array.from(porPeriodo.keys()).sort();
  for (const clave of claves) {
    const encs = porPeriodo.get(clave)!;
    const k = calcularKPIs(encs);
    puntos.push({
      fecha: clave,
      tNPS: k.tNPS,
      total: k.total,
      promotores: k.promotores,
      pasivos: k.pasivos,
      detractores: k.detractores,
    });
  }
  return puntos;
}

/**
 * Tendencia acumulada: cada punto muestra el tNPS acumulado desde el
 * inicio hasta el cierre de ese día/semana/mes.
 */
export function calcularTendenciaAcumulada(
  encuestas: Encuesta[],
  gran: Granularidad = 'dia'
): PuntoTendencia[] {
  // Ordenar por fecha
  const ordenadas = [...encuestas].filter((e) => e.fechaDia).sort((a, b) => a.fechaDia.localeCompare(b.fechaDia));
  if (ordenadas.length === 0) return [];

  // Agrupar por período
  const porPeriodo = new Map<string, Encuesta[]>();
  for (const e of ordenadas) {
    const etiqueta = etiquetaPeriodo(e.fechaDia, gran);
    const lista = porPeriodo.get(etiqueta) ?? [];
    lista.push(e);
    porPeriodo.set(etiqueta, lista);
  }

  const puntos: PuntoTendencia[] = [];
  const claves = Array.from(porPeriodo.keys()).sort();
  let acumuladas: Encuesta[] = [];
  for (const clave of claves) {
    acumuladas = acumuladas.concat(porPeriodo.get(clave)!);
    const k = calcularKPIs(acumuladas);
    puntos.push({
      fecha: clave,
      tNPS: k.tNPS,
      total: k.total,
      promotores: k.promotores,
      pasivos: k.pasivos,
      detractores: k.detractores,
    });
  }
  return puntos;
}

/** KPIs por franja horaria */
export function calcularKPIsPorFranja(encuestas: Encuesta[]): FranjaKPI[] {
  return FRANJAS.map((f) => {
    const encs = encuestas.filter((e) => e.franjaHoraria === f.id);
    return { franja: f.id, label: f.label, kpis: calcularKPIs(encs) };
  });
}

/** Detecta patrones problemáticos por franja horaria */
export function detectarPatronesFranja(encuestas: Encuesta[]): Insight[] {
  const kpisFranja = calcularKPIsPorFranja(encuestas);
  const kpisGlobal = calcularKPIs(encuestas);
  const insights: Insight[] = [];

  for (const f of kpisFranja) {
    if (f.kpis.total < 10) continue;
    const delta = f.kpis.tNPS - kpisGlobal.tNPS;
    if (delta <= -15) {
      insights.push({
        tipo: 'franja',
        titulo: `Franja ${f.label} por debajo del promedio`,
        descripcion: `El tNPS de esta franja es ${f.kpis.tNPS} (${delta.toFixed(1)} pts vs. global ${kpisGlobal.tNPS}) con ${f.kpis.total} encuestas. Revisa la dotación y los descansos en ese horario.`,
        severidad: 'critico',
      });
    } else if (delta >= 15) {
      insights.push({
        tipo: 'franja',
        titulo: `Franja ${f.label} sobresaliente`,
        descripcion: `El tNPS de esta franja es ${f.kpis.tNPS} (+${delta.toFixed(1)} pts vs. global ${kpisGlobal.tNPS}). Es un buen momento del día: identifica qué hacen distinto los asesores de ese turno.`,
        severidad: 'positivo',
      });
    }
  }

  // Franja con más detractores absolutos
  const conDatos = kpisFranja.filter((f) => f.kpis.total > 0);
  if (conDatos.length > 0) {
    const peor = conDatos.reduce((a, b) => (a.kpis.pctDetractores > b.kpis.pctDetractores ? a : b));
    if (peor.kpis.pctDetractores > kpisGlobal.pctDetractores + 5) {
      insights.push({
        tipo: 'franja',
        titulo: `Concentración de detractores en ${peor.label}`,
        descripcion: `El ${peor.kpis.pctDetractores}% de las encuestas de esta franja son detractores (vs. ${kpisGlobal.pctDetractores}% global). Prioriza coaching en este horario.`,
        severidad: 'advertencia',
      });
    }
  }

  return insights;
}

/** KPIs por tipificación (nivel 1-5) */
export function calcularKPIsPorTipificacion(
  encuestas: Encuesta[],
  campo: 'nivel1' | 'nivel2' | 'nivel3' | 'nivel4' | 'nivel5'
): TipificacionKPI[] {
  const grupos = new Map<string, Encuesta[]>();
  for (const e of encuestas) {
    const v = (e[campo] || '').trim();
    if (!v) continue;
    const lista = grupos.get(v) ?? [];
    lista.push(e);
    grupos.set(v, lista);
  }
  const resultado: TipificacionKPI[] = [];
  for (const [valor, encs] of grupos.entries()) {
    resultado.push({ valor, kpis: calcularKPIs(encs) });
  }
  resultado.sort((a, b) => b.kpis.total - a.kpis.total);
  return resultado;
}

/** Identifica las tipificaciones que más golpean al tNPS */
export function identificarTipificacionesCriticas(encuestas: Encuesta[]): Insight[] {
  const kpisGlobal = calcularKPIs(encuestas);
  const porNivel1 = calcularKPIsPorTipificacion(encuestas, 'nivel1').filter((t) => t.kpis.total >= 10);
  const insights: Insight[] = [];

  const criticas = porNivel1
    .filter((t) => t.kpis.tNPS < kpisGlobal.tNPS - 10)
    .sort((a, b) => a.kpis.tNPS - b.kpis.tNPS)
    .slice(0, 5);

  for (const c of criticas) {
    insights.push({
      tipo: 'tipificacion',
      titulo: `📉 Tipificación crítica: ${c.valor}`,
      descripcion: `tNPS ${c.kpis.tNPS} con ${c.kpis.total} encuestas y ${c.kpis.pctDetractores}% de detractores. Impacto directo en el resultado global.`,
      severidad: c.kpis.tNPS < -50 ? 'critico' : 'advertencia',
    });
  }

  const exitosas = porNivel1
    .filter((t) => t.kpis.tNPS > kpisGlobal.tNPS + 10)
    .sort((a, b) => b.kpis.tNPS - a.kpis.tNPS)
    .slice(0, 3);

  for (const x of exitosas) {
    insights.push({
      tipo: 'tipificacion',
      titulo: `🌟 Tipificación exitosa: ${x.valor}`,
      descripcion: `tNPS ${x.kpis.tNPS} con ${x.kpis.total} encuestas y ${x.kpis.pctPromotores}% de promotores. Replícala en otras líneas.`,
      severidad: 'positivo',
    });
  }

  return insights;
}

/** Filtra encuestas por rango de fechas */
export function filtrarPorFecha(encuestas: Encuesta[], filtro: FiltroFecha): Encuesta[] {
  switch (filtro.tipo) {
    case 'todo':
      return encuestas;
    case 'rango': {
      const desde = filtro.desde ?? '0000-01-01';
      const hasta = filtro.hasta ?? '9999-12-31';
      return encuestas.filter((e) => e.fechaDia >= desde && e.fechaDia <= hasta);
    }
    case 'mes':
      return encuestas.filter((e) => e.fechaDia.startsWith(filtro.valor ?? ''));
    case 'dia':
      return encuestas.filter((e) => e.fechaDia === filtro.valor);
    case 'anio':
      return encuestas.filter((e) => e.fechaDia.startsWith(filtro.valor ?? ''));
    default:
      return encuestas;
  }
}

/** KPIs por línea de negocio (siempre incluye las 3 líneas) */
export function calcularKPIsPorLinea(encuestas: Encuesta[]): Record<Linea, KPIS> {
  const resultado = {} as Record<Linea, KPIS>;
  for (const linea of LINEAS) {
    resultado[linea] = calcularKPIs(encuestas.filter((e) => e.linea === linea));
  }
  return resultado;
}
