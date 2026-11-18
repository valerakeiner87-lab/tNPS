// ============================================================
// tNPS Digital Claro Guatemala — Data layer con Prisma
// Archivo: src/lib/neon-data.ts
// ============================================================
// Reemplaza firestore-data.ts con queries directas a la BD via Prisma.
// Funciona tanto para SQLite (dev local) como PostgreSQL (Hugging Face/Neon).
// Este archivo se ejecuta EXCLUSIVAMENTE en el servidor.
// v3.1.5: Wrappers con server-cache para reducir lecturas a Neon (cuota).
// ============================================================
import { db } from '@/lib/db';
import { cachedRead, invalidatePattern, invalidate } from '@/lib/server-cache';
import type {
  Encuesta,
  AsesorHC,
  DatosTMO as TMO,
  MetadataCarga,
  MetricaAdherencia,
  DatosAdherencia,
  RegistroHorasRobot,
  DatosHorasRobot,
  DeslogueoAutorizado,
  DatosBitacora,
} from '@/lib/types';
import type {
  WalletATC,
  TransaccionATC,
  PremioATC,
  CanjeATC,
  ApelacionATC,
  NotificacionATC,
  ConfigATC,
} from '@/lib/atc-types';

// ------------------------------------------------------------
// Helpers de mapeo (snake_case DB <-> camelCase app)
// ------------------------------------------------------------

/** Convierte un row de la BD (snake_case, strings JSON) al formato de la app (camelCase, objetos JSON parseados) */
function parseJSON<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === 'object') return value as T;
  if (typeof value === 'string') {
    if (!value) return fallback;
    try { return JSON.parse(value) as T; } catch { return fallback; }
  }
  return fallback;
}

function mapEncuesta(e: any): Encuesta {
  return {
    id: e.id,
    idTransaccion: e.id_transaccion ?? e.idTransaccion ?? '',
    fechaDia: e.fecha_dia ?? e.fechaDia ?? '',
    fechaInicio: e.fecha_inicio ?? e.fechaInicio ?? '',
    fechaRegistro: e.fecha_registro ?? e.fechaRegistro ?? '',
    hora: Number(e.hora ?? 0),
    horaExacta: e.hora_exacta ?? e.horaExacta ?? '',
    franjaHoraria: e.franja_horaria ?? e.franjaHoraria ?? '',
    grupo: e.grupo ?? '',
    tnps: Number(e.tnps ?? 0),
    razon: e.razon ?? '',
    comentarioSolucion: e.comentario_solucion ?? e.comentarioSolucion ?? '',
    comentarioAdicional: e.comentario_adicional ?? e.comentarioAdicional ?? '',
    canal: e.canal ?? '',
    medioContacto: e.medio_contacto ?? e.medioContacto ?? '',
    unidad: e.unidad ?? '',
    cola: e.cola ?? '',
    linea: e.linea ?? '',
    usuario: e.usuario ?? '',
    loginNormalizado: e.login_normalizado ?? e.loginNormalizado ?? '',
    segmento: e.segmento ?? '',
    idCliente: e.id_cliente ?? e.idCliente ?? '',
    productoFamilia: e.producto_familia ?? e.productoFamilia ?? '',
    nivel1: e.nivel_1 ?? e.nivel1 ?? '',
    nivel2: e.nivel_2 ?? e.nivel2 ?? '',
    nivel3: e.nivel_3 ?? e.nivel3 ?? '',
    nivel4: e.nivel_4 ?? e.nivel4 ?? '',
    nivel5: e.nivel_5 ?? e.nivel5 ?? '',
    area: (e.area ?? 'digital') as any,
    alertaAgresiva: e.alerta_agresiva ?? e.alertaAgresiva ?? null,
    alertaRazon: e.alerta_razon ?? e.alertaRazon ?? null,
    alertaSeveridad: e.alerta_severidad ?? e.alertaSeveridad ?? null,
    savedAtTs: e.saved_at_ts != null ? Number(e.saved_at_ts) : (e.savedAtTs != null ? Number(e.savedAtTs) : undefined),
    // v3.0: índices
    indiceTiempo: e.indice_tiempo != null ? Number(e.indice_tiempo) : (e.indiceTiempo != null ? Number(e.indiceTiempo) : null),
    indiceConocimiento: e.indice_conocimiento != null ? Number(e.indice_conocimiento) : (e.indiceConocimiento != null ? Number(e.indiceConocimiento) : null),
    indiceSolucion: e.indice_solucion != null ? Number(e.indice_solucion) : (e.indiceSolucion != null ? Number(e.indiceSolucion) : null),
    indiceAmabilidad: e.indice_amabilidad != null ? Number(e.indice_amabilidad) : (e.indiceAmabilidad != null ? Number(e.indiceAmabilidad) : null),
    indicePromedio: e.indice_promedio != null ? Number(e.indice_promedio) : (e.indicePromedio != null ? Number(e.indicePromedio) : null),
  } as Encuesta;
}

function mapAsesorHC(a: any): AsesorHC {
  return {
    documento: a.documento,
    nombre: a.nombre ?? '',
    usuarioCic: a.usuario_cic ?? a.usuarioCic ?? '',
    usuarioGen: a.usuario_gen ?? a.usuarioGen ?? '',
    loginAib: a.login_aib ?? a.loginAib ?? '',
    cargo: a.cargo ?? '',
    lob: a.lob ?? '',
    linea: a.linea ?? null,
    supervisor: a.supervisor ?? '',
    jefeOperacion: a.jefe_operacion ?? a.jefeOperacion ?? '',
    fechaIngreso: a.fecha_ingreso ?? a.fechaIngreso ?? '',
    fechaNacimiento: a.fecha_nacimiento ?? a.fechaNacimiento ?? undefined,
    ciudad: a.ciudad ?? '',
    sede: a.sede ?? '',
    genero: a.genero ?? '',
    tipoContrato: a.tipo_contrato ?? a.tipoContrato ?? '',
    modalidad: a.modalidad ?? '',
    contratacion: a.contratacion ?? '',
    email: a.email ?? '',
    telefono: a.telefono ?? '',
    origen: a.origen ?? 'ACTIVOS',
    loginNormalizado: a.login_normalizado ?? a.loginNormalizado ?? '',
    areas: parseJSON<string[]>(a.areas ?? a.areas ?? '[]', []),
    savedAtTs: a.saved_at_ts != null ? Number(a.saved_at_ts) : (a.savedAtTs != null ? Number(a.savedAtTs) : undefined),
  } as AsesorHC;
}

function mapWallet(w: any): WalletATC {
  return {
    loginNormalizado: w.login_normalizado ?? w.loginNormalizado,
    nombre: w.nombre ?? '',
    saldo: Number(w.saldo ?? 0),
    semanaActual: w.semana_actual ?? w.semanaActual ?? '',
    stats: parseJSON<any>(w.stats, {}),
    rachaActual: Number(w.racha_actual ?? w.rachaActual ?? 0),
    ultimaPromocionTs: w.ultima_promocion_ts != null ? Number(w.ultima_promocion_ts) : (w.ultimaPromocionTs != null ? Number(w.ultimaPromocionTs) : null),
    metricasSemanales: parseJSON<any[]>(w.metricas_semanales ?? w.metricasSemanales ?? '[]', []),
    actualizado: w.actualizado ?? '',
  } as WalletATC;
}

function mapTransaccion(t: any): TransaccionATC {
  return {
    id: t.id,
    loginNormalizado: t.login_normalizado ?? t.loginNormalizado ?? '',
    tipo: t.tipo,
    monto: Number(t.monto ?? 0),
    descripcion: t.descripcion ?? '',
    encuestaId: t.encuesta_id ?? t.encuestaId ?? null,
    semanaISO: t.semana_iso ?? t.semanaISO ?? '',
    fecha: t.fecha,
    creado: t.creado ?? null,
    procesadoPor: t.procesado_por ?? t.procesadoPor ?? null,
  } as TransaccionATC;
}

function mapPremio(p: any): PremioATC {
  return {
    id: p.id,
    nombre: p.nombre,
    descripcion: p.descripcion ?? '',
    costoATC: Number(p.costo_atc ?? p.costoATC ?? p.costoAtc ?? 0),
    categoria: p.categoria ?? 'General',
    emoji: p.emoji ?? '',
    stock: Number(p.stock ?? -1),
    umbralDiario: Number(p.umbral_diario ?? p.umbralDiario ?? 0),
    umbralSemanal: Number(p.umbral_semanal ?? p.umbralSemanal ?? 0),
    autoAprobacion: Boolean(p.auto_aprobacion ?? p.autoAprobacion ?? false),
    activo: Boolean(p.activo ?? true),
    creado: p.creado,
    actualizado: p.actualizado ?? null,
    area: (p.area ?? 'ambas') as 'digital' | 'telefonico' | 'ambas',
    tmoMaximoRequerido:
      p.tmoMaximoRequerido !== undefined && p.tmoMaximoRequerido !== null
        ? Number(p.tmoMaximoRequerido)
        : p.tmo_maximo_requerido !== undefined && p.tmo_maximo_requerido !== null
          ? Number(p.tmo_maximo_requerido)
          : null,
    lineaRequerida: p.lineaRequerida ?? p.linea_requerida ?? null,
    imagenUrl: p.imagenUrl ?? p.imagen_url ?? null,
    // v3.0.4: duración y límite de reclamos
    duracionTipo: p.duracionTipo ?? p.duracion_tipo ?? null,
    duracionValor: Number(p.duracionValor ?? p.duracion_valor ?? 0),
    maxReclamosPorAsesor: Number(p.maxReclamosPorAsesor ?? p.max_reclamos_por_asesor ?? 0),
    // v3.0.7: canje por racha
    canjePorRacha: p.canjePorRacha ?? p.canje_por_racha ?? false,
    promotoresRequeridosRacha: Number(p.promotoresRequeridosRacha ?? p.promotores_requeridos_racha ?? 3),
    tipoCanje: p.tipoCanje ?? p.tipo_canje ?? 'monedas',
  } as PremioATC;
}

function mapCanje(c: any): CanjeATC {
  return {
    id: c.id,
    loginNormalizado: c.login_normalizado ?? c.loginNormalizado ?? '',
    nombreAsesor: c.nombre_asesor ?? c.nombreAsesor ?? '',
    premioId: c.premio_id ?? c.premioId,
    premioNombre: c.premio_nombre ?? c.premioNombre ?? '',
    premioEmoji: c.premio_emoji ?? c.premioEmoji ?? '',
    costoATC: Number(c.costo_atc ?? c.costoATC ?? 0),
    estado: c.estado ?? 'pendiente',
    solicitado: c.solicitado,
    actualizado: c.actualizado ?? null,
    resuelto: c.resuelto ?? null,
    resueltoPor: c.resuelto_por ?? c.resueltoPor ?? null,
    comentario: c.comentario ?? null,
  } as CanjeATC;
}

function mapApelacion(a: any): ApelacionATC {
  return {
    id: a.id,
    loginNormalizado: a.login_normalizado ?? a.loginNormalizado ?? '',
    nombreAsesor: a.nombre_asesor ?? a.nombreAsesor ?? '',
    encuestaId: a.encuesta_id ?? a.encuestaId,
    motivo: a.motivo,
    clasificacionOriginal: a.clasificacion_original ?? a.clasificacionOriginal ?? 'indeterminado',
    encuestaScore: a.encuesta_score != null ? Number(a.encuesta_score) : (a.encuestaScore != null ? Number(a.encuestaScore) : null),
    encuestaRazon: a.encuesta_razon ?? a.encuestaRazon ?? null,
    encuestaComentario: a.encuesta_comentario ?? a.encuestaComentario ?? null,
    encuestaFecha: a.encuesta_fecha ?? a.encuestaFecha ?? null,
    estado: a.estado ?? 'pendiente',
    creado: a.creado,
    actualizado: a.actualizado ?? null,
    resuelto: a.resuelto ?? null,
    resueltoPor: a.resuelto_por ?? a.resueltoPor ?? null,
    respuesta: a.respuesta ?? null,
    puntosAplicados: a.puntos_aplicados != null ? Number(a.puntos_aplicados) : (a.puntosAplicados != null ? Number(a.puntosAplicados) : null),
  } as ApelacionATC;
}

function mapNotificacion(n: any): NotificacionATC {
  return {
    id: n.id,
    tipo: n.tipo,
    titulo: n.titulo,
    mensaje: n.mensaje,
    paraLogin: n.para_login ?? n.paraLogin ?? null,
    paraAdmin: n.para_admin ?? n.paraAdmin ?? null,
    leida: Boolean(n.leida ?? false),
    creado: n.creado,
    data: n.data ? parseJSON<any>(n.data, null) : null,
  } as NotificacionATC;
}

function mapConfig(c: any): ConfigATC {
  return {
    id: c.id ?? 'global',
    sistemaATCActivo: Boolean(c.sistema_atc_activo ?? c.sistemaATCActivo ?? true),
    saldoInicial: Number(c.saldo_inicial ?? c.saldoInicial ?? 50),
    puntosPromotor: Number(c.puntos_promotor ?? c.puntosPromotor ?? 1),
    puntosPromotorRacha: Number(c.puntos_promotor_racha ?? c.puntosPromotorRacha ?? 2),
    puntosPasivo: Number(c.puntos_pasivo ?? c.puntosPasivo ?? 0),
    // v3.0: unificado
    puntosDetractor: Number(c.puntos_detractor ?? c.puntosDetractor ?? c.puntos_detractor_asesor ?? -1),
    rachaVentanaMinutos: Number(c.racha_ventana_minutos ?? c.rachaVentanaMinutos ?? 60),
    diaReinicioSemana: Number(c.dia_reinicio_semana ?? c.diaReinicioSemana ?? 0),
    horaReinicio: Number(c.hora_reinicio ?? c.horaReinicio ?? 23),
    minutoReinicio: Number(c.minuto_reinicio ?? c.minutoReinicio ?? 59),
    ultimaSemanaReiniciada: c.ultima_semana_reiniciada ?? c.ultimaSemanaReiniciada ?? null,
  } as ConfigATC;
}

function mapTMO(t: any): TMO | null {
  if (!t) return null;
  return {
    id: t.id ?? 'current',
    fechaProcesamiento: t.fecha_procesamiento ?? t.fechaProcesamiento ?? '',
    archivoNombre: t.archivo_nombre ?? t.archivoNombre ?? '',
    totalAsesores: Number(t.total_asesores ?? t.totalAsesores ?? 0),
    promedioGeneral: Number(t.promedio_general ?? t.promedioGeneral ?? 0),
    fechaInicio: t.fecha_inicio ?? t.fechaInicio ?? '',
    fechaFin: t.fecha_fin ?? t.fechaFin ?? '',
    asesores: parseJSON<any[]>(t.asesores, []),
  } as TMO;
}

function mapMetadata(m: any): MetadataCarga | null {
  if (!m) return null;
  return {
    id: m.id ?? 'carga_actual',
    fechaCarga: m.fecha_carga ?? m.fechaCarga ?? '',
    fechaCargaTs: Number(m.fecha_carga_ts ?? m.fechaCargaTs ?? 0),
    totalEncuestas: Number(m.total_encuestas ?? m.totalEncuestas ?? 0),
    totalAsesoresHC: Number(m.total_asesores_hc ?? m.totalAsesoresHC ?? 0),
    archivoHCNombre: m.archivo_hc_nombre ?? m.archivoHCNombre ?? '',
    archivoQualtricsNombre: m.archivo_qualtrics_nombre ?? m.archivoQualtricsNombre ?? '',
    cargadoPor: m.cargado_por ?? m.cargadoPor ?? '',
    cargadoPorUid: m.cargado_por_uid ?? m.cargadoPorUid ?? '',
    escrituraDiferencial: m.escritura_diferencial ?? m.escrituraDiferencial ?? null,
  } as MetadataCarga;
}

// ------------------------------------------------------------
// Encuestas
// ------------------------------------------------------------

export async function leerEncuestasNeon(): Promise<Encuesta[]> {
  // v3.0.1: limitar a 5000 encuestas más recientes para evitar carga
  // innecesaria de TODA la tabla (que con 50 usuarios concurrentes
  // puede ser muy pesada). Para análisis histórico, usar leerEncuestasNeonDesde.
  const rows = await db.encuesta.findMany({
    orderBy: { fechaDia: 'desc' },
    take: 5000,
  });
  return rows.map(mapEncuesta);
}

/**
 * v3.0.1: Lee encuestas de un asesor específico (por loginNormalizado).
 * Mucho más eficiente que leerEncuestasNeon() para asesores — solo carga
 * SUS encuestas en vez de las 5000 más recientes.
 */
export async function leerEncuestasAsesorNeon(loginNormalizado: string): Promise<Encuesta[]> {
  const rows = await db.encuesta.findMany({
    where: { loginNormalizado },
    orderBy: { fechaDia: 'desc' },
    take: 2000,
  });
  return rows.map(mapEncuesta);
}

/**
 * v3.0.1: Lee encuestas de un área específica (digital o telefonico).
 * Útil para que los supervisores solo carguen las encuestas de su área.
 * v3.1.5: caché del lado servidor por 30s para reducir quota Neon.
 */
export async function leerEncuestasAreaNeon(area: string, limite: number = 5000): Promise<Encuesta[]> {
  return cachedRead<Encuesta[]>(`encuestas:area:${area}:${limite}`, 30, async () => {
    const rows = await db.encuesta.findMany({
      where: { area },
      orderBy: { fechaDia: 'desc' },
      take: limite,
    });
    return rows.map(mapEncuesta);
  });
}

export async function leerEncuestasNeonDesde(ts: number): Promise<Encuesta[]> {
  const rows = await db.encuesta.findMany({
    where: { savedAtTs: { gt: BigInt(ts) } },
    orderBy: { savedAtTs: 'asc' },
  });
  return rows.map(mapEncuesta);
}

export async function guardarEncuestasNeon(encuestas: Encuesta[]): Promise<{ nuevas: number; omitidas: number }> {
  let nuevas = 0;
  let omitidas = 0;
  // v3.0.1: leer los IDs ya existentes en la BD para saber cuáles son realmente nuevas
  // Esto evita contar como "nueva" una encuesta que ya estaba (el upsert anterior
  // siempre sumaba al contador incluso en update).
  const idsAConsultar = encuestas.map(e => e.id);
  const existentes = new Set<string>();
  for (let i = 0; i < idsAConsultar.length; i += 500) {
    const loteIds = idsAConsultar.slice(i, i + 500);
    const rows = await db.encuesta.findMany({
      where: { id: { in: loteIds } },
      select: { id: true },
    });
    for (const r of rows) existentes.add(r.id);
  }

  for (let i = 0; i < encuestas.length; i += 400) {
    const lote = encuestas.slice(i, i + 400);
    for (const e of lote) {
      try {
        const yaExiste = existentes.has(e.id);
        await db.encuesta.upsert({
          where: { id: e.id },
          create: {
            id: e.id,
            idTransaccion: e.idTransaccion,
            fechaDia: e.fechaDia,
            fechaInicio: e.fechaInicio,
            fechaRegistro: e.fechaRegistro,
            hora: e.hora,
            horaExacta: e.horaExacta,
            franjaHoraria: e.franjaHoraria,
            grupo: e.grupo,
            tnps: e.tnps,
            razon: e.razon,
            comentarioSolucion: e.comentarioSolucion,
            comentarioAdicional: e.comentarioAdicional,
            canal: e.canal,
            medioContacto: e.medioContacto,
            unidad: e.unidad,
            cola: e.cola,
            linea: e.linea,
            usuario: e.usuario,
            loginNormalizado: e.loginNormalizado,
            segmento: e.segmento,
            idCliente: e.idCliente,
            productoFamilia: e.productoFamilia,
            nivel1: e.nivel1,
            nivel2: e.nivel2,
            nivel3: e.nivel3,
            nivel4: e.nivel4,
            nivel5: e.nivel5,
            area: e.area,
            // v3.0: índices
            indiceTiempo: e.indiceTiempo ?? null,
            indiceConocimiento: e.indiceConocimiento ?? null,
            indiceSolucion: e.indiceSolucion ?? null,
            indiceAmabilidad: e.indiceAmabilidad ?? null,
            indicePromedio: e.indicePromedio ?? null,
            savedAtTs: e.savedAtTs ?? BigInt(Date.now()),
          },
          update: {
            loginNormalizado: e.loginNormalizado,
            area: e.area,
            // v3.0: actualizar índices también en update
            indiceTiempo: e.indiceTiempo ?? null,
            indiceConocimiento: e.indiceConocimiento ?? null,
            indiceSolucion: e.indiceSolucion ?? null,
            indiceAmabilidad: e.indiceAmabilidad ?? null,
            indicePromedio: e.indicePromedio ?? null,
            // v3.0.1: NO actualizar savedAtTs en update — solo en create.
            // Si lo actualizamos, leerEncuestasNeonDesde(ultimoTs) devuelve
            // TODAS las encuestas como "nuevas" en cada recarga, lo que
            // causa que los ATC se recalculen infinitamente.
          },
        });
        // v3.0.1: solo contar como nueva si realmente no existía
        if (yaExiste) {
          omitidas++;
        } else {
          nuevas++;
        }
      } catch {
        omitidas++;
      }
    }
  }
  // v3.1.5: invalidar caché de encuestas tras escritura
  invalidatePattern('encuestas:');
  return { nuevas, omitidas };
}

export async function eliminarDuplicadosNeon(): Promise<{ total: number; borrados: number }> {
  // SQLite: con Prisma, primero leer duplicados, luego borrar
  const todas = await db.encuesta.findMany({ select: { id: true, idTransaccion: true } });
  const porTransaccion = new Map<string, string[]>(); // idTransaccion -> [ids]
  const sinTransaccion: string[] = [];
  for (const e of todas) {
    const idTrans = (e.idTransaccion ?? '').trim();
    if (!idTrans) { sinTransaccion.push(e.id); continue; }
    if (!porTransaccion.has(idTrans)) porTransaccion.set(idTrans, []);
    porTransaccion.get(idTrans)!.push(e.id);
  }
  const idsABorrar: string[] = [];
  for (const [idTrans, ids] of porTransaccion) {
    const idEstable = `enc_${idTrans}`;
    if (ids.includes(idEstable)) {
      // Borrar todos los que NO son el id estable
      for (const id of ids) if (id !== idEstable) idsABorrar.push(id);
    }
  }
  if (idsABorrar.length > 0) {
    await db.encuesta.deleteMany({ where: { id: { in: idsABorrar } } });
  }
  const total = await db.encuesta.count();
  return { total, borrados: idsABorrar.length };
}

// ------------------------------------------------------------
// Asesores HC
// ------------------------------------------------------------

export async function leerAsesoresHCNeon(): Promise<AsesorHC[]> {
  // v3.1.5: caché del lado servidor por 60s para reducir quota Neon
  return cachedRead<AsesorHC[]>('asesores_hc:all', 60, async () => {
    // v3.0.2: limitar a 1000 asesores HC para reducir payload
    // (los asesores no necesitan ver toda la lista, solo su propio registro)
    const rows = await db.asesorHC.findMany({ take: 1000 });
    return rows.map(mapAsesorHC);
  });
}

/**
 * v3.0.2: Lee un asesor HC específico por login o documento.
 * Mucho más eficiente que leerAsesoresHCNeon() para asesores.
 */
export async function leerAsesorHCNeon(loginOrDocumento: string): Promise<AsesorHC | null> {
  const row = await db.asesorHC.findFirst({
    where: {
      OR: [
        { loginNormalizado: loginOrDocumento },
        { documento: loginOrDocumento },
        { usuarioCic: loginOrDocumento },
      ],
    },
  });
  return row ? mapAsesorHC(row) : null;
}

export async function guardarAsesoresHCNeon(asesores: AsesorHC[]): Promise<void> {
  for (const a of asesores) {
    try {
      await db.asesorHC.upsert({
        where: { documento: a.documento },
        create: {
          documento: a.documento,
          nombre: a.nombre,
          usuarioCic: a.usuarioCic,
          usuarioGen: a.usuarioGen,
          loginAib: a.loginAib,
          cargo: a.cargo,
          lob: a.lob,
          linea: a.linea ?? null,
          supervisor: a.supervisor,
          jefeOperacion: a.jefeOperacion,
          fechaIngreso: a.fechaIngreso,
          fechaNacimiento: a.fechaNacimiento ?? null,
          ciudad: a.ciudad,
          sede: a.sede,
          genero: a.genero,
          tipoContrato: a.tipoContrato,
          modalidad: a.modalidad,
          contratacion: a.contratacion,
          email: a.email,
          telefono: a.telefono,
          origen: a.origen,
          loginNormalizado: a.loginNormalizado,
          areas: JSON.stringify(a.areas ?? []),
          savedAtTs: a.savedAtTs ?? BigInt(Date.now()),
        },
        update: {
          nombre: a.nombre,
          supervisor: a.supervisor,
          linea: a.linea ?? null,
          fechaNacimiento: a.fechaNacimiento ?? null,
          savedAtTs: a.savedAtTs ?? BigInt(Date.now()),
        },
      });
    } catch (err) {
      console.error('Error guardando asesor HC', a.documento, err);
    }
  }
  // v3.1.5: invalidar caché de HC tras escritura
  invalidatePattern('asesores_hc:');
}

export async function buscarAsesorHCNeon(loginNormalizado: string, documento: string) {
  const a = await db.asesorHC.findFirst({
    where: { loginNormalizado, documento },
  });
  return a ? mapAsesorHC(a) : null;
}

/**
 * v3.0.3: Crea usuarios automáticamente a partir del HC.
 * Para cada asesor del HC que NO tenga un usuario en la tabla `users`,
 * crea uno con:
 *   - username = loginNormalizado (ej: moises.rocha)
 *   - passwordHash = hashPassword(documento) (su cédula)
 *   - role = 'ASESOR'
 *   - area = 'digital' (por defecto; el asesor puede cambiarla en el login)
 *   - name = nombre del HC
 *   - documento = documento del HC
 *   - debeCambiarPassword = true (para forzar cambio en el primer login)
 *
 * Devuelve { creados, omitidos, errores }.
 */
export async function crearUsuariosDesdeHCNeon(asesores: AsesorHC[]): Promise<{ creados: number; omitidos: number; errores: number }> {
  const { hashPassword } = await import('./password');
  const { randomUUID } = await import('crypto');

  let creados = 0;
  let omitidos = 0;
  let errores = 0;

  // Filtrar asesores con loginNormalizado y documento válidos
  const validos = asesores.filter(a => {
    const login = (a.loginNormalizado || a.usuarioCic || '').trim().toLowerCase();
    const doc = (a.documento || '').trim();
    return login && doc;
  });

  if (validos.length === 0) {
    return { creados: 0, omitidos: 0, errores: 0 };
  }

  // Leer usernames ya existentes en la BD para no duplicar
  const loginsAConsultar = validos.map(a => (a.loginNormalizado || a.usuarioCic || '').trim().toLowerCase());
  const existentes = new Set<string>();
  for (let i = 0; i < loginsAConsultar.length; i += 500) {
    const lote = loginsAConsultar.slice(i, i + 500);
    const rows = await db.user.findMany({
      where: { username: { in: lote } },
      select: { username: true },
    });
    for (const r of rows) existentes.add(r.username);
  }

  for (const a of validos) {
    const login = (a.loginNormalizado || a.usuarioCic || '').trim().toLowerCase();
    const doc = (a.documento || '').trim();
    try {
      if (existentes.has(login)) {
        omitidos++;
        continue;
      }
      // Determinar área basándose en el LOB
      const lobLower = (a.lob || '').toLowerCase();
      let area = 'digital';
      if (lobLower.includes('whatsapp') || lobLower.includes('wa') || lobLower.includes('chat') || lobLower.includes('digital')) {
        area = 'digital';
      } else if (lobLower.includes('voz') || lobLower.includes('telefono') || lobLower.includes('call') || lobLower.includes('fijo info tel') || lobLower.includes('movil tel')) {
        area = 'telefonico';
      }

      const id = randomUUID();
      const hash = hashPassword(doc);
      await db.user.create({
        data: {
          id,
          username: login,
          passwordHash: hash,
          name: a.nombre || login,
          role: 'ASESOR',
          area,
          documento: doc,
          loginNormalizado: login,
          activo: true,
          debeCambiarPassword: true,
        },
      });
      existentes.add(login); // por si viene duplicado en el HC
      creados++;
    } catch (err) {
      console.error(`Error creando usuario ${login}:`, err);
      errores++;
    }
  }

  return { creados, omitidos, errores };
}

/**
 * v3.0.3: Crea usuarios a partir de encuestas Qualtrics (fallback si no hay HC).
 * Solo crea usuarios para logins que no existen, pero sin documento
 * (la contraseña será el login mismo — el asesor deberá resetearla).
 * Prefiere usar crearUsuariosDesdeHCNeon cuando sea posible.
 */
export async function crearUsuariosDesdeEncuestasNeon(encuestas: Encuesta[]): Promise<{ creados: number; omitidos: number; errores: number }> {
  const { hashPassword } = await import('./password');
  const { randomUUID } = await import('crypto');

  let creados = 0;
  let omitidos = 0;
  let errores = 0;

  // Extraer logins únicos de las encuestas
  const loginsUnicos = new Set<string>();
  for (const e of encuestas) {
    const login = (e.loginNormalizado || '').trim().toLowerCase();
    if (login) loginsUnicos.add(login);
  }

  if (loginsUnicos.size === 0) {
    return { creados: 0, omitidos: 0, errores: 0 };
  }

  const loginsArr = Array.from(loginsUnicos);
  const existentes = new Set<string>();
  for (let i = 0; i < loginsArr.length; i += 500) {
    const lote = loginsArr.slice(i, i + 500);
    const rows = await db.user.findMany({
      where: { username: { in: lote } },
      select: { username: true },
    });
    for (const r of rows) existentes.add(r.username);
  }

  for (const login of loginsArr) {
    try {
      if (existentes.has(login)) {
        omitidos++;
        continue;
      }
      const id = randomUUID();
      // Sin documento, usamos el login como password temporal
      const hash = hashPassword(login);
      await db.user.create({
        data: {
          id,
          username: login,
          passwordHash: hash,
          name: login,
          role: 'ASESOR',
          area: 'digital',
          documento: '',
          loginNormalizado: login,
          activo: true,
          debeCambiarPassword: true,
        },
      });
      existentes.add(login);
      creados++;
    } catch (err) {
      console.error(`Error creando usuario ${login}:`, err);
      errores++;
    }
  }

  return { creados, omitidos, errores };
}

// ------------------------------------------------------------
// Metadata y TMO
// ------------------------------------------------------------

export async function leerMetadataNeon() {
  const m = await db.metadataCarga.findUnique({ where: { id: 'carga_actual' } });
  return mapMetadata(m);
}

export async function guardarMetadataNeon(meta: any) {
  await db.metadataCarga.upsert({
    where: { id: 'carga_actual' },
    create: {
      fechaCarga: meta.fechaCarga,
      fechaCargaTs: BigInt(meta.fechaCargaTs),
      totalEncuestas: meta.totalEncuestas,
      totalAsesoresHC: meta.totalAsesoresHC,
      archivoHCNombre: meta.archivoHCNombre,
      archivoQualtricsNombre: meta.archivoQualtricsNombre,
      cargadoPor: meta.cargadoPor,
      cargadoPorUid: meta.cargadoPorUid,
      escrituraDiferencial: meta.escrituraDiferencial ?? null,
    },
    update: {
      fechaCarga: meta.fechaCarga,
      fechaCargaTs: BigInt(meta.fechaCargaTs),
      totalEncuestas: meta.totalEncuestas,
      totalAsesoresHC: meta.totalAsesoresHC,
      archivoHCNombre: meta.archivoHCNombre,
      archivoQualtricsNombre: meta.archivoQualtricsNombre,
      cargadoPor: meta.cargadoPor,
      cargadoPorUid: meta.cargadoPorUid,
      escrituraDiferencial: meta.escrituraDiferencial ?? null,
    },
  });
}

export async function leerTMONeon() {
  const t = await db.tMO.findUnique({ where: { id: 'current' } });
  return mapTMO(t);
}

export async function guardarTMONeon(tmo: any) {
  await db.tMO.upsert({
    where: { id: 'current' },
    create: {
      fechaProcesamiento: tmo.fechaProcesamiento,
      archivoNombre: tmo.archivoNombre,
      totalAsesores: tmo.totalAsesores,
      promedioGeneral: tmo.promedioGeneral,
      fechaInicio: tmo.fechaInicio,
      fechaFin: tmo.fechaFin,
      asesores: JSON.stringify(tmo.asesores ?? []),
    },
    update: {
      fechaProcesamiento: tmo.fechaProcesamiento,
      archivoNombre: tmo.archivoNombre,
      totalAsesores: tmo.totalAsesores,
      promedioGeneral: tmo.promedioGeneral,
      fechaInicio: tmo.fechaInicio,
      fechaFin: tmo.fechaFin,
      asesores: JSON.stringify(tmo.asesores ?? []),
    },
  });
}

// ------------------------------------------------------------
// Sistema ATC — Wallets
// ------------------------------------------------------------

export async function leerWalletsNeon(): Promise<WalletATC[]> {
  // v3.1.5: caché del lado servidor por 30s para reducir quota Neon
  return cachedRead<WalletATC[]>('wallets:all', 30, async () => {
    const rows = await db.walletATC.findMany({ orderBy: { saldo: 'desc' } });
    return rows.map(mapWallet);
  });
}

export async function guardarWalletNeon(w: WalletATC): Promise<void> {
  await db.walletATC.upsert({
    where: { loginNormalizado: w.loginNormalizado },
    create: {
      loginNormalizado: w.loginNormalizado,
      nombre: w.nombre,
      saldo: w.saldo,
      semanaActual: w.semanaActual,
      stats: JSON.stringify(w.stats ?? {}),
      rachaActual: w.rachaActual,
      ultimaPromocionTs: w.ultimaPromocionTs ?? null,
      metricasSemanales: JSON.stringify(w.metricasSemanales ?? []),
      actualizado: w.actualizado,
    },
    update: {
      nombre: w.nombre,
      saldo: w.saldo,
      semanaActual: w.semanaActual,
      stats: JSON.stringify(w.stats ?? {}),
      rachaActual: w.rachaActual,
      ultimaPromocionTs: w.ultimaPromocionTs ?? null,
      metricasSemanales: JSON.stringify(w.metricasSemanales ?? []),
      actualizado: w.actualizado,
    },
  });
  // v3.1.5: invalidar caché de wallets tras escritura
  invalidate('wallets:all');
}

// ------------------------------------------------------------
// Sistema ATC — Transacciones
// ------------------------------------------------------------

export async function leerTransaccionesNeon(login?: string): Promise<TransaccionATC[]> {
  // v3.0.2: limitar a 500 transacciones para reducir payload con 250 usuarios
  const rows = login
    ? await db.transaccionATC.findMany({
        where: { loginNormalizado: login },
        orderBy: { creado: 'desc' },
        take: 500,
      })
    : await db.transaccionATC.findMany({
        orderBy: { creado: 'desc' },
        take: 500,
      });
  return rows.map(mapTransaccion);
}

export async function guardarTransaccionNeon(t: TransaccionATC): Promise<void> {
  await db.transaccionATC.create({
    data: {
      id: t.id,
      loginNormalizado: t.loginNormalizado,
      tipo: t.tipo,
      monto: t.monto,
      descripcion: t.descripcion,
      encuestaId: t.encuestaId ?? null,
      semanaISO: t.semanaISO,
      fecha: t.fecha,
      creado: t.creado ?? null,
      procesadoPor: t.procesadoPor ?? null,
    },
  });
}

/**
 * v3.0.1: Lee los IDs de encuestas que ya tienen transacciones ATC en la BD.
 * Esto permite al motor ATC saber qué encuestas ya fueron procesadas y
 * saltárselas, evitando recargar ATC al recargar Qualtrics.
 *
 * Devuelve un Set<string> de encuestaId (los que no son null).
 */
export async function leerEncuestasProcesadasATCNeon(): Promise<Set<string>> {
  const rows = await db.transaccionATC.findMany({
    where: { encuestaId: { not: null } },
    select: { encuestaId: true },
  });
  return new Set(rows.map(r => r.encuestaId).filter((x): x is string => Boolean(x)));
}

// ------------------------------------------------------------
// Sistema ATC — Premios
// ------------------------------------------------------------

export async function leerPremiosNeon(): Promise<PremioATC[]> {
  // v3.1.5: caché del lado servidor por 60s (los premios cambian poco)
  return cachedRead<PremioATC[]>('premios:activos', 60, async () => {
    const rows = await db.premioATC.findMany({
      where: { activo: true },
      orderBy: { costoATC: 'asc' },
    });
    return rows.map(mapPremio);
  });
}

export async function leerTodosPremiosNeon(): Promise<PremioATC[]> {
  const rows = await db.premioATC.findMany({ orderBy: { creado: 'desc' } });
  return rows.map(mapPremio);
}

export async function guardarPremioNeon(p: PremioATC): Promise<void> {
  await db.premioATC.upsert({
    where: { id: p.id },
    create: {
      id: p.id,
      nombre: p.nombre,
      descripcion: p.descripcion,
      costoATC: p.costoATC,
      categoria: p.categoria,
      emoji: p.emoji,
      stock: p.stock,
      umbralDiario: p.umbralDiario,
      umbralSemanal: p.umbralSemanal,
      autoAprobacion: p.autoAprobacion,
      area: p.area ?? 'ambas',
      tmoMaximoRequerido: p.tmoMaximoRequerido ?? null,
      lineaRequerida: p.lineaRequerida ?? null,
      imagenUrl: p.imagenUrl ?? null,
      // v3.0.4: duración y límite de reclamos
      duracionTipo: (p as any).duracionTipo ?? null,
      duracionValor: (p as any).duracionValor ?? 0,
      maxReclamosPorAsesor: (p as any).maxReclamosPorAsesor ?? 0,
      // v3.0.7: canje por racha
      canjePorRacha: (p as any).canjePorRacha ?? false,
      promotoresRequeridosRacha: (p as any).promotoresRequeridosRacha ?? 3,
      tipoCanje: (p as any).tipoCanje ?? 'monedas',
      activo: p.activo,
      creado: p.creado,
      actualizado: p.actualizado ?? null,
    },
    update: {
      nombre: p.nombre,
      descripcion: p.descripcion,
      costoATC: p.costoATC,
      categoria: p.categoria,
      emoji: p.emoji,
      stock: p.stock,
      umbralDiario: p.umbralDiario,
      umbralSemanal: p.umbralSemanal,
      autoAprobacion: p.autoAprobacion,
      area: p.area ?? 'ambas',
      tmoMaximoRequerido: p.tmoMaximoRequerido ?? null,
      lineaRequerida: p.lineaRequerida ?? null,
      imagenUrl: p.imagenUrl ?? null,
      duracionTipo: (p as any).duracionTipo ?? null,
      duracionValor: (p as any).duracionValor ?? 0,
      maxReclamosPorAsesor: (p as any).maxReclamosPorAsesor ?? 0,
      canjePorRacha: (p as any).canjePorRacha ?? false,
      promotoresRequeridosRacha: (p as any).promotoresRequeridosRacha ?? 3,
      tipoCanje: (p as any).tipoCanje ?? 'monedas',
      activo: p.activo,
      actualizado: p.actualizado ?? null,
    },
  });
  // v3.1.5: invalidar caché de premios tras escritura
  invalidate('premios:activos');
}

export async function eliminarPremioNeon(id: string): Promise<void> {
  await db.premioATC.delete({ where: { id } });
  // v3.1.5: invalidar caché de premios tras borrado
  invalidate('premios:activos');
}

// ------------------------------------------------------------
// Sistema ATC — Canjes
// ------------------------------------------------------------

export async function leerCanjesNeon(login?: string): Promise<CanjeATC[]> {
  // v3.0.2: limitar a 300 canjes para reducir payload con 250 usuarios
  const rows = login
    ? await db.canjeATC.findMany({
        where: { loginNormalizado: login },
        orderBy: { solicitado: 'desc' },
        take: 300,
      })
    : await db.canjeATC.findMany({ orderBy: { solicitado: 'desc' }, take: 300 });
  return rows.map(mapCanje);
}

export async function crearCanjeNeon(c: CanjeATC): Promise<void> {
  await db.canjeATC.create({
    data: {
      id: c.id,
      loginNormalizado: c.loginNormalizado,
      nombreAsesor: c.nombreAsesor,
      premioId: c.premioId,
      premioNombre: c.premioNombre,
      premioEmoji: c.premioEmoji,
      costoATC: c.costoATC,
      estado: c.estado,
      solicitado: c.solicitado,
      actualizado: c.actualizado ?? null,
      resuelto: c.resuelto ?? null,
      resueltoPor: c.resueltoPor ?? null,
      comentario: c.comentario ?? null,
    },
  });
}

export async function resolverCanjeNeon(id: string, estado: 'aprobado' | 'rechazado', resueltoPor: string, comentario?: string): Promise<void> {
  await db.canjeATC.update({
    where: { id },
    data: {
      estado,
      resuelto: new Date().toISOString(),
      resueltoPor,
      comentario: comentario ?? null,
      actualizado: new Date().toISOString(),
    },
  });
}

// ------------------------------------------------------------
// Sistema ATC — Apelaciones
// ------------------------------------------------------------

export async function leerApelacionesNeon(login?: string): Promise<ApelacionATC[]> {
  // v3.0.2: limitar a 200 apelaciones para reducir payload
  const rows = login
    ? await db.apelacionATC.findMany({
        where: { loginNormalizado: login },
        orderBy: { creado: 'desc' },
        take: 200,
      })
    : await db.apelacionATC.findMany({ orderBy: { creado: 'desc' }, take: 200 });
  return rows.map(mapApelacion);
}

export async function crearApelacionNeon(a: ApelacionATC): Promise<void> {
  await db.apelacionATC.create({
    data: {
      id: a.id,
      loginNormalizado: a.loginNormalizado,
      nombreAsesor: a.nombreAsesor,
      encuestaId: a.encuestaId,
      motivo: a.motivo,
      clasificacionOriginal: a.clasificacionOriginal,
      encuestaScore: a.encuestaScore ?? null,
      encuestaRazon: a.encuestaRazon ?? null,
      encuestaComentario: a.encuestaComentario ?? null,
      encuestaFecha: a.encuestaFecha ?? null,
      estado: a.estado,
      creado: a.creado,
    },
  });
}

export async function resolverApelacionNeon(id: string, aprobada: boolean, respuesta: string, resueltoPor: string, puntosAplicados?: number): Promise<void> {
  await db.apelacionATC.update({
    where: { id },
    data: {
      estado: aprobada ? 'aprobada' : 'rechazada',
      resuelto: new Date().toISOString(),
      resueltoPor,
      respuesta,
      puntosAplicados: puntosAplicados ?? null,
      actualizado: new Date().toISOString(),
    },
  });
}

// ------------------------------------------------------------
// Sistema ATC — Notificaciones
// ------------------------------------------------------------

export async function leerNotificacionesNeon(paraAdmin: boolean, paraLogin?: string): Promise<NotificacionATC[]> {
  let rows: any[] = [];
  if (paraAdmin) {
    rows = await db.notificacionATC.findMany({
      where: { paraAdmin: true },
      orderBy: { creado: 'desc' },
      take: 100,
    });
  } else if (paraLogin) {
    rows = await db.notificacionATC.findMany({
      where: { paraLogin },
      orderBy: { creado: 'desc' },
      take: 100,
    });
  }
  return rows.map(mapNotificacion);
}

export async function crearNotificacionNeon(n: NotificacionATC): Promise<void> {
  await db.notificacionATC.create({
    data: {
      id: n.id,
      tipo: n.tipo,
      titulo: n.titulo,
      mensaje: n.mensaje,
      paraLogin: n.paraLogin ?? null,
      paraAdmin: n.paraAdmin ?? null,
      leida: n.leida ?? false,
      creado: n.creado,
      data: n.data ? JSON.stringify(n.data) : null,
    },
  });
}

export async function marcarNotificacionLeidaNeon(id: string): Promise<void> {
  await db.notificacionATC.update({ where: { id }, data: { leida: true } });
}

export async function marcarTodasLeidasNeon(paraLogin?: string, paraAdmin?: boolean): Promise<void> {
  const where: any = {};
  if (paraLogin) where.paraLogin = paraLogin;
  if (paraAdmin) where.paraAdmin = paraAdmin;
  await db.notificacionATC.updateMany({ where, data: { leida: true } });
}

// ------------------------------------------------------------
// Sistema ATC — Config
// ------------------------------------------------------------

export async function leerConfigNeon(): Promise<ConfigATC | null> {
  const c = await db.configATC.findUnique({ where: { id: 'global' } });
  return c ? mapConfig(c) : null;
}

export async function guardarConfigNeon(c: ConfigATC): Promise<void> {
  await db.configATC.upsert({
    where: { id: 'global' },
    create: {
      sistemaATCActivo: c.sistemaATCActivo,
      saldoInicial: c.saldoInicial,
      puntosPromotor: c.puntosPromotor,
      puntosPromotorRacha: c.puntosPromotorRacha,
      puntosPasivo: c.puntosPasivo,
      // v3.0: unificado
      puntosDetractor: c.puntosDetractor,
      rachaVentanaMinutos: c.rachaVentanaMinutos,
      diaReinicioSemana: c.diaReinicioSemana,
      horaReinicio: c.horaReinicio,
      minutoReinicio: c.minutoReinicio,
      ultimaSemanaReiniciada: c.ultimaSemanaReiniciada ?? null,
    },
    update: {
      sistemaATCActivo: c.sistemaATCActivo,
      saldoInicial: c.saldoInicial,
      puntosPromotor: c.puntosPromotor,
      puntosPromotorRacha: c.puntosPromotorRacha,
      puntosPasivo: c.puntosPasivo,
      puntosDetractor: c.puntosDetractor,
      rachaVentanaMinutos: c.rachaVentanaMinutos,
      diaReinicioSemana: c.diaReinicioSemana,
      horaReinicio: c.horaReinicio,
      minutoReinicio: c.minutoReinicio,
      ultimaSemanaReiniciada: c.ultimaSemanaReiniciada ?? null,
    },
  });
}

// ------------------------------------------------------------
// Sistema ATC — Reinicio de wallets (PRESERVA stats y metricas)
// ------------------------------------------------------------

export async function reiniciarWalletsNeon(saldoInicial: number, semanaActual: string): Promise<void> {
  // v3.0.1: Al reiniciar wallets, TAMBIÉN borramos las transacciones ATC
  // para que cuando se recargue Qualtrics, el motor ATC reprocese TODAS
  // las encuestas (porque idsProcesados estará vacío) y reconstruya las
  // wallets desde cero.
  //
  // Si NO borráramos las transacciones, el motor vería que las encuestas
  // ya tienen transacciones y no las reprocesaría, dejando las wallets
  // en saldoInicial sin sumar los ATC del mes.
  //
  // Preservamos stats / metricas_semanales (historial de premios canjeados)
  await db.walletATC.updateMany({
    data: {
      saldo: saldoInicial,
      rachaActual: 0,
      semanaActual: semanaActual,
      actualizado: new Date().toISOString(),
    },
  });
  // Borrar transacciones ATC para que el motor reprocese al recargar Qualtrics
  await db.transaccionATC.deleteMany({});
}

// ------------------------------------------------------------
// Sistema ATC — Beacon
// ------------------------------------------------------------

export async function leerBeaconATCNeon(): Promise<string> {
  const b = await db.beaconATC.findUnique({ where: { id: 'beacon' } });
  return b?.ts ?? '';
}

export async function actualizarBeaconATCNeon(ts: string): Promise<void> {
  await db.beaconATC.upsert({
    where: { id: 'beacon' },
    create: { ts },
    update: { ts },
  });
}

// ------------------------------------------------------------
// Análisis de alertas
// ------------------------------------------------------------

export async function leerAnalisisAlertasNeon(): Promise<any[]> {
  return db.analisisAlerta.findMany();
}

export async function guardarAnalisisAlertasNeon(analisis: any[]): Promise<void> {
  for (const a of analisis) {
    try {
      await db.analisisAlerta.upsert({
        where: { encuestaId: a.encuestaId },
        create: {
          encuestaId: a.encuestaId,
          agresivo: a.agresivo,
          razon: a.razon,
          severidad: a.severidad,
        },
        update: {
          agresivo: a.agresivo,
          razon: a.razon,
          severidad: a.severidad,
        },
      });
    } catch (err) {
      console.error('Error guardando análisis alerta', a.encuestaId, err);
    }
  }
}

// ------------------------------------------------------------
// Borrados (zona de peligro)
// ------------------------------------------------------------

export async function borrarEncuestasNeon(): Promise<void> {
  await db.encuesta.deleteMany({});
}

export async function borrarAsesoresHCNeon(): Promise<void> {
  await db.asesorHC.deleteMany({});
}

export async function borrarTMONeon(): Promise<void> {
  await db.tMO.deleteMany({});
}

export async function borrarTodaLaBaseNeon(): Promise<void> {
  await db.encuesta.deleteMany({});
  await db.asesorHC.deleteMany({});
  await db.tMO.deleteMany({});
  await db.metadataCarga.deleteMany({});
  await db.analisisAlerta.deleteMany({});
  await db.transaccionATC.deleteMany({});
  await db.canjeATC.deleteMany({});
  await db.apelacionATC.deleteMany({});
  await db.notificacionATC.deleteMany({});
  await db.walletATC.deleteMany({});
  try {
    await db.adherencia.deleteMany({});
  } catch {}
}

export async function borrarAdherenciaNeon(): Promise<void> {
  await db.adherencia.deleteMany({});
  invalidate('adherencia:current');
}

// ------------------------------------------------------------
// Verificación de conexión
// ------------------------------------------------------------

export async function verificarConexionNeon(): Promise<boolean> {
  try {
    await db.$queryRaw`SELECT 1 as ok`;
    return true;
  } catch {
    return false;
  }
}

// ============================================================
// v3.0 — TMO Diario (tmo_asesor_daily) + ConfigTMOLinea
// ============================================================

function mapTMOAsesorDaily(r: any): any {
  return {
    id: r.id,
    documento: r.documento,
    nombreAsesor: r.nombre_asesor ?? r.nombreAsesor ?? '',
    loginNormalizado: r.login_normalizado ?? r.loginNormalizado ?? '',
    lob: r.lob ?? '',
    supervisor: r.supervisor ?? '',
    fecha: r.fecha,
    semana: r.semana ?? '',
    mes: r.mes ?? '',
    interacciones: Number(r.interacciones ?? 0),
    manejoTotal: Number(r.manejo_total ?? r.manejoTotal ?? 0),
    tmo: Number(r.tmo ?? 0),
    meta: Number(r.meta ?? 0),
    area: r.area ?? '',
  };
}

/** Guarda registros TMO diarios masivamente (upsert por documento+fecha) */
export async function guardarTMODailyNeon(registros: any[]): Promise<{ guardados: number; errores: number }> {
  let guardados = 0;
  let errores = 0;
  for (let i = 0; i < registros.length; i += 200) {
    const lote = registros.slice(i, i + 200);
    for (const r of lote) {
      try {
        await db.tMOAsesorDaily.upsert({
          where: { documento_fecha: { documento: r.documento || r.loginNormalizado || 'unknown', fecha: r.fecha } },
          create: {
            id: r.id,
            documento: r.documento || r.loginNormalizado || 'unknown',
            nombreAsesor: r.nombreAsesor,
            loginNormalizado: r.loginNormalizado,
            lob: r.lob,
            supervisor: r.supervisor,
            fecha: r.fecha,
            semana: r.semana,
            mes: r.mes,
            interacciones: r.interacciones,
            manejoTotal: r.manejoTotal,
            tmo: r.tmo,
            meta: r.meta,
            area: r.area,
          },
          update: {
            nombreAsesor: r.nombreAsesor,
            loginNormalizado: r.loginNormalizado,
            lob: r.lob,
            supervisor: r.supervisor,
            semana: r.semana,
            mes: r.mes,
            interacciones: r.interacciones,
            manejoTotal: r.manejoTotal,
            tmo: r.tmo,
            meta: r.meta,
            area: r.area,
          },
        });
        guardados++;
      } catch (err) {
        console.error('Error guardando TMO daily:', err);
        errores++;
      }
    }
  }
  return { guardados, errores };
}

/** Lee TMO diario de un asesor (por login o documento) */
export async function leerTMODailyAsesorNeon(loginOrDocumento: string): Promise<any[]> {
  const rows = await db.tMOAsesorDaily.findMany({
    where: {
      OR: [
        { loginNormalizado: loginOrDocumento },
        { documento: loginOrDocumento },
      ],
    },
    orderBy: { fecha: 'asc' },
  });
  return rows.map(mapTMOAsesorDaily);
}

/** Lee TMO diario de todos los asesores en un rango de fechas */
export async function leerTMODailyRangoNeon(fechaInicio: string, fechaFin: string, area?: string): Promise<any[]> {
  const where: any = {
    fecha: { gte: fechaInicio, lte: fechaFin },
  };
  if (area) where.area = area;
  const rows = await db.tMOAsesorDaily.findMany({ where, orderBy: { fecha: 'asc' } });
  return rows.map(mapTMOAsesorDaily);
}

/** Lee TMO diario del mes actual */
export async function leerTMODailyMesActualNeon(area?: string): Promise<any[]> {
  const ahora = new Date();
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  const fechaInicio = `${inicioMes.getFullYear()}-${String(inicioMes.getMonth() + 1).padStart(2, '0')}-01`;
  const fechaFin = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;
  return leerTMODailyRangoNeon(fechaInicio, fechaFin, area);
}

/** Calcula el TMO promedio de los últimos N días para un asesor */
export async function leerTMOPromedioAsesorNeon(loginOrDocumento: string, dias: number = 7): Promise<number | null> {
  const rows = await db.tMOAsesorDaily.findMany({
    where: {
      OR: [
        { loginNormalizado: loginOrDocumento },
        { documento: loginOrDocumento },
      ],
    },
    orderBy: { fecha: 'desc' },
    take: dias,
  });
  if (rows.length === 0) return null;
  const totalInteracciones = rows.reduce((s, r) => s + r.interacciones, 0);
  if (totalInteracciones === 0) return null;
  const totalManejo = rows.reduce((s, r) => s + Number(r.manejoTotal), 0);
  return Math.round((totalManejo / totalInteracciones) * 10) / 10;
}

// ============================================================
// ConfigTMOLinea — umbrales TMO por línea
// ============================================================

const LINEAS_DEFAULT = [
  { linea: 'WhatsApp Fijo Soporte', area: 'digital' },
  { linea: 'WhatsApp Fijo Información', area: 'digital' },
  { linea: 'WhatsApp Móvil', area: 'digital' },
  { linea: 'Móvil Telefónico', area: 'telefonico' },
  { linea: 'Fijo Información Telefónico', area: 'telefonico' },
  { linea: 'Fijo Soporte Telefónico', area: 'telefonico' },
];

export async function leerConfigTMOLineasNeon(): Promise<any[]> {
  let rows = await db.configTMOLinea.findMany({ orderBy: { linea: 'asc' } });
  // Si no hay, crear las 6 líneas por defecto
  if (rows.length === 0) {
    for (const l of LINEAS_DEFAULT) {
      const id = `cfg_tmo_${l.linea.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      await db.configTMOLinea.upsert({
        where: { id },
        create: {
          id,
          linea: l.linea,
          lineaNormalizada: l.linea.toLowerCase().replace(/[^a-z0-9]/g, '_'),
          area: l.area,
          tmoMaximo: 600,
          descripcion: `TMO máximo para ${l.linea}`,
        },
        update: {},
      });
    }
    rows = await db.configTMOLinea.findMany({ orderBy: { linea: 'asc' } });
  }
  return rows.map((r: any) => ({
    id: r.id,
    linea: r.linea,
    lineaNormalizada: r.lineaNormalizada,
    area: r.area,
    tmoMaximo: Number(r.tmoMaximo),
    descripcion: r.descripcion ?? '',
  }));
}

export async function guardarConfigTMOLineaNeon(id: string, tmoMaximo: number, descripcion?: string): Promise<void> {
  await db.configTMOLinea.update({
    where: { id },
    data: {
      tmoMaximo,
      descripcion: descripcion ?? undefined,
    },
  });
}

/** Obtiene el umbral TMO para una línea específica */
export async function leerUmbralTMOLineaNeon(linea: string): Promise<number | null> {
  const row = await db.configTMOLinea.findFirst({
    where: { linea },
  });
  return row ? Number(row.tmoMaximo) : null;
}

// ============================================================
// Encuesta detalle (para popup)
// ============================================================

export async function leerEncuestaPorIdNeon(id: string): Promise<any | null> {
  const e = await db.encuesta.findUnique({ where: { id } });
  return e ? mapEncuesta(e) : null;
}

// ============================================================
// Rendimiento de asesor (punto fuerte, frecuencia, etc.)
// ============================================================

export async function calcularRendimientoAsesorNeon(loginNormalizado: string, area: 'digital' | 'telefonico' = 'digital'): Promise<any> {
  // 1. Encuestas del asesor
  const encuestas = await db.encuesta.findMany({
    where: { loginNormalizado },
    orderBy: { fechaDia: 'desc' },
  });

  if (encuestas.length === 0) {
    return {
      promedioTiempoCalificacion: 0,
      frecuenciaRespuestaHoras: 0,
      totalEncuestas: 0,
      puntoFuerte: 'Sin datos suficientes',
      puntoFuerteEmoji: '📊',
      indicePromedio: null,
      indiceTiempo: null,
      indiceConocimiento: null,
      indiceSolucion: null,
      indiceAmabilidad: null,
      tmoPromedio: null,
      tmoTendencia: [],
      tnpsTendencia: [],
    };
  }

  // 2. Promedio de tiempo entre fechaInicio y fechaRegistro (segundos)
  let totalSegundos = 0;
  let countTiempo = 0;
  for (const e of encuestas) {
    try {
      const inicio = new Date(e.fechaInicio).getTime();
      const registro = new Date(e.fechaRegistro).getTime();
      if (!Number.isNaN(inicio) && !Number.isNaN(registro) && registro >= inicio) {
        totalSegundos += (registro - inicio) / 1000;
        countTiempo++;
      }
    } catch {}
  }
  const promedioTiempoCalificacion = countTiempo > 0 ? Math.round(totalSegundos / countTiempo) : 0;

  // 3. Frecuencia de respuesta (horas entre encuestas)
  const fechas = encuestas
    .map(e => new Date(e.fechaInicio).getTime())
    .filter(t => !Number.isNaN(t))
    .sort((a, b) => a - b);
  let frecuenciaHoras = 0;
  if (fechas.length > 1) {
    let totalDiff = 0;
    for (let i = 1; i < fechas.length; i++) {
      totalDiff += (fechas[i] - fechas[i - 1]) / (1000 * 3600);
    }
    frecuenciaHoras = Math.round((totalDiff / (fechas.length - 1)) * 10) / 10;
  }

  // 4. Punto fuerte (análisis simple de comentarios)
  const comentarios = encuestas
    .map(e => `${e.razon ?? ''} ${e.comentarioSolucion ?? ''} ${e.comentarioAdicional ?? ''}`)
    .join(' ')
    .toLowerCase();
  const puntoFuerte = detectarPuntoFuerte(comentarios);

  // 5. Índices promedio
  const indicesValidos = (key: string) => encuestas
    .map((e: any) => e[key])
    .filter((v: any) => v !== null && v !== undefined)
    .map(Number)
    .filter((n: number) => !Number.isNaN(n));
  const idxTiempo = indicesValidos('indiceTiempo');
  const idxConocimiento = indicesValidos('indiceConocimiento');
  const idxSolucion = indicesValidos('indiceSolucion');
  const idxAmabilidad = indicesValidos('indiceAmabilidad');
  const prom = (arr: number[]) => arr.length > 0 ? Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 100) / 100 : null;

  // 6. TMO del mes actual
  const tmoDailyRows = await db.tMOAsesorDaily.findMany({
    where: {
      OR: [
        { loginNormalizado },
        { documento: loginNormalizado },
      ],
    },
    orderBy: { fecha: 'asc' },
  });
  const ahora = new Date();
  const mesActual = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;
  const tmoMesActual = tmoDailyRows.filter((r: any) => r.fecha.startsWith(mesActual));
  const tmoTendencia = tmoMesActual.map((r: any) => ({
    fecha: r.fecha,
    tmo: Number(r.tmo),
    interacciones: Number(r.interacciones),
  }));
  const totalInteraccionesTMO = tmoMesActual.reduce((s: number, r: any) => s + Number(r.interacciones), 0);
  const totalManejoTMO = tmoMesActual.reduce((s: number, r: any) => s + Number(r.manejoTotal), 0);
  const tmoPromedio = totalInteraccionesTMO > 0 ? Math.round((totalManejoTMO / totalInteraccionesTMO) * 10) / 10 : null;

  // 7. tNPS tendencia acumulada por día del mes actual
  const encuestasMesActual = encuestas.filter((e: any) => e.fechaDia?.startsWith(mesActual));
  const porDia = new Map<string, { suma: number; count: number; prom: number; pas: number; det: number }>();
  for (const e of encuestasMesActual) {
    const dia = e.fechaDia;
    if (!dia) continue;
    const actual = porDia.get(dia) ?? { suma: 0, count: 0, prom: 0, pas: 0, det: 0 };
    actual.suma += Number(e.tnps);
    actual.count += 1;
    if (e.grupo === 'Promotor') actual.prom += 1;
    else if (e.grupo === 'Pasivo') actual.pas += 1;
    else if (e.grupo === 'Detractor') actual.det += 1;
    porDia.set(dia, actual);
  }
  // Acumulado: tNPS acumulado hasta cada día
  let acumProm = 0, acumPas = 0, acumDet = 0, acumTotal = 0;
  const tnpsTendencia: any[] = [];
  const diasOrdenados = Array.from(porDia.keys()).sort();
  for (const dia of diasOrdenados) {
    const d = porDia.get(dia)!;
    acumProm += d.prom;
    acumPas += d.pas;
    acumDet += d.det;
    acumTotal += d.count;
    const tnpsAcum = acumTotal > 0 ? Math.round(((acumProm - acumDet) / acumTotal) * 100) : 0;
    tnpsTendencia.push({
      fecha: dia,
      tNPS: tnpsAcum,
      total: acumTotal,
      promotores: acumProm,
      pasivos: acumPas,
      detractores: acumDet,
    });
  }

  return {
    promedioTiempoCalificacion,
    frecuenciaRespuestaHoras: frecuenciaHoras,
    totalEncuestas: encuestas.length,
    puntoFuerte: puntoFuerte.titulo,
    puntoFuerteEmoji: puntoFuerte.emoji,
    indicePromedio: prom([...idxTiempo, ...idxConocimiento, ...idxSolucion, ...(area === 'telefonico' ? idxAmabilidad : [])]),
    indiceTiempo: prom(idxTiempo),
    indiceConocimiento: prom(idxConocimiento),
    indiceSolucion: prom(idxSolucion),
    indiceAmabilidad: prom(idxAmabilidad),
    tmoPromedio,
    tmoTendencia,
    tnpsTendencia,
  };
}

/** Análisis simple de comentarios para detectar el punto fuerte del asesor */
function detectarPuntoFuerte(texto: string): { titulo: string; emoji: string } {
  const palabras: Record<string, number> = {
    'rapido': 0, 'rapida': 0, 'rapidez': 0, 'agil': 0, 'pronto': 0, 'inmediato': 0, 'veloz': 0,
    'amable': 0, 'amabilidad': 0, 'cordial': 0, 'cordialidad': 0, 'simpatico': 0, 'simpatica': 0, 'gentil': 0, 'atento': 0, 'atenta': 0,
    'conocimiento': 0, 'experto': 0, 'experta': 0, 'sabe': 0, 'sabia': 0, 'profesional': 0, 'profesionalismo': 0, 'competente': 0,
    'solucion': 0, 'soluciono': 0, 'resolvio': 0, 'resolvi': 0, 'resuelto': 0, 'ayudo': 0, 'ayuda': 0, 'efectivo': 0, 'efectiva': 0,
    'paciencia': 0, 'paciente': 0, 'calma': 0,
    'claro': 0, 'clara': 0, 'claridad': 0, 'explica': 0, 'explico': 0, 'explicacion': 0,
  };
  for (const p of Object.keys(palabras)) {
    const regex = new RegExp(`\\b${p}`, 'g');
    const matches = texto.match(regex);
    if (matches) palabras[p] = matches.length;
  }
  const categorias = {
    rapidez: palabras.rapido + palabras.rapida + palabras.rapidez + palabras.agil + palabras.pronto + palabras.inmediato + palabras.veloz,
    amabilidad: palabras.amable + palabras.amabilidad + palabras.cordial + palabras.cordialidad + palabras.simpatico + palabras.simpatica + palabras.gentil + palabras.atento + palabras.atenta,
    conocimiento: palabras.conocimiento + palabras.experto + palabras.experta + palabras.sabe + palabras.sabia + palabras.profesional + palabras.profesionalismo + palabras.competente,
    solucion: palabras.solucion + palabras.soluciono + palabras.resolvio + palabras.resolvi + palabras.resuelto + palabras.ayudo + palabras.ayuda + palabras.efectivo + palabras.efectiva,
    paciencia: palabras.paciencia + palabras.paciente + palabras.calma,
    claridad: palabras.claro + palabras.clara + palabras.claridad + palabras.explica + palabras.explico + palabras.explicacion,
  };
  const entradas = Object.entries(categorias) as Array<[string, number]>;
  entradas.sort((a, b) => b[1] - a[1]);
  const [top, count] = entradas[0];
  if (count === 0) return { titulo: 'Atención equilibrada', emoji: '🌟' };
  const map: Record<string, { titulo: string; emoji: string }> = {
    rapidez: { titulo: 'Rapidez en la atención', emoji: '⚡' },
    amabilidad: { titulo: 'Amabilidad y calidez', emoji: '😊' },
    conocimiento: { titulo: 'Conocimiento y expertise', emoji: '🎓' },
    solucion: { titulo: 'Capacidad de resolución', emoji: '✅' },
    paciencia: { titulo: 'Paciencia y empatía', emoji: '🤝' },
    claridad: { titulo: 'Claridad en explicaciones', emoji: '💡' },
  };
  return map[top] ?? { titulo: 'Atención equilibrada', emoji: '🌟' };
}

// ============================================================
// Archivos subidos (avatares, imágenes de premios)
// ============================================================

export async function guardarArchivoNeon(params: {
  tipo: 'avatar' | 'premio' | 'general';
  ownerId?: string;
  nombre: string;
  mime: string;
  size: number;
  data: Buffer | Uint8Array;
}): Promise<string> {
  const { randomUUID } = await import('crypto');
  const id = randomUUID();
  // Convertir a Uint8Array<ArrayBuffer> para compatibilidad con Prisma
  const src = params.data instanceof Uint8Array ? params.data : new Uint8Array(params.data);
  // Crear un ArrayBuffer nuevo y copiar los bytes (evita problemas de tipo con SharedArrayBuffer)
  const buf = new ArrayBuffer(src.byteLength);
  const dataBytes = new Uint8Array(buf);
  dataBytes.set(src);
  await db.archivoSubido.create({
    data: {
      id,
      tipo: params.tipo,
      ownerId: params.ownerId ?? null,
      nombre: params.nombre,
      mime: params.mime,
      size: params.size,
      data: dataBytes,
    },
  });
  return id;
}

export async function leerArchivoNeon(id: string): Promise<any | null> {
  return await db.archivoSubido.findUnique({ where: { id } });
}

export async function leerArchivoPorOwnerNeon(tipo: string, ownerId: string): Promise<any | null> {
  const row = await db.archivoSubido.findFirst({
    where: { tipo, ownerId },
    orderBy: { createdAt: 'desc' },
  });
  return row;
}

export async function actualizarAvatarUsuarioNeon(userId: string, archivoId: string): Promise<void> {
  const avatarUrl = `/api/archivos/${archivoId}`;
  await db.user.update({
    where: { id: userId },
    data: { avatarUrl },
  });
}

export async function actualizarImagenPremioNeon(premioId: string, archivoId: string): Promise<void> {
  const imagenUrl = `/api/archivos/${archivoId}`;
  await db.premioATC.update({
    where: { id: premioId },
    data: { imagenUrl },
  });
}

// ============================================================
// Reset password masivo
// ============================================================

export async function resetPasswordMasivoNeon(params: {
  filtro: 'todos' | 'area' | 'lob';
  area?: string;
  lob?: string;
  nuevoPassword: string;
  excluirAdmins?: boolean;
}): Promise<{ actualizados: number }> {
  const { hashPassword } = await import('./password');
  const where: any = { activo: true };
  if (params.excluirAdmins) {
    where.role = { not: 'ADMIN' };
  }
  if (params.filtro === 'area' && params.area) {
    where.area = params.area;
  }
  if (params.filtro === 'lob') {
    // Buscar usuarios cuyo documento esté en asesores_hc con ese LOB
    // Nota: SQLite no soporta mode: 'insensitive', así que usamos contains directo
    // (Prisma maneja case-insensitive automáticamente en SQLite para contains)
    const lobLower = params.lob?.toLowerCase() ?? '';
    const asesores = await db.asesorHC.findMany({
      where: { lob: { contains: lobLower } },
      select: { documento: true },
    });
    const documentos = asesores.map(a => a.documento).filter(Boolean);
    if (documentos.length === 0) return { actualizados: 0 };
    where.documento = { in: documentos };
  }
  const usuarios = await db.user.findMany({ where, select: { id: true } });
  const hash = hashPassword(params.nuevoPassword);
  for (const u of usuarios) {
    await db.user.update({
      where: { id: u.id },
      data: { passwordHash: hash, debeCambiarPassword: true },
    });
  }
  return { actualizados: usuarios.length };
}

// ============================================================
// v3.2.0 — Adherencia
// ============================================================

function mapAdherencia(row: any): DatosAdherencia {
  const data = parseJSON<MetricaAdherencia[]>(row.data ?? row.Data ?? '[]', []);
  return {
    fechaProcesamiento: row.saved_at_ts ? new Date(Number(row.saved_at_ts)).toISOString() : '',
    archivoNombre: 'Adherencia',
    totalRegistros: data.length,
    fechaInicio: data.length > 0 ? data.reduce((min, m) => m.fecha < min ? m.fecha : min, data[0].fecha) : '',
    fechaFin: data.length > 0 ? data.reduce((max, m) => m.fecha > max ? m.fecha : max, data[0].fecha) : '',
    metricas: data,
  } as DatosAdherencia;
}

export async function leerAdherenciaNeon(): Promise<DatosAdherencia | null> {
  return cachedRead<DatosAdherencia | null>('adherencia:current', 30, async () => {
    const row = await db.adherencia.findUnique({ where: { id: 'current' } });
    return row ? mapAdherencia(row) : null;
  });
}

export async function guardarAdherenciaNeon(datos: DatosAdherencia): Promise<void> {
  await db.adherencia.upsert({
    where: { id: 'current' },
    create: {
      id: 'current',
      data: JSON.stringify(datos.metricas),
      savedAtTs: BigInt(Date.now()),
    },
    update: {
      data: JSON.stringify(datos.metricas),
      savedAtTs: BigInt(Date.now()),
    },
  });
  invalidatePattern('adherencia:');
}

// ============================================================
// v3.4.2 — Horas Robot y Bitácora (persistencia en BD)
// ============================================================

function mapHorasRobot(row: any): DatosHorasRobot {
  const data = parseJSON<RegistroHorasRobot[]>(row.data ?? row.Data ?? '[]', []);
  return {
    fechaProcesamiento: row.saved_at_ts ? new Date(Number(row.saved_at_ts)).toISOString() : '',
    archivoNombre: 'Horas Robot',
    totalRegistros: data.length,
    fechaInicio: data.length > 0 ? data.reduce((min, r) => r.fecha < min ? r.fecha : min, data[0].fecha) : '',
    fechaFin: data.length > 0 ? data.reduce((max, r) => r.fecha > max ? r.fecha : max, data[0].fecha) : '',
    registros: data,
  } as DatosHorasRobot;
}

export async function leerHorasRobotNeon(): Promise<DatosHorasRobot | null> {
  return cachedRead<DatosHorasRobot | null>('horas_robot:current', 30, async () => {
    const row = await db.horasRobot.findUnique({ where: { id: 'current' } });
    return row ? mapHorasRobot(row) : null;
  });
}

export async function guardarHorasRobotNeon(datos: DatosHorasRobot): Promise<void> {
  await db.horasRobot.upsert({
    where: { id: 'current' },
    create: {
      id: 'current',
      data: JSON.stringify(datos.registros),
      savedAtTs: BigInt(Date.now()),
    },
    update: {
      data: JSON.stringify(datos.registros),
      savedAtTs: BigInt(Date.now()),
    },
  });
  invalidatePattern('horas_robot:');
}

export async function borrarHorasRobotNeon(): Promise<void> {
  await db.horasRobot.deleteMany({});
  invalidatePattern('horas_robot:');
}

function mapBitacora(row: any): DatosBitacora {
  const data = parseJSON<DeslogueoAutorizado[]>(row.data ?? row.Data ?? '[]', []);
  return {
    fechaProcesamiento: row.saved_at_ts ? new Date(Number(row.saved_at_ts)).toISOString() : '',
    archivoNombre: 'Bitácora',
    totalRegistros: data.length,
    deslogueos: data,
  } as DatosBitacora;
}

export async function leerBitacoraNeon(): Promise<DatosBitacora | null> {
  return cachedRead<DatosBitacora | null>('bitacora:current', 30, async () => {
    const row = await db.bitacora.findUnique({ where: { id: 'current' } });
    return row ? mapBitacora(row) : null;
  });
}

export async function guardarBitacoraNeon(datos: DatosBitacora): Promise<void> {
  await db.bitacora.upsert({
    where: { id: 'current' },
    create: {
      id: 'current',
      data: JSON.stringify(datos.deslogueos),
      savedAtTs: BigInt(Date.now()),
    },
    update: {
      data: JSON.stringify(datos.deslogueos),
      savedAtTs: BigInt(Date.now()),
    },
  });
  invalidatePattern('bitacora:');
}

export async function borrarBitacoraNeon(): Promise<void> {
  await db.bitacora.deleteMany({});
  invalidatePattern('bitacora:');
}

// ============================================================
// v3.3.0 — Nómina y Gestión Operativa
// Novedades, Sugerencias de Turno y Nómina Diaria.
// ============================================================

/** Novedad (evento operativo: retraso, ausencia, incapacidad, etc.) */
export interface Novedad {
  id: string;
  documento: string;
  nombre: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  duracion: number;
  tipo: string;
  ticket?: string | null;
  descripcion: string;
  evidenciaUrl?: string | null;
  estado: string;
  procesadoPor?: string | null;
  respuesta?: string | null;
}

/** Sugerencia de turno (restricción o preferencia del asesor) */
export interface SugerenciaTurno {
  id: string;
  documento: string;
  nombre: string;
  turnoSugerido: string;
  descanso: string;
  tipoRestriccion: string;
  prioridad: string;
  comentario: string;
  semana: string;
  estado: string;
}

/** Nómina diaria por asesor (horas, tiempo ajustado, valor monetario) */
export interface NominaDiaria {
  id: string;
  documento: string;
  nombre: string;
  fecha: string;
  horasProgramadas: number;
  horasRobot: number;
  tiempoFaltante: number;
  tiempoAjustado: number;
  valorMonetario: number;
  estado: string;
  procesadoPor?: string | null;
}

function mapNovedad(n: any): Novedad {
  return {
    id: n.id,
    documento: n.documento,
    nombre: n.nombre ?? '',
    fecha: n.fecha,
    horaInicio: n.horaInicio ?? '',
    horaFin: n.horaFin ?? '',
    duracion: Number(n.duracion ?? 0),
    tipo: n.tipo ?? 'OTRO',
    ticket: n.ticket ?? null,
    descripcion: n.descripcion ?? '',
    evidenciaUrl: n.evidenciaUrl ?? null,
    estado: n.estado ?? 'pendiente',
    procesadoPor: n.procesadoPor ?? null,
    respuesta: n.respuesta ?? null,
  };
}

function mapSugerenciaTurno(s: any): SugerenciaTurno {
  return {
    id: s.id,
    documento: s.documento,
    nombre: s.nombre ?? '',
    turnoSugerido: s.turnoSugerido ?? '',
    descanso: s.descanso ?? '',
    tipoRestriccion: s.tipoRestriccion ?? 'OTROS',
    prioridad: s.prioridad ?? 'PRIORIDAD TURNO',
    comentario: s.comentario ?? '',
    semana: s.semana,
    estado: s.estado ?? 'pendiente',
  };
}

function mapNominaDiaria(r: any): NominaDiaria {
  return {
    id: r.id,
    documento: r.documento,
    nombre: r.nombre ?? '',
    fecha: r.fecha,
    horasProgramadas: Number(r.horasProgramadas ?? 0),
    horasRobot: Number(r.horasRobot ?? 0),
    tiempoFaltante: Number(r.tiempoFaltante ?? 0),
    tiempoAjustado: Number(r.tiempoAjustado ?? 0),
    valorMonetario: Number(r.valorMonetario ?? 0),
    estado: r.estado ?? 'pendiente',
    procesadoPor: r.procesadoPor ?? null,
  };
}

// ------------------------------------------------------------
// Novedades
// ------------------------------------------------------------

export async function leerNovedadesNeon(documento?: string): Promise<Novedad[]> {
  return cachedRead<Novedad[]>(
    documento ? `novedades:doc:${documento}` : 'novedades:all',
    30,
    async () => {
      const rows = documento
        ? await db.novedad.findMany({
            where: { documento },
            orderBy: [{ fecha: 'desc' }, { horaInicio: 'desc' }],
          })
        : await db.novedad.findMany({
            orderBy: [{ fecha: 'desc' }, { horaInicio: 'desc' }],
            take: 2000,
          });
      return rows.map(mapNovedad);
    }
  );
}

export async function guardarNovedadNeon(novedad: Novedad): Promise<void> {
  await db.novedad.upsert({
    where: { id: novedad.id },
    create: {
      id: novedad.id,
      documento: novedad.documento,
      nombre: novedad.nombre ?? '',
      fecha: novedad.fecha,
      horaInicio: novedad.horaInicio,
      horaFin: novedad.horaFin,
      duracion: novedad.duracion ?? 0,
      tipo: novedad.tipo ?? 'OTRO',
      ticket: novedad.ticket ?? null,
      descripcion: novedad.descripcion ?? '',
      evidenciaUrl: novedad.evidenciaUrl ?? null,
      estado: novedad.estado ?? 'pendiente',
      procesadoPor: novedad.procesadoPor ?? null,
      respuesta: novedad.respuesta ?? null,
    },
    update: {
      documento: novedad.documento,
      nombre: novedad.nombre ?? '',
      fecha: novedad.fecha,
      horaInicio: novedad.horaInicio,
      horaFin: novedad.horaFin,
      duracion: novedad.duracion ?? 0,
      tipo: novedad.tipo ?? 'OTRO',
      ticket: novedad.ticket ?? null,
      descripcion: novedad.descripcion ?? '',
      evidenciaUrl: novedad.evidenciaUrl ?? null,
      estado: novedad.estado ?? 'pendiente',
      procesadoPor: novedad.procesadoPor ?? null,
      respuesta: novedad.respuesta ?? null,
    },
  });
  invalidatePattern('novedades:');
}

export async function actualizarNovedadNeon(
  id: string,
  estado: string,
  procesadoPor?: string | null,
  respuesta?: string | null
): Promise<void> {
  await db.novedad.update({
    where: { id },
    data: {
      estado,
      procesadoPor: procesadoPor ?? null,
      respuesta: respuesta ?? null,
    },
  });
  invalidatePattern('novedades:');
}

// ------------------------------------------------------------
// Sugerencias de Turno
// ------------------------------------------------------------

export async function leerSugerenciasTurnoNeon(semana?: string): Promise<SugerenciaTurno[]> {
  return cachedRead<SugerenciaTurno[]>(
    semana ? `sugerencias_turno:semana:${semana}` : 'sugerencias_turno:all',
    30,
    async () => {
      const rows = semana
        ? await db.sugerenciaTurno.findMany({
            where: { semana },
            orderBy: [{ semana: 'desc' }, { documento: 'asc' }],
          })
        : await db.sugerenciaTurno.findMany({
            orderBy: [{ semana: 'desc' }, { documento: 'asc' }],
            take: 2000,
          });
      return rows.map(mapSugerenciaTurno);
    }
  );
}

export async function guardarSugerenciaTurnoNeon(sugerencia: SugerenciaTurno): Promise<void> {
  await db.sugerenciaTurno.upsert({
    where: { id: sugerencia.id },
    create: {
      id: sugerencia.id,
      documento: sugerencia.documento,
      nombre: sugerencia.nombre ?? '',
      turnoSugerido: sugerencia.turnoSugerido,
      descanso: sugerencia.descanso,
      tipoRestriccion: sugerencia.tipoRestriccion ?? 'OTROS',
      prioridad: sugerencia.prioridad ?? 'PRIORIDAD TURNO',
      comentario: sugerencia.comentario ?? '',
      semana: sugerencia.semana,
      estado: sugerencia.estado ?? 'pendiente',
    },
    update: {
      documento: sugerencia.documento,
      nombre: sugerencia.nombre ?? '',
      turnoSugerido: sugerencia.turnoSugerido,
      descanso: sugerencia.descanso,
      tipoRestriccion: sugerencia.tipoRestriccion ?? 'OTROS',
      prioridad: sugerencia.prioridad ?? 'PRIORIDAD TURNO',
      comentario: sugerencia.comentario ?? '',
      semana: sugerencia.semana,
      estado: sugerencia.estado ?? 'pendiente',
    },
  });
  invalidatePattern('sugerencias_turno:');
}

export async function actualizarSugerenciaTurnoNeon(
  id: string,
  estado: string
): Promise<void> {
  await db.sugerenciaTurno.update({
    where: { id },
    data: { estado },
  });
  invalidatePattern('sugerencias_turno:');
}

// ------------------------------------------------------------
// Nómina Diaria
// ------------------------------------------------------------

export async function leerNominaDiariaNeon(documento?: string): Promise<NominaDiaria[]> {
  return cachedRead<NominaDiaria[]>(
    documento ? `nomina_diaria:doc:${documento}` : 'nomina_diaria:all',
    30,
    async () => {
      const rows = documento
        ? await db.nominaDiaria.findMany({
            where: { documento },
            orderBy: { fecha: 'desc' },
          })
        : await db.nominaDiaria.findMany({
            orderBy: [{ fecha: 'desc' }, { documento: 'asc' }],
            take: 2000,
          });
      return rows.map(mapNominaDiaria);
    }
  );
}

export async function guardarNominaDiariaNeon(registro: NominaDiaria): Promise<void> {
  // Upsert por [documento, fecha] (unique constraint).
  // El `id` se conserva si ya existe; si es nuevo, se usa el id provisto.
  await db.nominaDiaria.upsert({
    where: { documento_fecha: { documento: registro.documento, fecha: registro.fecha } },
    create: {
      id: registro.id,
      documento: registro.documento,
      nombre: registro.nombre ?? '',
      fecha: registro.fecha,
      horasProgramadas: registro.horasProgramadas ?? 0,
      horasRobot: registro.horasRobot ?? 0,
      tiempoFaltante: registro.tiempoFaltante ?? 0,
      tiempoAjustado: registro.tiempoAjustado ?? 0,
      valorMonetario: registro.valorMonetario ?? 0,
      estado: registro.estado ?? 'pendiente',
      procesadoPor: registro.procesadoPor ?? null,
    },
    update: {
      nombre: registro.nombre ?? '',
      horasProgramadas: registro.horasProgramadas ?? 0,
      horasRobot: registro.horasRobot ?? 0,
      tiempoFaltante: registro.tiempoFaltante ?? 0,
      tiempoAjustado: registro.tiempoAjustado ?? 0,
      valorMonetario: registro.valorMonetario ?? 0,
      estado: registro.estado ?? 'pendiente',
      procesadoPor: registro.procesadoPor ?? null,
    },
  });
  invalidatePattern('nomina_diaria:');
}

export async function actualizarNominaDiariaNeon(
  documento: string,
  fecha: string,
  tiempoAjustado: number,
  valorMonetario: number,
  estado: string,
  procesadoPor?: string | null
): Promise<void> {
  await db.nominaDiaria.update({
    where: { documento_fecha: { documento, fecha } },
    data: {
      tiempoAjustado,
      valorMonetario,
      estado,
      procesadoPor: procesadoPor ?? null,
    },
  });
  invalidatePattern('nomina_diaria:');
}

