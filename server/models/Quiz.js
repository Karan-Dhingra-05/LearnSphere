import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema({
  question: { type: String, required: true },
  options: [{ type: String, required: true }],
  correctAnswer: { type: String, required: true },
  explanation: { type: String, required: true },
});

const quizSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
      required: true,
    },
    score: {
      type: Number,
      required: true,
    },
    totalQuestions: {
      type: Number,
      required: true,
    },
    questions: [questionSchema],
  },
  { timestamps: true }
);

// Speeds up per-document attempt lookups (progress/dashboard); not unique —
// multiple attempts per document per user are expected.
quizSchema.index({ documentId: 1, userId: 1 });

const Quiz = mongoose.model('Quiz', quizSchema);
export default Quiz;
