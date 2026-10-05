// Convierte un Excel en un arreglo de objetos JSON con claves normalizadas.
// Ej: "Proteínas (g)" -> "proteinas_g"
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
  // "12,5" -> 12.5  (TODO: definir formato de miles si el Excel los trae)
  if (/^-?\d+([.,]\d+)?$/.test(t)) return Number(t.replace(',', '.'));
  return t;
}

export function leerExcel(buffer) {
  const libro = XLSX.read(buffer, { type: 'buffer' });
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
