import asyncHandler from 'express-async-handler';
import Document from '../models/Document.js';
import { generateSummary } from '../services/llmService.js';

const parseLLMError = (err) => {
  const msg = err?.message || '';
  if (msg.includes('429') || msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('quota')) {
    return { status: 429, message: 'The AI service is temporarily busy. Please wait a moment and try again.' };
  }
  if (msg.includes('401') || msg.includes('GROQ_API_KEY') || msg.toLowerCase().includes('api key')) {
    return { status: 503, message: 'The AI service is not configured correctly. Please contact support.' };
  }
  if (msg.includes('503') || msg.toLowerCase().includes('unavailable')) {
    return { status: 503, message: 'The AI service is temporarily unavailable. Please try again shortly.' };
  }
  if (msg.includes('empty response')) {
    return { status: 502, message: 'The AI returned an empty response. Please try again.' };
  }
  return { status: 500, message: 'An error occurred while generating the summary. Please try again.' };
};

// @desc    Get the cached summary for a document (or null if not yet generated)
// @route   GET /api/summary/:documentId
// @access  Private
const getSummary = asyncHandler(async (req, res) => {
  const { documentId } = req.params;

  const document = await Document.findOne({
    _id: documentId,
    userId: req.user._id,
  }).select('summary');

  if (!document) {
    res.status(404);
    throw new Error('Document not found.');
  }

  res.json({ summary: document.summary || null });
});

// @desc    Generate and cache a summary (returns cached version if it exists)
// @route   POST /api/summary/:documentId
// @access  Private
const createSummary = asyncHandler(async (req, res) => {
  const { documentId } = req.params;

  const document = await Document.findOne({
    _id: documentId,
    userId: req.user._id,
  }).select('summary');

  if (!document) {
    res.status(404);
    throw new Error('Document not found.');
  }

  // Return cached summary if it already exists
  if (document.summary && document.summary.trim().length > 0) {
    return res.json({ summary: document.summary, cached: true });
  }

  try {
    const summary = await generateSummary(documentId);

    // Persist to MongoDB so future requests skip the AI call
    document.summary = summary;
    await document.save();

    res.json({ summary, cached: false });
  } catch (err) {
    console.error('[Summary Error]', err?.message?.slice(0, 200));
    // Surface chunk-not-found as a 422 (unprocessable) rather than a 500
    if (err?.message?.includes('No document chunks found')) {
      return res.status(422).json({
        message: 'This document has not been processed yet. Please wait a moment and try again.',
      });
    }
    const { status, message } = parseLLMError(err);
    res.status(status).json({ message });
  }
});

// @desc    Force-regenerate a summary even if one is already cached
// @route   POST /api/summary/:documentId/regenerate
// @access  Private
const regenerateSummary = asyncHandler(async (req, res) => {
  const { documentId } = req.params;

  const document = await Document.findOne({
    _id: documentId,
    userId: req.user._id,
  }).select('summary');

  if (!document) {
    res.status(404);
    throw new Error('Document not found.');
  }

  try {
    const summary = await generateSummary(documentId);

    document.summary = summary;
    await document.save();

    res.json({ summary, cached: false });
  } catch (err) {
    console.error('[Summary Regenerate Error]', err?.message?.slice(0, 200));
    if (err?.message?.includes('No document chunks found')) {
      return res.status(422).json({
        message: 'This document has not been processed yet. Please wait a moment and try again.',
      });
    }
    const { status, message } = parseLLMError(err);
    res.status(status).json({ message });
  }
});

export { getSummary, createSummary, regenerateSummary };
