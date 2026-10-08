// Procesamiento de un archivo ya encolado: leer, validar y guardar.
// Lo usa el worker (jobs/importaciones.worker.js); la API solo encola.
import { leerExcel } from './excel.service.js';
import { tieneFormato, leerSegunFormato } from '../formatos/index.js';
import { query, withTransaction } from '../db/pool.js';
import { HttpError } from '../utils/HttpError.js';
import { env } from '../config/env.js';

// Espacio de nombres para los advisory locks de listas (evita choques con otros locks)
const LOCK_LISTAS = 4501;

// ---------------------------------------------------------------------------
// Lectura: formato registrado (formatos/index.js) o lectura genérica.
// Devuelve { hoja, formato, columnas, filas, avisos, omitidas }
// ---------------------------------------------------------------------------

const COLUMNAS_NOMBRE = ['nombre', 'receta', 'plato', 'preparacion'];
const COLUMNAS_TIPO_RECETA = ['tipo', 'tiempo', 'categoria'];

function leerRecetasGenerico(buffer) {
  const { hoja, columnas, filas: crudas } = leerExcel(buffer);
  const colNombre = columnas.find((c) => COLUMNAS_NOMBRE.includes(c));
  if (!colNombre) {
    throw new HttpError(422, 'No se encontró una columna de nombre', { esperadas: COLUMNAS_NOMBRE, encontradas: columnas });
  }
  const colTipo = columnas.find((c) => COLUMNAS_TIPO_RECETA.includes(c));

  const filas = [];
  const avisos = [];
  const vistos = new Map();
  crudas.forEach((fila, i) => {
    const numFila = i + 2;
    const { [colNombre]: nombre, ...atributos } = fila;
    if (nombre === null || nombre === undefined) {
      avisos.push({ fila: numFila, mensaje: 'Fila sin nombre; fila omitida' });
      return;
    }
    const clave = String(nombre).trim();
    if (vistos.has(clave)) {
      avisos.push({ fila: numFila, mensaje: `Receta "${clave}" repetida (ya aparece en la fila ${vistos.get(clave)}); fila omitida` });
      return;
    }
    vistos.set(clave, numFila);
    const tipo = colTipo ? atributos[colTipo] : null;
    if (colTipo) delete atributos[colTipo];
    filas.push({ nombre: clave, tipo: tipo ? String(tipo).toLowerCase() : null, atributos });
  });
  return { hoja, formato: null, columnas, filas, avisos, omitidas: avisos.length };
}

export function leerArchivo(buffer, tipo) {
  const resultado = tieneFormato(tipo) ? leerSegunFormato(tipo, buffer) : leerRecetasGenerico(buffer);
  if (!resultado.filas.length) {
    throw new HttpError(422, 'El archivo no tiene filas válidas para importar', {
      omitidas: resultado.omitidas,
      avisos: resultado.avisos.slice(0, 20),
    });
  }
  return resultado;
}

// ---------------------------------------------------------------------------
// Guardado por lotes: un INSERT ... SELECT FROM jsonb_to_recordset por lote.
// Devuelve la cantidad de filas escritas.
// ---------------------------------------------------------------------------

const GUARDAR_LOTE = {
  async ingredientes(db, trabajo, lote) {
    const { rowCount } = await db.query(
      `INSERT INTO ingredientes (lista_id, codigo, nombre, fuente, porcion_g, nutrientes, importacion_id)
       SELECT $1, x.codigo, x.nombre, x.fuente, x.porcion_g, x.nutrientes, $2
       FROM jsonb_to_recordset($3::jsonb)
         AS x(codigo int, nombre text, fuente text, porcion_g numeric, nutrientes jsonb)
       ON CONFLICT (lista_id, codigo) DO UPDATE
       SET nombre = EXCLUDED.nombre, fuente = EXCLUDED.fuente, porcion_g = EXCLUDED.porcion_g,
           nutrientes = EXCLUDED.nutrientes, importacion_id = EXCLUDED.importacion_id, actualizado_en = now()`,
      [trabajo.lista_id, trabajo.id, JSON.stringify(lote)],
    );
    return rowCount;
  },
  async recetas(db, trabajo, lote) {
    const { rowCount } = await db.query(
      `INSERT INTO recetas (nombre, tipo, atributos, importacion_id)
       SELECT x.nombre, x.tipo, x.atributos, $1
       FROM jsonb_to_recordset($2::jsonb) AS x(nombre text, tipo text, atributos jsonb)
       ON CONFLICT (nombre) DO UPDATE
       SET tipo = EXCLUDED.tipo, atributos = EXCLUDED.atributos,
           importacion_id = EXCLUDED.importacion_id, actualizado_en = now()`,
      [trabajo.id, JSON.stringify(lote)],
    );
    return rowCount;
  },
};

/** En modo "reemplazar", borra de la lista lo que ya no viene en el Excel. */
const ELIMINAR_SOBRANTES = {
  async ingredientes(db, trabajo, filas) {
    const { rowCount } = await db.query(
      'DELETE FROM ingredientes WHERE lista_id = $1 AND NOT (codigo = ANY($2::int[]))',
      [trabajo.lista_id, filas.map((f) => f.codigo)],
    );
    return rowCount;
  },
};

/**
 * Procesa un trabajo de importación. Todo lo que toca los datos va en UNA transacción:
 * si algo falla, la lista queda exactamente como estaba.
 * @param {{ id, tipo, modo, lista_id, archivo }} trabajo
 */
export async function procesarImportacion(trabajo) {
  if (tieneListas(trabajo.tipo) && !trabajo.lista_id) {
    throw new HttpError(409, 'La lista de destino fue eliminada antes de procesar el archivo');
  }

  const { hoja, formato, columnas, filas, avisos, omitidas } = leerArchivo(trabajo.archivo, trabajo.tipo);

  // Fuera de la transacción: así el frontend ve el total y los avisos mientras se guarda.
  await query(
    `UPDATE importaciones SET hoja = $2, formato = $3, columnas = $4, total_filas = $5,
            omitidas = $6, avisos = $7, latido_en = now()
     WHERE id = $1`,
    [trabajo.id, hoja, formato, columnas, filas.length, omitidas, JSON.stringify(avisos)],
  );

  return withTransaction(async (db) => {
    if (trabajo.lista_id) {
      // Una sola importación a la vez por lista (otros workers esperan aquí)
      await db.query('SELECT pg_advisory_xact_lock($1, $2)', [LOCK_LISTAS, trabajo.lista_id]);
      const { rowCount } = await db.query('SELECT 1 FROM listas WHERE id = $1 FOR KEY SHARE', [trabajo.lista_id]);
      if (!rowCount) throw new HttpError(409, 'La lista de destino fue eliminada antes de procesar el archivo');
    }

    let guardadas = 0;
    const tamano = env.worker.tamanoLote;
    for (let i = 0; i < filas.length; i += tamano) {
      guardadas += await GUARDAR_LOTE[trabajo.tipo](db, trabajo, filas.slice(i, i + tamano));
      // Progreso fuera de la transacción para que sea visible de inmediato
      await query('UPDATE importaciones SET procesadas = $2, latido_en = now() WHERE id = $1', [
        trabajo.id, Math.min(i + tamano, filas.length),
      ]);
    }

    let eliminadas = 0;
    if (trabajo.modo === 'reemplazar') eliminadas = await ELIMINAR_SOBRANTES[trabajo.tipo](db, trabajo, filas);
    if (trabajo.lista_id) await db.query('UPDATE listas SET actualizado_en = now() WHERE id = $1', [trabajo.lista_id]);

    // El cambio de estado va en la misma transacción que los datos: o queda todo, o nada.
    await db.query(
      `UPDATE importaciones
       SET estado = 'completada', procesadas = $2, guardadas = $3, eliminadas = $4, datos = $5,
           archivo = NULL, error = NULL, error_detalle = NULL, finalizado_en = now()
       WHERE id = $1`,
      [trabajo.id, filas.length, guardadas, eliminadas, JSON.stringify(filas)],
    );
    return { guardadas, eliminadas };
  });
}

export const tieneListas = (tipo) => tipo === 'ingredientes';
export const soportaReemplazo = (tipo) => Boolean(ELIMINAR_SOBRANTES[tipo]);
