import { HttpError } from './HttpError.js';

/** Convierte un parámetro a entero positivo o lanza 400. Vacío -> null si opcional. */
export function aId(valor, nombre = 'id', { opcional = false } = {}) {
  if ((valor === undefined || valor === null || valor === '') && opcional) return null;
  const n = Number(valor);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, `"${nombre}" debe ser un número entero positivo`);
  return n;
}

/** Texto recortado o null. */
export const aTexto = (valor) => {
  const t = valor === undefined || valor === null ? '' : String(valor).trim();
  return t || null;
};
