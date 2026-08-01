import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { FiFileText, FiUpload } from 'react-icons/fi';
import { getDocuments } from '../services/documentService.js';
import DocumentCard from '../components/DocumentCard.jsx';
import EmptyState from '../components/EmptyState.jsx';

const Documents = () => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const { data } = await getDocuments();
        setDocuments(data);
      } catch {
        toast.error('Failed to load documents');
      } finally {
        setLoading(false);
      }
    };
    fetchDocuments();
  }, []);

  const handleDocumentDeleted = (id) => {
    setDocuments((prev) => prev.filter((d) => d._id !== id));
  };

  return (
    <div className="page-container">
      {/* Page header */}
      <motion.div
        className="page-header"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div>
          <h1 className="page-title">My Documents</h1>
          <p className="page-subtitle">
            {documents.length > 0
              ? `${documents.length} document${documents.length !== 1 ? 's' : ''} uploaded`
              : 'No documents yet'}
          </p>
        </div>
        <Link to="/upload" className="btn-primary-action">
          <FiUpload size={15} />
          Upload PDF
        </Link>
      </motion.div>

      {/* Content */}
      {loading ? (
        <div className="docs-grid">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="doc-card-skeleton" />
          ))}
        </div>
      ) : documents.length === 0 ? (
        <EmptyState
          icon={FiFileText}
          title="No documents uploaded"
          description="Upload a PDF to start learning. AI-powered tools like chat, summaries, flashcards, and quizzes will be available on each document."
          action={
            <Link to="/upload" className="btn-primary-sm">
              <FiUpload size={14} />
              Upload your first PDF
            </Link>
          }
        />
      ) : (
        <div className="docs-grid">
          {documents.map((doc, index) => (
            <DocumentCard
              key={doc._id}
              document={doc}
              onDeleted={handleDocumentDeleted}
              index={index}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Documents;
