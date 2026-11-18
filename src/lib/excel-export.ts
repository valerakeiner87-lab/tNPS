// ============================================================
// ATC Digital — Utilidades de exportación a Excel (.xlsx)
// ============================================================
// Genera archivos Excel para llevar control de:
// - Canjes de premios (historial completo)
// - Transacciones ATC (ledger completo)
// - Wallets (resumen de saldo por asesor)
// - Asesores (ranking consolidado)
// ============================================================

import * as XLSX from 'xlsx';
import type { CanjeATC, TransaccionATC, WalletATC } from '@/lib/atc-types';

function descargarWorkbook(wb: XLSX.WorkBook, nombreArchivo: string) {
  XLSX.writeFile(wb, nombreArchivo);
}

function fechaHoraLocal(iso?: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('es-GT', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

// ------------------------------------------------------------
// Exportar canjes de premios
// ------------------------------------------------------------

export function exportarCanjesAExcel(
  canjes: CanjeATC[],
  nombreArchivo: string = `canjes-atc-${new Date().toISOString().slice(0, 10)}.xlsx`
): void {
  const filas = canjes.map((c, idx) => ({
    '#': idx + 1,
    'Solicitado': fechaHoraLocal(c.solicitado),
    'Asesor': c.nombreAsesor,
    'Login': c.loginNormalizado,
    'Premio': c.premioNombre,
    'Emoji': c.premioEmoji,
    'Costo ATC': c.costoATC,
    'Estado': c.estado === 'aprobado' ? 'Aprobado' : c.estado === 'rechazado' ? 'Rechazado' : 'Pendiente',
    'Resuelto': fechaHoraLocal(c.resuelto),
    'Resuelto Por': c.resueltoPor ?? '',
    'Comentario': c.comentario ?? '',
  }));

  const ws = XLSX.utils.json_to_sheet(filas, {
    header: [
      '#', 'Solicitado', 'Asesor', 'Login', 'Premio', 'Emoji',
      'Costo ATC', 'Estado', 'Resuelto', 'Resuelto Por', 'Comentario',
    ],
  });

  // Anchos de columna sugeridos
  ws['!cols'] = [
    { wch: 5 }, { wch: 22 }, { wch: 28 }, { wch: 18 }, { wch: 32 },
    { wch: 8 }, { wch: 11 }, { wch: 12 }, { wch: 22 }, { wch: 18 }, { wch: 40 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Canjes');

  // Hoja resumen
  const totalGastado = canjes
    .filter((c) => c.estado === 'aprobado')
    .reduce((acc, c) => acc + c.costoATC, 0);
  const totalPendiente = canjes
    .filter((c) => c.estado === 'pendiente')
    .reduce((acc, c) => acc + c.costoATC, 0);

  const resumen = [
    { 'Métrica': 'Total de canjes', 'Valor': canjes.length },
    { 'Métrica': 'Canjes aprobados', 'Valor': canjes.filter((c) => c.estado === 'aprobado').length },
    { 'Métrica': 'Canjes pendientes', 'Valor': canjes.filter((c) => c.estado === 'pendiente').length },
    { 'Métrica': 'Canjes rechazados', 'Valor': canjes.filter((c) => c.estado === 'rechazado').length },
    { 'Métrica': 'ATC gastado (aprobado)', 'Valor': totalGastado },
    { 'Métrica': 'ATC pendiente de aprobar', 'Valor': totalPendiente },
  ];
  const wsResumen = XLSX.utils.json_to_sheet(resumen);
  wsResumen['!cols'] = [{ wch: 30 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');

  descargarWorkbook(wb, nombreArchivo);
}

// ------------------------------------------------------------
// Exportar transacciones ATC (ledger completo)
// ------------------------------------------------------------

export function exportarTransaccionesAExcel(
  transacciones: TransaccionATC[],
  nombreArchivo: string = `transacciones-atc-${new Date().toISOString().slice(0, 10)}.xlsx`
): void {
  const filas = transacciones.map((t, idx) => ({
    '#': idx + 1,
    'Fecha Evento': fechaHoraLocal(t.fecha),
    'Creado': fechaHoraLocal(t.creado),
    'Asesor (Login)': t.loginNormalizado,
    'Tipo': t.tipo,
    'Monto ATC': t.monto,
    'Descripción': t.descripcion,
    'Encuesta ID': t.encuestaId ?? '',
    'Semana ISO': t.semanaISO,
    'Procesado Por': t.procesadoPor ?? '',
  }));

  const ws = XLSX.utils.json_to_sheet(filas, {
    header: [
      '#', 'Fecha Evento', 'Creado', 'Asesor (Login)', 'Tipo',
      'Monto ATC', 'Descripción', 'Encuesta ID', 'Semana ISO', 'Procesado Por',
    ],
  });

  ws['!cols'] = [
    { wch: 5 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 22 },
    { wch: 12 }, { wch: 45 }, { wch: 28 }, { wch: 12 }, { wch: 22 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Transacciones');

  // Hoja resumen
  const porTipo = new Map<string, { cantidad: number; total: number }>();
  for (const t of transacciones) {
    const actual = porTipo.get(t.tipo) ?? { cantidad: 0, total: 0 };
    actual.cantidad++;
    actual.total += t.monto;
    porTipo.set(t.tipo, actual);
  }
  const resumen = Array.from(porTipo.entries()).map(([tipo, v]) => ({
    'Tipo': tipo,
    'Cantidad': v.cantidad,
    'Total ATC': v.total,
  }));
  const wsResumen = XLSX.utils.json_to_sheet(resumen);
  wsResumen['!cols'] = [{ wch: 26 }, { wch: 12 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen por tipo');

  descargarWorkbook(wb, nombreArchivo);
}

// ------------------------------------------------------------
// Exportar wallets ATC (resumen de saldos)
// ------------------------------------------------------------

export function exportarWalletsAExcel(
  wallets: WalletATC[],
  nombreArchivo: string = `wallets-atc-${new Date().toISOString().slice(0, 10)}.xlsx`
): void {
  const filas = wallets.map((w, idx) => {
    const stats = (w.stats ?? {}) as any;
    return {
      '#': idx + 1,
      'Login': w.loginNormalizado,
      'Nombre': w.nombre,
      'Saldo ATC': w.saldo,
      'Racha Actual': w.rachaActual,
      'Total Promotores': stats.totalPromotores ?? 0,
      'Total Pasivos': stats.totalPasivos ?? 0,
      'Total Detractores': stats.totalDetractores ?? 0,
      'Total Ganado (histórico)': stats.totalGanado ?? 0,
      'Total Gastado (histórico)': stats.totalGastado ?? 0,
      'Mejor Racha': stats.mejorRacha ?? 0,
      'Semana Actual': w.semanaActual,
      'Actualizado': fechaHoraLocal(w.actualizado),
    };
  });

  const ws = XLSX.utils.json_to_sheet(filas, {
    header: [
      '#', 'Login', 'Nombre', 'Saldo ATC', 'Racha Actual',
      'Total Promotores', 'Total Pasivos', 'Total Detractores',
      'Total Ganado (histórico)', 'Total Gastado (histórico)', 'Mejor Racha',
      'Semana Actual', 'Actualizado',
    ],
  });

  ws['!cols'] = [
    { wch: 5 }, { wch: 18 }, { wch: 28 }, { wch: 12 }, { wch: 14 },
    { wch: 18 }, { wch: 16 }, { wch: 18 }, { wch: 22 }, { wch: 22 },
    { wch: 14 }, { wch: 14 }, { wch: 22 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Wallets');

  // Hoja resumen
  const totalSaldo = wallets.reduce((acc, w) => acc + w.saldo, 0);
  const totalGanado = wallets.reduce((acc, w) => acc + (((w.stats as any)?.totalGanado) ?? 0), 0);
  const totalGastado = wallets.reduce((acc, w) => acc + (((w.stats as any)?.totalGastado) ?? 0), 0);

  const resumen = [
    { 'Métrica': 'Total de asesores', 'Valor': wallets.length },
    { 'Métrica': 'Suma de saldos actuales', 'Valor': totalSaldo },
    { 'Métrica': 'Suma histórica de ATC ganado', 'Valor': totalGanado },
    { 'Métrica': 'Suma histórica de ATC gastado', 'Valor': totalGastado },
    { 'Métrica': 'Promedio de saldo por asesor', 'Valor': wallets.length ? Math.round(totalSaldo / wallets.length) : 0 },
  ];
  const wsResumen = XLSX.utils.json_to_sheet(resumen);
  wsResumen['!cols'] = [{ wch: 36 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');

  descargarWorkbook(wb, nombreArchivo);
}

// ------------------------------------------------------------
// Exportar genérico (cualquier array de objetos)
// ------------------------------------------------------------

export function exportarTablaAExcel<T extends Record<string, unknown>>(
  filas: T[],
  hoja: string,
  nombreArchivo: string
): void {
  const ws = XLSX.utils.json_to_sheet(filas);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, hoja.slice(0, 31));
  descargarWorkbook(wb, nombreArchivo);
}
