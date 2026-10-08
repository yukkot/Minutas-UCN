import { Router } from 'express';
import * as ctrl from '../controllers/recetas.controller.js';

const router = Router();
router.get('/', ctrl.listar); // ?q=
export default router;
