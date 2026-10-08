// Punto de entrada del worker como proceso independiente (servicio "worker" en Docker).
import { iniciarWorker, detenerWorker } from './jobs/importaciones.worker.js';
import { pool } from './db/pool.js';

iniciarWorker();

for (const senal of ['SIGINT', 'SIGTERM']) {
  process.on(senal, async () => {
    await detenerWorker(); // termina el trabajo en curso antes de salir
    await pool.end();
    process.exit(0);
  });
}
