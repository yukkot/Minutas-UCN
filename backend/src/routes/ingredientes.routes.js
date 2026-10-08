import { Router } from 'express';
import * as ctrl from '../controllers/ingredientes.controller.js';

const router = Router();
router.get('/', ctrl.listar);                // ?lista_id=&q=&pagina=&por_pagina=
router.get('/nutrientes', ctrl.nutrientes);
export default router;
