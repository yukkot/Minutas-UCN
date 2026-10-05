import 'dotenv/config';

export const env = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL,
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB ?? 10),
};

if (!env.databaseUrl) {
  throw new Error('Falta DATABASE_URL. Copia .env.example a .env y revisa los valores.');
}
