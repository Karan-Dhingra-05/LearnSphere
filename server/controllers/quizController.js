import asyncHandler from 'express-async-handler';
import Document from '../models/Document.js';
import QuizSet from '../models/QuizSet.js';
import Quiz from '../models/Quiz.js';
import { generateQuiz } from '../services/llmService.js';

// @desc    Get the cached quiz set for a document (or null)
// @route   GET /api/quiz/:documentId
// @access  Private
const getQuiz = asyncHandler(async (req, res) => {
  const { documentId } = req.params;

  // Verify the document belongs to this user
  const document = await Document.findOne({ _id: documentId, userId: req.user._id }).select('_id');
  if (!document) {
    res.status(404);
    throw new Error('Document not found.');
  }

  const quizSet = await QuizSet.findOne({ documentId, userId: req.user._id });
  res.json({ quizSet: quizSet || null });
});

// @desc    Generate and cache a quiz (returns cached set if it exists)
// @route   POST /api/quiz/:documentId
// @access  Private
const createQuiz = asyncHandler(async (req, res) => {
  const { documentId } = req.params;

  const document = await Document.findOne({ _id: documentId, userId: req.user._id }).select('_id title');
  if (!document) {
    res.status(404);
    throw new Error('Document not found.');
  }

  // Return the cached set if it already exists
  const existing = await QuizSet.findOne({ documentId, userId: req.user._id });
  if (existing) {
    return res.json({ quizSet: existing, cached: true });
  }

  try {
    const questions = await generateQuiz(documentId);

    const quizSet = await QuizSet.create({
      userId: req.user._id,
      documentId,
      title: document.title,
      questions,
    });

    res.status(201).json({ quizSet, cached: false });
  } catch (err) {
    console.error('[Quiz Error]', err?.message?.slice(0, 200));
    if (err?.message?.includes('No document chunks found')) {
      return res.status(422).json({
        message: 'This document has not been processed yet. Please wait a moment and try again.',
      });
    }
    if (err instanceof SyntaxError) {
      return res.status(502).json({
        message: 'The AI returned an unexpected format. Please try again.',
      });
    }
    res.status(500).json({ message: 'Failed to generate quiz. Please try again.' });
  }
});

// @desc    Force-regenerate the quiz set (delete existing QuizSet, generate fresh).
//          Past Quiz attempts are never touched by this.
// @route   POST /api/quiz/:documentId/regenerate
// @access  Private
const regenerateQuiz = asyncHandler(async (req, res) => {
  const { documentId } = req.params;

  const document = await Document.findOne({ _id: documentId, userId: req.user._id }).select('_id title');
  if (!document) {
    res.status(404);
    throw new Error('Document not found.');
  }

  // Remove only the cached quiz definition — Quiz attempt history is preserved.
  await QuizSet.deleteOne({ documentId, userId: req.user._id });

  try {
    const questions = await generateQuiz(documentId);

    const quizSet = await QuizSet.create({
      userId: req.user._id,
      documentId,
      title: document.title,
      questions,
    });

    res.status(201).json({ quizSet, cached: false });
  } catch (err) {
    console.error('[Quiz Regenerate Error]', err?.message?.slice(0, 200));
    if (err?.message?.includes('No document chunks found')) {
      return res.status(422).json({
        message: 'This document has not been processed yet. Please wait a moment and try again.',
      });
    }
    if (err instanceof SyntaxError) {
      return res.status(502).json({
        message: 'The AI returned an unexpected format. Please try again.',
      });
    }
    res.status(500).json({ message: 'Failed to regenerate quiz. Please try again.' });
  }
});

// @desc    Submit answers for the cached quiz. Score is computed server-side —
//          the client's answers are never trusted for scoring. Creates a new
//          Quiz attempt record; retaking never modifies the cached QuizSet.
// @route   POST /api/quiz/:documentId/submit
// @access  Private
const submitQuiz = asyncHandler(async (req, res) => {
  const { documentId } = req.params;
  const { answers } = req.body;

  const document = await Document.findOne({ _id: documentId, userId: req.user._id }).select('_id');
  if (!document) {
    res.status(404);
    throw new Error('Document not found.');
  }

  if (!Array.isArray(answers)) {
    res.status(400);
    throw new Error('answers must be an array.');
  }

  const quizSet = await QuizSet.findOne({ documentId, userId: req.user._id });
  if (!quizSet || quizSet.questions.length === 0) {
    res.status(404);
    throw new Error('No quiz found for this document. Generate a quiz first.');
  }

  // Score against the cached QuizSet's correctAnswer — never a client-supplied score.
  let score = 0;
  const results = quizSet.questions.map((q, index) => {
    const submittedAnswer = typeof answers[index] === 'string' ? answers[index] : null;
    const isCorrect = submittedAnswer === q.correctAnswer;
    if (isCorrect) score += 1;
    return {
      question: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      submittedAnswer,
      isCorrect,
    };
  });

  // Quiz.js's schema only has room for a question snapshot (question, options,
  // correctAnswer, explanation) — it has no per-question submittedAnswer field,
  // so the persisted attempt stores the snapshot + aggregate score, while the
  // richer per-question submittedAnswer/isCorrect breakdown is returned to the
  // client directly rather than persisted.
  const attempt = await Quiz.create({
    userId: req.user._id,
    documentId,
    score,
    totalQuestions: quizSet.questions.length,
    questions: quizSet.questions.map((q) => ({
      question: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
    })),
  });

  res.status(201).json({
    attemptId: attempt._id,
    score,
    totalQuestions: quizSet.questions.length,
    results,
  });
});

export { getQuiz, createQuiz, regenerateQuiz, submitQuiz };
