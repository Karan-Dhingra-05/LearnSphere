import mongoose from 'mongoose';

/**
 * Stores individual text chunks for a document.
 * Embeddings are stored in FAISS — NOT here.
 * Chunks are retrieved by documentId + chunkIndex during RAG.
 */
const documentChunkSchema = new mongoose.Schema({
  documentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document',
    required: true,
    index: true,
  },
  chunkIndex: {
    type: Number,
    required: true,
  },
  text: {
    type: String,
    required: true,
  },
});

// Compound index so we can efficiently fetch all chunks for a document in order
documentChunkSchema.index({ documentId: 1, chunkIndex: 1 });

const DocumentChunk = mongoose.model('DocumentChunk', documentChunkSchema);
export default DocumentChunk;
