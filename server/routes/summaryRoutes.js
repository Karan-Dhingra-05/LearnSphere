import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { getSummary, createSummary, regenerateSummary } from '../controllers/summaryController.js';

const router = express.Router();

router.get('/:documentId', protect, getSummary);
router.post('/:documentId', protect, createSummary);
router.post('/:documentId/regenerate', protect, regenerateSummary);

export default router;
