// ============================================================
// tNPS Digital Claro Guatemala — Motor de cálculo ATC
// Archivo: src/lib/atc-engine.ts
// Pipeline: deduplicación → ordenamiento → clasificación →
// cálculo de puntos → transacciones + wallets actualizadas.
// ============================================================
import { v4 as uuidv4 } from 'uuid';
import type { Encuesta } from './types';
import { clasificarDetractor } from './keyword-detector';
import type { ConfigATC, TransaccionATC, WalletATC } from './atc-types';
import { CONFIG_ATC_DEFAULT, semanaISOActual } from './atc-types';

export interface ResumenProcesamientoATC {
  recibidas: number;
  yaProcesadas: number;
  promotores: number;
  promotoresRacha: number;
  pasivos: number;
  detractoresAsesor: number;
  detractoresServicio: number;
  detractoresIndeterminados: number;
  totalPuntosDistribuidos: number;
  walletsCreadas: number;
  walletsActualizadas: number;
}

export interface ResultadoProcesamientoATC {
  transacciones: TransaccionATC[];
  wallets: WalletATC[];
  resumen: ResumenProcesamientoATC;
}

function walletVacia(login: string, nombre: string, config: ConfigATC): WalletATC {
  const semana = semanaISOActual();
  return {
    loginNormalizado: login,
    nombre,
    saldo: config.saldoInicial,
    semanaActual: semana,
    stats: {
      totalPromotores: 0,
      totalPasivos: 0,
      totalDetractores: 0,
      totalGanado: 0,
      totalGastado: 0,
      mejorRacha: 0,
    },
    rachaActual: 0,
    metricasSemanales: [
      { semanaISO: semana, promotores: 0, pasivos: 0, detractores: 0, ganado: 0, gastado: 0 },
    ],
    actualizado: new Date().toISOString(),
  };
}

/** Obtiene (o crea) la métrica semanal de la wallet para la semana dada */
function metricaDe(wallet: WalletATC, semana: string) {
  let m = wallet.metricasSemanales.find((x) => x.semanaISO === semana);
  if (!m) {
    m = { semanaISO: semana, promotores: 0, pasivos: 0, detractores: 0, ganado: 0, gastado: 0 };
    wallet.metricasSemanales.push(m);
  }
  return m;
}

function tsDeEncuesta(e: Encuesta): number {
  const t = new Date(e.fechaInicio).getTime();
  return Number.isNaN(t) ? new Date(e.fechaRegistro).getTime() || Date.now() : t;
}

/**
 * Procesa encuestas y calcula puntos ATC.
 *
 * @param encuestas Encuestas a procesar (pueden incluir ya procesadas; se deduplican)
 * @param config Configuración ATC vigente
 * @param walletsActuales Wallets existentes indexadas por login
 * @param idsYaProcesados IDs de encuestas que ya generaron transacciones
 */
export function procesarEncuestasATC(
  encuestas: Encuesta[],
  walletsActuales: Record<string, WalletATC>,
  idsYaProcesados: Set<string>,
  config: ConfigATC = CONFIG_ATC_DEFAULT
): ResultadoProcesamientoATC {
  const cfg = { ...CONFIG_ATC_DEFAULT, ...config };
  const resumen: ResumenProcesamientoATC = {
    recibidas: encuestas.length,
    yaProcesadas: 0,
    promotores: 0,
    promotoresRacha: 0,
    pasivos: 0,
    detractoresAsesor: 0,
    detractoresServicio: 0,
    detractoresIndeterminados: 0,
    totalPuntosDistribuidos: 0,
    walletsCreadas: 0,
    walletsActualizadas: 0,
  };

  // 1. Deduplicación: filtrar encuestas ya procesadas
  const nuevas = encuestas.filter((e) => {
    if (idsYaProcesados.has(e.id)) {
      resumen.yaProcesadas++;
      return false;
    }
    return Boolean(e.loginNormalizado);
  });

  // 2. Ordenamiento por timestamp (para la lógica de racha)
  nuevas.sort((a, b) => tsDeEncuesta(a) - tsDeEncuesta(b));

  const transacciones: TransaccionATC[] = [];
  const walletsAfctadas = new Map<string, WalletATC>();

  const obtenerWallet = (login: string, nombre: string): WalletATC => {
    let w = walletsAfctadas.get(login) ?? walletsActuales[login];
    if (!w) {
      w = walletVacia(login, nombre, cfg);
      walletsActuales[login] = w; // registrar en el mapa global
      resumen.walletsCreadas++;
    } else {
      // Clonar para no mutar el original hasta persistir
      w = JSON.parse(JSON.stringify(w)) as WalletATC;
      walletsActuales[login] = w;
      resumen.walletsActualizadas++;
    }
    walletsAfctadas.set(login, w);

    // Reinicio semanal: si la wallet es de una semana anterior, el saldo
    // vuelve al saldo inicial (domingo 23:59:59)
    const semanaActual = semanaISOActual();
    if (w.semanaActual !== semanaActual) {
      w.saldo = cfg.saldoInicial;
      w.semanaActual = semanaActual;
      w.rachaActual = 0;
      metricaDe(w, semanaActual);
    }
    return w;
  };

  const ventanaRachaMs = cfg.rachaVentanaMinutos * 60 * 1000;

  for (const e of nuevas) {
    const login = e.loginNormalizado;
    const nombre = e.usuario || login;
    const wallet = obtenerWallet(login, nombre);
    const ts = tsDeEncuesta(e);
    const semana = wallet.semanaActual;
    const metrica = metricaDe(wallet, semana);

    let monto = 0;
    let tipo: TransaccionATC['tipo'];
    let descripcion = '';

    // 3. Clasificación y 4. Cálculo de puntos
    switch (e.grupo) {
      case 'Promotor': {
        const conRacha =
          wallet.ultimaPromocionTs !== undefined &&
          ts - wallet.ultimaPromocionTs <= ventanaRachaMs &&
          ts - wallet.ultimaPromocionTs > 0;
        if (conRacha) {
          monto = cfg.puntosPromotorRacha;
          tipo = 'PROMOTOR_RACHA';
          descripcion = `Promotor con racha (score ${e.tnps})`;
          wallet.rachaActual = (wallet.rachaActual ?? 0) + 1;
          resumen.promotoresRacha++;
        } else {
          monto = cfg.puntosPromotor;
          tipo = 'PROMOTOR';
          descripcion = `Promotor (score ${e.tnps})`;
          wallet.rachaActual = 1;
          resumen.promotores++;
        }
        wallet.ultimaPromocionTs = ts;
        wallet.stats.totalPromotores++;
        metrica.promotores++;
        break;
      }
      case 'Pasivo': {
        monto = cfg.puntosPasivo;
        tipo = 'PASIVO';
        descripcion = `Pasivo (score ${e.tnps})`;
        wallet.stats.totalPasivos++;
        metrica.pasivos++;
        wallet.rachaActual = 0;
        resumen.pasivos++;
        break;
      }
      case 'Detractor': {
        // v3.0: detractor unificado (sin distinción asesor/servicio)
        monto = cfg.puntosDetractor;
        tipo = 'DETRACTOR_ASESOR';
        descripcion = `Detractor (score ${e.tnps})`;
        resumen.detractoresAsesor++;
        wallet.stats.totalDetractores++;
        metrica.detractores++;
        wallet.rachaActual = 0;
        break;
      }
    }

    // 5. Registrar transacción y actualizar wallet
    transacciones.push({
      id: uuidv4(),
      loginNormalizado: login,
      tipo,
      monto,
      descripcion,
      encuestaId: e.id,
      semanaISO: semana,
      fecha: new Date(ts).toISOString(),
      procesadoPor: 'auto',
    });

    wallet.saldo += monto;
    if (monto > 0) {
      wallet.stats.totalGanado += monto;
      metrica.ganado += monto;
    }
    if (monto < 0) {
      metrica.gastado += Math.abs(monto);
    }
    wallet.stats.mejorRacha = Math.max(wallet.stats.mejorRacha ?? 0, wallet.rachaActual ?? 0);
    wallet.actualizado = new Date().toISOString();
    resumen.totalPuntosDistribuidos += monto;
  }

  return {
    transacciones,
    wallets: Array.from(walletsAfctadas.values()),
    resumen,
  };
}

/**
 * Puntos que YA fueron aplicados a la wallet por la clasificación
 * original del detractor (en el procesamiento automático).
 * v3.0: detractor unificado, siempre devuelve config.puntosDetractor.
 */
export function puntosYaAplicados(
  clasificacionOriginal: string,
  config: ConfigATC = CONFIG_ATC_DEFAULT
): number {
  // v3.0: todos los detractores usan el mismo monto
  if (clasificacionOriginal === 'asesor' || clasificacionOriginal === 'servicio' || clasificacionOriginal === 'indeterminado') {
    return config.puntosDetractor;
  }
  return 0;
}

/**
 * Calcula el AJUSTE (delta) de una apelación resuelta.
 * v3.0: como el detractor es unificado, no hay delta por reclasificación.
 * Si se aprueba la apelación, se reembolsa lo descontado.
 * Si se rechaza, no hay cambio.
 */
export function deltaApelacion(
  clasificacionOriginal: string,
  aprobada: boolean,
  config: ConfigATC = CONFIG_ATC_DEFAULT
): number {
  const yaAplicado = puntosYaAplicados(clasificacionOriginal, config);
  // Si se aprueba la apelación, se reembolsa lo descontado (delta positivo)
  // Si se rechaza, se mantiene el descuento (delta 0)
  return aprobada ? -yaAplicado : 0;
}

/**
 * @deprecated Usar deltaApelacion.
 */
export function puntosPorApelacion(
  aprobada: boolean,
  config: ConfigATC = CONFIG_ATC_DEFAULT
): number {
  // v3.0: si se aprueba, se reembolsa el detractor; si no, se mantiene
  return aprobada ? -config.puntosDetractor : 0;
}
