import { Router } from 'express';
import { uploadExcel } from '../middlewares/upload.js';
import * as ctrl from '../controllers/importaciones.controller.js';

const router = Router();
router.get('/', ctrl.listar);                              // ?lista_id=&limite=
router.get('/formatos', ctrl.formatos);                    // definición de cada formato
router.post('/preview', uploadExcel, ctrl.previsualizar);  // lectura síncrona, no guarda
router.post('/', uploadExcel, ctrl.importar);              // encola y responde 202
router.get('/:id', ctrl.obtener);                          // estado y avance (?datos=true incluye el JSON)
router.post('/:id/reintentar', ctrl.reintentar);
export default router;
