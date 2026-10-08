// Registro de formatos de importación por tipo de datos.
// Para agregar un formato: crear su definición (como alimentos.js) y registrarla aquí.
import { FORMATO_ALIMENTOS } from './alimentos.js';
import { leerFormato, describirFormato } from './motor.js';

export const FORMATOS = {
  ingredientes: FORMATO_ALIMENTOS,
  // recetas: FORMATO_RECETAS,   <- cuando exista el Excel oficial de recetas
};

export const tieneFormato = (tipo) => Boolean(FORMATOS[tipo]);
export const leerSegunFormato = (tipo, buffer) => leerFormato(buffer, FORMATOS[tipo]);
export const describirFormatos = () =>
  Object.fromEntries(Object.entries(FORMATOS).map(([tipo, def]) => [tipo, describirFormato(def)]));
