#!/bin/sh
# ============================================================
# ATC Digital · Claro Guatemala — Script de inicio para Hugging Face Spaces
# v3.1.8 — 7 BDs Neon con failover automático simplificado
# ============================================================
# Estrategia:
#   1. Probar DATABASE_URL del env (si existe un HF Secret).
#   2. Si falla, probar las 7 BDs internas en orden.
#   3. La primera que responda se exporta como DATABASE_URL.
#   4. Ejecutar prisma db push (las tablas ya están creadas, esto solo
#      verifica y aplica cambios menores si los hay).
#   5. Arrancar el server Next.js standalone.
#
# NOTA: Las 7 BDs Neon YA TIENEN el schema aplicado desde un script
# externo (scripts/push_schema_all_dbs.js). prisma db push aquí solo
# verifica sincronización — no debería hacer cambios mayores.
# ============================================================
set -e

echo "=== ATC Digital · Claro Guatemala · v3.1.8 ==="
echo "=== Inicializando con 7 BDs Neon en failover ==="

# ============================================================
# LISTA DE LAS 7 BDs NEON CONFIGURADAS
# ============================================================
BD_URL_1="postgresql://neondb_owner:npg_eOtcs3rByJG7@ep-frosty-moon-b4vw32xp-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require"
BD_URL_2="postgresql://neondb_owner:npg_UJsjRQqNp1x2@ep-damp-meadow-b4qa0d1n-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require"
BD_URL_3="postgresql://neondb_owner:npg_gozHd28BDlOe@ep-holy-smoke-b4jwnenr-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require"
BD_URL_4="postgresql://neondb_owner:npg_gtySUlro37ea@ep-ancient-rain-b490nfti-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require"
BD_URL_5="postgresql://neondb_owner:npg_PyzerEG94ZOk@ep-bold-wildflower-b5q3v6zf-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require"
BD_URL_6="postgresql://neondb_owner:npg_rD4moHwXuQh2@ep-polished-smoke-b4vwp4xw-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require"
BD_URL_7="postgresql://neondb_owner:npg_yrto7l6FpGKd@ep-royal-sky-amu52xjn-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require"

# Lista completa (DATABASE_URL del env va primero si existe)
TODAS_URLS=""
if [ -n "$DATABASE_URL" ]; then
  TODAS_URLS="$DATABASE_URL|$BD_URL_1|$BD_URL_2|$BD_URL_3|$BD_URL_4|$BD_URL_5|$BD_URL_6|$BD_URL_7"
  echo "DATABASE_URL detectada en entorno (HF Secret?) — se probara primero, luego las 7 BDs internas"
else
  TODAS_URLS="$BD_URL_1|$BD_URL_2|$BD_URL_3|$BD_URL_4|$BD_URL_5|$BD_URL_6|$BD_URL_7"
  echo "DATABASE_URL no configurada — se usaran las 7 BDs internas"
fi

# Función para extraer host de una URL (sin credenciales)
get_host() {
  echo "$1" | sed -E 's|^.*@([^:/]+).*|\1|'
}

# Función para probar conexión rápida a una BD (timeout 12s)
probar_bd() {
  URL="$1"
  DATABASE_URL="$URL" timeout 12 node -e '
    const { PrismaClient } = require("@prisma/client");
    const p = new PrismaClient({ log: [] });
    Promise.race([
      p.$queryRaw`SELECT 1 as ok`,
      new Promise((_, rej) => setTimeout(() => rej(new Error("Timeout 10s")), 10000))
    ]).then(() => p.$disconnect()).then(() => process.exit(0)).catch(e => { process.exit(1); });
  ' 2>/dev/null
  return $?
}

# ============================================================
# PROBAR CADA BD Y APLICAR SCHEMA A LA PRIMERA QUE RESPONDA
# ============================================================
BD_OK_URL=""
IFS='|'
for URL in $TODAS_URLS; do
  HOST=$(get_host "$URL")
  echo ""
  echo "--- Probando BD: $HOST ---"
  if probar_bd "$URL"; then
    echo "✅ BD responde OK: $HOST"
    BD_OK_URL="$URL"
    break
  else
    echo "❌ BD no responde: $HOST"
  fi
done
unset IFS

# ============================================================
# VERIFICACIÓN FINAL
# ============================================================
if [ -z "$BD_OK_URL" ]; then
  echo ""
  echo "============================================================"
  echo "❌ ERROR FATAL: No se pudo conectar a NINGUNA de las BDs."
  echo "============================================================"
  echo "Posibles causas:"
  echo "  1. Cuota mensual agotada en TODAS las BDs Neon"
  echo "  2. IP del HF Space bloqueada por Neon IP Allow"
  echo "  3. Red de HF Spaces caída"
  echo ""
  echo "Acciones recomendadas:"
  echo "  - Crear nuevas BDs en https://console.neon.tech"
  echo "  - Agregar las nuevas URLs en src/lib/db.ts (BD_URLS_INTERNAS)"
  echo "  - Verificar que las BDs tengan ?sslmode=require"
  echo "============================================================"
  exit 1
fi

# Exportar la BD que funcionó como DATABASE_URL para el server
export DATABASE_URL="$BD_OK_URL"
HOST_OK=$(get_host "$BD_OK_URL")
echo ""
echo "============================================================"
echo "✅ BD activa para esta sesión: $HOST_OK"
echo "============================================================"

# ============================================================
# APLICAR SCHEMA (solo si hay diferencias — las tablas ya existen)
# ============================================================
echo "=== Sincronizando schema con prisma db push ==="
# Timeout de 60s — si tarda más, asumir que está OK y continuar
if timeout 60 npx prisma db push --accept-data-loss --skip-generate 2>&1; then
  echo "✅ Schema sincronizado correctamente"
else
  EXIT_CODE=$?
  if [ "$EXIT_CODE" = "124" ]; then
    echo "⚠️  prisma db push superó 60s timeout — continuando de todas formas (las tablas ya existen)"
  else
    echo "⚠️  prisma db push falló (código $EXIT_CODE) — continuando, las tablas ya están creadas"
  fi
fi

# ============================================================
# INICIAR SERVER NEXT.JS
# ============================================================
echo ""
echo "=== Iniciando servidor Next.js en puerto $PORT ==="
exec node server.js
