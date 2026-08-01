import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { chat } from '../controllers/aiController.js';

const router = express.Router();

router.post('/chat', protect, chat);

export default router;
