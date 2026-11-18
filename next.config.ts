import type { NextConfig } from "next";

/**
 * ATC Digital · Claro Guatemala
 *
 * CONFIGURACIÓN:
 * - Por defecto: standalone (soporta Server Actions + API routes + BD).
 *   Genera .next/standalone/ listo para Docker.
 * - Con BUILD_STATIC=1: export estático (sin server).
 *
 * Hugging Face Spaces (SDK Docker): usar el Dockerfile que corre
 * `npm run build` (standalone) y sirve el server en el puerto 7860.
 *
 * La BD se configura vía DATABASE_URL (env var):
 * - Desarrollo local: SQLite (file:./db/custom.db)
 * - Producción: PostgreSQL (Neon u otro)
 * Prisma maneja el dialecto automáticamente según el schema.
 */
const esEstatico = process.env.BUILD_STATIC === "1";

const nextConfig: NextConfig = {
  output: esEstatico ? "export" : "standalone",
  images: {
    unoptimized: true,
  },
  trailingSlash: esEstatico,
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: false,
  // Server Actions requeridas para el data layer
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  // Prisma y bcryptjs deben ser externos al bundle del server
  serverExternalPackages: ["@prisma/client", "bcryptjs", "pg"],
};

export default nextConfig;
