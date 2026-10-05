import { Router } from 'express';
import * as ctrl from '../controllers/menus.controller.js';

const router = Router();
router.get('/', ctrl.listar);
router.post('/', ctrl.crear);
router.get('/:id', ctrl.obtener);
router.put('/:id', ctrl.actualizar);
router.delete('/:id', ctrl.eliminar);
export default router;
