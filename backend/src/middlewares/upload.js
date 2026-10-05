import multer from 'multer';
import path from 'node:path';
import { env } from '../config/env.js';
import { HttpError } from '../utils/HttpError.js';

const EXTENSIONES = ['.xlsx', '.xls', '.csv'];

// En memoria: el archivo se transforma a JSON y se guarda en BD, no en disco.
export const uploadExcel = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxUploadMb * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (EXTENSIONES.includes(ext)) cb(null, true);
    else cb(new HttpError(400, `Formato no permitido (${ext}). Usa ${EXTENSIONES.join(', ')}`));
  },
}).single('archivo');
