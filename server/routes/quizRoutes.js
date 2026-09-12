import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  getQuiz,
  createQuiz,
  regenerateQuiz,
  submitQuiz,
} from '../controllers/quizController.js';

const router = express.Router();

router.get('/:documentId',             protect, getQuiz);
router.post('/:documentId',            protect, createQuiz);
router.post('/:documentId/regenerate', protect, regenerateQuiz);
router.post('/:documentId/submit',     protect, submitQuiz);

export default router;
