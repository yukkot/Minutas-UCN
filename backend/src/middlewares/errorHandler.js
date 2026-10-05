import multer from 'multer';
import { HttpError } from '../utils/HttpError.js';

export function notFound(req, res) {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: `Error al subir el archivo: ${err.message}` });
  }
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
}
