/** Junta las columnas fijas con los atributos JSONB para mostrarlas en tabla. */
export function aplanar({ id, nombre, tipo, atributos }) {
  return { nombre, ...(tipo !== undefined ? { tipo } : {}), ...atributos };
}

/** Busca un valor de calorías en los atributos (hasta definir la estructura oficial). */
export function kcal(receta) {
  if (!receta) return null;
  const clave = Object.keys(receta.atributos ?? {}).find((k) => /kcal|calor|energ/i.test(k));
  const valor = clave ? Number(receta.atributos[clave]) : NaN;
  return Number.isFinite(valor) ? valor : null;
}

export const formatoFecha = (iso) =>
  new Date(iso).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
