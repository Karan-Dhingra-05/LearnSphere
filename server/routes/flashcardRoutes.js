import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  getFlashcards,
  createFlashcards,
  regenerateFlashcards,
  toggleFavorite,
  markReviewed,
} from '../controllers/flashcardController.js';

const router = express.Router();

router.get('/:documentId',                              protect, getFlashcards);
router.post('/:documentId',                             protect, createFlashcards);
router.post('/:documentId/regenerate',                  protect, regenerateFlashcards);
router.patch('/:documentId/cards/:cardId/favorite',     protect, toggleFavorite);
router.patch('/:documentId/cards/:cardId/reviewed',     protect, markReviewed);

export default router;
