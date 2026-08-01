/**
 * retrievalService.js
 *
 * The single entry point for all RAG vector operations.
 * No other service or controller communicates with FAISS directly.
 *
 * Responsibilities:
 *  - Load / persist the FAISS index to disk
 *  - Index a document's chunks (add vectors)
 *  - Remove a document's vectors (on deletion)
 *  - Search for the top-K most relevant chunks for a query
 *  - Load matching chunk texts from MongoDB
 *  - Return a combined context string + chunk metadata
 *
 * FAISS design:
 *  - IndexFlatL2 (exact search, 384 dims)
 *  - Metadata array (one entry per vector): { documentId, chunkIndex, vector }
 *  - Positions in the FAISS index === positions in the metadata array (always in sync)
 *  - Deletion: filter metadata → rebuild index (O(n) but correct and simple)
 *  - Persistence:
 *      server/faiss/index.bin       — FAISS binary index
 *      server/faiss/metadata.json   — serialised metadata array (includes raw vectors
 *                                     so the index can be rebuilt without re-embedding)
 *
 * NOTE: faiss-node exposes ntotal as a method, not a property — always call ntotal().
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import faissNode from 'faiss-node';
import { getEmbedding, getEmbeddings, EMBEDDING_DIMS } from './embeddingService.js';
import DocumentChunk from '../models/DocumentChunk.js';

const { IndexFlatL2 } = faissNode;

// ─── Paths ───────────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FAISS_DIR = path.join(__dirname, '..', 'faiss');
const INDEX_PATH = path.join(FAISS_DIR, 'index.bin');
const META_PATH = path.join(FAISS_DIR, 'metadata.json');

// ─── In-memory state ─────────────────────────────────────────────────────────
/** @type {IndexFlatL2|null} */
let _index = null;

/**
 * Each entry mirrors one vector in the FAISS index (same positional order).
 * @type {Array<{documentId: string, chunkIndex: number, vector: number[]}>}
 */
let _metadata = [];

// ─── Internal helpers ────────────────────────────────────────────────────────

/** Returns the number of vectors currently in the index (faiss-node uses a method). */
const ntotal = () => (_index ? _index.ntotal() : 0);

const ensureFaissDir = () => {
  if (!fs.existsSync(FAISS_DIR)) {
    fs.mkdirSync(FAISS_DIR, { recursive: true });
  }
};

const saveToDisk = () => {
  ensureFaissDir();
  if (_index && ntotal() > 0) {
    _index.write(INDEX_PATH);
  } else if (fs.existsSync(INDEX_PATH)) {
    fs.unlinkSync(INDEX_PATH);
  }
  fs.writeFileSync(META_PATH, JSON.stringify(_metadata), 'utf8');
};

const loadFromDisk = () => {
  if (fs.existsSync(META_PATH)) {
    try {
      _metadata = JSON.parse(fs.readFileSync(META_PATH, 'utf8'));
    } catch {
      console.warn('[RAG] metadata.json is corrupt — resetting.');
      _metadata = [];
    }
  }

  if (fs.existsSync(INDEX_PATH) && _metadata.length > 0) {
    try {
      _index = IndexFlatL2.read(INDEX_PATH);
      console.log(`[RAG] Loaded FAISS index: ${ntotal()} vectors`);
      return;
    } catch (err) {
      console.warn('[RAG] Failed to load FAISS index — will rebuild from metadata.', err.message);
    }
  }

  // Rebuild index from stored metadata vectors (no re-embedding needed)
  _index = new IndexFlatL2(EMBEDDING_DIMS);
  if (_metadata.length > 0) {
    const flat = _metadata.flatMap((m) => m.vector);
    _index.add(flat);
    console.log(`[RAG] Rebuilt FAISS index from metadata: ${ntotal()} vectors`);
  } else {
    console.log('[RAG] New FAISS index initialised (empty).');
  }
};

/** Compact metadata (no gaps) and rebuild index from stored vectors. */
const rebuildIndex = () => {
  _index = new IndexFlatL2(EMBEDDING_DIMS);
  if (_metadata.length > 0) {
    const flat = _metadata.flatMap((m) => m.vector);
    _index.add(flat);
  }
};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Call once at server startup.
 * Loads persisted index and metadata from disk.
 */
const initializeRAG = () => {
  try {
    ensureFaissDir();
    loadFromDisk();
  } catch (err) {
    console.error('[RAG] Initialization failed — RAG features will be unavailable:', err.message);
    _index = new IndexFlatL2(EMBEDDING_DIMS);
    _metadata = [];
  }
};

/**
 * Index a document's chunks.
 * Called from the upload pipeline after chunks have been saved to MongoDB.
 *
 * @param {string}   documentId - MongoDB document ID.
 * @param {string[]} chunks     - Array of chunk text strings (in order).
 */
const indexDocument = async (documentId, chunks) => {
  if (!chunks || chunks.length === 0) return;

  console.log(`[RAG] Generating embeddings for ${chunks.length} chunks (doc ${documentId})…`);
  const vectors = await getEmbeddings(chunks);

  vectors.forEach((vector, i) => {
    _metadata.push({ documentId: documentId.toString(), chunkIndex: i, vector });
  });

  const flat = vectors.flatMap((v) => v);
  _index.add(flat);

  saveToDisk();
  console.log(`[RAG] Indexed ${chunks.length} chunks for doc ${documentId}. Total vectors: ${ntotal()}`);
};

/**
 * Remove all vectors for a document from the FAISS index and metadata.
 * Called from the delete pipeline.
 *
 * @param {string} documentId - MongoDB document ID.
 */
const removeDocument = (documentId) => {
  const docStr = documentId.toString();
  const before = _metadata.length;
  _metadata = _metadata.filter((m) => m.documentId !== docStr);
  const removed = before - _metadata.length;

  if (removed === 0) return;

  rebuildIndex();
  saveToDisk();
  console.log(`[RAG] Removed ${removed} vectors for doc ${documentId}. Remaining: ${ntotal()}`);
};

/**
 * Retrieve the most relevant text chunks for a query, scoped to one document.
 *
 * @param {string} documentId - Only return chunks from this document.
 * @param {string} query      - The user's question / search text.
 * @param {number} topK       - Number of top chunks to return (default 5).
 * @returns {Promise<{context: string, chunks: Array<{chunkIndex:number, text:string, score:number}>}>}
 */
const retrieveRelevantChunks = async (documentId, query, topK = 5) => {
  const docStr = documentId.toString();

  // Guard: empty index → no vectors to search
  if (ntotal() === 0) {
    return { context: '', chunks: [] };
  }

  // Positions in _metadata that belong to this document
  const docPositions = _metadata
    .map((m, i) => (m.documentId === docStr ? i : -1))
    .filter((i) => i !== -1);

  if (docPositions.length === 0) {
    return { context: '', chunks: [] };
  }

  const queryVector = await getEmbedding(query);

  // Over-fetch so we have enough results after filtering by documentId
  const searchK = Math.min(topK * 10, ntotal());
  if (searchK === 0) return { context: '', chunks: [] };

  const { distances, labels } = _index.search(queryVector, searchK);

  // Filter to positions belonging to our document, take topK
  const docPositionSet = new Set(docPositions);
  const hits = [];
  for (let i = 0; i < labels.length; i++) {
    const pos = labels[i];
    if (pos === -1) continue;              // FAISS padding for unfilled slots
    if (!docPositionSet.has(pos)) continue; // different document
    hits.push({ pos, score: distances[i] });
    if (hits.length >= topK) break;
  }

  if (hits.length === 0) {
    return { context: '', chunks: [] };
  }

  // Load chunk texts from MongoDB
  const chunkIndices = hits.map((h) => _metadata[h.pos].chunkIndex);
  const dbChunks = await DocumentChunk.find({
    documentId,
    chunkIndex: { $in: chunkIndices },
  }).select('chunkIndex text -_id');

  const chunkMap = new Map(dbChunks.map((c) => [c.chunkIndex, c.text]));

  const chunks = hits.map((h) => ({
    chunkIndex: _metadata[h.pos].chunkIndex,
    text: chunkMap.get(_metadata[h.pos].chunkIndex) || '',
    score: h.score,
  }));

  // Sort by chunk order for coherent reading
  const sortedChunks = [...chunks].sort((a, b) => a.chunkIndex - b.chunkIndex);
  const context = sortedChunks.map((c) => c.text).join('\n\n---\n\n');

  return { context, chunks };
};

/**
 * Returns index statistics (useful for health checks / debugging).
 * @returns {{totalVectors: number, documents: number}}
 */
const getStats = () => {
  const docIds = new Set(_metadata.map((m) => m.documentId));
  return {
    totalVectors: ntotal(),
    documents: docIds.size,
  };
};

export { initializeRAG, indexDocument, removeDocument, retrieveRelevantChunks, getStats };
