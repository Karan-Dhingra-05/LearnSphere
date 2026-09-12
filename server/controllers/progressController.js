import asyncHandler from 'express-async-handler';
import Document from '../models/Document.js';
import FlashcardSet from '../models/FlashcardSet.js';
import Quiz from '../models/Quiz.js';

// @desc    Get per-document learning progress (flashcard + quiz stats)
// @route   GET /api/progress
// @access  Private
const getProgress = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // Plain finds + in-JS grouping — simplest option at this scale, no
  // aggregation pipeline needed.
  const [documents, flashcardSets, attempts] = await Promise.all([
    Document.find({ userId }).select('title createdAt').sort({ createdAt: -1 }),
    FlashcardSet.find({ userId }).select('documentId flashcards'),
    Quiz.find({ userId }).select('documentId score totalQuestions createdAt'),
  ]);

  const flashcardSetByDoc = new Map(
    flashcardSets.map((set) => [set.documentId.toString(), set])
  );

  const attemptsByDoc = new Map();
  for (const attempt of attempts) {
    const key = attempt.documentId.toString();
    if (!attemptsByDoc.has(key)) attemptsByDoc.set(key, []);
    attemptsByDoc.get(key).push(attempt);
  }

  const progress = documents.map((doc) => {
    const docId = doc._id.toString();

    // Flashcards — a current snapshot only (reviewed/favorite are booleans,
    // not a history), null when no set has been generated for this document.
    const set = flashcardSetByDoc.get(docId);
    const flashcards = set
      ? {
          reviewed: set.flashcards.filter((c) => c.reviewed).length,
          total: set.flashcards.length,
          favorites: set.flashcards.filter((c) => c.favorite).length,
        }
      : null;

    // Quiz — derived from this document's attempt history.
    const docAttempts = attemptsByDoc.get(docId) || [];
    const scorePcts = docAttempts.map((a) =>
      a.totalQuestions > 0 ? (a.score / a.totalQuestions) * 100 : 0
    );
    const quiz = {
      attempts: docAttempts.length,
      averageScorePct: scorePcts.length
        ? Math.round(scorePcts.reduce((sum, p) => sum + p, 0) / scorePcts.length)
        : null,
      bestScorePct: scorePcts.length ? Math.round(Math.max(...scorePcts)) : null,
      lastAttemptAt: docAttempts.length
        ? docAttempts.reduce(
            (latest, a) => (a.createdAt > latest ? a.createdAt : latest),
            docAttempts[0].createdAt
          )
        : null,
    };

    return {
      documentId: docId,
      title: doc.title,
      flashcards,
      quiz,
    };
  });

  res.json({ documents: progress });
});

export { getProgress };
