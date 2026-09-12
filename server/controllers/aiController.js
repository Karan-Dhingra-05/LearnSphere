import asyncHandler from 'express-async-handler';
import Document from '../models/Document.js';
import { chatWithDocument, parseLLMError } from '../services/llmService.js';

// @desc    Send a chat message for a given document and receive an AI response
// @route   POST /api/ai/chat
// @access  Private
const chat = asyncHandler(async (req, res) => {
  const { documentId, message, history = [] } = req.body;

  // Input validation
  if (!documentId) {
    res.status(400);
    throw new Error('documentId is required.');
  }
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    res.status(400);
    throw new Error('message must be a non-empty string.');
  }

  // Fetch the document, verifying ownership.
  // extractedText is loaded as the fallback for the RAG dev-fallback path only.
  const document = await Document.findOne({
    _id: documentId,
    userId: req.user._id,
  }).select('extractedText title');

  if (!document) {
    res.status(404);
    throw new Error('Document not found.');
  }

  if (!document.extractedText || document.extractedText.trim().length === 0) {
    res.status(422);
    throw new Error(
      'This document has no extractable text. AI chat requires a text-based PDF.'
    );
  }

  // Validate and sanitise history — accept only the last 12 messages
  const safeHistory = Array.isArray(history)
    ? history
        .filter(
          (m) =>
            m &&
            typeof m.role === 'string' &&
            typeof m.content === 'string' &&
            (m.role === 'user' || m.role === 'assistant')
        )
        .slice(-12)
    : [];

  try {
    // Pass documentId (for RAG retrieval) and extractedText (for dev fallback only).
    // The controller stays thin — all retrieval + prompt logic lives in llmService.
    const aiResponse = await chatWithDocument(
      documentId,
      safeHistory,
      message.trim(),
      document.extractedText     // fallback only — never the primary context
    );
    res.json({ response: aiResponse });
  } catch (err) {
    console.error('[AI Chat Error]', err?.message?.slice(0, 300));
    const { status, message: userMessage } = parseLLMError(err);
    res.status(status).json({ message: userMessage });
  }
});

export { chat };
