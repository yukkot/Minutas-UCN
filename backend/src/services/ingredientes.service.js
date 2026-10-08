import { query } from '../db/pool.js';

const MAX_POR_PAGINA = 500;

/**
 * Lista ingredientes paginados.
 * @param {{ listaId?: number, q?: string, pagina?: number, porPagina?: number }} filtros
 * @returns {{ total, pagina, por_pagina, items }}
 */
export async function listar({ listaId = null, q = null, pagina = 1, porPagina = 50 } = {}) {
  const por = Math.min(Math.max(Number(porPagina) || 50, 1), MAX_POR_PAGINA);
  const pag = Math.max(Number(pagina) || 1, 1);

  // Búsqueda por nombre o fuente (parcial) o por código (exacto)
  const where = `($1::int IS NULL OR i.lista_id = $1)
    AND ($2::text IS NULL OR i.nombre ILIKE '%' || $2 || '%' OR i.fuente ILIKE '%' || $2 || '%' OR i.codigo::text = $2)`;
  const params = [listaId, q || null];

  const [{ rows: [{ total }] }, { rows: items }] = await Promise.all([
    query(`SELECT count(*)::int AS total FROM ingredientes i WHERE ${where}`, params),
    query(
      `SELECT i.id, i.lista_id, l.nombre AS lista_nombre, i.codigo, i.nombre, i.fuente, i.porcion_g,
              i.nutrientes, i.importacion_id, i.actualizado_en
       FROM ingredientes i JOIN listas l ON l.id = i.lista_id
       WHERE ${where}
       ORDER BY i.nombre, l.nombre, i.id
       LIMIT $3 OFFSET $4`,
      [...params, por, (pag - 1) * por],
    ),
  ]);

  return { total, pagina: pag, por_pagina: por, items };
}
