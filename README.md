---
title: ATC Digital Claro Guatemala
emoji: 📊
colorFrom: red
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
license: other
---

# ATC Digital · Claro Guatemala

Plataforma de análisis de satisfacción (tNPS) y gamificación (ATC) para el contact center de Claro Guatemala.

> Versión 2.0 · Next.js 16 · Prisma 6 · PostgreSQL (Neon) · Tailwind CSS 4 · shadcn/ui

---

## 📦 Despliegue en Hugging Face Spaces (Docker)

Esta aplicación está preparada para desplegarse en un **Hugging Face Space de tipo Docker**. El `Dockerfile` hace todo el trabajo: instala dependencias, genera el cliente Prisma, construye la app Next.js standalone, aplica el schema a la base de datos y arranca el servidor en el puerto **7860**.

### Paso 1 — Crear un Space nuevo

1. Entra a https://huggingface.co/new-space
2. **Owner**: tu usuario u organización
3. **Space name**: `atc-digital-claro-gt` (o el que prefieras)
4. **License**: elegir cualquiera (propietaria internamente)
5. **SDK**: **Docker**
6. **Space hardware**: **CPU basic (free)** es suficiente
7. Click en **Create Space**

### Paso 2 — Subir el contenido del ZIP

> ⚠️ **MUY IMPORTANTE**: Subir **el contenido** de la carpeta `atc-digital-claro-gt/`, NO la carpeta misma. El `Dockerfile` debe quedar en la raíz del Space.

**Opción A — Subir por la UI web** (recomendado para primer despliegue):

1. Descomprime localmente `atc-digital-claro-gt.zip`
2. Entra a la carpeta descomprimida
3. En el Space → **Files** → **Add file** → **Upload files**
4. Sube **todos los archivos y carpetas** que están DENTRO de `atc-digital-claro-gt/`:
   - `Dockerfile` (obligatorio en la raíz)
   - `package.json`
   - `next.config.ts`
   - `tsconfig.json`
   - `tailwind.config.ts`
   - `postcss.config.mjs`
   - `eslint.config.mjs`
   - `components.json`
   - `next-env.d.ts`
   - `README.md`
   - `.dockerignore`
   - `.env.example`
   - Carpeta `prisma/` (con `schema.prisma` y `schema.postgres.prisma`)
   - Carpeta `src/` (con todo el código TypeScript/React)
   - Carpeta `public/` (con `logo.svg` y `robots.txt`)
   - Carpeta `scripts/` (con `start.sh` y `seed.ts`)

**Opción B — Subir por Git** (recomendado para actualizar):

```bash
# Clonar el Space (reemplaza USER y SPACE-NAME)
git clone https://huggingface.co/spaces/USER/SPACE-NAME
cd SPACE-NAME

# Copiar aquí TODO el contenido de atc-digital-claro-gt/
# (asegúrate de que Dockerfile quede en la raíz)

# Commit y push
git add .
git commit -m "Deploy ATC Digital v2.0"
git push
```

### Paso 3 — Configurar los Secrets de la base de datos

En el Space → **Settings** → **Variables and secrets** → **New secret**:

| Nombre | Valor | Obligatorio |
|--------|-------|-------------|
| `DATABASE_URL` | `postgresql://USER:PASS@ep-HOST.aws.neon.tech/DBNAME?sslmode=require` | ✅ Sí |
| `JWT_SECRET` | cadena aleatoria de 32+ caracteres (ej. `openssl rand -hex 32`) | ✅ Sí |

#### Cómo obtener `DATABASE_URL` desde Neon

1. Crea una cuenta en https://neon.tech (gratis)
2. Crea un proyecto nuevo → nombre: `atc-claro-gt`
3. En el dashboard del proyecto → **Connection Details** → **Connection String**
4. Copia la URL completa. Debe verse así:
   ```
   postgresql://neondb_owner:npg_XxXxXxXx@ep-cool-name-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
5. Pégala como valor del secret `DATABASE_URL` en Hugging Face

> 💡 **Importante sobre el error "la BD no carga en otros PCs"**: el problema casi siempre es que `DATABASE_URL` no estaba configurada en los Secrets del Space, o estaba mal escrita. El nuevo `start.sh` verifica la conexión antes de arrancar y muestra un error claro en los logs si falla. Revisa **Logs** en el Space para ver el estado.

#### Generar un `JWT_SECRET` seguro

```bash
# En tu terminal local:
openssl rand -hex 32
# Pega el resultado como valor del secret JWT_SECRET
```

### Paso 4 — Verificar el despliegue

1. En el Space → **Logs** → esperar a que aparezca:
   ```
   === Verificando configuración de base de datos ===
   DATABASE_URL detectada: postgresql://***@ep-xxx.neon.tech (longitud: XX chars)
   === Aplicando schema a la base de datos (con reintentos) ===
   Intento 1/10: prisma db push --accept-data-loss --skip-generate
   ✅ Schema aplicado correctamente con prisma db push
   === Verificando conexión a la base de datos ===
   ✅ Conexión a BD exitosa: [{"ok":1}]
   === Iniciando servidor Next.js en puerto 7860 ===
   ```
2. Abrir la URL del Space (botón **App**): debería mostrar el login de ATC Digital.
3. Probar el endpoint de salud: `https://TU-SPACE.hf.space/api/health` debe responder:
   ```json
   {"ok":true,"database":{"configured":true,"connected":true}}
   ```

### Paso 5 — Sembrar datos iniciales (usuarios de ejemplo)

La primera vez que despliegues, la base de datos estará vacía. Tienes dos opciones:

**Opción A — Crear al menos un usuario admin desde Neon Console**:

Entra al dashboard de Neon → **SQL Editor** y ejecuta:

```sql
-- Crear usuario admin (password: admin123)
-- El hash bcryptjs de "admin123" se incluye abajo:
INSERT INTO users (id, username, password_hash, name, role, area, documento, login_normalizado, activo, debe_cambiar_password, created_at, updated_at)
VALUES (
  gen_random_uuid()::text,
  'admin',
  '$2a$10$N9qo8uLOickgx2ZMRZoMy.Mrq4ZQ7mMx5Q8XkkL3FBy1CpJvq2zK2',
  'Administrador',
  'ADMIN',
  'digital',
  'admin-001',
  'admin',
  true,
  false,
  now(),
  now()
)
ON CONFLICT (username) DO NOTHING;

-- Crear config ATC por defecto
INSERT INTO atc_config (id, sistema_atc_activo, saldo_inicial, created_at, updated_at)
VALUES ('global', true, 50, now(), now())
ON CONFLICT (id) DO NOTHING;
```

> ⚠️ Cambiar la contraseña después del primer login desde el panel de Usuarios.

**Opción B — Sembrar todos los datos de ejemplo**:

Si quieres datos de demostración (asesores, wallets, premios, etc.), sigue estas instrucciones en tu entorno local:

```bash
# Localmente:
# 1. Crea un .env con tu DATABASE_URL de Neon:
echo 'DATABASE_URL=postgresql://USER:PASS@ep-HOST.neon.tech/DB?sslmode=require' > .env

# 2. Aplica el schema a Neon:
npx prisma db push --accept-data-loss

# 3. Sembrar datos:
npx tsx scripts/seed.ts
```

### Credenciales de ejemplo (tras sembrar datos)

| Usuario | Password | Rol | Área |
|---------|----------|-----|------|
| `admin` | `admin123` | Administrador | digital |
| `supervisor` | `super123` | Supervisor | digital |
| `suptelefonico` | `super123` | Supervisor | telefonico |
| `jperez` | `1234` | Asesor | digital |
| `mgomez` | `1234` | Asesor | digital |
| `clopez` | `1234` | Asesor | digital |
| `aruiz` | `1234` | Asesor | telefonico |
| `lramirez` | `1234` | Asesor | telefonico |

---

## 🧑‍💻 Desarrollo local

### Requisitos
- **Node.js 22+** (recomendado 22.x o 24.x)
- **npm 10+**
- Opcional: **bun** para ejecutar el seed más rápido

### Pasos

```bash
# 1. Instalar dependencias
npm install --legacy-peer-deps

# 2. Crear .env con SQLite local
echo 'DATABASE_URL=file:./db/custom.db' > .env

# 3. Generar cliente Prisma
npx prisma generate

# 4. Crear la base de datos SQLite local
npm run db:push

# 5. (Opcional) Sembrar datos de ejemplo
npx tsx scripts/seed.ts
# o con bun: bun run scripts/seed.ts

# 6. Arrancar el dev server
npm run dev
```

App disponible en `http://localhost:3000`.

### Scripts npm disponibles

| Script | Descripción |
|--------|-------------|
| `npm run dev` | Dev server en puerto 3000 |
| `npm run build` | Build producción (standalone) |
| `npm run start` | Sirve el build standalone |
| `npm run db:push` | Aplica el schema Prisma a la BD |
| `npm run db:generate` | Regenera el cliente Prisma |
| `npm run seed` | Siembra datos de ejemplo (requiere `bun`) |
| `npm run lint` | Ejecuta ESLint |

---

## 🐛 Solución de problemas (Troubleshooting)

### Error: `/app/scripts/start.sh: not found` en HuggingFace

Este error ocurría en versiones anteriores cuando el archivo `scripts/start.sh` no se subía al Space. **Ya está resuelto**: el `Dockerfile` ahora crea el script inline (no depende del archivo externo). Si lo sigues viendo, asegúrate de subir el `Dockerfile` actualizado y hacer **factory rebuild** desde Settings.

### La app carga pero no muestra datos (BD "offline")

**Causa**: el contenedor arrancó pero no pudo conectar con la base de datos Neon.

**Solución**:

1. **Revisa los logs del Space** (tab **Logs**). Busca:
   - `❌ ERROR FATAL: DATABASE_URL no está configurada` → configura el secret
   - `⚠️ Intento X/10 falló` → la URL está mal o la BD no responde
   - `❌ No se pudo conectar a la BD` → la URL es correcta pero hay un problema de red

2. **Verifica el secret `DATABASE_URL`**:
   - Debe comenzar con `postgresql://`
   - Debe terminar con `?sslmode=require` (NEON lo exige)
   - No debe tener espacios ni saltos de línea
   - El usuario debe ser el `owner` del proyecto Neon

3. **Verifica la conexión a Neon**:
   - Entra a https://console.neon.tech
   - Comprueba que el proyecto esté activo (Neon suspende proyectos inactivos en el plan free)
   - Si estaba suspendido, haz click en "Resume" y reinicia el Space

4. **Verifica el endpoint de salud**:
   ```
   https://TU-SPACE.hf.space/api/health
   ```
   Debe responder `{"ok":true,"database":{"configured":true,"connected":true}}`

5. **IP Allow en Neon**:
   - Por defecto, Neon permite conexiones desde cualquier IP
   - Si configuraste IP Allow, asegúrate de no bloquear a HuggingFace
   - HF Spaces usan IPs dinámicas → mejor dejar IP Allow vacío

### Error: `prisma db push` falla en el arranque

**Causa**: generalmente porque hay datos existentes que no cumplen con el nuevo schema (constraints, FKs rotas, etc.).

**Solución**: el script `start.sh` ya tiene un **fallback con ALTER TABLEs** que agrega las columnas faltantes. Si aún así falla:

1. Entra al **SQL Editor** de Neon
2. Ejecuta: `DROP TABLE IF EXISTS "_prisma_migrations" CASCADE;`
3. Reinicia el Space (Settings → Restart Space → Factory reboot)

### El asesor abre la app en su PC pero no ve información

**Causas posibles**:

1. **La BD estaba vacía cuando el asesor entró** → el caché del navegador (Dexie) guardó esa respuesta vacía.
   - **Solución**: el asesor debe hacer Ctrl+F5 (o limpiar caché del sitio) y volver a iniciar sesión.

2. **El asesor se logueó con un usuario cuyo `login_normalizado` no coincide con el de las encuestas**.
   - **Solución**: en el panel de Usuarios, verificar que el campo `login_normalizado` del asesor coincida exactamente con el `login` que viene en el archivo de Qualtrics.

3. **El asesor está viendo datos de un área diferente** (digital vs telefonico).
   - **Solución**: en el login, seleccionar el área correcta (Digital o Telefónico).

### Error: `Proxy is missing expected function export name`

Ocurría porque Next.js 16 renombró `middleware` → `proxy` y la función exportada también debe llamarse `proxy` (no `middleware`). **Ya está resuelto** en `src/proxy.ts`.

### Quiero forzar un rebuild completo en HuggingFace

1. Settings → **Restart Space** → **Factory reboot**
2. O sube un commit vacío: `git commit --allow-empty -m "force rebuild" && git push`

---

## 🏗️ Arquitectura

### Stack

- **Next.js 16** con App Router + Turbopack (output: standalone)
- **TypeScript 5** estricto
- **Prisma 6** (SQLite en dev, PostgreSQL/Neon en prod)
- **Tailwind CSS 4** + **shadcn/ui**
- **Zustand** + **Dexie** (cache offline en el navegador como fallback)
- **bcryptjs** para hashing de passwords
- **JWT nativo** con `crypto` de Node (sin dependencias externas)

### Estructura

```
atc-digital-claro-gt/
├── Dockerfile                  # Build Docker para HuggingFace Spaces
├── .dockerignore               # Exclusiones del contexto Docker
├── .env.example                # Template de variables de entorno
├── package.json
├── next.config.ts              # Config Next.js (standalone + serverActions)
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.mjs
├── eslint.config.mjs
├── components.json             # Config shadcn/ui
├── prisma/
│   ├── schema.prisma           # Schema SQLite (dev local)
│   └── schema.postgres.prisma  # Schema PostgreSQL (prod / Neon)
├── scripts/
│   ├── start.sh                # Script de inicio (también inline en Dockerfile)
│   └── seed.ts                 # Datos de ejemplo
├── public/
│   ├── logo.svg
│   └── robots.txt
└── src/
    ├── proxy.ts                # Proxy (antes middleware) — verificación de cookie
    ├── app/
    │   ├── layout.tsx
    │   ├── page.tsx            # Página principal (header + tabs)
    │   ├── globals.css
    │   ├── actions/            # Server Actions (CRUD Prisma)
    │   │   ├── neon-actions.ts
    │   │   ├── premios-actions.ts
    │   │   ├── auth-actions.ts
    │   │   ├── usuarios-actions.ts
    │   │   └── logros-actions.ts
    │   └── api/
    │       ├── route.ts        # /api — info + estado de BD
    │       ├── health/route.ts # /api/health — healthcheck Docker
    │       └── auth/
    │           ├── login/route.ts
    │           ├── logout/route.ts
    │           └── me/route.ts
    ├── components/
    │   ├── providers.tsx       # ThemeProvider + Toaster
    │   ├── ui/                 # shadcn/ui components
    │   └── tnps/               # Componentes específicos de la app
    └── lib/
        ├── db.ts               # Cliente Prisma singleton + checkDatabaseConnection
        ├── neon-data.ts        # Capa de datos (Prisma)
        ├── session.ts          # JWT cookies
        ├── store.ts            # Zustand store principal
        ├── atc-store.ts        # Zustand store ATC
        ├── cache.ts            # Cache Dexie (fallback offline)
        ├── excel-parser.ts     # Parser de archivos Excel
        ├── excel-export.ts     # Exportación a Excel
        ├── password.ts         # Hash/verify con scrypt
        └── ...
```

### Flujo de datos

```
Browser (Zustand + Dexie cache)
    │
    ├── fetch('/api/auth/login')     → API route → Prisma → Neon
    ├── fetch('/api/auth/me')        → API route → JWT verify
    └── Server Actions (neon-actions.ts) → Prisma → Neon
                                              │
                                              └── Si la BD falla, el cliente usa el cache Dexie
                                                  como fallback (solo lectura, datos antiguos)
```

---

## 🔐 Seguridad

- Sesiones firmadas con **JWT HS256** usando `JWT_SECRET`
- Cookies **httpOnly** (no accesibles desde JS)
- Passwords hasheados con **scrypt** (crypto nativo de Node)
- Server Actions validan la sesión antes de cualquier operación sensible
- Borrados peligrosos requieren rol `ADMIN` o `SUPERVISOR`

---

## ✨ Novedades de la versión 2.0

### Sincronización con base de datos
- **Todas las lecturas** ahora van directamente a la BD vía Prisma (SQLite en dev, PostgreSQL/Neon en producción)
- El caché del navegador (Dexie/IndexedDB) se usa solo como fallback si la BD no responde
- Los asesores solo leen sus propios datos (wallet, canjes, transacciones, encuestas)
- Los supervisores leen todas las colecciones

### Umbrales de puntos ATC
- **Promotor: +1 punto**
- **Promotor con racha: +2 puntos**
- **Detractor: -1 punto**
- **Pasivo: 0 puntos** (no quita ni suma)

### Pestañas reorganizadas
- **Eliminadas**: TMO, Centralización ATC
- **Solo asesores**: Calculadora, Perfil, Mis Encuestas, Mis Métricas, Mi Billetera
- **Solo supervisores/admin**: Supervisión, Carga, Dashboard Global, Asesores, Alertas, Patrones, Tipificaciones, Podio TV, Billeteras ATC, Usuarios, Admin

### Panel de Supervisión (nueva pestaña)
4 sub-pestañas con KPIs en tiempo real:
1. **Resumen** — tNPS, asesores activos, ATC en circulación, canjes pendientes
2. **Top Asesores** — top 8 con avatar, saldo, promotores, racha + exportar Excel
3. **Canjes** — pendientes de aprobación con acciones rápidas + exportar Excel
4. **Movimientos** — últimas 10 transacciones ATC + exportar Excel

### Cambios técnicos en este despliegue
- ✅ **`middleware.ts` → `proxy.ts`** (Next.js 16)
- ✅ **`scripts/start.sh` inline en Dockerfile** (evita el error "file not found" en HF)
- ✅ **Retry logic en `start.sh`**: 10 intentos con backoff de 6s antes de fallar
- ✅ **Healthcheck Docker**: `HEALTHCHECK` con wget a `/api/health`
- ✅ **Endpoint `/api/health`**: verifica conexión real a la BD con `SELECT 1`
- ✅ **`db.ts` mejorado**: warning claro si `DATABASE_URL` no está configurada
- ✅ **`.env.example`**: template para variables de entorno
- ✅ **`.dockerignore` limpio**: no excluye `scripts/` ni `prisma/`

---

## 📝 Licencia

Propietaria · Claro Guatemala.
