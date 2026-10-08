import { app } from './app.js';
import { env } from './config/env.js';
import { iniciarWorker, detenerWorker } from './jobs/importaciones.worker.js';

const servidor = app.listen(env.port, () => {
  console.log(`API escuchando en http://localhost:${env.port}/api`);
});

// En desarrollo la API también procesa importaciones (EJECUTAR_WORKER=true en .env)
if (env.worker.enApi) iniciarWorker();

for (const senal of ['SIGINT', 'SIGTERM']) {
  process.on(senal, async () => {
    servidor.close();
    if (env.worker.enApi) await detenerWorker();
    process.exit(0);
  });
}
