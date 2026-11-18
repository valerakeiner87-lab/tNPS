import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * v3.4.3 — Normaliza un número de cédula / documento para cruce seguro.
 *
 * - Elimina espacios en blanco (al inicio, al final e intermedios).
 * - Elimina puntos (algunos sistemas separan miles con puntos).
 * - Elimina guiones.
 * - Elimina ceros a la izquierda innecesarios (preservando al menos un dígito).
 * - Convierte a string y aplica trim.
 *
 * Ejemplos:
 *   normalizarDocumento("  1.043.667.350  ") → "1043667350"
 *   normalizarDocumento("043667350") → "43667350"
 *   normalizarDocumento("") → ""
 *   normalizarDocumento(null) → ""
 */
export function normalizarDocumento(input: unknown): string {
  if (input === null || input === undefined) return '';
  const s = String(input).trim();
  if (!s) return '';
  // Quitar espacios, puntos, guiones, comas
  const limpio = s.replace(/[\s.,\-_]/g, '');
  if (!limpio) return '';
  // Quitar ceros a la izquierda (preservar al menos un dígito)
  const sinCeros = limpio.replace(/^0+/, '');
  return sinCeros || '0';
}

/**
 * Compara dos documentos normalizados para ver si son el mismo.
 */
export function documentosIguales(a: unknown, b: unknown): boolean {
  const na = normalizarDocumento(a);
  const nb = normalizarDocumento(b);
  if (!na || !nb) return false;
  return na === nb;
}
