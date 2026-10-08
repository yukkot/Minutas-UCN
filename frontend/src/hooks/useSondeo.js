import { useEffect, useRef } from 'react';

/**
 * Ejecuta "fn" cada "ms" milisegundos mientras "activo" sea true.
 * Espera a que termine cada llamada antes de programar la siguiente (no se acumulan).
 */
export function useSondeo(fn, ms, activo) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!activo) return undefined;
    let cancelado = false;
    let timer;
    const ciclo = async () => {
      try { await fnRef.current(); } catch { /* el siguiente ciclo reintenta */ }
      if (!cancelado) timer = setTimeout(ciclo, ms);
    };
    timer = setTimeout(ciclo, ms);
    return () => { cancelado = true; clearTimeout(timer); };
  }, [ms, activo]);
}
