import { query, withTransaction } from '../db/pool.js';
import { HttpError } from '../utils/HttpError.js';

export const TIEMPOS = ['desayuno', 'almuerzo', 'once', 'cena'];

function validarMenu({ nombre, dias }) {
  if (nombre !== undefined && !String(nombre).trim()) throw new HttpError(400, 'El nombre no puede estar vacío');
  if (dias !== undefined && ![5, 7].includes(Number(dias))) throw new HttpError(400, '"dias" debe ser 5 o 7');
}

function validarItems(items) {
  if (!Array.isArray(items)) throw new HttpError(400, '"items" debe ser un arreglo');
  for (const it of items) {
    if (!Number.isInteger(it.dia) || it.dia < 0 || it.dia > 6) throw new HttpError(400, 'dia inválido', it);
    if (!TIEMPOS.includes(it.tiempo)) throw new HttpError(400, 'tiempo inválido', it);
    if (!Number.isInteger(it.receta_id)) throw new HttpError(400, 'receta_id inválido', it);
  }
}

export async function listar() {
  const { rows } = await query('SELECT * FROM menus ORDER BY actualizado_en DESC');
  return rows;
}

export async function obtener(id) {
  const { rows: [menu] } = await query('SELECT * FROM menus WHERE id = $1', [id]);
  if (!menu) throw new HttpError(404, 'Menú no encontrado');
  const { rows: items } = await query(
    `SELECT mi.dia, mi.tiempo, mi.receta_id, r.nombre AS receta_nombre
     FROM menu_items mi JOIN recetas r ON r.id = mi.receta_id
     WHERE mi.menu_id = $1 ORDER BY mi.dia`,
    [id],
  );
  return { ...menu, items };
}

export async function crear({ nombre = 'Menú semanal', dias = 5 }) {
  validarMenu({ nombre, dias });
  const { rows: [menu] } = await query(
    'INSERT INTO menus (nombre, dias) VALUES ($1, $2) RETURNING *',
    [String(nombre).trim(), Number(dias)],
  );
  return { ...menu, items: [] };
}

/** Actualiza nombre/días y reemplaza el set completo de items del menú. */
export async function actualizar(id, { nombre, dias, items = [] }) {
  validarMenu({ nombre, dias });
  validarItems(items);
  await withTransaction(async (db) => {
    const { rowCount } = await db.query(
      `UPDATE menus SET nombre = COALESCE($2, nombre), dias = COALESCE($3, dias), actualizado_en = now()
       WHERE id = $1`,
      [id, nombre ?? null, dias ?? null],
    );
    if (!rowCount) throw new HttpError(404, 'Menú no encontrado');
    await db.query('DELETE FROM menu_items WHERE menu_id = $1', [id]);
    for (const it of items) {
      await db.query(
        'INSERT INTO menu_items (menu_id, dia, tiempo, receta_id) VALUES ($1, $2, $3, $4)',
        [id, it.dia, it.tiempo, it.receta_id],
      );
    }
  });
  return obtener(id);
}

export async function eliminar(id) {
  const { rowCount } = await query('DELETE FROM menus WHERE id = $1', [id]);
  if (!rowCount) throw new HttpError(404, 'Menú no encontrado');
}
