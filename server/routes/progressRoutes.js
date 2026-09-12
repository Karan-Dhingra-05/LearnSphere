import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { getProgress } from '../controllers/progressController.js';

const router = express.Router();

router.get('/', protect, getProgress);

export default router;
