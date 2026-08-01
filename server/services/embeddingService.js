/**
 * embeddingService.js
 *
 * Generates dense vector embeddings for text chunks and queries.
 *
 * Provider: Xenova/all-MiniLM-L6-v2 via @huggingface/transformers (ONNX Runtime)
 *   - 384 dimensions
 *   - Mean pooling + L2 normalisation (required for cosine / L2 similarity)
 *   - Model downloads once to ~/.cache/huggingface/hub and is cached locally
 *
 * The provider is isolated here so it can be swapped (e.g. OpenAI, Cohere)
 * without touching retrieval or any other service.
 */

import { pipeline } from '@huggingface/transformers';

const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';
export const EMBEDDING_DIMS = 384;

// Lazy singleton — loaded on first use, reused for all subsequent calls
let _extractor = null;

const getExtractor = async () => {
  if (!_extractor) {
    console.log('[Embeddings] Loading model', MODEL_ID, '(first call — may take a moment)…');
    _extractor = await pipeline('feature-extraction', MODEL_ID, {
      dtype: 'fp32',
    });
    console.log('[Embeddings] Model ready ✓');
  }
  return _extractor;
};

/**
 * Generates a single embedding vector for the given text.
 *
 * @param {string} text - Input text (chunk or query).
 * @returns {Promise<number[]>} - 384-dimensional float array, L2-normalised.
 */
const getEmbedding = async (text) => {
  const extractor = await getExtractor();
  // pooling:'mean' + normalize:true → unit vector (cosine ≡ dot product ≡ IndexFlatIP)
  const result = await extractor(text.trim() || ' ', { pooling: 'mean', normalize: true });
  return Array.from(result.data);
};

/**
 * Generates embeddings for an array of texts in sequence.
 * Returns results in the same order as the input.
 *
 * @param {string[]} texts - Array of input strings.
 * @returns {Promise<number[][]>} - Array of 384-dimensional float arrays.
 */
const getEmbeddings = async (texts) => {
  const results = [];
  for (const text of texts) {
    results.push(await getEmbedding(text));
  }
  return results;
};

export { getEmbedding, getEmbeddings };
