import * as service from '../services/menus.service.js';

export async function listar(req, res) {
  res.json(await service.listar());
}

export async function obtener(req, res) {
  res.json(await service.obtener(Number(req.params.id)));
}

export async function crear(req, res) {
  res.status(201).json(await service.crear(req.body ?? {}));
}

export async function actualizar(req, res) {
  res.json(await service.actualizar(Number(req.params.id), req.body ?? {}));
}

export async function eliminar(req, res) {
  await service.eliminar(Number(req.params.id));
  res.status(204).end();
}
