import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { getFavorites } from '../controllers/favoritesController.js';

const router = express.Router();

router.get('/', protect, getFavorites);

export default router;
