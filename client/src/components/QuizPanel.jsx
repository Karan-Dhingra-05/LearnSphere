import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  FiCheckSquare,
  FiRefreshCw,
  FiChevronLeft,
  FiChevronRight,
  FiAlertCircle,
  FiCheck,
  FiX,
} from 'react-icons/fi';
import { createQuiz, regenerateQuiz, submitQuiz } from '../services/quizService.js';

/* ─── Difficulty badge ────────────────────────────────────────────────────── */
const DIFFICULTY_CLASS = {
  Easy:   'quiz-badge quiz-badge--easy',
  Medium: 'quiz-badge quiz-badge--medium',
  Hard:   'quiz-badge quiz-badge--hard',
};

const DifficultyBadge = ({ difficulty }) => (
  <span className={DIFFICULTY_CLASS[difficulty] || 'quiz-badge quiz-badge--medium'}>
    {difficulty}
  </span>
);

/* ─── Main panel ──────────────────────────────────────────────────────────── */
const QuizPanel = ({ documentId, quizSet, loading, error, onSetLoaded, onDismissError }) => {
  const [generating, setGenerating]     = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers]           = useState([]);
  const [submitting, setSubmitting]     = useState(false);
  const [results, setResults]           = useState(null);

  const questions = quizSet?.questions || [];
  const total = questions.length;

  // Reset local "taking" state whenever a different quiz set is loaded
  // (first generation or a regenerate) so a stale attempt never carries over.
  // Intentionally keyed only on quizSet._id — that's the identity signal for
  // "a new set loaded"; questions.length changes for the same reason, so
  // depending on both would be redundant.
  useEffect(() => {
    setCurrentIndex(0);
    setAnswers(new Array(quizSet?.questions?.length || 0).fill(null));
    setResults(null);
  }, [quizSet?._id]);

  /* ── Generate ── */
  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    try {
      const { data } = await createQuiz(documentId);
      onSetLoaded(data.quizSet);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to generate quiz. Please try again.');
    } finally {
      setGenerating(false);
    }
  }, [documentId, onSetLoaded]);

  /* ── Regenerate ── */
  const handleRegenerate = useCallback(async () => {
    setGenerating(true);
    try {
      const { data } = await regenerateQuiz(documentId);
      onSetLoaded(data.quizSet);
      toast.success('Quiz regenerated!');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to regenerate. Please try again.');
    } finally {
      setGenerating(false);
    }
  }, [documentId, onSetLoaded]);

  /* ── Answer selection ── */
  const handleSelect = (option) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[currentIndex] = option;
      return next;
    });
  };

  const goPrev = () => setCurrentIndex((i) => Math.max(0, i - 1));
  const goNext = () => setCurrentIndex((i) => Math.min(total - 1, i + 1));

  /* ── Submit — score is calculated server-side, never trusted from the client ── */
  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    try {
      const { data } = await submitQuiz(documentId, answers);
      setResults(data);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to submit quiz. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [documentId, answers]);

  /* ── Retake — reuse the cached quiz, no Groq call ── */
  const handleRetake = () => {
    setCurrentIndex(0);
    setAnswers(new Array(total).fill(null));
    setResults(null);
  };

  /* ── Loading ── */
  if (loading || generating) {
    return (
      <div className="quiz-panel quiz-panel--loading">
        <div className="quiz-loading-icon">
          <div className="btn-spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
        </div>
        <p className="quiz-loading-text">
          {generating ? 'Generating quiz… this may take a moment.' : 'Loading quiz…'}
        </p>
        {generating && <p className="quiz-loading-hint">Processing your document with AI.</p>}
      </div>
    );
  }

  /* ── Empty state ── */
  if (!quizSet || total === 0) {
    return (
      <div className="quiz-panel quiz-panel--empty">
        {error && (
          <div className="quiz-error">
            <FiAlertCircle size={14} />
            <span>{error}</span>
            <button className="quiz-error-dismiss" onClick={onDismissError}>×</button>
          </div>
        )}
        <div className="quiz-empty-icon"><FiCheckSquare size={32} /></div>
        <h3 className="quiz-empty-title">AI Quiz</h3>
        <p className="quiz-empty-desc">
          Generate a 10-question multiple-choice quiz to test your understanding of this document.
        </p>
        <button id="quiz-generate-btn" className="quiz-generate-btn" onClick={handleGenerate}>
          <FiCheckSquare size={15} />
          Generate Quiz
        </button>
      </div>
    );
  }

  /* ── Results view ── */
  if (results) {
    const percentage = Math.round((results.score / results.totalQuestions) * 100);
    return (
      <div className="quiz-panel quiz-panel--results">
        <div className="quiz-results-header">
          <div className="quiz-score-circle">
            <span className="quiz-score-percentage">{percentage}%</span>
          </div>
          <p className="quiz-score-text">{results.score} / {results.totalQuestions} correct</p>

          <div className="quiz-results-actions">
            <button id="quiz-retake-btn" className="quiz-action-btn" onClick={handleRetake}>
              <FiRefreshCw size={13} />
              Retake
            </button>
            <button id="quiz-regenerate-btn" className="quiz-action-btn" onClick={handleRegenerate}>
              <FiRefreshCw size={13} />
              Regenerate
            </button>
          </div>
        </div>

        <div className="quiz-results-list">
          {results.results.map((r, i) => (
            <div
              key={i}
              className={`quiz-result-item ${r.isCorrect ? 'quiz-result-item--correct' : 'quiz-result-item--incorrect'}`}
            >
              <div className="quiz-result-icon">
                {r.isCorrect ? <FiCheck size={16} /> : <FiX size={16} />}
              </div>
              <div className="quiz-result-body">
                <p className="quiz-result-question">{i + 1}. {r.question}</p>
                {!r.isCorrect && (
                  <p className="quiz-result-your-answer">
                    Your answer: {r.submittedAnswer || 'No answer'}
                  </p>
                )}
                <p className="quiz-result-correct-answer">Correct answer: {r.correctAnswer}</p>
                <p className="quiz-result-explanation">{r.explanation}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ── Taking view ── */
  const currentQuestion = questions[currentIndex];
  const isLast = currentIndex === total - 1;

  return (
    <div className="quiz-panel quiz-panel--taking">
      <div className="quiz-action-bar">
        <span className="quiz-action-label">Question {currentIndex + 1} / {total}</span>
        <button
          id="quiz-regenerate-btn"
          className="quiz-regen-btn"
          onClick={handleRegenerate}
          title="Regenerate quiz"
        >
          <FiRefreshCw size={13} />
          Regenerate
        </button>
      </div>

      <div className="quiz-progress-track">
        <div
          className="quiz-progress-fill"
          style={{ width: `${((currentIndex + 1) / total) * 100}%` }}
        />
      </div>

      <div className="quiz-stage">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="quiz-question-card"
          >
            <div className="quiz-question-top">
              <DifficultyBadge difficulty={currentQuestion.difficulty} />
            </div>
            <p className="quiz-question-text">{currentQuestion.question}</p>

            <div className="quiz-options">
              {currentQuestion.options.map((option, i) => (
                <button
                  key={i}
                  className={`quiz-option${answers[currentIndex] === option ? ' quiz-option--selected' : ''}`}
                  onClick={() => handleSelect(option)}
                >
                  <span className="quiz-option-marker" />
                  <span className="quiz-option-text">{option}</span>
                </button>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="quiz-nav">
        <button className="quiz-nav-btn" onClick={goPrev} disabled={currentIndex === 0}>
          <FiChevronLeft size={18} />
          Previous
        </button>

        {isLast ? (
          <button id="quiz-submit-btn" className="quiz-submit-btn" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit Quiz'}
          </button>
        ) : (
          <button className="quiz-nav-btn" onClick={goNext}>
            Next
            <FiChevronRight size={18} />
          </button>
        )}
      </div>
    </div>
  );
};

export default QuizPanel;
