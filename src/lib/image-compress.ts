// ============================================================
// v3.0.5 — Compresión de imágenes con Canvas API
// ============================================================
// Redimensiona y comprime imágenes antes de subirlas a la BD.
// Esto reduce el tamaño de la BD y mejora la velocidad de carga.

interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0-1 para JPEG
  format?: 'jpeg' | 'png' | 'webp';
}

const DEFAULTS: Required<CompressionOptions> = {
  maxWidth: 800,
  maxHeight: 800,
  quality: 0.85,
  format: 'jpeg',
};

/** Presets por tipo de imagen */
export const PRESETS = {
  avatar: { maxWidth: 200, maxHeight: 200, quality: 0.8, format: 'jpeg' as const },
  premio: { maxWidth: 400, maxHeight: 400, quality: 0.85, format: 'jpeg' as const },
  formulario: { maxWidth: 800, maxHeight: 600, quality: 0.85, format: 'jpeg' as const },
  general: { maxWidth: 800, maxHeight: 800, quality: 0.85, format: 'jpeg' as const },
};

/**
 * Comprime una imagen usando Canvas API.
 * @param file Archivo de imagen (File o Blob)
 * @param options Opciones de compresión
 * @returns Promise con el blob comprimido y el data URL base64
 */
export async function comprimirImagen(
  file: File | Blob,
  options: CompressionOptions = {}
): Promise<{ blob: Blob; base64: string; mime: string; size: number }> {
  const opts = { ...DEFAULTS, ...options };

  // Leer el archivo como data URL
  const dataUrl = await readFileAsDataURL(file);

  // Crear un elemento Image
  const img = await loadImage(dataUrl);

  // Calcular dimensiones manteniendo aspect ratio
  let { width, height } = img;
  if (width > opts.maxWidth) {
    height = (height * opts.maxWidth) / width;
    width = opts.maxWidth;
  }
  if (height > opts.maxHeight) {
    width = (width * opts.maxHeight) / height;
    height = opts.maxHeight;
  }
  width = Math.round(width);
  height = Math.round(height);

  // Crear canvas y dibujar la imagen redimensionada
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo crear el contexto del canvas');
  ctx.drawImage(img, 0, 0, width, height);

  // Convertir a blob con el formato y calidad especificados
  const mime = opts.format === 'png' ? 'image/png' : opts.format === 'webp' ? 'image/webp' : 'image/jpeg';
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Error al comprimir imagen'))),
      mime,
      opts.quality
    );
  });

  // Convertir a base64
  const base64 = await blobToBase64(blob);

  return {
    blob,
    base64,
    mime,
    size: blob.size,
  };
}

/** Valida que el archivo sea una imagen y no exceda el tamaño máximo */
export function validarImagen(file: File, maxSizeKB: number = 2048): string | null {
  if (!file.type.startsWith('image/')) {
    return 'Solo se permiten archivos de imagen (JPEG, PNG, WebP).';
  }
  if (file.size > maxSizeKB * 1024) {
    return `La imagen no puede ser mayor a ${maxSizeKB} KB.`;
  }
  return null;
}

// --- Helpers ---

function readFileAsDataURL(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Error al leer el archivo'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Error al cargar la imagen'));
    img.src = src;
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Quitar el prefijo "data:image/jpeg;base64,"
      const base64 = result.split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Error al convertir a base64'));
    reader.readAsDataURL(blob);
  });
}
