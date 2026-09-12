import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { aiGenerationLimiter } from '../middleware/rateLimiter.js';
import { getSummary, createSummary, regenerateSummary } from '../controllers/summaryController.js';

const router = express.Router();

router.get('/:documentId', protect, getSummary);
router.post('/:documentId', protect, aiGenerationLimiter, createSummary);
router.post('/:documentId/regenerate', protect, aiGenerationLimiter, regenerateSummary);

export default router;
