import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { FiLayers, FiStar, FiRefreshCw, FiChevronLeft, FiChevronRight, FiAlertCircle } from 'react-icons/fi';
import {
  createFlashcards,
  regenerateFlashcards,
  toggleFavorite,
  markReviewed,
} from '../services/flashcardService.js';

/* ─── Difficulty badge ────────────────────────────────────────────────────── */
const DIFFICULTY_CLASS = {
  Easy:   'fc-badge fc-badge--easy',
  Medium: 'fc-badge fc-badge--medium',
  Hard:   'fc-badge fc-badge--hard',
};

const DifficultyBadge = ({ difficulty }) => (
  <span className={DIFFICULTY_CLASS[difficulty] || 'fc-badge fc-badge--medium'}>
    {difficulty}
  </span>
);

/* ─── Single flashcard ────────────────────────────────────────────────────── */
const FlashCard = ({ card, index, total, onFlip, onToggleFavorite }) => {
  const [flipped, setFlipped] = useState(false);

  const handleFlip = () => {
    const nextFlipped = !flipped;
    setFlipped(nextFlipped);
    if (nextFlipped) onFlip(card._id);
  };

  return (
    <div className="fc-scene" onClick={handleFlip}>
      <motion.div
        className="fc-card-inner"
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Front */}
        <div className="fc-face fc-face--front">
          <div className="fc-face-top">
            <DifficultyBadge difficulty={card.difficulty} />
            <button
              className={`fc-favorite-btn${card.favorite ? ' active' : ''}`}
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(card._id); }}
              title={card.favorite ? 'Remove from favorites' : 'Add to favorites'}
              aria-label="Toggle favorite"
            >
              <FiStar size={18} fill={card.favorite ? 'currentColor' : 'none'} />
            </button>
          </div>

          <div className="fc-face-body">
            <p className="fc-counter">{index + 1} / {total}</p>
            <p className="fc-question">{card.question}</p>
          </div>

          <p className="fc-hint">Click to reveal answer</p>
        </div>

        {/* Back */}
        <div className="fc-face fc-face--back">
          <div className="fc-face-top">
            <DifficultyBadge difficulty={card.difficulty} />
            <button
              className={`fc-favorite-btn${card.favorite ? ' active' : ''}`}
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(card._id); }}
              title={card.favorite ? 'Remove from favorites' : 'Add to favorites'}
              aria-label="Toggle favorite"
            >
              <FiStar size={18} fill={card.favorite ? 'currentColor' : 'none'} />
            </button>
          </div>

          <div className="fc-face-body">
            <p className="fc-answer">{card.answer}</p>
          </div>

          <p className="fc-hint">Click to see question</p>
        </div>
      </motion.div>
    </div>
  );
};

/* ─── Main panel ──────────────────────────────────────────────────────────── */
const FlashcardPanel = ({ documentId, flashcardSet, loading, error, onSetLoaded, onDismissError }) => {
  const [generating, setGenerating]   = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cards, setCards]             = useState(flashcardSet?.flashcards || []);

  // Sync when flashcardSet prop changes (after initial load)
  const activeCards = flashcardSet ? (cards.length ? cards : flashcardSet.flashcards) : cards;

  /* ── Generate ── */
  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    try {
      const { data } = await createFlashcards(documentId);
      setCards(data.flashcardSet.flashcards);
      setCurrentIndex(0);
      onSetLoaded(data.flashcardSet);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to generate flashcards. Please try again.');
    } finally {
      setGenerating(false);
    }
  }, [documentId, onSetLoaded]);

  /* ── Regenerate ── */
  const handleRegenerate = useCallback(async () => {
    setGenerating(true);
    try {
      const { data } = await regenerateFlashcards(documentId);
      setCards(data.flashcardSet.flashcards);
      setCurrentIndex(0);
      onSetLoaded(data.flashcardSet);
      toast.success('Flashcards regenerated!');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to regenerate. Please try again.');
    } finally {
      setGenerating(false);
    }
  }, [documentId, onSetLoaded]);

  /* ── Flip → mark reviewed ── */
  const handleFlip = useCallback(async (cardId) => {
    const card = activeCards.find((c) => c._id === cardId);
    if (!card || card.reviewed) return;
    try {
      await markReviewed(documentId, cardId);
      setCards((prev) =>
        prev.map((c) => (c._id === cardId ? { ...c, reviewed: true } : c))
      );
      toast.success('Flashcard reviewed!', { duration: 1800 });
    } catch {
      /* non-critical — silently ignore */
    }
  }, [documentId, activeCards]);

  /* ── Toggle favorite ── */
  const handleToggleFavorite = useCallback(async (cardId) => {
    try {
      const { data } = await toggleFavorite(documentId, cardId);
      setCards((prev) =>
        prev.map((c) => (c._id === cardId ? { ...c, favorite: data.favorite } : c))
      );
    } catch {
      toast.error('Failed to update favorite.');
    }
  }, [documentId]);

  /* ── Navigation ── */
  const displayCards = cards.length ? cards : (flashcardSet?.flashcards || []);
  const total = displayCards.length;
  const currentCard = displayCards[currentIndex];

  const goPrev = () => setCurrentIndex((i) => Math.max(0, i - 1));
  const goNext = () => setCurrentIndex((i) => Math.min(total - 1, i + 1));

  /* ── Loading ── */
  if (loading || generating) {
    return (
      <div className="fc-panel fc-panel--loading">
        <div className="fc-loading-icon">
          <div className="btn-spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
        </div>
        <p className="fc-loading-text">
          {generating ? 'Generating flashcards… this may take a moment.' : 'Loading flashcards…'}
        </p>
        {generating && <p className="fc-loading-hint">Processing your document with AI.</p>}
      </div>
    );
  }

  /* ── Empty state ── */
  if (!flashcardSet && !displayCards.length) {
    return (
      <div className="fc-panel fc-panel--empty">
        {error && (
          <div className="fc-error">
            <FiAlertCircle size={14} />
            <span>{error}</span>
            <button className="fc-error-dismiss" onClick={onDismissError}>×</button>
          </div>
        )}
        <div className="fc-empty-icon"><FiLayers size={32} /></div>
        <h3 className="fc-empty-title">AI Flashcards</h3>
        <p className="fc-empty-desc">
          Generate study flashcards covering the key concepts, definitions, and facts from this document.
        </p>
        <button id="fc-generate-btn" className="fc-generate-btn" onClick={handleGenerate}>
          <FiLayers size={15} />
          Generate Flashcards
        </button>
      </div>
    );
  }

  /* ── Cards view ── */
  return (
    <div className="fc-panel fc-panel--cards">
      {/* Action bar */}
      <div className="fc-action-bar">
        <span className="fc-action-label">
          {total} flashcard{total !== 1 ? 's' : ''}
        </span>
        <button
          id="fc-regenerate-btn"
          className="fc-regen-btn"
          onClick={handleRegenerate}
          title="Regenerate flashcards"
        >
          <FiRefreshCw size={13} />
          Regenerate
        </button>
      </div>

      {/* Card stage */}
      <div className="fc-stage">
        <AnimatePresence mode="wait">
          {currentCard && (
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="fc-card-wrapper"
            >
              <FlashCard
                card={currentCard}
                index={currentIndex}
                total={total}
                onFlip={handleFlip}
                onToggleFavorite={handleToggleFavorite}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="fc-nav">
        <button
          className="fc-nav-btn"
          onClick={goPrev}
          disabled={currentIndex === 0}
          aria-label="Previous card"
        >
          <FiChevronLeft size={20} />
        </button>
        <span className="fc-nav-counter">{currentIndex + 1} / {total}</span>
        <button
          className="fc-nav-btn"
          onClick={goNext}
          disabled={currentIndex === total - 1}
          aria-label="Next card"
        >
          <FiChevronRight size={20} />
        </button>
      </div>
    </div>
  );
};

export default FlashcardPanel;
