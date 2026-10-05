import { Router } from 'express';
import { uploadExcel } from '../middlewares/upload.js';
import * as ctrl from '../controllers/importaciones.controller.js';

const router = Router();
router.get('/', ctrl.listar);
router.get('/:id', ctrl.obtener);
router.post('/preview', uploadExcel, ctrl.previsualizar); // solo lee, no guarda
router.post('/', uploadExcel, ctrl.importar);              // transforma y guarda en BD
export default router;
