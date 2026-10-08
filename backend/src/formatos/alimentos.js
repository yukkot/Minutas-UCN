// Definición del "formato de alimentos" (tabla de composición de alimentos).
//
//   Fila 1  -> encabezados (CODIGO, Tabla comp, Cantidad gramos, Calorias, ...)
//   Fila 2  -> numeración de columnas 1 ... 40 (sirve para reconocer la hoja)
//   Fila 3+ -> un alimento por fila
//
// Las columnas se leen por POSICIÓN. El texto del encabezado solo se compara para
// avisar si parece que las columnas están corridas.
//
// Para hacer obligatorio (u opcional) un campo basta con cambiar "obligatorio".
// Si se cambia la obligatoriedad de un nutriente, actualizar también el CHECK
// "ingredientes_nutrientes_basicos" con una migración nueva.
import { leerFormato, describirFormato } from './motor.js';

const nutriente = (n, clave, etiqueta, encabezado, unidad, obligatorio = false) => ({
  n, clave, etiqueta, encabezado, unidad, obligatorio, tipo: 'numero', min: 0, grupo: 'nutrientes',
});

export const FORMATO_ALIMENTOS = {
  id: 'alimentos',
  version: 1,
  descripcion: 'Tabla de composición de alimentos',
  filas: { encabezados: 1, numeracion: 2, datos: 3 },
  claveUnica: 'codigo',
  columnas: [
    // ---- Identificación ---------------------------------------------------------------
    { n: 1, clave: 'codigo', etiqueta: 'Código', encabezado: 'CODIGO', tipo: 'entero', min: 1, obligatorio: true },
    { n: 2, clave: 'fuente', etiqueta: 'Tabla de composición', encabezado: 'Tabla comp', tipo: 'texto', obligatorio: true },
    { n: 3, clave: 'nombre', etiqueta: 'Nombre', tipo: 'texto', obligatorio: true }, // columna sin encabezado
    { n: 4, clave: 'porcion_g', etiqueta: 'Cantidad', encabezado: 'Cantidad gramos', tipo: 'numero', unidad: 'g', min: 0.000001, obligatorio: true },

    // ---- Macronutrientes básicos (obligatorios) ------------------------------------------
    nutriente(5, 'energia', 'Calorías', 'Calorias', 'kcal', true),
    nutriente(6, 'proteinas', 'Proteínas', 'Proteinas g', 'g', true),
    nutriente(7, 'hidratos_carbono', 'Hidratos de carbono', 'Hidratos g', 'g', true),
    nutriente(10, 'lipidos', 'Lípidos', 'Lipidos g', 'g', true),

    // ---- Resto de la composición (opcionales) --------------------------------------------
    nutriente(8, 'azucares_totales', 'Azúcares totales', 'Azucares Totales', 'g'),
    nutriente(9, 'fibra_dietaria', 'Fibra dietaria', 'Fibra Dietaria g', 'g'),
    nutriente(11, 'ag_saturados', 'Saturados', 'Saturados g', 'g'),
    nutriente(12, 'ag_monoinsaturados', 'Monoinsaturados', 'Monoinsat g', 'g'),
    nutriente(13, 'ag_poliinsaturados', 'Poliinsaturados', 'Poliinsat g', 'g'),
    nutriente(14, 'ag_trans', 'Ácidos grasos trans', 'acidos grasos trans', 'g'),
    nutriente(15, 'colesterol', 'Colesterol', 'Colesterol mg', 'mg'),
    nutriente(16, 'omega_6', 'Omega 6', 'omega 6 g', 'g'),
    nutriente(17, 'omega_3', 'Omega 3', 'omega 3 g', 'g'),
    nutriente(18, 'caroteno', 'Caroteno', 'Caroteno ER', 'ER'),
    nutriente(19, 'retinol', 'Retinol', 'Retinol ER', 'ER'),
    nutriente(20, 'vitamina_a', 'Vitamina A', 'Vitamina A ER', 'ER'),
    nutriente(21, 'vitamina_c', 'Vitamina C', 'Vit C mg', 'mg'),
    nutriente(22, 'vitamina_d', 'Vitamina D', 'Vit D', null),
    nutriente(23, 'vitamina_e', 'Vitamina E', 'Vit E mg', 'mg'),
    nutriente(24, 'vitamina_k', 'Vitamina K', 'Vit K', null),
    nutriente(25, 'vitamina_b1', 'Vitamina B1', 'Vit.B1 mg', 'mg'),
    nutriente(26, 'vitamina_b2', 'Vitamina B2', 'Vit B2 mg', 'mg'),
    nutriente(27, 'niacina', 'Niacina', 'Niacina mg', 'mg'),
    nutriente(28, 'vitamina_b6', 'Vitamina B6', 'Vit B6 mg', 'mg'),
    nutriente(29, 'ac_pantotenico', 'Ác. pantoténico', 'Pantoténico mg', 'mg'),
    nutriente(30, 'vitamina_b12', 'Vitamina B12', 'Vit B12 mg', 'mg'),
    nutriente(31, 'folatos', 'Folatos', 'Folatos mcg', 'mcg'),
    nutriente(32, 'sodio', 'Sodio', 'Sodio mg', 'mg'),
    nutriente(33, 'potasio', 'Potasio', 'Potasio mg', 'mg'),
    nutriente(34, 'calcio', 'Calcio', 'Calcio mg', 'mg'),
    nutriente(35, 'fosforo', 'Fósforo', 'Fosforo mg', 'mg'),
    nutriente(36, 'magnesio', 'Magnesio', 'Magnesio mg', 'mg'),
    nutriente(37, 'hierro', 'Hierro', 'Hierro mg', 'mg'),
    nutriente(38, 'zinc', 'Zinc', 'Zinc mg', 'mg'),
    nutriente(39, 'cobre', 'Cobre', 'Cobre mg', 'mg'),
    nutriente(40, 'selenio', 'Selenio', 'Selenio mcg', 'mcg'),
  ],
};

/** Nutrientes en el orden de las columnas del Excel (para tablas del frontend). */
export const NUTRIENTES = FORMATO_ALIMENTOS.columnas
  .filter((c) => c.grupo === 'nutrientes')
  .sort((a, b) => a.n - b.n)
  .map(({ n, clave, etiqueta, unidad, obligatorio }) => ({ n, clave, etiqueta, unidad, obligatorio }));

/**
 * @param {Buffer} buffer
 * @returns {{ hoja, formato, columnas, filas, avisos, omitidas }}
 *   filas: [{ codigo, fuente, nombre, porcion_g, nutrientes: { energia, proteinas, ... } }]
 */
export const leerAlimentos = (buffer) => leerFormato(buffer, FORMATO_ALIMENTOS);

export const describirAlimentos = () => describirFormato(FORMATO_ALIMENTOS);
