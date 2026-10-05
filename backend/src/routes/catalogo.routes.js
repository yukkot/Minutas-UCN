import { Router } from 'express';
import { ingredientesService, recetasService } from '../services/catalogo.service.js';
import { crearCatalogoController } from '../controllers/catalogo.controller.js';

function crearRouter(service) {
  const ctrl = crearCatalogoController(service);
  const router = Router();
  router.get('/', ctrl.listar);
  return router;
}

export const ingredientesRoutes = crearRouter(ingredientesService);
export const recetasRoutes = crearRouter(recetasService);
