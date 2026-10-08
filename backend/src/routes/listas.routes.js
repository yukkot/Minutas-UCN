import { Router } from 'express';
import * as ctrl from '../controllers/listas.controller.js';

const router = Router();
router.get('/', ctrl.listar);          // ?tipo=ingredientes
router.post('/', ctrl.crear);          // { nombre, descripcion?, tipo? }
router.get('/:id', ctrl.obtener);
router.patch('/:id', ctrl.actualizar); // { nombre?, descripcion? }
router.delete('/:id', ctrl.eliminar);  // borra la lista y todos sus ingredientes
export default router;
