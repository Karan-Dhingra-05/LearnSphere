import asyncHandler from 'express-async-handler';
import Document from '../models/Document.js';
import FlashcardSet from '../models/FlashcardSet.js';
import { generateFlashcards } from '../services/llmService.js';

// @desc    Get the cached flashcard set for a document (or null)
// @route   GET /api/flashcards/:documentId
// @access  Private
const getFlashcards = asyncHandler(async (req, res) => {
  const { documentId } = req.params;

  // Verify the document belongs to this user
  const document = await Document.findOne({ _id: documentId, userId: req.user._id }).select('_id');
  if (!document) {
    res.status(404);
    throw new Error('Document not found.');
  }

  const set = await FlashcardSet.findOne({ documentId, userId: req.user._id });
  res.json({ flashcardSet: set || null });
});

// @desc    Generate and cache flashcards (returns cached set if it exists)
// @route   POST /api/flashcards/:documentId
// @access  Private
const createFlashcards = asyncHandler(async (req, res) => {
  const { documentId } = req.params;

  const document = await Document.findOne({ _id: documentId, userId: req.user._id }).select('_id title');
  if (!document) {
    res.status(404);
    throw new Error('Document not found.');
  }

  // Return the cached set if it already exists
  const existing = await FlashcardSet.findOne({ documentId, userId: req.user._id });
  if (existing) {
    return res.json({ flashcardSet: existing, cached: true });
  }

  try {
    const cards = await generateFlashcards(documentId);

    const set = await FlashcardSet.create({
      userId: req.user._id,
      documentId,
      title: document.title,
      flashcards: cards,
    });

    res.status(201).json({ flashcardSet: set, cached: false });
  } catch (err) {
    console.error('[Flashcard Error]', err?.message?.slice(0, 200));
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
    res.status(500).json({ message: 'Failed to generate flashcards. Please try again.' });
  }
});

// @desc    Force-regenerate flashcards (delete existing, generate fresh)
// @route   POST /api/flashcards/:documentId/regenerate
// @access  Private
const regenerateFlashcards = asyncHandler(async (req, res) => {
  const { documentId } = req.params;

  const document = await Document.findOne({ _id: documentId, userId: req.user._id }).select('_id title');
  if (!document) {
    res.status(404);
    throw new Error('Document not found.');
  }

  // Remove previous set
  await FlashcardSet.deleteOne({ documentId, userId: req.user._id });

  try {
    const cards = await generateFlashcards(documentId);

    const set = await FlashcardSet.create({
      userId: req.user._id,
      documentId,
      title: document.title,
      flashcards: cards,
    });

    res.status(201).json({ flashcardSet: set, cached: false });
  } catch (err) {
    console.error('[Flashcard Regenerate Error]', err?.message?.slice(0, 200));
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
    res.status(500).json({ message: 'Failed to regenerate flashcards. Please try again.' });
  }
});

// @desc    Toggle favorite on a single flashcard
// @route   PATCH /api/flashcards/:documentId/cards/:cardId/favorite
// @access  Private
const toggleFavorite = asyncHandler(async (req, res) => {
  const { documentId, cardId } = req.params;

  const set = await FlashcardSet.findOne({ documentId, userId: req.user._id });
  if (!set) {
    res.status(404);
    throw new Error('Flashcard set not found.');
  }

  const card = set.flashcards.id(cardId);
  if (!card) {
    res.status(404);
    throw new Error('Flashcard not found.');
  }

  card.favorite = !card.favorite;
  await set.save();

  res.json({ cardId, favorite: card.favorite });
});

// @desc    Mark a flashcard as reviewed
// @route   PATCH /api/flashcards/:documentId/cards/:cardId/reviewed
// @access  Private
const markReviewed = asyncHandler(async (req, res) => {
  const { documentId, cardId } = req.params;

  const set = await FlashcardSet.findOne({ documentId, userId: req.user._id });
  if (!set) {
    res.status(404);
    throw new Error('Flashcard set not found.');
  }

  const card = set.flashcards.id(cardId);
  if (!card) {
    res.status(404);
    throw new Error('Flashcard not found.');
  }

  const wasAlreadyReviewed = card.reviewed;
  card.reviewed = true;
  await set.save();

  res.json({ cardId, reviewed: true, isNew: !wasAlreadyReviewed });
});

export { getFlashcards, createFlashcards, regenerateFlashcards, toggleFavorite, markReviewed };
