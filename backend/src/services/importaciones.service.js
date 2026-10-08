// Lado API de las importaciones: valida la solicitud, ENCOLA el archivo y responde de inmediato.
// El procesamiento real ocurre en segundo plano (jobs/importaciones.worker.js).
import { describirFormatos } from '../formatos/index.js';
import { leerArchivo, tieneListas, soportaReemplazo } from './importaciones.procesador.js';
import * as listas from './listas.service.js';
import { query, withTransaction } from '../db/pool.js';
import { HttpError } from '../utils/HttpError.js';

const TIPOS = ['ingredientes', 'recetas'];
const MODOS = ['agregar', 'reemplazar'];
const MAX_AVISOS = 200;

// Columnas que se devuelven (nunca el archivo binario; "datos" solo si se pide)
const COLUMNAS = `i.id, i.tipo, i.formato, i.modo, i.estado, i.lista_id, l.nombre AS lista_nombre,
  i.nombre_archivo, i.hoja, i.total_filas, i.procesadas, i.guardadas, i.eliminadas, i.omitidas,
  jsonb_array_length(i.avisos) AS total_avisos, i.error, i.error_detalle, i.intentos,
  (i.archivo IS NOT NULL) AS conserva_archivo,
  i.creado_en, i.iniciado_en, i.finalizado_en`;

function validarTipo(tipo) {
  if (!TIPOS.includes(tipo)) throw new HttpError(400, `"tipo" debe ser uno de: ${TIPOS.join(', ')}`);
}

// Para mostrar en tabla: saca "nutrientes" / "atributos" al primer nivel.
const aplanar = ({ nutrientes, atributos, ...resto }) => ({ ...resto, ...nutrientes, ...atributos });

export const formatos = () => describirFormatos();

/** Lectura síncrona para la vista previa: no guarda nada. */
export function previsualizar(buffer, tipo) {
  validarTipo(tipo);
  const { hoja, formato, columnas, filas, avisos, omitidas } = leerArchivo(buffer, tipo);
  return {
    hoja,
    formato,
    columnas,
    total_filas: filas.length,
    omitidas,
    filas: filas.slice(0, 10).map(aplanar),
    avisos: avisos.slice(0, MAX_AVISOS),
    total_avisos: avisos.length,
  };
}

/**
 * Registra la importación como trabajo pendiente.
 * Ingredientes: va a una lista existente (listaId + modo) o a una lista nueva (listaNombre).
 *   modo "reemplazar": la lista queda igual al Excel (se borra lo que no venga).
 *   modo "agregar":    se agregan y actualizan alimentos, sin borrar los demás.
 * @returns el trabajo creado (estado "pendiente")
 */
export async function encolar({ buffer, nombreArchivo, tipo, listaId, listaNombre, modo }) {
  validarTipo(tipo);

  if (tieneListas(tipo)) {
    if (Boolean(listaId) === Boolean(listaNombre)) {
      throw new HttpError(400, 'Indica "lista_id" (lista existente) o "lista_nombre" (lista nueva), uno de los dos');
    }
    modo = listaNombre ? 'agregar' : (modo ?? 'reemplazar');
  } else {
    if (listaId || listaNombre) throw new HttpError(400, `Las importaciones de ${tipo} no usan listas`);
    modo = modo ?? 'agregar';
  }
  if (!MODOS.includes(modo)) throw new HttpError(400, `"modo" debe ser uno de: ${MODOS.join(', ')}`);
  if (modo === 'reemplazar' && !soportaReemplazo(tipo)) {
    throw new HttpError(400, `El modo "reemplazar" no está disponible para ${tipo}`);
  }

  const id = await withTransaction(async (db) => {
    let lista = null;
    if (listaNombre) lista = await listas.crear({ tipo, nombre: listaNombre }, db);
    else if (listaId) lista = await listas.obtener(listaId, db);

    const { rows: [imp] } = await db.query(
      `INSERT INTO importaciones (tipo, lista_id, modo, estado, nombre_archivo, archivo)
       VALUES ($1, $2, $3, 'pendiente', $4, $5) RETURNING id`,
      [tipo, lista?.id ?? null, modo, nombreArchivo, buffer],
    );
    return imp.id;
  });
  return obtener(id);
}

export async function listar({ listaId = null, limite = 50 } = {}) {
  const { rows } = await query(
    `SELECT ${COLUMNAS} FROM importaciones i LEFT JOIN listas l ON l.id = i.lista_id
     WHERE $1::int IS NULL OR i.lista_id = $1
     ORDER BY i.creado_en DESC LIMIT $2`,
    [listaId, Math.min(Math.max(Number(limite) || 50, 1), 200)],
  );
  return rows;
}

export async function obtener(id, { incluirDatos = false } = {}) {
  const { rows: [row] } = await query(
    `SELECT ${COLUMNAS}, i.avisos ${incluirDatos ? ', i.datos' : ''}
     FROM importaciones i LEFT JOIN listas l ON l.id = i.lista_id WHERE i.id = $1`,
    [id],
  );
  if (!row) throw new HttpError(404, 'Importación no encontrada');
  row.avisos = row.avisos.slice(0, MAX_AVISOS);
  return row;
}

/** Vuelve a encolar una importación fallida (solo si aún conserva su archivo). */
export async function reintentar(id) {
  const { rowCount } = await query(
    `UPDATE importaciones
     SET estado = 'pendiente', intentos = 0, error = NULL, error_detalle = NULL, procesadas = 0, finalizado_en = NULL
     WHERE id = $1 AND estado = 'fallida' AND archivo IS NOT NULL
       AND (tipo <> 'ingredientes' OR lista_id IS NOT NULL)`,
    [id],
  );
  if (!rowCount) {
    throw new HttpError(409, 'Solo se pueden reintentar importaciones fallidas que conservan su archivo y cuya lista aún existe');
  }
  return obtener(id);
}
