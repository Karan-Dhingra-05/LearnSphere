import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiFileText, FiExternalLink, FiTrash2 } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { deleteDocument } from '../services/documentService.js';
import { formatFileSize, formatDate } from '../utils/formatters.js';

const DocumentCard = ({ document, onDeleted, index = 0 }) => {
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const navigate = useNavigate();

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      await deleteDocument(document._id);
      toast.success('Document deleted');
      onDeleted(document._id);
    } catch {
      toast.error('Failed to delete document');
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <motion.div
      className="doc-card"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06, ease: 'easeOut' }}
      whileHover={{ y: -4, transition: { duration: 0.15 } }}
    >
      {/* PDF icon */}
      <div className="doc-card-icon">
        <FiFileText size={22} color="white" />
      </div>

      {/* Info */}
      <div className="doc-card-info">
        <h3 className="doc-card-title" title={document.title}>
          {document.title}
        </h3>
        <p className="doc-card-meta">
          {formatFileSize(document.fileSize)}
          <span className="doc-card-dot">·</span>
          {formatDate(document.createdAt)}
        </p>
      </div>

      {/* Actions */}
      <div className="doc-card-actions">
        <button
          id={`doc-open-${document._id}`}
          className="doc-card-btn doc-card-btn--open"
          onClick={() => navigate(`/viewer/${document._id}`)}
          aria-label="Open document"
        >
          <FiExternalLink size={14} />
          Open
        </button>

        {confirmDelete ? (
          <div className="doc-card-confirm">
            <button
              id={`doc-confirm-delete-${document._id}`}
              className="doc-card-btn doc-card-btn--danger"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Deleting…' : 'Confirm'}
            </button>
            <button
              className="doc-card-btn doc-card-btn--ghost"
              onClick={() => setConfirmDelete(false)}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            id={`doc-delete-${document._id}`}
            className="doc-card-btn doc-card-btn--delete"
            onClick={handleDelete}
            aria-label="Delete document"
          >
            <FiTrash2 size={14} />
          </button>
        )}
      </div>
    </motion.div>
  );
};

export default DocumentCard;
