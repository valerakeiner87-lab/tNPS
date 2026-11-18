// Arreglar BD 7 — dropear tablas incompatibles y recrear schema completo
const { Client } = require('pg');
const URL = 'postgresql://neondb_owner:npg_yrto7l6FpGKd@ep-royal-sky-amu52xjn-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require';

const DROP_SQL = `
DROP TABLE IF EXISTS "slides" CASCADE;
DROP TABLE IF EXISTS "users" CASCADE;
`;

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS "users" (
  "id" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "name" TEXT NOT NULL DEFAULT '',
  "role" TEXT NOT NULL DEFAULT 'ASESOR',
  "area" TEXT NOT NULL DEFAULT 'digital',
  "documento" TEXT NOT NULL DEFAULT '',
  "email" TEXT,
  "login_normalizado" TEXT NOT NULL DEFAULT '',
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "avatar_url" TEXT,
  "bio" TEXT,
  "debe_cambiar_password" BOOLEAN NOT NULL DEFAULT false,
  "ultimo_ingreso" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "users_username_key" ON "users"("username");
CREATE INDEX IF NOT EXISTS "users_role_idx" ON "users"("role");
CREATE INDEX IF NOT EXISTS "users_login_normalizado_idx" ON "users"("login_normalizado");
CREATE INDEX IF NOT EXISTS "users_documento_idx" ON "users"("documento");
CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users"("email");

CREATE TABLE IF NOT EXISTS "sessions" (
  "id" TEXT NOT NULL,
  "user_id" TEXT,
  "data" TEXT NOT NULL DEFAULT '{}',
  "expires_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "sessions_user_id_idx" ON "sessions"("user_id");

CREATE TABLE IF NOT EXISTS "audit_log" (
  "id" TEXT NOT NULL,
  "user_id" TEXT,
  "username" TEXT NOT NULL DEFAULT '',
  "accion" TEXT NOT NULL,
  "descripcion" TEXT NOT NULL DEFAULT '',
  "ip_origen" TEXT,
  "user_agent" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "audit_log_user_id_idx" ON "audit_log"("user_id");
CREATE INDEX IF NOT EXISTS "audit_log_accion_idx" ON "audit_log"("accion");
CREATE INDEX IF NOT EXISTS "audit_log_created_at_idx" ON "audit_log"("created_at");

CREATE TABLE IF NOT EXISTS "asesores_h_c" (
  "documento" TEXT NOT NULL,
  "nombre" TEXT NOT NULL DEFAULT '',
  "usuario_cic" TEXT NOT NULL DEFAULT '',
  "usuario_gen" TEXT NOT NULL DEFAULT '',
  "login_aib" TEXT NOT NULL DEFAULT '',
  "cargo" TEXT NOT NULL DEFAULT '',
  "lob" TEXT NOT NULL DEFAULT '',
  "linea" TEXT,
  "supervisor" TEXT NOT NULL DEFAULT '',
  "jefe_operacion" TEXT NOT NULL DEFAULT '',
  "fecha_ingreso" TEXT NOT NULL DEFAULT '',
  "fecha_nacimiento" TEXT,
  "ciudad" TEXT NOT NULL DEFAULT '',
  "sede" TEXT NOT NULL DEFAULT '',
  "genero" TEXT NOT NULL DEFAULT '',
  "tipo_contrato" TEXT NOT NULL DEFAULT '',
  "modalidad" TEXT NOT NULL DEFAULT '',
  "contratacion" TEXT NOT NULL DEFAULT '',
  "email" TEXT NOT NULL DEFAULT '',
  "telefono" TEXT NOT NULL DEFAULT '',
  "origen" TEXT NOT NULL DEFAULT 'ACTIVOS',
  "login_normalizado" TEXT NOT NULL DEFAULT '',
  "areas" TEXT NOT NULL DEFAULT '[]',
  "saved_at_ts" BIGINT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "asesores_h_c_pkey" PRIMARY KEY ("documento")
);
CREATE INDEX IF NOT EXISTS "asesores_h_c_login_normalizado_idx" ON "asesores_h_c"("login_normalizado");
CREATE INDEX IF NOT EXISTS "asesores_h_c_documento_idx" ON "asesores_h_c"("documento");
CREATE INDEX IF NOT EXISTS "asesores_h_c_saved_at_ts_idx" ON "asesores_h_c"("saved_at_ts");
CREATE INDEX IF NOT EXISTS "asesores_h_c_lob_idx" ON "asesores_h_c"("lob");

CREATE TABLE IF NOT EXISTS "encuestas" (
  "id" TEXT NOT NULL,
  "id_transaccion" TEXT NOT NULL DEFAULT '',
  "id_interaccion" TEXT,
  "fecha_dia" TEXT NOT NULL DEFAULT '',
  "fecha_inicio" TEXT NOT NULL DEFAULT '',
  "fecha_registro" TEXT NOT NULL DEFAULT '',
  "hora" INTEGER NOT NULL DEFAULT 0,
  "hora_exacta" TEXT NOT NULL DEFAULT '',
  "franja_horaria" TEXT NOT NULL DEFAULT '',
  "grupo" TEXT NOT NULL DEFAULT '',
  "tnps" INTEGER NOT NULL DEFAULT 0,
  "score" INTEGER NOT NULL DEFAULT 0,
  "razon" TEXT NOT NULL DEFAULT '',
  "comentario_solucion" TEXT NOT NULL DEFAULT '',
  "comentario_adicional" TEXT NOT NULL DEFAULT '',
  "canal" TEXT NOT NULL DEFAULT '',
  "medio_contacto" TEXT NOT NULL DEFAULT '',
  "unidad" TEXT NOT NULL DEFAULT '',
  "cola" TEXT NOT NULL DEFAULT '',
  "linea" TEXT NOT NULL DEFAULT '',
  "usuario" TEXT NOT NULL DEFAULT '',
  "login_normalizado" TEXT NOT NULL DEFAULT '',
  "documento" TEXT NOT NULL DEFAULT '',
  "nivel1" TEXT NOT NULL DEFAULT '',
  "nivel2" TEXT NOT NULL DEFAULT '',
  "nivel3" TEXT NOT NULL DEFAULT '',
  "nivel4" TEXT NOT NULL DEFAULT '',
  "nivel5" TEXT NOT NULL DEFAULT '',
  "index_tiempo" INTEGER,
  "index_conocimiento" INTEGER,
  "index_solucion" INTEGER,
  "index_amabilidad" INTEGER,
  "area" TEXT NOT NULL DEFAULT 'digital',
  "saved_at_ts" BIGINT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "encuestas_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "encuestas_login_normalizado_idx" ON "encuestas"("login_normalizado");
CREATE INDEX IF NOT EXISTS "encuestas_fecha_dia_idx" ON "encuestas"("fecha_dia");
CREATE INDEX IF NOT EXISTS "encuestas_grupo_idx" ON "encuestas"("grupo");
CREATE INDEX IF NOT EXISTS "encuestas_linea_idx" ON "encuestas"("linea");
CREATE INDEX IF NOT EXISTS "encuestas_area_idx" ON "encuestas"("area");
CREATE INDEX IF NOT EXISTS "encuestas_saved_at_ts_idx" ON "encuestas"("saved_at_ts");

CREATE TABLE IF NOT EXISTS "tmo" (
  "id" TEXT NOT NULL,
  "data" TEXT NOT NULL DEFAULT '{}',
  "saved_at_ts" BIGINT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "tmo_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "tmo_asesor_daily" (
  "id" TEXT NOT NULL,
  "login_normalizado" TEXT NOT NULL,
  "fecha" TEXT NOT NULL,
  "tmo" INTEGER NOT NULL DEFAULT 0,
  "interacciones" INTEGER NOT NULL DEFAULT 0,
  "lob" TEXT NOT NULL DEFAULT '',
  "supervisor" TEXT NOT NULL DEFAULT '',
  "semana" TEXT NOT NULL DEFAULT '',
  "mes" TEXT NOT NULL DEFAULT '',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "tmo_asesor_daily_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "tmo_asesor_daily_login_fecha_idx" ON "tmo_asesor_daily"("login_normalizado", "fecha");
CREATE INDEX IF NOT EXISTS "tmo_asesor_daily_login_idx" ON "tmo_asesor_daily"("login_normalizado");
CREATE INDEX IF NOT EXISTS "tmo_asesor_daily_fecha_idx" ON "tmo_asesor_daily"("fecha");

CREATE TABLE IF NOT EXISTS "config_tmo_linea" (
  "id" TEXT NOT NULL,
  "linea" TEXT NOT NULL,
  "tmo_maximo" INTEGER NOT NULL DEFAULT 970,
  "area" TEXT NOT NULL DEFAULT 'ambas',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "config_tmo_linea_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "config_tmo_linea_linea_area_key" ON "config_tmo_linea"("linea", "area");

CREATE TABLE IF NOT EXISTS "metadata_carga" (
  "id" TEXT NOT NULL DEFAULT 'global',
  "data" TEXT NOT NULL DEFAULT '{}',
  "saved_at_ts" BIGINT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "metadata_carga_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "analisis_alertas" (
  "encuesta_id" TEXT NOT NULL,
  "agresivo" BOOLEAN NOT NULL DEFAULT false,
  "razon" TEXT NOT NULL DEFAULT '',
  "severidad" TEXT NOT NULL DEFAULT 'leve',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "analisis_alertas_pkey" PRIMARY KEY ("encuesta_id")
);

CREATE TABLE IF NOT EXISTS "wallets_atc" (
  "id" TEXT NOT NULL,
  "login_normalizado" TEXT NOT NULL,
  "saldo" INTEGER NOT NULL DEFAULT 0,
  "racha_actual" INTEGER NOT NULL DEFAULT 0,
  "racha_maxima" INTEGER NOT NULL DEFAULT 0,
  "ultima_actualizacion" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "wallets_atc_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "wallets_atc_login_normalizado_key" ON "wallets_atc"("login_normalizado");

CREATE TABLE IF NOT EXISTS "transacciones_atc" (
  "id" TEXT NOT NULL,
  "wallet_id" TEXT,
  "login_normalizado" TEXT NOT NULL DEFAULT '',
  "tipo" TEXT NOT NULL DEFAULT '',
  "descripcion" TEXT NOT NULL DEFAULT '',
  "cantidad" INTEGER NOT NULL DEFAULT 0,
  "saldo_anterior" INTEGER,
  "saldo_nuevo" INTEGER,
  "ip_origen" TEXT,
  "procesado_por" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "transacciones_atc_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "transacciones_atc_wallet_id_idx" ON "transacciones_atc"("wallet_id");
CREATE INDEX IF NOT EXISTS "transacciones_atc_login_normalizado_idx" ON "transacciones_atc"("login_normalizado");
CREATE INDEX IF NOT EXISTS "transacciones_atc_created_at_idx" ON "transacciones_atc"("created_at");

CREATE TABLE IF NOT EXISTS "canjes_atc" (
  "id" TEXT NOT NULL,
  "wallet_id" TEXT,
  "login_normalizado" TEXT NOT NULL DEFAULT '',
  "premio_id" TEXT,
  "premio_nombre" TEXT NOT NULL DEFAULT '',
  "costo" INTEGER NOT NULL DEFAULT 0,
  "estado" TEXT NOT NULL DEFAULT 'pendiente',
  "procesado_por" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "canjes_atc_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "canjes_atc_wallet_id_idx" ON "canjes_atc"("wallet_id");
CREATE INDEX IF NOT EXISTS "canjes_atc_login_normalizado_idx" ON "canjes_atc"("login_normalizado");
CREATE INDEX IF NOT EXISTS "canjes_atc_estado_idx" ON "canjes_atc"("estado");

CREATE TABLE IF NOT EXISTS "apelaciones_atc" (
  "id" TEXT NOT NULL,
  "login_normalizado" TEXT NOT NULL DEFAULT '',
  "transaccion_id" TEXT,
  "motivo" TEXT NOT NULL DEFAULT '',
  "estado" TEXT NOT NULL DEFAULT 'pendiente',
  "respuesta" TEXT NOT NULL DEFAULT '',
  "procesado_por" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "apelaciones_atc_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "apelaciones_atc_login_normalizado_idx" ON "apelaciones_atc"("login_normalizado");
CREATE INDEX IF NOT EXISTS "apelaciones_atc_estado_idx" ON "apelaciones_atc"("estado");

CREATE TABLE IF NOT EXISTS "notificaciones_atc" (
  "id" TEXT NOT NULL,
  "login_normalizado" TEXT NOT NULL DEFAULT '',
  "titulo" TEXT NOT NULL DEFAULT '',
  "mensaje" TEXT NOT NULL DEFAULT '',
  "tipo" TEXT NOT NULL DEFAULT 'info',
  "leida" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "notificaciones_atc_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "notificaciones_atc_login_normalizado_idx" ON "notificaciones_atc"("login_normalizado");
CREATE INDEX IF NOT EXISTS "notificaciones_atc_leida_idx" ON "notificaciones_atc"("leida");

CREATE TABLE IF NOT EXISTS "atc_premios" (
  "id" TEXT NOT NULL,
  "nombre" TEXT NOT NULL,
  "descripcion" TEXT NOT NULL DEFAULT '',
  "costo" INTEGER NOT NULL DEFAULT 0,
  "categoria" TEXT NOT NULL DEFAULT 'General',
  "stock" INTEGER NOT NULL DEFAULT -1,
  "imagen_url" TEXT,
  "area" TEXT NOT NULL DEFAULT 'ambas',
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "duracion_tipo" TEXT,
  "duracion_valor" INTEGER NOT NULL DEFAULT 0,
  "max_reclamos_por_asesor" INTEGER NOT NULL DEFAULT 0,
  "canje_por_racha" BOOLEAN NOT NULL DEFAULT false,
  "promotores_requeridos_racha" INTEGER NOT NULL DEFAULT 3,
  "tipo_canje" TEXT NOT NULL DEFAULT 'monedas',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "atc_premios_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "atc_premios_activo_idx" ON "atc_premios"("activo");
CREATE INDEX IF NOT EXISTS "atc_premios_categoria_idx" ON "atc_premios"("categoria");

CREATE TABLE IF NOT EXISTS "config_reinicio_moneda" (
  "id" TEXT NOT NULL DEFAULT 'global',
  "tipo" TEXT NOT NULL DEFAULT 'semana',
  "valor" INTEGER NOT NULL DEFAULT 50,
  "dia_semana" INTEGER NOT NULL DEFAULT 0,
  "hora" INTEGER NOT NULL DEFAULT 0,
  "dia_mes" INTEGER NOT NULL DEFAULT 1,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "ultimo_reinicio" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "config_reinicio_moneda_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "formularios" (
  "id" TEXT NOT NULL,
  "titulo" TEXT NOT NULL,
  "descripcion" TEXT NOT NULL DEFAULT '',
  "categoria" TEXT NOT NULL DEFAULT 'General',
  "diseño" TEXT NOT NULL DEFAULT 'clasico',
  "max_intentos" INTEGER NOT NULL DEFAULT 1,
  "atc_por_respuesta" INTEGER NOT NULL DEFAULT 1,
  "atc_bonus" INTEGER NOT NULL DEFAULT 5,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "imagen_url" TEXT,
  "asignacion_tipo" TEXT NOT NULL DEFAULT 'todos',
  "asignacion_valor" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "formularios_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "formularios_activo_idx" ON "formularios"("activo");
CREATE INDEX IF NOT EXISTS "formularios_categoria_idx" ON "formularios"("categoria");
CREATE INDEX IF NOT EXISTS "formularios_asignacion_tipo_idx" ON "formularios"("asignacion_tipo");

CREATE TABLE IF NOT EXISTS "preguntas_formulario" (
  "id" TEXT NOT NULL,
  "formulario_id" TEXT NOT NULL,
  "tipo" TEXT NOT NULL DEFAULT 'opcion_multiple',
  "enunciado" TEXT NOT NULL,
  "opciones" TEXT NOT NULL DEFAULT '[]',
  "respuesta_correcta" INTEGER NOT NULL DEFAULT 0,
  "es_verdadero" BOOLEAN,
  "respuesta_texto" TEXT,
  "explicacion" TEXT NOT NULL DEFAULT '',
  "imagen_url" TEXT,
  "orden" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "preguntas_formulario_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "preguntas_formulario_formulario_id_idx" ON "preguntas_formulario"("formulario_id");

CREATE TABLE IF NOT EXISTS "respuestas_formulario" (
  "id" TEXT NOT NULL,
  "formulario_id" TEXT NOT NULL,
  "pregunta_id" TEXT NOT NULL,
  "login_normalizado" TEXT NOT NULL,
  "respuesta" TEXT NOT NULL,
  "correcta" BOOLEAN NOT NULL DEFAULT false,
  "atc_otorgado" INTEGER NOT NULL DEFAULT 0,
  "intento" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "respuestas_formulario_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "respuestas_formulario_formulario_id_idx" ON "respuestas_formulario"("formulario_id");
CREATE INDEX IF NOT EXISTS "respuestas_formulario_login_normalizado_idx" ON "respuestas_formulario"("login_normalizado");
CREATE INDEX IF NOT EXISTS "respuestas_formulario_pregunta_id_idx" ON "respuestas_formulario"("pregunta_id");

CREATE TABLE IF NOT EXISTS "partidas_juego" (
  "id" TEXT NOT NULL,
  "juego" TEXT NOT NULL,
  "login_normalizado" TEXT NOT NULL,
  "puntaje" INTEGER NOT NULL DEFAULT 0,
  "nivel" INTEGER NOT NULL DEFAULT 1,
  "duracion_seg" INTEGER NOT NULL DEFAULT 0,
  "ganado" BOOLEAN NOT NULL DEFAULT false,
  "atc_ganado" INTEGER NOT NULL DEFAULT 0,
  "datos" TEXT NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "partidas_juego_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "partidas_juego_juego_idx" ON "partidas_juego"("juego");
CREATE INDEX IF NOT EXISTS "partidas_juego_login_normalizado_idx" ON "partidas_juego"("login_normalizado");
CREATE INDEX IF NOT EXISTS "partidas_juego_created_at_idx" ON "partidas_juego"("created_at");

CREATE TABLE IF NOT EXISTS "logros" (
  "id" TEXT NOT NULL,
  "clave" TEXT,
  "nombre" TEXT NOT NULL,
  "descripcion" TEXT NOT NULL DEFAULT '',
  "emoji" TEXT NOT NULL DEFAULT '',
  "categoria" TEXT NOT NULL DEFAULT 'general',
  "puntos_recompensa" INTEGER NOT NULL DEFAULT 0,
  "condicion" TEXT NOT NULL DEFAULT '{}',
  "imagen_url" TEXT,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "logros_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "logros_clave_key" ON "logros"("clave") WHERE "clave" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "logros_activo_idx" ON "logros"("activo");
CREATE INDEX IF NOT EXISTS "logros_categoria_idx" ON "logros"("categoria");

CREATE TABLE IF NOT EXISTS "usuario_logros" (
  "id" TEXT NOT NULL,
  "usuario_id" TEXT,
  "logro_id" TEXT,
  "logro_nombre" TEXT,
  "logro_emoji" TEXT NOT NULL DEFAULT '',
  "logro_descripcion" TEXT NOT NULL DEFAULT '',
  "puntos_recompensa" INTEGER NOT NULL DEFAULT 0,
  "otorgado_en" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "usuario_logros_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "usuario_logros_usuario_id_logro_id_key" ON "usuario_logros"("usuario_id", "logro_id");
CREATE INDEX IF NOT EXISTS "usuario_logros_usuario_id_idx" ON "usuario_logros"("usuario_id");
CREATE INDEX IF NOT EXISTS "usuario_logros_logro_id_idx" ON "usuario_logros"("logro_id");

CREATE TABLE IF NOT EXISTS "streaks" (
  "id" TEXT NOT NULL,
  "login_normalizado" TEXT NOT NULL,
  "tipo" TEXT NOT NULL DEFAULT 'promotor',
  "actual" INTEGER NOT NULL DEFAULT 0,
  "maxima" INTEGER NOT NULL DEFAULT 0,
  "ultima_fecha" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "streaks_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "streaks_login_tipo_key" ON "streaks"("login_normalizado", "tipo");

CREATE TABLE IF NOT EXISTS "torneos" (
  "id" TEXT NOT NULL,
  "nombre" TEXT NOT NULL,
  "descripcion" TEXT NOT NULL DEFAULT '',
  "fecha_inicio" TIMESTAMPTZ,
  "fecha_fin" TIMESTAMPTZ,
  "tipo" TEXT NOT NULL DEFAULT 'tnps',
  "area" TEXT NOT NULL DEFAULT 'ambas',
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "premio" TEXT NOT NULL DEFAULT '',
  "config" TEXT NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "torneos_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "torneos_activo_idx" ON "torneos"("activo");

CREATE TABLE IF NOT EXISTS "torneo_participantes" (
  "id" TEXT NOT NULL,
  "torneo_id" TEXT NOT NULL,
  "login_normalizado" TEXT NOT NULL,
  "puntaje" INTEGER NOT NULL DEFAULT 0,
  "posicion" INTEGER,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "torneo_participantes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "torneo_participantes_torneo_login_key" ON "torneo_participantes"("torneo_id", "login_normalizado");
CREATE INDEX IF NOT EXISTS "torneo_participantes_torneo_id_idx" ON "torneo_participantes"("torneo_id");
CREATE INDEX IF NOT EXISTS "torneo_participantes_login_normalizado_idx" ON "torneo_participantes"("login_normalizado");

CREATE TABLE IF NOT EXISTS "preguntas_seguridad" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "pregunta" TEXT NOT NULL,
  "respuesta_hash" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "preguntas_seguridad_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "preguntas_seguridad_user_id_idx" ON "preguntas_seguridad"("user_id");

CREATE TABLE IF NOT EXISTS "theme_settings" (
  "id" TEXT NOT NULL DEFAULT 'global',
  "data" TEXT NOT NULL DEFAULT '{}',
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "theme_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "archivos" (
  "id" TEXT NOT NULL,
  "nombre" TEXT NOT NULL DEFAULT '',
  "tipo" TEXT NOT NULL DEFAULT '',
  "size" INTEGER NOT NULL DEFAULT 0,
  "data" BYTEA,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "archivos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "config_juegos" (
  "id" TEXT NOT NULL,
  "juego" TEXT NOT NULL,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "atc_ganado_max" INTEGER NOT NULL DEFAULT 10,
  "config" TEXT NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "config_juegos_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "config_juegos_juego_key" ON "config_juegos"("juego");
`;

(async () => {
  const client = new Client({ connectionString: URL, connectionTimeoutMillis: 15000, query_timeout: 60000 });
  await client.connect();
  console.log('Aplicando DROP a tablas incompatibles...');
  await client.query(DROP_SQL);
  console.log('✅ Tablas incompatibles dropeadas');
  console.log('Aplicando schema completo...');
  await client.query(SCHEMA_SQL);
  const r = await client.query(`SELECT count(*) as n FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`);
  console.log(`✅ BD 7 lista con ${r.rows[0].n} tablas`);
  await client.end();
})().catch(e => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
