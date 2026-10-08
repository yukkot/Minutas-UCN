import 'dotenv/config';

const numero = (valor, porDefecto) => (valor === undefined || valor === '' ? porDefecto : Number(valor));

export const env = {
  port: numero(process.env.PORT, 3000),
  databaseUrl: process.env.DATABASE_URL,
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  maxUploadMb: numero(process.env.MAX_UPLOAD_MB, 10),

  worker: {
    // true: la API también procesa importaciones (cómodo en desarrollo).
    // En Docker va en false y el procesamiento lo hace el servicio "worker".
    // Si no se define: true en desarrollo, false en producción (NODE_ENV=production).
    enApi: process.env.EJECUTAR_WORKER
      ? process.env.EJECUTAR_WORKER === 'true'
      : process.env.NODE_ENV !== 'production',
    intervaloMs: numero(process.env.WORKER_INTERVALO_MS, 1000),  // cada cuánto busca trabajos
    maxIntentos: numero(process.env.WORKER_MAX_INTENTOS, 3),     // reintentos ante errores inesperados
    timeoutMin: numero(process.env.WORKER_TIMEOUT_MIN, 5),       // sin latido por este tiempo = worker caído
    tamanoLote: numero(process.env.WORKER_TAMANO_LOTE, 500),     // filas por INSERT
  },
};

if (!env.databaseUrl) {
  throw new Error('Falta DATABASE_URL. Copia .env.example a .env y revisa los valores.');
}
