import express from 'express';
import * as documentController from '../controllers/documentController.js';
import multer from 'multer';

const router = express.Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }
});

router.post('/extract-document', upload.single('file'), documentController.extractDocument);

export default router;
