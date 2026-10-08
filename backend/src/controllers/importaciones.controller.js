import * as service from '../services/importaciones.service.js';
import { HttpError } from '../utils/HttpError.js';
import { aId, aTexto } from '../utils/params.js';

function archivoRequerido(req) {
  if (!req.file) throw new HttpError(400, 'Adjunta un archivo en el campo "archivo"');
  return req.file;
}

export function formatos(req, res) {
  res.json(service.formatos());
}

export function previsualizar(req, res) {
  res.json(service.previsualizar(archivoRequerido(req).buffer, req.body.tipo));
}

/** 202 Accepted: el archivo quedó en cola; consultar GET /:id para ver el avance. */
export async function importar(req, res) {
  const archivo = archivoRequerido(req);
  const trabajo = await service.encolar({
    buffer: archivo.buffer,
    nombreArchivo: archivo.originalname,
    tipo: req.body.tipo,
    listaId: aId(req.body.lista_id, 'lista_id', { opcional: true }),
    listaNombre: aTexto(req.body.lista_nombre),
    modo: aTexto(req.body.modo) ?? undefined,
  });
  res.status(202).location(`${req.baseUrl}/${trabajo.id}`).json(trabajo);
}

export async function listar(req, res) {
  res.json(await service.listar({
    listaId: aId(req.query.lista_id, 'lista_id', { opcional: true }),
    limite: req.query.limite,
  }));
}

export async function obtener(req, res) {
  res.json(await service.obtener(aId(req.params.id), { incluirDatos: req.query.datos === 'true' }));
}

export async function reintentar(req, res) {
  res.status(202).json(await service.reintentar(aId(req.params.id)));
}
