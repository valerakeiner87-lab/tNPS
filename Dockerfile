# ============================================================
# ATC Digital · Claro Guatemala — Dockerfile para Hugging Face Spaces
# v3.1.7 — 7 BDs Neon con failover automático
# ============================================================
# Construye la aplicación Next.js en modo standalone y la sirve
# en el puerto 7860 (puerto estándar de HF Spaces).
#
# El script scripts/start.sh intenta cada una de las 7 BDs Neon
# configuradas y usa la primera que responda.
# ============================================================
# syntax=docker/dockerfile:1.6

# ----------- BUILD STAGE -----------
FROM node:22-alpine AS build
WORKDIR /app

# Copiar package.json y lockfiles
COPY package.json bun.lock* yarn.lock* package-lock.json* pnpm-lock.yaml* ./

# Instalar dependencias (incluye pg para migración manual)
RUN npm install --legacy-peer-deps

# Copiar el resto del código (incluye scripts/start.sh, prisma, src, public…)
COPY . .

# Renombrar schema.postgres.prisma → schema.prisma para producción
RUN cp prisma/schema.postgres.prisma prisma/schema.prisma

# Generar el cliente Prisma para PostgreSQL
RUN npx prisma generate

# Build standalone (soporta Server Actions + BD)
RUN npm run build

# ----------- PRODUCTION STAGE -----------
FROM node:22-alpine

WORKDIR /app

# Instalar prisma CLI y pg en el production stage directamente
# (en vez de COPY desde build, que falla por dependencias faltantes)
RUN npm install -g prisma@6 && npm install pg pg-connection-string

# Copiar el server standalone + assets estáticos
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

# Copiar schema.prisma y prisma client para poder hacer db push en runtime
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma

# Copiar scripts/start.sh (script de arranque con failover de 7 BDs)
COPY --from=build /app/scripts ./scripts
RUN chmod +x /app/scripts/start.sh

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=7860
ENV HOSTNAME=0.0.0.0
# v3.1.7: DATABASE_URL por defecto apunta a la primera de las 7 BDs Neon.
# Si el Space tiene un Secret DATABASE_URL, start.sh lo probará primero
# y si falla, probará las 7 BDs internas.
# NO necesitas agregar DATABASE_URL en HF Settings — las 7 URLs están
# hardcoded en scripts/start.sh y src/lib/db.ts
ENV DATABASE_URL=postgresql://neondb_owner:npg_eOtcs3rByJG7@ep-frosty-moon-b4vw32xp-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require

EXPOSE 7860

# Healthcheck: verifica que el server responda en /api
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:7860/api || exit 1

# Script de inicio: aplica el schema a la BD con failover automático
CMD ["sh", "-c", "/app/scripts/start.sh"]
