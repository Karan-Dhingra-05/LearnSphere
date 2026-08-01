import asyncHandler from 'express-async-handler';
import Document from '../models/Document.js';
import FlashcardSet from '../models/FlashcardSet.js';
import Quiz from '../models/Quiz.js';

// @desc    Get dashboard statistics and recent documents
// @route   GET /api/dashboard
// @access  Private
const getDashboard = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const [totalDocuments, totalFlashcardSets, totalQuizzes, recentDocuments, quizzes] =
    await Promise.all([
      Document.countDocuments({ userId }),
      FlashcardSet.countDocuments({ userId }),
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

  res.json({
    stats: {
      totalDocuments,
      totalFlashcardSets,
      totalQuizzes,
      avgScore,
    },
    recentDocuments,
  });
});

export { getDashboard };
