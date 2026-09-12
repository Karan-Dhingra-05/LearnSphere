import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { aiGenerationLimiter } from '../middleware/rateLimiter.js';
import {
  getFlashcards,
  createFlashcards,
  regenerateFlashcards,
  toggleFavorite,
  markReviewed,
} from '../controllers/flashcardController.js';

const router = express.Router();

router.get('/:documentId',                              protect, getFlashcards);
router.post('/:documentId',                             protect, aiGenerationLimiter, createFlashcards);
router.post('/:documentId/regenerate',                  protect, aiGenerationLimiter, regenerateFlashcards);
router.patch('/:documentId/cards/:cardId/favorite',     protect, toggleFavorite);
router.patch('/:documentId/cards/:cardId/reviewed',     protect, markReviewed);

export default router;
