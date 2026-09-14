import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { FiBarChart2, FiFileText, FiLayers, FiCheckSquare, FiAlertCircle } from 'react-icons/fi';
import { getProgress } from '../services/progressService.js';
import EmptyState from '../components/EmptyState.jsx';
import UploadModal from '../components/UploadModal.jsx';
import { formatDate } from '../utils/formatters.js';

const Progress = () => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);

  const fetchProgress = async () => {
    try {
      const { data } = await getProgress();
      setDocuments(data.documents);
    } catch (err) {
      const message = err?.response?.data?.message || 'Failed to load progress.';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProgress();
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
          <h1 className="page-title">Progress</h1>
          <p className="page-subtitle">
            Flashcard and quiz progress for each of your documents
          </p>
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
      ) : documents.length === 0 ? (
        <EmptyState
          icon={FiBarChart2}
          title="No documents yet"
          description="Upload a PDF and generate flashcards or a quiz to start tracking your progress."
          action={
            <button className="btn-primary-sm" onClick={() => setShowUploadModal(true)}>
              Upload PDF
            </button>
          }
        />
      ) : (
        <div className="progress-list">
          {documents.map((doc, i) => (
            <motion.div
              key={doc.documentId}
              className="progress-row"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.04 }}
            >
              <div className="progress-row-header">
                <div className="progress-doc-icon">
                  <FiFileText size={15} color="white" />
                </div>
                <Link to={`/viewer/${doc.documentId}`} className="progress-doc-title">
                  {doc.title}
                </Link>
              </div>

              <div className="progress-metrics">
                <div className="progress-metric-group">
                  <span className="progress-metric-label">
                    <FiLayers size={12} />
                    Flashcards
                  </span>
                  {doc.flashcards ? (
                    <>
                      <span className="progress-metric-value">
                        {doc.flashcards.reviewed} / {doc.flashcards.total} reviewed
                      </span>
                      <span className="progress-metric-sub">
                        {doc.flashcards.favorites} favorite{doc.flashcards.favorites !== 1 ? 's' : ''}
                      </span>
                    </>
                  ) : (
                    <span className="progress-metric-empty">No flashcards generated yet</span>
                  )}
                </div>

                <div className="progress-metric-group">
                  <span className="progress-metric-label">
                    <FiCheckSquare size={12} />
                    Quiz
                  </span>
                  {doc.quiz.attempts > 0 ? (
                    <>
                      <span className="progress-metric-value">
                        {doc.quiz.attempts} attempt{doc.quiz.attempts !== 1 ? 's' : ''}
                      </span>
                      <span className="progress-metric-sub">
                        Avg {doc.quiz.averageScorePct}% · Best {doc.quiz.bestScorePct}%
                      </span>
                      <span className="progress-metric-sub">
                        Last attempt: {formatDate(doc.quiz.lastAttemptAt)}
                      </span>
                    </>
                  ) : (
                    <span className="progress-metric-empty">No attempts yet</span>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <UploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUploaded={fetchProgress}
      />
    </div>
  );
};

export default Progress;
