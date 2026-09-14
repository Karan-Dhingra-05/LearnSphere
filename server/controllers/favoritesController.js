import asyncHandler from 'express-async-handler';
import FlashcardSet from '../models/FlashcardSet.js';

// @desc    Get every favorited flashcard across all of the user's documents
// @route   GET /api/favorites
// @access  Private
const getFavorites = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const sets = await FlashcardSet.find({ userId }).select('documentId title flashcards');

  const favorites = sets.flatMap((set) =>
    set.flashcards
      .filter((card) => card.favorite)
      .map((card) => ({
        cardId: card._id,
        documentId: set.documentId,
        documentTitle: set.title,
        question: card.question,
        answer: card.answer,
        difficulty: card.difficulty,
      }))
  );

  res.json({ favorites });
});

export { getFavorites };
