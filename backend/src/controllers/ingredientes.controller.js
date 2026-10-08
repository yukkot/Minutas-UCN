import * as service from '../services/ingredientes.service.js';
import { NUTRIENTES } from '../formatos/alimentos.js';
import { aId, aTexto } from '../utils/params.js';

export async function listar(req, res) {
  res.json(await service.listar({
    listaId: aId(req.query.lista_id, 'lista_id', { opcional: true }),
    q: aTexto(req.query.q),
    pagina: req.query.pagina,
    porPagina: req.query.por_pagina,
  }));
}

/** Catálogo de nutrientes (clave, etiqueta, unidad, obligatorio) en el orden del Excel. */
export function nutrientes(req, res) {
  res.json(NUTRIENTES);
}
