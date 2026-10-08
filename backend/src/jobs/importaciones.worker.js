// Worker de importaciones: toma trabajos pendientes de la tabla "importaciones" y los procesa.
//
// Escalable: se pueden levantar varios workers a la vez (docker compose up --scale worker=3).
// "FOR UPDATE SKIP LOCKED" garantiza que cada trabajo lo tome un solo worker. Listas distintas
// se procesan en paralelo; las importaciones de una MISMA lista se procesan en orden de llegada.
//
// Tolerante a fallos: mientras procesa, el worker actualiza "latido_en". Si un worker se cae,
// su trabajo queda sin latido y otro lo retoma tras WORKER_TIMEOUT_MIN minutos.
import os from 'node:os';
import { query } from '../db/pool.js';
import { env } from '../config/env.js';
import { HttpError } from '../utils/HttpError.js';
import { procesarImportacion } from '../services/importaciones.procesador.js';

const { intervaloMs, maxIntentos, timeoutMin } = env.worker;
const ID_WORKER = `${os.hostname()}:${process.pid}`;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...args) => console.log(`[worker ${ID_WORKER}]`, ...args);

let activo = false;
let cicloActual = null;

/** Toma el trabajo más antiguo disponible: pendiente, o "procesando" abandonado por un worker caído. */
async function tomarTrabajo() {
  const { rows: [trabajo] } = await query(
    `UPDATE importaciones SET estado = 'procesando', intentos = intentos + 1,
            iniciado_en = now(), latido_en = now(), procesadas = 0
     WHERE id = (
       SELECT i.id FROM importaciones i
       WHERE (i.estado = 'pendiente'
              OR (i.estado = 'procesando' AND i.latido_en < now() - $1 * interval '1 minute' AND i.intentos < $2))
         -- Orden por destino: no se toma un trabajo si hay uno anterior del mismo tipo y lista
         -- aún sin terminar. Así el último Excel subido es siempre el que queda.
         AND NOT EXISTS (
           SELECT 1 FROM importaciones previo
           WHERE previo.tipo = i.tipo
             AND previo.lista_id IS NOT DISTINCT FROM i.lista_id
             AND previo.id < i.id
             AND previo.estado IN ('pendiente', 'procesando'))
       ORDER BY i.id
       FOR UPDATE SKIP LOCKED
       LIMIT 1
     )
     RETURNING id, tipo, modo, lista_id, nombre_archivo, archivo, intentos`,
    [timeoutMin, maxIntentos],
  );
  return trabajo ?? null;
}

/** Trabajos abandonados que ya agotaron sus intentos pasan a fallida. */
async function cerrarAbandonados() {
  await query(
    `UPDATE importaciones
     SET estado = 'fallida', finalizado_en = now(),
         error = 'El procesamiento se interrumpió demasiadas veces (posible archivo demasiado grande o worker caído)'
     WHERE estado = 'procesando' AND latido_en < now() - $1 * interval '1 minute' AND intentos >= $2`,
    [timeoutMin, maxIntentos],
  );
}

async function ejecutar(trabajo) {
  const inicio = Date.now();
  log(`procesando importación #${trabajo.id} (${trabajo.tipo}, ${trabajo.nombre_archivo}, intento ${trabajo.intentos})`);
  // Latido periódico por si la lectura del archivo tarda (no hay lotes que lo actualicen)
  const latido = setInterval(() => {
    query('UPDATE importaciones SET latido_en = now() WHERE id = $1', [trabajo.id]).catch(() => {});
  }, 30_000);

  try {
    const { guardadas, eliminadas } = await procesarImportacion(trabajo);
    log(`importación #${trabajo.id} completada: ${guardadas} guardadas, ${eliminadas} eliminadas (${Date.now() - inicio} ms)`);
  } catch (err) {
    // HttpError = problema del archivo o de los datos: reintentar no sirve.
    // Otro error (BD caída, etc.): se reintenta hasta maxIntentos.
    const esDelArchivo = err instanceof HttpError;
    const reintentar = !esDelArchivo && trabajo.intentos < maxIntentos;
    await query(
      `UPDATE importaciones
       SET estado = $2, error = $3, error_detalle = $4,
           finalizado_en = CASE WHEN $2 = 'fallida' THEN now() END
       WHERE id = $1`,
      [trabajo.id, reintentar ? 'pendiente' : 'fallida', err.message,
        err.details ? JSON.stringify(err.details) : null],
    );
    if (esDelArchivo) log(`importación #${trabajo.id} rechazada: ${err.message}`);
    else console.error(`[worker ${ID_WORKER}] error en importación #${trabajo.id}${reintentar ? ' (se reintentará)' : ''}:`, err);
  } finally {
    clearInterval(latido);
  }
}

async function bucle() {
  while (activo) {
    try {
      await cerrarAbandonados();
      const trabajo = await tomarTrabajo();
      if (trabajo) {
        await ejecutar(trabajo);
        continue; // puede haber más en cola: no esperar
      }
    } catch (err) {
      console.error(`[worker ${ID_WORKER}] error en el ciclo:`, err.message);
    }
    await esperar(intervaloMs);
  }
}

export function iniciarWorker() {
  if (activo) return cicloActual;
  activo = true;
  log(`iniciado (intervalo ${intervaloMs} ms, lote ${env.worker.tamanoLote} filas)`);
  cicloActual = bucle();
  return cicloActual;
}

/** Detiene el ciclo después de terminar el trabajo en curso. */
export async function detenerWorker() {
  activo = false;
  await cicloActual;
  log('detenido');
}
