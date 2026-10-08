// Listas: agrupan ingredientes de distintos Excel para no mezclarlos.
import { query } from '../db/pool.js';
import { HttpError } from '../utils/HttpError.js';

export const TIPOS_LISTA = ['ingredientes'];

const SELECT_LISTA = `
  SELECT l.*,
         (SELECT count(*)::int FROM ingredientes i WHERE i.lista_id = l.id) AS total_items,
         (SELECT count(*)::int FROM importaciones im
           WHERE im.lista_id = l.id AND im.estado IN ('pendiente', 'procesando'))  AS importaciones_activas
  FROM listas l`;

function validarNombre(nombre) {
  const limpio = String(nombre ?? '').trim();
  if (!limpio) throw new HttpError(400, 'La lista necesita un nombre');
  if (limpio.length > 120) throw new HttpError(400, 'El nombre de la lista no puede superar 120 caracteres');
  return limpio;
}

/** Envuelve el error de nombre duplicado con un mensaje claro. */
async function conNombreUnico(fn, nombre) {
  try {
    return await fn();
  } catch (err) {
    if (err.code === '23505') throw new HttpError(409, `Ya existe una lista llamada "${nombre}"`);
    throw err;
  }
}

export async function listar({ tipo } = {}) {
  const { rows } = await query(`${SELECT_LISTA} WHERE $1::text IS NULL OR l.tipo = $1 ORDER BY l.nombre`, [tipo ?? null]);
  return rows;
}

export async function obtener(id, db = { query }) {
  const { rows: [lista] } = await db.query(`${SELECT_LISTA} WHERE l.id = $1`, [id]);
  if (!lista) throw new HttpError(404, 'Lista no encontrada');
  return lista;
}

/** db permite crearla dentro de una transacción ajena (ver importaciones.service). */
export async function crear({ tipo = 'ingredientes', nombre, descripcion = null }, db = { query }) {
  if (!TIPOS_LISTA.includes(tipo)) throw new HttpError(400, `Tipo de lista no soportado: ${tipo}`);
  const limpio = validarNombre(nombre);
  return conNombreUnico(async () => {
    const { rows: [lista] } = await db.query(
      'INSERT INTO listas (tipo, nombre, descripcion) VALUES ($1, $2, $3) RETURNING *',
      [tipo, limpio, descripcion],
    );
    return { ...lista, total_items: 0, importaciones_activas: 0 };
  }, limpio);
}

export async function actualizar(id, { nombre, descripcion }) {
  const limpio = nombre === undefined ? null : validarNombre(nombre);
  await conNombreUnico(async () => {
    const { rowCount } = await query(
      `UPDATE listas SET nombre = COALESCE($2, nombre),
              descripcion = CASE WHEN $3 THEN $4 ELSE descripcion END,
              actualizado_en = now()
       WHERE id = $1`,
      [id, limpio, descripcion !== undefined, descripcion ?? null],
    );
    if (!rowCount) throw new HttpError(404, 'Lista no encontrada');
  }, limpio);
  return obtener(id);
}

/**
 * Borra la lista y TODOS sus ingredientes (ON DELETE CASCADE).
 * Si hay una importación procesándose, Postgres espera a que termine antes de borrar.
 * Las importaciones pendientes de esta lista fallarán con un mensaje claro.
 */
export async function eliminar(id) {
  const { rows: [r] } = await query(
    `WITH conteo AS (SELECT count(*)::int AS n FROM ingredientes WHERE lista_id = $1)
     DELETE FROM listas WHERE id = $1 RETURNING nombre, (SELECT n FROM conteo) AS ingredientes_eliminados`,
    [id],
  );
  if (!r) throw new HttpError(404, 'Lista no encontrada');
  return r;
}
