// Consultas de lectura para ingredientes y recetas (comparten forma de tabla).
import { query } from '../db/pool.js';

const TABLAS = ['ingredientes', 'recetas']; // lista blanca: el nombre va interpolado en el SQL

export function crearCatalogoService(tabla) {
  if (!TABLAS.includes(tabla)) throw new Error(`Tabla no permitida: ${tabla}`);

  return {
    async listar({ q } = {}) {
      const { rows } = await query(
        `SELECT * FROM ${tabla}
         WHERE $1::text IS NULL
            OR nombre ILIKE '%' || $1 || '%'
            OR atributos::text ILIKE '%' || $1 || '%'
         ORDER BY nombre`,
        [q || null],
      );
      return rows;
    },
  };
}

export const ingredientesService = crearCatalogoService('ingredientes');
export const recetasService = crearCatalogoService('recetas');
