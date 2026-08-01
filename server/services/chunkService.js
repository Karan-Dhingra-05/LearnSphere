/**
 * chunkService.js
 *
 * Splits document text into overlapping chunks for RAG.
 * No AI logic — pure text processing only.
 *
 * Strategy:
 *  1. Split text into paragraphs (double newline boundaries).
 *  2. Accumulate paragraphs until the chunk reaches targetWords.
 *  3. When the target is exceeded, save the current chunk and start
 *     the next chunk with the last `overlapWords` words for context.
 *  4. Any remaining words form the final chunk.
 */

const DEFAULT_TARGET_WORDS = 900;  // approximate words per chunk
const DEFAULT_OVERLAP_WORDS = 175; // words carried over to the next chunk
const MIN_CHUNK_CHARS = 80;        // discard very short / whitespace-only chunks

/**
 * Splits text into overlapping chunks that preserve paragraph boundaries.
 *
 * @param {string} text             - Full extracted document text.
 * @param {number} targetWords      - Target chunk size in words (~900 default).
 * @param {number} overlapWords     - Overlap size in words (~175 default).
 * @returns {string[]}              - Array of non-empty chunk strings.
 */
const chunkText = (text, targetWords = DEFAULT_TARGET_WORDS, overlapWords = DEFAULT_OVERLAP_WORDS) => {
  if (!text || text.trim().length === 0) return [];

  // Split into paragraphs; treat blocks of 1+ blank lines as separators
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const chunks = [];
  let currentWords = [];

  for (const para of paragraphs) {
    const paraWords = para.split(/\s+/).filter((w) => w.length > 0);

    // If adding this paragraph would exceed the target AND we already have
    // content, flush the current chunk first
    if (currentWords.length > 0 && currentWords.length + paraWords.length > targetWords) {
      chunks.push(currentWords.join(' '));
      // Carry the last `overlapWords` words into the next chunk
      currentWords = currentWords.slice(-overlapWords);
    }

    currentWords.push(...paraWords);
  }

  // Flush any remaining words as the final chunk
  if (currentWords.length > 0) {
    chunks.push(currentWords.join(' '));
  }

  // Remove trivially small chunks (headers, page numbers, etc.)
  return chunks.filter((c) => c.trim().length >= MIN_CHUNK_CHARS);
};

export { chunkText };
