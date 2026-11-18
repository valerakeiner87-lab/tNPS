// ============================================================
// tNPS Digital Claro Guatemala — Detector de agresividad
// Archivo: src/lib/keyword-detector.ts
// Sistema determinista por palabras clave. NO usa IA.
// ============================================================

/** Palabras graves — severidad alta (insultos directos) */
export const INSULTOS_ALTA: string[] = [
  'idiota',
  'imbecil',
  'estupido',
  'estupida',
  'pendejo',
  'pendeja',
  'mierda',
  'puta',
  'puto',
  'zorra',
  'basura',
  'inutil',
  'burro',
  'burra',
  'cerdo',
  'cerda',
  'maldito',
  'maldita',
  'desgraciado',
  'desgraciada',
  'hijo de puta',
  'carajo',
];

/** Frases completas — severidad alta */
export const FRASES_ALTA: string[] = [
  'me voy a demandar',
  'voy a demandar',
  'queja formal',
  'voy a denunciar',
  'abogado',
  'demanda',
  'indemnizacion',
  'me siento estafado',
  'es una estafa',
  'me estafaron',
  'robo',
  'me robaron',
  'ladrones',
  'sinverguenzas',
];

/** Palabras — severidad media */
export const INSULTOS_MEDIA: string[] = [
  'grosero',
  'grosera',
  'groseria',
  'mal educado',
  'maleducado',
  'molesto',
  'molestia',
  'pesimo',
  'pesima',
  'horrible',
  'porqueria',
  'porquerias',
  'incompetente',
  'incompetentes',
  'inepto',
  'inepta',
  'burla',
  'se burlaron',
  'sarcasmo',
  'ironia',
  'falta de respeto',
  'irrespetuoso',
  'irrespetuosa',
];

/** Palabras — severidad leve */
export const INSULTOS_LEVE: string[] = [
  'molesto',
  'frustrado',
  'frustracion',
  'decepcionado',
  'decepcionada',
  'decepcion',
  'harto',
  'cansado',
  'aburrido',
  'perdi mi tiempo',
  'tiempo perdido',
  'no me ayudaron',
  'no ayudan',
  'nunca resuelven',
  'mala atencion',
  'mal servicio',
];

/** Palabras que indican que el problema fue atribuible al asesor */
export const KW_ASESOR: string[] = [
  'asesor',
  'agente',
  'la persona que me atendio',
  'el que me atendio',
  'la que me atendio',
  'no me ayudo',
  'no me ayudó',
  'no sabia',
  'no sabía',
  'no entendia',
  'no entendía',
  'no conoce',
  'me colgo',
  'me colgó',
  'colgo la llamada',
  'colgó la llamada',
  'me dejo hablando',
  'me dejó hablando',
  'grosero',
  'grosera',
  'groseria',
  'mal educado',
  'maleducado',
  'no respondia',
  'no respondía',
  'tardo mucho',
  'tardó mucho',
  'lento',
  'se demoro',
  'se demoró',
  'me transfirieron sin avisar',
  'despistado',
  'confundido',
  'confundida',
];

/** Palabras que indican que el problema fue del servicio/producto/infraestructura */
export const KW_SERVICIO: string[] = [
  'señal',
  'senal',
  'red',
  'internet',
  'wifi',
  'router',
  'equipo',
  'decodificador',
  'factura',
  'facturacion',
  'facturación',
  'cargo',
  'cargos',
  'cobro',
  'cobros',
  'promocion',
  'promoción',
  'oferta',
  'velocidad',
  'lentitud',
  'caida',
  'caída',
  'cortes',
  'corte',
  'interferencia',
  'app',
  'aplicacion',
  'aplicación',
  'sistema',
  'plataforma',
  'linea',
  'línea',
  'telefonia',
  'telefonía',
  'plan',
  'servicio',
  'producto',
  'compania',
  'compañía',
  'claro',
  'mudanza',
  'reconexion',
  'reconexión',
  'instalacion',
  'instalación',
];

/** Normaliza texto para búsqueda de keywords */
function norm(texto: string): string {
  return (texto || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

export interface ResultadoAlerta {
  agresivo: boolean;
  razon: string;
  severidad: 'leve' | 'moderada' | 'alta';
}

/**
 * Detecta agresividad en un texto combinando las listas de keywords.
 * Se evalúa por severidad: alta → media → leve (primera coincidencia gana).
 */
export function detectarAgresividad(...textos: (string | undefined | null)[]): ResultadoAlerta {
  const texto = norm(textos.filter(Boolean).join(' '));
  if (!texto) return { agresivo: false, razon: '', severidad: 'leve' };

  // Severidad alta: insultos directos y frases
  const fraseAlta = FRASES_ALTA.find((f) => texto.includes(norm(f)));
  if (fraseAlta) {
    return { agresivo: true, razon: fraseAlta, severidad: 'alta' };
  }
  const insultoAlta = INSULTOS_ALTA.find((p) => texto.includes(norm(p)));
  if (insultoAlta) {
    return { agresivo: true, razon: insultoAlta, severidad: 'alta' };
  }

  // Severidad moderada (media)
  const insultoMedia = INSULTOS_MEDIA.find((p) => texto.includes(norm(p)));
  if (insultoMedia) {
    return { agresivo: true, razon: insultoMedia, severidad: 'moderada' };
  }

  // Severidad leve
  const insultoLeve = INSULTOS_LEVE.find((p) => texto.includes(norm(p)));
  if (insultoLeve) {
    return { agresivo: true, razon: insultoLeve, severidad: 'leve' };
  }

  return { agresivo: false, razon: '', severidad: 'leve' };
}

export type ClasificacionDetractor = 'asesor' | 'servicio' | 'indeterminado';

/**
 * Clasifica un detractor en:
 *  - 'asesor': el problema fue causado por el asesor
 *  - 'servicio': el problema fue del servicio/producto/infraestructura
 *  - 'indeterminado': sin comentario o sin keywords reconocidas
 */
export function clasificarDetractor(...textos: (string | undefined | null)[]): ClasificacionDetractor {
  const texto = norm(textos.filter(Boolean).join(' '));
  if (!texto) return 'indeterminado';

  const asesorHit = KW_ASESOR.some((k) => texto.includes(norm(k)));
  const servicioHit = KW_SERVICIO.some((k) => texto.includes(norm(k)));

  if (asesorHit) return 'asesor';
  if (servicioHit) return 'servicio';
  return 'indeterminado';
}
