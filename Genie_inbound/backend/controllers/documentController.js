import { extractTextFromFile } from '../services/documentExtractor.js';

export const extractDocument = async (req, res, next) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });

        const allowedTypes = [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/msword',
            'text/plain'
        ];

        if (!allowedTypes.includes(req.file.mimetype)) {
            return res.status(400).json({
                success: false,
                error: `Unsupported file type: ${req.file.mimetype}. Supported types: PDF, DOCX, TXT`
            });
        }

        const extractedText = await extractTextFromFile(req.file.buffer, req.file.mimetype);

        res.json({
            success: true,
            extractedText,
            fileName: req.file.originalname,
            fileType: req.file.mimetype,
            fileSize: req.file.size
        });
    } catch (error) {
        next(error);
    }
};
