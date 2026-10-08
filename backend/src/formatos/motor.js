// Motor genérico para leer Excel a partir de una DEFINICIÓN DE FORMATO declarativa.
//
// Para soportar un formato nuevo no se toca este archivo: se crea una definición
// (ver alimentos.js) y se registra en formatos/index.js.
//
// Definición:
// {
//   id, version, descripcion,
//   filas: { encabezados: 1, numeracion: 2, datos: 3 },  // números de fila del Excel
//   claveUnica: 'codigo',                                 // campo que no se puede repetir
//   columnas: [{
//     n,            // posición (1 = A); debe coincidir con la fila de numeración
//     clave,        // nombre del campo en el JSON resultante
//     etiqueta,     // nombre legible
//     encabezado,   // texto esperado en la fila de encabezados (solo para avisar si no calza)
//     tipo,         // 'entero' | 'numero' | 'texto'
//     unidad,       // opcional
//     obligatorio,  // si falta o es inválido, la fila se omite
//     min,          // valor mínimo permitido (numéricos)
//     grupo,        // si se indica, el campo va anidado: fila[grupo][clave]
//   }]
// }
import { HttpError } from '../utils/HttpError.js';
import { leerLibro, hojaComoMatriz, letraColumna, normalizarClave } from '../services/excel.service.js';

const SIN_DATO = ['', '-', '--', 's/d', 'sd', 'nd', 'n/d'];
const TRAZAS = ['tr', 'trazas'];

const texto = (celda) => (celda === null || celda === undefined ? '' : String(celda).trim());

/** Interpreta una celda según el tipo. Devuelve { valor } o { valor: null, error }. */
function interpretar(celda, col) {
  if (col.tipo === 'texto') return { valor: texto(celda) || null };

  let valor;
  if (typeof celda === 'number') {
    valor = celda;
  } else {
    const t = texto(celda).toLowerCase();
    if (SIN_DATO.includes(t)) return { valor: null };
    if (TRAZAS.includes(t)) return { valor: 0 };
    valor = Number(t.replace(/\s/g, '').replace(',', '.'));
    if (!Number.isFinite(valor)) return { valor: null, error: `no es un número ("${texto(celda)}")` };
  }
  if (col.tipo === 'entero' && !Number.isInteger(valor)) return { valor: null, error: `debe ser entero (${valor})` };
  if (col.min !== undefined && valor < col.min) return { valor: null, error: `debe ser mayor o igual a ${col.min} (${valor})` };
  return { valor };
}

/** Explica por qué una hoja no calza con la numeración esperada; null si calza. */
function diagnosticarHoja(matriz, def, total) {
  const numeracion = matriz[def.filas.numeracion - 1] ?? [];
  for (let i = 0; i < total; i++) {
    if (Number(texto(numeracion[i])) !== i + 1) {
      return `en la fila ${def.filas.numeracion}, la columna ${letraColumna(i)} debería tener ${i + 1} y tiene "${texto(numeracion[i])}"`;
    }
  }
  return null;
}

/** Compara encabezados reales con los esperados; solo genera avisos, no bloquea. */
function revisarEncabezados(matriz, def) {
  const fila = matriz[def.filas.encabezados - 1] ?? [];
  const avisos = [];
  for (const col of def.columnas) {
    if (!col.encabezado) continue;
    const real = normalizarClave(texto(fila[col.n - 1]));
    const esperado = normalizarClave(col.encabezado);
    const calza = real === esperado
      || real.includes(esperado)
      || (real.length >= 3 && esperado.includes(real))
      || (real.length >= 4 && real.slice(0, 4) === esperado.slice(0, 4));
    if (!calza) {
      avisos.push({
        fila: def.filas.encabezados,
        columna: letraColumna(col.n - 1),
        mensaje: `El encabezado dice "${texto(fila[col.n - 1])}" y se esperaba "${col.encabezado}" (${col.etiqueta}). Revisa que las columnas no estén corridas.`,
      });
    }
  }
  return avisos;
}

/**
 * Lee un Excel según la definición de formato.
 * @returns {{ hoja, formato, columnas, filas, avisos, omitidas }}
 *   avisos: [{ fila, columna?, mensaje }] con números de fila/columna del Excel
 */
export function leerFormato(buffer, def) {
  const total = Math.max(...def.columnas.map((c) => c.n));
  const libro = leerLibro(buffer);

  // 1. Buscar la hoja por su estructura (no por nombre ni posición)
  const diagnosticos = [];
  let hoja = null;
  let matriz = null;
  for (const nombre of libro.SheetNames) {
    const m = hojaComoMatriz(libro, nombre);
    const problema = diagnosticarHoja(m, def, total);
    if (!problema) { hoja = nombre; matriz = m; break; }
    diagnosticos.push({ hoja: nombre, problema });
  }
  if (!hoja) {
    throw new HttpError(
      422,
      `El archivo no tiene una hoja con el formato "${def.descripcion}": la fila ${def.filas.numeracion} debe numerar las columnas del 1 al ${total}`,
      { hojas: diagnosticos },
    );
  }

  // 2. Revisar encabezados (avisos no bloqueantes)
  const avisos = revisarEncabezados(matriz, def);

  // 3. Procesar filas de datos
  const filas = [];
  const filaDeClave = new Map();
  let omitidas = 0;

  matriz.slice(def.filas.datos - 1).forEach((celdas, i) => {
    const numFila = def.filas.datos + i;
    if (celdas.every((c) => texto(c) === '')) return; // fila vacía: se salta sin aviso

    const registro = {};
    const faltantes = [];
    const avisosFila = [];

    for (const col of def.columnas) {
      const { valor, error } = interpretar(celdas[col.n - 1], col);
      const columna = letraColumna(col.n - 1);

      if (valor === null && col.obligatorio) {
        faltantes.push(`${col.etiqueta} (${columna}${error ? `: ${error}` : ': vacío'})`);
      } else if (error) {
        avisosFila.push({ fila: numFila, columna, mensaje: `${col.etiqueta} ${error}; se guarda vacío` });
      }

      if (col.grupo) (registro[col.grupo] ??= {})[col.clave] = valor;
      else registro[col.clave] = valor;
    }

    if (faltantes.length) {
      avisos.push({ fila: numFila, mensaje: `Faltan datos obligatorios: ${faltantes.join(', ')}; fila omitida` });
      omitidas++;
      return;
    }

    const clave = registro[def.claveUnica];
    if (filaDeClave.has(clave)) {
      avisos.push({ fila: numFila, mensaje: `${def.claveUnica} ${clave} repetido (ya aparece en la fila ${filaDeClave.get(clave)}); fila omitida` });
      omitidas++;
      return;
    }
    filaDeClave.set(clave, numFila);

    avisos.push(...avisosFila);
    filas.push(registro);
  });

  return {
    hoja,
    formato: `${def.id}@${def.version}`,
    columnas: def.columnas.map((c) => c.clave),
    filas,
    avisos,
    omitidas,
  };
}

/** Resumen público de una definición (para documentar o mostrar en el frontend). */
export function describirFormato(def) {
  return {
    id: def.id,
    version: def.version,
    descripcion: def.descripcion,
    filas: def.filas,
    claveUnica: def.claveUnica,
    columnas: def.columnas.map(({ n, clave, etiqueta, tipo, unidad = null, obligatorio = false, grupo = null }) => ({
      n, columna: letraColumna(n - 1), clave, etiqueta, tipo, unidad, obligatorio, grupo,
    })),
  };
}
