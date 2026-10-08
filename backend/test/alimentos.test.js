// Pruebas del lector del formato de alimentos. No necesitan base de datos.
// Ejecutar: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as XLSX from 'xlsx';
import { leerAlimentos } from '../src/formatos/alimentos.js';

const ENCABEZADOS = ['CODIGO', 'Tabla comp', null, 'Cantidad gramos', 'Calorias', 'Proteinas g', 'Hidratos g',
  'Azucares Totales', 'Fibra Dietaria g', 'Lipidos g', 'Saturados g', 'Monoinsat g', 'Poliinsat g',
  'acidos grasos trans', 'Colesterol mg', 'omega 6 g', 'omega 3 g', 'Caroteno ER', 'Retinol ER', 'Vitamina A ER',
  'Vit C mg', 'Vit D', 'Vit E mg', 'Vit K', 'Vit.B1 mg', 'Vit B2 mg', 'Niacina mg', 'Vit B6 mg', 'Pantoténico mg',
  'Vit B12 mg', 'Folatos mcg', 'Sodio mg', 'Potasio mg', 'Calcio mg', 'Fosforo mg', 'Magnesio mg', 'Hierro mg',
  'Zinc    mg', 'Cobre mg', 'Selenio mcg'];
const NUMERACION = Array.from({ length: 40 }, (_, i) => i + 1);

/** Fila de alimento con todo en 0 salvo lo indicado ({ n: valor }, n = número de columna). */
function alimento(codigo, fuente, nombre, valores = {}) {
  const fila = [codigo, fuente, nombre, 100, ...Array(36).fill(0)];
  for (const [n, v] of Object.entries(valores)) fila[n - 1] = v;
  return fila;
}

/** Crea un .xlsx en memoria. hojas: { nombre: matriz } */
function libro(hojas) {
  const wb = XLSX.utils.book_new();
  for (const [nombre, aoa] of Object.entries(hojas)) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), nombre);
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

test('lee el Excel de ejemplo sin avisos', async () => {
  const r = leerAlimentos(await readFile(new URL('../../docs/ejemplos/ingredientes.xlsx', import.meta.url)));
  assert.equal(r.formato, 'alimentos@1');
  assert.equal(r.filas.length, 8);
  assert.equal(r.omitidas, 0);
  assert.deepEqual(r.avisos, []);
  const aceite = r.filas[0];
  assert.equal(aceite.codigo, 1);
  assert.equal(aceite.nombre, 'ACEITE (SOJA, GIRASOL)');
  assert.equal(aceite.fuente, 'TCQA$1997');
  assert.equal(aceite.porcion_g, 100);
  assert.equal(aceite.nutrientes.energia, 897);
  assert.equal(aceite.nutrientes.vitamina_e, 93.6);
  assert.equal(aceite.nutrientes.zinc, 0.2);
});

test('encuentra la hoja aunque no sea la primera', () => {
  const r = leerAlimentos(libro({
    Notas: [['Hoja de notas']],
    Datos: [ENCABEZADOS, NUMERACION, alimento(1, 'TCA - 2018', 'ARROZ')],
  }));
  assert.equal(r.hoja, 'Datos');
  assert.equal(r.filas.length, 1);
});

test('rechaza un archivo sin la fila de numeración, indicando el problema por hoja', () => {
  assert.throws(
    () => leerAlimentos(libro({ Hoja1: [ENCABEZADOS, alimento(1, 'X', 'ARROZ')] })),
    (e) => e.status === 422 && e.details.hojas[0].hoja === 'Hoja1',
  );
});

test('omite filas con datos obligatorios faltantes y lista todos los que faltan', () => {
  const r = leerAlimentos(libro({
    Hoja1: [
      ENCABEZADOS, NUMERACION,
      alimento(1, 'TCA - 2018', 'VALIDO'),
      alimento(2, 'TCA - 2018', null),                 // sin nombre
      alimento(null, 'TCA - 2018', 'SIN CODIGO'),       // sin código
      alimento(3, '', 'SIN FUENTE'),                    // sin fuente
      alimento(4, 'TCA - 2018', 'SIN MACROS', { 5: '-', 6: 'abc' }),
      alimento(5, 'TCA - 2018', 'PORCION CERO', { 4: 0 }),
      alimento(6, 'TCA - 2018', 'CALORIAS NEGATIVAS', { 5: -10 }),
    ],
  }));
  assert.deepEqual(r.filas.map((f) => f.codigo), [1]);
  assert.equal(r.omitidas, 6);
  const fila7 = r.avisos.find((a) => a.fila === 7);
  assert.match(fila7.mensaje, /Calorías.*Proteínas/);
});

test('valores opcionales: trazas = 0, sin dato = null, texto inválido = null con aviso', () => {
  const r = leerAlimentos(libro({
    Hoja1: [ENCABEZADOS, NUMERACION, alimento(1, 'TCA - 2018', 'PRUEBA', { 15: 'tr', 21: '-', 32: 'xx', 33: '1,5' })],
  }));
  const n = r.filas[0].nutrientes;
  assert.equal(n.colesterol, 0);
  assert.equal(n.vitamina_c, null);
  assert.equal(n.sodio, null);
  assert.equal(n.potasio, 1.5);
  assert.ok(r.avisos.some((a) => a.fila === 3 && a.columna === 'AF'));
});

test('omite códigos repetidos y salta filas vacías', () => {
  const r = leerAlimentos(libro({
    Hoja1: [ENCABEZADOS, NUMERACION, alimento(1, 'X', 'A'), [], alimento(1, 'X', 'B')],
  }));
  assert.equal(r.filas.length, 1);
  assert.match(r.avisos[0].mensaje, /repetido.*fila 3/);
  assert.equal(r.avisos[0].fila, 5);
});

test('avisa si los encabezados no calzan (columnas corridas)', () => {
  const encabezados = [...ENCABEZADOS];
  encabezados[4] = 'Proteinas g'; // E dice "Proteinas" en vez de "Calorias"
  const r = leerAlimentos(libro({ Hoja1: [encabezados, NUMERACION, alimento(1, 'X', 'A')] }));
  assert.ok(r.avisos.some((a) => a.fila === 1 && a.columna === 'E'));
  assert.equal(r.filas.length, 1); // es solo un aviso, no bloquea
});
