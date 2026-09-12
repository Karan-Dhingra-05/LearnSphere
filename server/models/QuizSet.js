import mongoose from 'mongoose';

const quizQuestionSchema = new mongoose.Schema({
  question:      { type: String, required: true },
  options:       { type: [String], required: true },
  correctAnswer: { type: String, required: true },
  explanation:   { type: String, required: true },
  difficulty:    { type: String, enum: ['Easy', 'Medium', 'Hard'], default: 'Medium' },
});

const quizSetSchema = new mongoose.Schema(
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
    title: {
      type: String,
      required: [true, 'Quiz set title is required'],
      trim: true,
    },
    questions: [quizQuestionSchema],
  },
  { timestamps: true }
);

const QuizSet = mongoose.model('QuizSet', quizSetSchema);
export default QuizSet;
