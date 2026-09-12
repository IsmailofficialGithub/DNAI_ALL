import express from 'express';
import * as callController from '../controllers/callController.js';

const router = express.Router();

router.post('/calls/analyze', callController.analyzeCall);

export default router;
