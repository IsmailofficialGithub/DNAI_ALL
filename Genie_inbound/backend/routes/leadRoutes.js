import express from 'express';
import * as leadController from '../controllers/leadController.js';

const router = express.Router();

router.get('/leads', leadController.getLeads);

export default router;
