import * as service from '../services/recetas.service.js';
import { aTexto } from '../utils/params.js';

export async function listar(req, res) {
  res.json(await service.listar({ q: aTexto(req.query.q) }));
}
