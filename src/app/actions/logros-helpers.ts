'use server';

/**
 * Server Action auxiliar para verificar logros de un asesor.
 * Usa Prisma (compatible SQLite dev / PostgreSQL prod).
 */
import { otorgarLogroAction } from './logros-actions';
import { db } from '@/lib/db';
import type { WalletATC } from '@/lib/atc-types';

export async function verificarLogrosAction(wallets: WalletATC[]): Promise<void> {
  if (!wallets || wallets.length === 0) return;

  try {
    const logins = wallets.map((w) => w.loginNormalizado).filter(Boolean);
    if (logins.length === 0) return;

    const users = await db.user.findMany({
      where: {
        OR: [
          { loginNormalizado: { in: logins } },
          { username: { in: logins } },
        ],
      },
      select: { id: true, username: true, loginNormalizado: true },
    });
    const loginToUserId = new Map<string, string>();
    for (const u of users) {
      loginToUserId.set(u.loginNormalizado || u.username, u.id);
    }

    for (const w of wallets) {
      const userId = loginToUserId.get(w.loginNormalizado);
      if (!userId) continue;

      const stats = (w.stats || { totalPromotores: 0, totalPasivos: 0, totalDetractores: 0, totalGanado: 0, totalGastado: 0, mejorRacha: 0 }) as any;
      const racha = w.rachaActual || 0;

      if (stats.totalPromotores >= 1) await otorgarLogroAction(userId, 'primer_promotor').catch(() => undefined);
      if (stats.totalPromotores >= 10) await otorgarLogroAction(userId, 'diez_promotores').catch(() => undefined);
      if (stats.totalPromotores >= 50) await otorgarLogroAction(userId, 'cincuenta_promotores').catch(() => undefined);
      if (racha >= 3) await otorgarLogroAction(userId, 'racha_3').catch(() => undefined);
      if (racha >= 5) await otorgarLogroAction(userId, 'racha_5').catch(() => undefined);
      if (stats.totalGanado >= 100) await otorgarLogroAction(userId, 'cien_atc').catch(() => undefined);
      if (stats.totalGanado >= 500) await otorgarLogroAction(userId, 'quinientos_atc').catch(() => undefined);

      if (stats.totalPromotores > 0) {
        const total = stats.totalPromotores + stats.totalPasivos + stats.totalDetractores;
        if (total > 0) {
          const tNPSIndividual = ((stats.totalPromotores - stats.totalDetractores) / total) * 100;
          if (tNPSIndividual >= 50) await otorgarLogroAction(userId, 'tnps_alto').catch(() => undefined);
          if (tNPSIndividual >= 80) await otorgarLogroAction(userId, 'tnps_excelente').catch(() => undefined);
        }
      }
    }
  } catch (err) {
    console.error('Error verificarLogrosAction:', err);
  }
}

export async function otorgarLogroPorLoginAction(login: string, logroClave: string): Promise<void> {
  try {
    const u = await db.user.findFirst({
      where: {
        OR: [
          { username: login },
          { loginNormalizado: login },
        ],
      },
      select: { id: true },
    });
    if (u) {
      await otorgarLogroAction(u.id, logroClave).catch(() => undefined);
    }
  } catch (err) {
    console.error('Error otorgarLogroPorLoginAction:', err);
  }
}
