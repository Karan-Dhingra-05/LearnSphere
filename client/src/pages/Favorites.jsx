import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { FiHeart, FiAlertCircle, FiExternalLink } from 'react-icons/fi';
import { getFavorites } from '../services/favoritesService.js';
import { toggleFavorite } from '../services/flashcardService.js';
import EmptyState from '../components/EmptyState.jsx';

const DIFFICULTY_CLASS = {
  Easy: 'fc-badge fc-badge--easy',
  Medium: 'fc-badge fc-badge--medium',
  Hard: 'fc-badge fc-badge--hard',
};

const Favorites = () => {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchFavorites = async () => {
      try {
        const { data } = await getFavorites();
        setFavorites(data.favorites);
      } catch (err) {
        const message = err?.response?.data?.message || 'Failed to load favorites.';
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    };
    fetchFavorites();
  }, []);

  // Unfavoriting here reuses the same toggle endpoint the Flashcard tab
  // uses — no separate favorites-specific mutation needed.
  const handleUnfavorite = useCallback(async (documentId, cardId) => {
    try {
      await toggleFavorite(documentId, cardId);
      setFavorites((prev) => prev.filter((f) => f.cardId !== cardId));
    } catch {
      toast.error('Failed to update favorite.');
    }
  }, []);

  return (
    <div className="page-container">
      <motion.div
        className="page-header"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div>
          <h1 className="page-title">Favorites</h1>
          <p className="page-subtitle">Flashcards you've starred, across all documents</p>
        </div>
      </motion.div>

      {loading ? (
        <div className="loading-rows">
          {[1, 2, 3].map((i) => (
            <div key={i} className="loading-row-skeleton" />
          ))}
        </div>
      ) : error ? (
        <div className="progress-error">
          <FiAlertCircle size={16} />
          <span>{error}</span>
        </div>
      ) : favorites.length === 0 ? (
        <EmptyState
          icon={FiHeart}
          title="No favorites yet"
          description="Star a flashcard from any document's Flashcards tab to see it here."
        />
      ) : (
        <div className="favorites-list">
          {favorites.map((fav, i) => (
            <motion.div
              key={fav.cardId}
              className="favorites-card"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.04 }}
            >
              <div className="favorites-card-top">
                <Link
                  to={`/viewer/${fav.documentId}`}
                  state={{ initialTab: 'flashcards' }}
                  className="favorites-doc-link"
                >
                  <FiExternalLink size={12} />
                  {fav.documentTitle}
                </Link>
                <div className="favorites-card-actions">
                  <span className={DIFFICULTY_CLASS[fav.difficulty] || 'fc-badge fc-badge--medium'}>
                    {fav.difficulty}
                  </span>
                  <button
                    className="favorites-unfavorite-btn"
                    onClick={() => handleUnfavorite(fav.documentId, fav.cardId)}
                    title="Remove from favorites"
                    aria-label="Remove from favorites"
                  >
                    <FiHeart size={16} fill="currentColor" />
                  </button>
                </div>
              </div>
              <p className="favorites-question">{fav.question}</p>
              <p className="favorites-answer">{fav.answer}</p>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Favorites;
