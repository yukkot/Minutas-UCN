import { query } from '../db/pool.js';

export async function listar({ q } = {}) {
  const { rows } = await query(
    `SELECT * FROM recetas
     WHERE $1::text IS NULL OR nombre ILIKE '%' || $1 || '%' OR tipo ILIKE '%' || $1 || '%'
        OR atributos::text ILIKE '%' || $1 || '%'
     ORDER BY nombre`,
    [q || null],
  );
  return rows;
}
