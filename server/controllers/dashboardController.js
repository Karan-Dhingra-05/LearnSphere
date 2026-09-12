import asyncHandler from 'express-async-handler';
import Document from '../models/Document.js';
import FlashcardSet from '../models/FlashcardSet.js';
import Quiz from '../models/Quiz.js';

// @desc    Get dashboard statistics and recent documents
// @route   GET /api/dashboard
// @access  Private
const getDashboard = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const [totalDocuments, flashcardSets, totalQuizzes, recentDocuments, quizzes] =
    await Promise.all([
      Document.countDocuments({ userId }),
      FlashcardSet.find({ userId }).select('flashcards'),
      Quiz.countDocuments({ userId }),
      Document.find({ userId })
        .select('-extractedText')
        .sort({ createdAt: -1 })
        .limit(5),
      Quiz.find({ userId }).select('score totalQuestions'),
    ]);

  const avgScore =
    quizzes.length > 0
      ? Math.round(
          quizzes.reduce(
            (acc, q) => acc + (q.totalQuestions > 0 ? (q.score / q.totalQuestions) * 100 : 0),
            0
          ) / quizzes.length
        )
      : 0;

  // Reviewed/favorite are simple booleans on each flashcard — sum them
  // across every set the user owns for a global snapshot count.
  const allFlashcards = flashcardSets.flatMap((set) => set.flashcards);
  const reviewedFlashcards = allFlashcards.filter((c) => c.reviewed).length;
  const favoriteFlashcards = allFlashcards.filter((c) => c.favorite).length;

  res.json({
    stats: {
      totalDocuments,
      totalFlashcardSets: flashcardSets.length,
      totalQuizzes,
      avgScore,
      reviewedFlashcards,
      favoriteFlashcards,
    },
    recentDocuments,
  });
});

export { getDashboard };
