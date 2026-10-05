import { leerExcel } from './excel.service.js';
import { query, withTransaction } from '../db/pool.js';
import { HttpError } from '../utils/HttpError.js';

const TIPOS = ['ingredientes', 'recetas'];
// Mientras no exista la estructura oficial, se detectan estas columnas por nombre.
const COLUMNAS_NOMBRE = ['nombre', 'ingrediente', 'receta', 'plato', 'preparacion'];
const COLUMNAS_TIPO_RECETA = ['tipo', 'tiempo', 'categoria'];

function validarTipo(tipo) {
  if (!TIPOS.includes(tipo)) throw new HttpError(400, `"tipo" debe ser uno de: ${TIPOS.join(', ')}`);
}

function analizar(buffer) {
  const resultado = leerExcel(buffer);
  if (!resultado.filas.length) throw new HttpError(422, 'La primera hoja del Excel está vacía');
  const colNombre = resultado.columnas.find((c) => COLUMNAS_NOMBRE.includes(c));
  if (!colNombre) {
    throw new HttpError(422, 'No se encontró una columna de nombre', {
      esperadas: COLUMNAS_NOMBRE,
      encontradas: resultado.columnas,
    });
  }
  return { ...resultado, colNombre };
}

export function previsualizar(buffer) {
  const { hoja, columnas, filas } = analizar(buffer);
  return { hoja, columnas, total_filas: filas.length, filas: filas.slice(0, 10) };
}

export async function importar({ buffer, nombreArchivo, tipo }) {
  validarTipo(tipo);
  const { hoja, columnas, filas, colNombre } = analizar(buffer);
  const colTipo = columnas.find((c) => COLUMNAS_TIPO_RECETA.includes(c));

  return withTransaction(async (db) => {
    const { rows: [imp] } = await db.query(
      `INSERT INTO importaciones (tipo, nombre_archivo, hoja, total_filas, columnas, datos)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, creado_en`,
      [tipo, nombreArchivo, hoja, filas.length, columnas, JSON.stringify(filas)],
    );

    let guardadas = 0;
    let omitidas = 0;
    // TODO: pasar a inserción masiva cuando los archivos sean grandes.
    for (const fila of filas) {
      const { [colNombre]: nombre, ...atributos } = fila;
      if (nombre === null || nombre === undefined) { omitidas++; continue; }

      if (tipo === 'ingredientes') {
        await db.query(
          `INSERT INTO ingredientes (nombre, atributos, importacion_id) VALUES ($1, $2, $3)
           ON CONFLICT (nombre) DO UPDATE
           SET atributos = EXCLUDED.atributos, importacion_id = EXCLUDED.importacion_id, actualizado_en = now()`,
          [String(nombre), JSON.stringify(atributos), imp.id],
        );
      } else {
        const tipoReceta = colTipo ? atributos[colTipo] : null;
        if (colTipo) delete atributos[colTipo];
        await db.query(
          `INSERT INTO recetas (nombre, tipo, atributos, importacion_id) VALUES ($1, $2, $3, $4)
           ON CONFLICT (nombre) DO UPDATE
           SET tipo = EXCLUDED.tipo, atributos = EXCLUDED.atributos,
               importacion_id = EXCLUDED.importacion_id, actualizado_en = now()`,
          [String(nombre), tipoReceta ? String(tipoReceta).toLowerCase() : null, JSON.stringify(atributos), imp.id],
        );
      }
      guardadas++;
    }

    return { importacion_id: imp.id, creado_en: imp.creado_en, tipo, hoja, columnas, guardadas, omitidas };
  });
}

export async function listar() {
  const { rows } = await query(
    `SELECT id, tipo, nombre_archivo, hoja, total_filas, columnas, creado_en
     FROM importaciones ORDER BY creado_en DESC LIMIT 50`,
  );
  return rows;
}

export async function obtener(id) {
  const { rows: [row] } = await query('SELECT * FROM importaciones WHERE id = $1', [id]);
  if (!row) throw new HttpError(404, 'Importación no encontrada');
  return row;
}
