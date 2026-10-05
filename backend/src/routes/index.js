import { Router } from 'express';
import { query } from '../db/pool.js';
import importacionesRoutes from './importaciones.routes.js';
import { ingredientesRoutes, recetasRoutes } from './catalogo.routes.js';
import menusRoutes from './menus.routes.js';

const router = Router();

router.get('/health', async (req, res) => {
  await query('SELECT 1');
  res.json({ ok: true });
});

router.use('/importaciones', importacionesRoutes);
router.use('/ingredientes', ingredientesRoutes);
router.use('/recetas', recetasRoutes);
router.use('/menus', menusRoutes);

export default router;
