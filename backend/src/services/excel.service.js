// Utilidades genéricas para leer archivos Excel con SheetJS.
import * as XLSX from 'xlsx';

export function normalizarClave(texto) {
  return String(texto)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizarValor(valor) {
  if (typeof valor !== 'string') return valor ?? null;
  const t = valor.trim();
  if (t === '') return null;
  // "12,5" -> 12.5
  if (/^-?\d+([.,]\d+)?$/.test(t)) return Number(t.replace(',', '.'));
  return t;
}

export const leerLibro = (buffer) => XLSX.read(buffer, { type: 'buffer' });

export const letraColumna = (indice) => XLSX.utils.encode_col(indice); // 0 -> "A"

/**
 * Devuelve la hoja como matriz de celdas, siempre desde A1 y conservando filas vacías,
 * así matriz[i][j] corresponde a la fila i+1 y la columna j (0 = A) del Excel.
 */
export function hojaComoMatriz(libro, nombreHoja) {
  const hoja = libro.Sheets[nombreHoja];
  if (!hoja?.['!ref']) return [];
  const rango = XLSX.utils.decode_range(hoja['!ref']);
  rango.s.r = 0;
  rango.s.c = 0;
  return XLSX.utils.sheet_to_json(hoja, { header: 1, defval: null, blankrows: true, raw: true, range: rango });
}

/**
 * Lectura genérica: primera hoja, fila 1 como encabezados y claves normalizadas.
 * Ej: "Proteínas (g)" -> "proteinas_g"
 */
export function leerExcel(buffer) {
  const libro = leerLibro(buffer);
  const hoja = libro.SheetNames[0];
  const crudas = XLSX.utils.sheet_to_json(libro.Sheets[hoja], { defval: null });

  const filas = crudas
    .map((fila) => Object.fromEntries(
      Object.entries(fila)
        .filter(([k]) => !k.startsWith('__EMPTY')) // columnas sin encabezado
        .map(([k, v]) => [normalizarClave(k), normalizarValor(v)]),
    ))
    .filter((fila) => Object.values(fila).some((v) => v !== null)); // filas vacías

  const columnas = [...new Set(filas.flatMap(Object.keys))];
  return { hoja, columnas, filas };
}
