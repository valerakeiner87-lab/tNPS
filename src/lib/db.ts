// ============================================================
// v3.2.0 — Sistema de failover automático con múltiples BDs Neon
// ============================================================
// La app mantiene N connection strings de Neon. Si la BD activa
// falla (cuota agotada, suspendida, timeout), la app cambia
// automáticamente a la siguiente BD disponible.
//
// El orden de prioridad se define en DATABASE_URLS (variable de entorno
// o hardcoded como fallback).
//
// La BD activa se guarda en memoria y se verifica periódicamente.
// Si falla, se prueba la siguiente hasta encontrar una que funcione.
//
// v3.1.5 — Las URLs ahora viven en una lista pública BD_URLS para que
// el panel de supervisor pueda mostrar "X/N BDs activas". El sistema
// ahora rota automáticamente cuando una BD queda sin cuota.

import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  prismaUrlIndex: number | undefined
  prismaUrlStatus: Record<number, { ok: boolean; lastCheck: number; error?: string }> | undefined
}

// ============================================================
// CONFIGURACIÓN DE BDs — 7 bases de datos Neon nuevas con failover
// ============================================================
// Si DATABASE_URL está configurada en el entorno (HuggingFace Space),
// se usa como primera opción. Si no, se usan estas URLs hardcoded.
//
// IMPORTANTE: cuando una BD agote su cuota mensual, la app rotará
// automáticamente a la siguiente. El supervisor verá el estado en
// el panel principal.
const BD_URLS_INTERNAS = [
  'postgresql://neondb_owner:npg_eOtcs3rByJG7@ep-frosty-moon-b4vw32xp-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require',
  'postgresql://neondb_owner:npg_UJsjRQqNp1x2@ep-damp-meadow-b4qa0d1n-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require',
  'postgresql://neondb_owner:npg_gozHd28BDlOe@ep-holy-smoke-b4jwnenr-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require',
  'postgresql://neondb_owner:npg_gtySUlro37ea@ep-ancient-rain-b490nfti-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require',
  'postgresql://neondb_owner:npg_PyzerEG94ZOk@ep-bold-wildflower-b5q3v6zf-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require',
  'postgresql://neondb_owner:npg_rD4moHwXuQh2@ep-polished-smoke-b4vwp4xw-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require',
  'postgresql://neondb_owner:npg_yrto7l6FpGKd@ep-royal-sky-amu52xjn-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require',
]

// Si DATABASE_URL está configurada, usarla como primera opción
const PRIMARY_URL = process.env.DATABASE_URL || BD_URLS_INTERNAS[0]

// Lista completa de URLs a probar (PRIMARY primero, luego las demás,
// evitando duplicados)
const TODAS_URLS = [PRIMARY_URL, ...BD_URLS_INTERNAS.filter(u => u !== PRIMARY_URL)]

// Estado de cada BD (compartido entre requests vía globalThis)
if (!globalForPrisma.prismaUrlStatus) {
  globalForPrisma.prismaUrlStatus = {}
}

let urlActivaIndex = globalForPrisma.prismaUrlIndex ?? 0
let urlActiva = TODAS_URLS[urlActivaIndex] || TODAS_URLS[0]

function getURLActiva(): string {
  return urlActiva
}

/**
 * Devuelve la lista de hosts (sin credenciales) para mostrar en la UI.
 */
export function getBDsInfo(): { index: number; host: string; region: string }[] {
  return TODAS_URLS.map((url, i) => {
    const host = url.split('@')[1]?.split('/')[0] || 'desconocido'
    // Host tiene forma "ep-xxx-pooler.c-N.region.aws.neon.tech"
    const regionMatch = host.match(/\.([a-z]+-[a-z]+-\d+)\.aws\.neon\.tech/)
    const region = regionMatch ? regionMatch[1] : 'unknown'
    return { index: i, host, region }
  })
}

/**
 * Devuelve el índice de la BD activa (0-based).
 */
export function getBDActivaIndex(): number {
  return urlActivaIndex
}

/**
 * Devuelve el estado de cada BD: { ok, lastCheck, error }.
 * El supervisor usa esto para pintar el panel "X/N BDs activas".
 */
export function getBDsStatus(): { index: number; host: string; region: string; ok: boolean; lastCheck: number; error?: string; activa: boolean }[] {
  const status = globalForPrisma.prismaUrlStatus || {}
  return TODAS_URLS.map((url, i) => {
    const host = url.split('@')[1]?.split('/')[0] || 'desconocida'
    const regionMatch = host.match(/\.([a-z]+-[a-z]+-\d+)\.aws\.neon\.tech/)
    const region = regionMatch ? regionMatch[1] : 'unknown'
    const s = status[i] || { ok: false, lastCheck: 0 }
    return {
      index: i,
      host,
      region,
      ok: s.ok,
      lastCheck: s.lastCheck,
      error: s.error,
      activa: i === urlActivaIndex,
    }
  })
}

function setBDStatus(index: number, ok: boolean, error?: string) {
  if (!globalForPrisma.prismaUrlStatus) globalForPrisma.prismaUrlStatus = {}
  globalForPrisma.prismaUrlStatus[index] = { ok, lastCheck: Date.now(), error: error?.substring(0, 200) }
}

/**
 * Cambia a la siguiente BD disponible. Devuelve true si encontró una BD que responde.
 */
async function probarFailover(): Promise<boolean> {
  for (let i = 0; i < TODAS_URLS.length; i++) {
    const url = TODAS_URLS[i]
    if (i === urlActivaIndex) continue // ya la probamos
    try {
      console.log(`Failover: probando BD ${i + 1}/${TODAS_URLS.length}...`)
      const testClient = new PrismaClient({
        log: ['error'],
        datasources: { db: { url } },
      })
      // Timeout de 10s para la prueba
      await Promise.race([
        testClient.$queryRaw`SELECT 1 as ok`,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout probando BD')), 10000)
        ),
      ])
      await testClient.$disconnect()
      console.log(`✅ Failover exitoso a BD ${i + 1}`)
      urlActiva = url
      urlActivaIndex = i
      globalForPrisma.prismaUrlIndex = i
      setBDStatus(i, true)
      // Recrear el cliente Prisma con la nueva URL
      if (globalForPrisma.prisma) {
        await globalForPrisma.prisma.$disconnect().catch(() => undefined)
      }
      globalForPrisma.prisma = new PrismaClient({
        log: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['error', 'warn'],
        datasources: { db: { url } },
      })
      return true
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`❌ BD ${i + 1} no responde:`, msg.substring(0, 100))
      setBDStatus(i, false, msg)
    }
  }
  return false
}

function createPrismaClient(): PrismaClient {
  if (!process.env.DATABASE_URL && !urlActiva) {
    console.warn('⚠️  DATABASE_URL no está configurada y no hay BDs de fallback.')
  }
  console.log(`Usando BD: ${urlActiva.split('@')[1]?.split('/')[0] || 'desconocida'}`)
  return new PrismaClient({
    log: process.env.NODE_ENV === 'production'
      ? ['error', 'warn']
      : ['error', 'warn'],
    datasources: { db: { url: urlActiva } },
  })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
}

// Helper para verificar conexión (usado por /api/health)
export async function checkDatabaseConnection(): Promise<{ ok: boolean; error?: string; bdActiva?: string }> {
  try {
    await db.$queryRaw`SELECT 1 as ok`
    const host = urlActiva.split('@')[1]?.split('/')[0] || 'desconocida'
    setBDStatus(urlActivaIndex, true)
    return { ok: true, bdActiva: host }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    setBDStatus(urlActivaIndex, false, msg)
    // Intentar failover
    console.warn('BD principal falló, intentando failover...')
    const recovered = await probarFailover()
    if (recovered) {
      // Reintentar la query con la nueva BD
      try {
        await db.$queryRaw`SELECT 1 as ok`
        const host = urlActiva.split('@')[1]?.split('/')[0] || 'desconocida'
        return { ok: true, bdActiva: host }
      } catch (err2) {
        return { ok: false, error: err2 instanceof Error ? err2.message : String(err2) }
      }
    }
    return { ok: false, error: msg }
  }
}

/**
 * Ejecuta una función con reintento y failover automático.
 * Si la BD falla, prueba el failover y reintenta.
 */
export async function withFailover<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err: any) {
    const msg = err?.message || ''
    // Si es error de conexión, intentar failover
    if (msg.includes("Can't reach database") || msg.includes('Timed out') ||
        msg.includes('connect ECONNREFUSED') || msg.includes('Connection terminated') ||
        msg.includes('Connection refused') || msg.includes('timeout') ||
        msg.includes('exceeded the quota') || msg.includes('53000')) {
      console.warn('Error de BD detectado, intentando failover...')
      const recovered = await probarFailover()
      if (recovered) {
        // Reintentar con la nueva BD
        return await fn()
      }
    }
    throw err
  }
}

/**
 * Verifica el estado de TODAS las BDs en paralelo (sin afectar la BD activa).
 * Usado por /api/db-status para el panel del supervisor.
 * Timeout corto (4s por BD) para no bloquear.
 */
export async function verificarTodasLasBDs(): Promise<{ index: number; host: string; region: string; ok: boolean; ms: number; error?: string; activa: boolean }[]> {
  const results = await Promise.all(
    TODAS_URLS.map(async (url, i) => {
      const host = url.split('@')[1]?.split('/')[0] || 'desconocida'
      const regionMatch = host.match(/\.([a-z]+-[a-z]+-\d+)\.aws\.neon\.tech/)
      const region = regionMatch ? regionMatch[1] : 'unknown'
      const t0 = Date.now()
      try {
        const testClient = new PrismaClient({
          log: [],
          datasources: { db: { url } },
        })
        await Promise.race([
          testClient.$queryRaw`SELECT 1 as ok`,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Timeout 4s')), 4000)
          ),
        ])
        await testClient.$disconnect()
        const ms = Date.now() - t0
        setBDStatus(i, true)
        return { index: i, host, region, ok: true, ms, activa: i === urlActivaIndex }
      } catch (err: any) {
        const ms = Date.now() - t0
        const msg = err?.message || String(err)
        setBDStatus(i, false, msg)
        return { index: i, host, region, ok: false, ms, error: msg.substring(0, 200), activa: i === urlActivaIndex }
      }
    })
  )
  return results
}

/**
 * Total de BDs configuradas.
 */
export function getTotalBDs(): number {
  return TODAS_URLS.length
}
