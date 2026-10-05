import * as service from '../services/importaciones.service.js';
import { HttpError } from '../utils/HttpError.js';

function archivoRequerido(req) {
  if (!req.file) throw new HttpError(400, 'Adjunta un archivo en el campo "archivo"');
  return req.file;
}

export function previsualizar(req, res) {
  res.json(service.previsualizar(archivoRequerido(req).buffer));
}

export async function importar(req, res) {
  const archivo = archivoRequerido(req);
  const resultado = await service.importar({
    buffer: archivo.buffer,
    nombreArchivo: archivo.originalname,
    tipo: req.body.tipo,
  });
  res.status(201).json(resultado);
}

export async function listar(req, res) {
  res.json(await service.listar());
}

export async function obtener(req, res) {
  res.json(await service.obtener(Number(req.params.id)));
}
