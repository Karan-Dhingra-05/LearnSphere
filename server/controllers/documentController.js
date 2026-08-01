import asyncHandler from 'express-async-handler';
import path from 'path';
import Document from '../models/Document.js';
import DocumentChunk from '../models/DocumentChunk.js';
import FlashcardSet from '../models/FlashcardSet.js';
import Quiz from '../models/Quiz.js';
import { extractTextFromPDF } from '../utils/pdfHelper.js';
import { deleteFile } from '../utils/fileHelper.js';
import { chunkText } from '../services/chunkService.js';
import { indexDocument, removeDocument } from '../services/retrievalService.js';

// @desc    Upload a PDF document
// @route   POST /api/documents/upload
// @access  Private
const uploadDocument = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error('Please upload a PDF file');
  }

  const { title } = req.body;
  const pdfPath = req.file.filename;
  const fileSize = req.file.size;
  const originalFilename = req.file.originalname;

  // ── 1. Extract text (once at upload; reused by all AI features) ────────────
  let extractedText = '';
  try {
    const fullPath = path.join(process.cwd(), 'uploads', pdfPath);
    extractedText = await extractTextFromPDF(fullPath);
  } catch (err) {
    console.warn(`PDF text extraction warning for "${originalFilename}":`, err.message);
  }

  // ── 2. Save Document to MongoDB ────────────────────────────────────────────
  const document = await Document.create({
    userId: req.user._id,
    title: title || originalFilename.replace(/\.pdf$/i, ''),
    originalFilename,
    pdfPath,
    fileSize,
    extractedText,
  });

  // ── 3. RAG pipeline (best-effort — errors do not fail the upload) ──────────
  if (extractedText.trim().length > 0) {
    (async () => {
      try {
        // 3a. Chunk the extracted text
        const chunks = chunkText(extractedText);
        if (chunks.length === 0) return;

        // 3b. Save chunks to MongoDB (for retrieval after similarity search)
        const chunkDocs = chunks.map((text, chunkIndex) => ({
          documentId: document._id,
          chunkIndex,
          text,
        }));
        await DocumentChunk.insertMany(chunkDocs);

        // 3c. Generate embeddings + store in FAISS
        await indexDocument(document._id, chunks);

        console.log(`[Upload] RAG pipeline complete: ${chunks.length} chunks for "${document.title}"`);
      } catch (ragErr) {
        console.error('[Upload] RAG pipeline error (non-fatal):', ragErr.message);
      }
    })();
  }

  // ── 4. Respond to frontend immediately (RAG runs in background) ───────────
  res.status(201).json({
    _id: document._id,
    userId: document.userId,
    title: document.title,
    originalFilename: document.originalFilename,
    pdfPath: document.pdfPath,
    fileSize: document.fileSize,
    createdAt: document.createdAt,
    extractedTextLength: extractedText.length,
  });
});

// @desc    Get all documents for authenticated user
// @route   GET /api/documents
// @access  Private
const getDocuments = asyncHandler(async (req, res) => {
  const documents = await Document.find({ userId: req.user._id })
    .select('-extractedText')
    .sort({ createdAt: -1 });

  res.json(documents);
});

// @desc    Get single document by ID
// @route   GET /api/documents/:id
// @access  Private
const getDocument = asyncHandler(async (req, res) => {
  const document = await Document.findOne({
    _id: req.params.id,
    userId: req.user._id,
  }).select('-extractedText');

  if (!document) {
    res.status(404);
    throw new Error('Document not found');
  }

  res.json(document);
});

// @desc    Delete a document and all associated data
// @route   DELETE /api/documents/:id
// @access  Private
const deleteDocument = asyncHandler(async (req, res) => {
  const document = await Document.findOne({
    _id: req.params.id,
    userId: req.user._id,
  });

  if (!document) {
    res.status(404);
    throw new Error('Document not found');
  }

  // Delete PDF from disk — graceful if file is already missing
  const filePath = path.join(process.cwd(), 'uploads', document.pdfPath);
  await deleteFile(filePath);

  // Cascade delete: MongoDB document, chunks, flashcards, quizzes
  await Promise.all([
    Document.deleteOne({ _id: document._id }),
    DocumentChunk.deleteMany({ documentId: document._id }),
    FlashcardSet.deleteMany({ documentId: document._id }),
    Quiz.deleteMany({ documentId: document._id }),
  ]);

  // Remove document vectors from FAISS (best-effort)
  try {
    removeDocument(document._id);
  } catch (ragErr) {
    console.error('[Delete] FAISS cleanup error (non-fatal):', ragErr.message);
  }

  res.json({ message: 'Document deleted successfully' });
});

export { uploadDocument, getDocuments, getDocument, deleteDocument };
