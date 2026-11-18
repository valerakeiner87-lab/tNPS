'use client';

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cake, Gift, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { AsesorHC } from '@/lib/types';

// ============================================================
// Cumpleaños del mes — Tarjeta para el panel principal
// ============================================================
// Lee la lista de asesoresHC (con fechaNacimiento poblada por el parser)
// y muestra:
//  1. Los cumpleaños del mes actual, ordenados por día.
//  2. Resalta a quienes cumplen HOY (badge "¡HOY!" + animación).
//  3. Si nadie cumple hoy, resalta al próximo cumpleañero del mes.
//
// La fecha se acepta en formato ISO (YYYY-MM-DD) o DD/MM/YYYY (formato
// común en exports Excel/Qualtrics de Guatemala). Si la fecha no tiene
// año válido (ej. solo DD/MM), se muestra igual sin calcular edad.
// ============================================================

const MESES_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const DIAS_ES = [
  'domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado',
];

interface Cumpleanhiero {
  nombre: string;
  documento: string;
  loginNormalizado: string;
  linea?: string | null;
  sede?: string;
  /** Día del mes 1-31 */
  dia: number;
  /** Mes 0-11 */
  mes: number;
  /** Año de nacimiento (puede ser null si no se conoce) */
  anio: number | null;
  /** Edad que cumple (null si no se sabe el año) */
  edad: number | null;
  /** Fecha original tal como vino del HC */
  fechaOriginal: string;
}

/**
 * Intenta parsear una fecha de nacimiento en formatos comunes:
 *  - ISO: "1990-04-15"
 *  - Latino: "15/04/1990" o "15-04-1990"
 *  - Excel: "Mon Apr 15 1990" (Date toString)
 * Devuelve { dia, mes, anio, fechaOriginal } o null si no se puede.
 */
function parseFechaNac(raw: string | undefined | null): { dia: number; mes: number; anio: number | null; fechaOriginal: string } | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s || s === '-' || s === 'N/A' || s.toLowerCase() === 'null') return null;

  // Ya es un objeto Date serializado (poco probable aquí, pero por si acaso)
  if (s.startsWith('Date(') || (s.includes('T') && s.includes('Z'))) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      return { dia: d.getDate(), mes: d.getMonth(), anio: d.getFullYear(), fechaOriginal: s };
    }
  }

  // ISO YYYY-MM-DD
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const anio = parseInt(iso[1], 10);
    const mes = parseInt(iso[2], 10) - 1;
    const dia = parseInt(iso[3], 10);
    if (mes >= 0 && mes < 12 && dia >= 1 && dia <= 31) {
      return { dia, mes, anio, fechaOriginal: s };
    }
  }

  // DD/MM/YYYY o DD-MM-YYYY (acepta años de 2 o 4 dígitos)
  const latin = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (latin) {
    const dia = parseInt(latin[1], 10);
    const mes = parseInt(latin[2], 10) - 1;
    let anio = parseInt(latin[3], 10);
    if (anio < 100) anio += 1900; // 90 → 1990
    if (mes >= 0 && mes < 12 && dia >= 1 && dia <= 31) {
      return { dia, mes, anio, fechaOriginal: s };
    }
  }

  // Date.toString() en inglés: "Mon Apr 15 1990 00:00:00 GMT..."
  const d = new Date(s);
  if (!isNaN(d.getTime()) && d.getFullYear() > 1900) {
    return { dia: d.getDate(), mes: d.getMonth(), anio: d.getFullYear(), fechaOriginal: s };
  }

  return null;
}

function calcularEdad(dia: number, mes: number, anio: number): number {
  const hoy = new Date();
  let edad = hoy.getFullYear() - anio;
  // Si aún no llegó el mes/día este año, restar 1
  if (hoy.getMonth() < mes || (hoy.getMonth() === mes && hoy.getDate() < dia)) {
    edad--;
  }
  return edad;
}

function primeraLetra(linea?: string | null): string {
  if (!linea) return '?';
  const map: Record<string, string> = {
    'Móvil': 'M',
    'Fijo Soporte': 'FS',
    'Fijo Información': 'FI',
  };
  return map[linea] ?? linea.charAt(0).toUpperCase();
}

function colorDeLinea(linea?: string | null): string {
  switch (linea) {
    case 'Móvil': return '#1A3F7A';
    case 'Fijo Soporte': return '#DA291C';
    case 'Fijo Información': return '#F59E0B';
    default: return '#6B7280';
  }
}

interface Props {
  asesoresHC: AsesorHC[];
  /** Login del asesor que está viendo el panel (para resaltarlo si es su cumpleaños) */
  miLogin?: string;
}

export function CumpleanosCard({ asesoresHC, miLogin }: Props) {
  const ahora = new Date();
  const mesActual = ahora.getMonth();
  const anioActual = ahora.getFullYear();
  const diaHoy = ahora.getDate();

  const cumpleanhieros = useMemo<Cumpleanhiero[]>(() => {
    if (!asesoresHC || asesoresHC.length === 0) return [];
    const lista: Cumpleanhiero[] = [];
    const vistos = new Set<string>();
    for (const a of asesoresHC) {
      const key = (a.documento || a.loginNormalizado || a.nombre || '').toLowerCase().trim();
      if (!key || vistos.has(key)) continue;
      vistos.add(key);
      const f = parseFechaNac(a.fechaNacimiento);
      if (!f) continue;
      if (f.mes !== mesActual) continue;
      const edad = f.anio ? calcularEdad(f.dia, f.mes, f.anio) : null;
      lista.push({
        nombre: a.nombre || a.loginNormalizado || a.usuarioCic || 'Asesor',
        documento: a.documento,
        loginNormalizado: a.loginNormalizado || a.usuarioCic || '',
        linea: a.linea,
        sede: a.sede,
        dia: f.dia,
        mes: f.mes,
        anio: f.anio,
        edad,
        fechaOriginal: f.fechaOriginal,
      });
    }
    // Ordenar por día del mes ascendente
    lista.sort((a, b) => a.dia - b.dia);
    return lista;
  }, [asesoresHC, mesActual]);

  const hoyList = cumpleanhieros.filter((c) => c.dia === diaHoy);
  const proximo = cumpleanhieros.find((c) => c.dia > diaHoy) ?? null;
  const yaPaso = cumpleanhieros.filter((c) => c.dia < diaHoy).length;
  const quedan = cumpleanhieros.filter((c) => c.dia >= diaHoy).length;

  // ----- Estado: no hay cumpleaños este mes -----
  if (cumpleanhieros.length === 0) {
    return null;
  }

  return (
    <Card className="animar-aparecer overflow-hidden border-pink-200/60 dark:border-pink-900/40 shadow-sm">
      <CardHeader className="pb-3 bg-gradient-to-br from-pink-50 to-purple-50 dark:from-pink-950/30 dark:to-purple-950/30">
        <CardTitle className="text-base flex items-center gap-2">
          <span className="h-8 w-8 rounded-lg bg-pink-500/15 flex items-center justify-center" aria-hidden>
            <Cake className="h-4 w-4 text-pink-600 dark:text-pink-400" />
          </span>
          <span>
            Cumpleaños de {MESES_ES[mesActual]}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {cumpleanhieros.length} {cumpleanhieros.length === 1 ? 'cumpleañero' : 'cumpleañeros'}
            </span>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        {/* ----- HOY ----- */}
        {hoyList.length > 0 && (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="rounded-xl bg-gradient-to-r from-pink-500 via-rose-500 to-purple-500 text-white p-4 shadow-md"
            >
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 animate-pulse" />
                <p className="text-xs font-semibold uppercase tracking-wider opacity-90">
                  {hoyList.length === 1 ? '¡Hoy cumple años!' : '¡Hoy cumplen años!'}
                </p>
                <span className="ml-auto text-xs font-bold bg-white/25 px-2 py-0.5 rounded-full">
                  {DIAS_ES[ahora.getDay()].charAt(0).toUpperCase() + DIAS_ES[ahora.getDay()].slice(1)} {diaHoy}
                </span>
              </div>
              <div className="space-y-2">
                {hoyList.map((c) => {
                  const esMiCumple = miLogin && c.loginNormalizado && c.loginNormalizado.toLowerCase() === miLogin.toLowerCase();
                  return (
                    <div key={c.documento || c.loginNormalizado} className="flex items-center gap-3 bg-white/15 backdrop-blur rounded-lg p-2.5">
                      <div
                        className="h-9 w-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ring-2 ring-white/40"
                        style={{ backgroundColor: colorDeLinea(c.linea) }}
                        aria-hidden
                      >
                        {primeraLetra(c.linea)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold leading-tight truncate flex items-center gap-1.5">
                          {c.nombre}
                          {esMiCumple && (
                            <span className="text-[10px] bg-yellow-300 text-yellow-900 px-1.5 py-0.5 rounded-full font-bold">
                              ¡TÚ!
                            </span>
                          )}
                        </p>
                        <p className="text-xs opacity-90 truncate">
                          {c.linea ?? 'Contact Center'}
                          {c.sede ? ` · ${c.sede}` : ''}
                          {c.edad !== null && ` · Cumple ${c.edad} años`}
                        </p>
                      </div>
                      <Gift className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </AnimatePresence>
        )}

        {/* ----- Próximo cumpleaños del mes ----- */}
        {hoyList.length === 0 && proximo && (
          <div className="rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 p-3 flex items-center gap-3">
            <span className="h-9 w-9 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0" aria-hidden>
              <Gift className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">Próximo cumpleaños del mes</p>
              <p className="font-semibold truncate">
                {proximo.nombre}{' '}
                <span className="text-xs font-normal text-muted-foreground">
                  · {proximo.dia} de {MESES_ES[mesActual]}
                  {proximo.edad !== null && ` · Cumple ${proximo.edad}`}
                </span>
              </p>
            </div>
            <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-300 font-bold">
              {proximo.dia - diaHoy === 0 ? 'Hoy' : `${proximo.dia - diaHoy} día${proximo.dia - diaHoy === 1 ? '' : 's'}`}
            </Badge>
          </div>
        )}

        {/* ----- Lista completa del mes ----- */}
        <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
          {cumpleanhieros.map((c) => {
            const esHoy = c.dia === diaHoy;
            const esProximo = !esHoy && proximo?.documento === c.documento;
            const esMiCumple = miLogin && c.loginNormalizado && c.loginNormalizado.toLowerCase() === miLogin.toLowerCase();
            return (
              <div
                key={c.documento || c.loginNormalizado || c.nombre}
                className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
                  esHoy
                    ? 'bg-pink-100 dark:bg-pink-900/40 ring-1 ring-pink-300 dark:ring-pink-700'
                    : esProximo
                      ? 'bg-amber-50 dark:bg-amber-950/20 ring-1 ring-amber-200 dark:ring-amber-900/40'
                      : 'hover:bg-accent/60'
                }`}
              >
                <span
                  className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                  style={{ backgroundColor: colorDeLinea(c.linea) }}
                  aria-hidden
                >
                  {primeraLetra(c.linea)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium leading-tight truncate flex items-center gap-1.5">
                    {c.nombre}
                    {esMiCumple && (
                      <span className="text-[9px] bg-yellow-300 text-yellow-900 px-1 py-0.5 rounded-full font-bold">
                        TÚ
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {c.linea ?? 'Contact Center'}
                    {c.sede ? ` · ${c.sede}` : ''}
                  </p>
                </div>
                <div className="flex flex-col items-end shrink-0">
                  <span className={`font-bold tabular-nums ${esHoy ? 'text-pink-600 dark:text-pink-300' : ''}`}>
                    {c.dia}
                  </span>
                  {c.edad !== null && (
                    <span className="text-[10px] text-muted-foreground">{c.edad} años</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ----- Footer de resumen ----- */}
        <p className="text-[11px] text-muted-foreground text-center pt-1 border-t">
          {hoyList.length > 0 ? (
            <>🎉 {hoyList.length} {hoyList.length === 1 ? 'cumpleañero hoy' : 'cumpleañeros hoy'} · </>
          ) : null}
          {quedanText(quedan, yaPaso)}
        </p>
      </CardContent>
    </Card>
  );
}

function quedanText(quedan: number, yaPaso: number): string {
  if (quedan === 0 && yaPaso === 0) return '';
  const partes: string[] = [];
  if (quedan > 0) partes.push(`${quedan} por venir`);
  if (yaPaso > 0) partes.push(`${yaPaso} ya celebrado${yaPaso === 1 ? '' : 's'}`);
  return partes.join(' · ');
}
