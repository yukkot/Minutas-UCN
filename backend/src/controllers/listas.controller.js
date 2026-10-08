import * as service from '../services/listas.service.js';
import { aId } from '../utils/params.js';

export async function listar(req, res) {
  res.json(await service.listar({ tipo: req.query.tipo }));
}

export async function obtener(req, res) {
  res.json(await service.obtener(aId(req.params.id)));
}

export async function crear(req, res) {
  res.status(201).json(await service.crear(req.body ?? {}));
}

export async function actualizar(req, res) {
  res.json(await service.actualizar(aId(req.params.id), req.body ?? {}));
}

export async function eliminar(req, res) {
  res.json(await service.eliminar(aId(req.params.id)));
}
