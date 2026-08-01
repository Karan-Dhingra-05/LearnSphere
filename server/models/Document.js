import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: [true, 'Document title is required'],
      trim: true,
    },
    originalFilename: {
      type: String,
      required: true,
    },
    pdfPath: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      required: true,
    },
    // Extracted once at upload time; stored here so AI features (chat, summary)
    // can read from the DB instead of re-parsing the PDF on every request.
    extractedText: {
      type: String,
      default: '',
    },
    // Cached AI summary — populated on first generation, cleared on regeneration.
    summary: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

documentSchema.index({ userId: 1 });

const Document = mongoose.model('Document', documentSchema);
export default Document;
