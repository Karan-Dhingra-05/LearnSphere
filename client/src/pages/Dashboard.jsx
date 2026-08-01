import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  FiFileText,
  FiLayers,
  FiCheckCircle,
  FiTrendingUp,
  FiUpload,
  FiClock,
  FiArrowRight,
} from 'react-icons/fi';
import useAuth from '../hooks/useAuth.js';
import { getDashboardStats } from '../services/dashboardService.js';
import StatCard from '../components/StatCard.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { formatFileSize, formatDate, getGreeting } from '../utils/formatters.js';

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentDocuments, setRecentDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const { data } = await getDashboardStats();
        setStats(data.stats);
        setRecentDocuments(data.recentDocuments);
      } catch {
        toast.error('Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  const statCards = [
    {
      icon: FiFileText,
      value: stats?.totalDocuments ?? '—',
      label: 'Documents',
      gradient: 'linear-gradient(135deg, #3B82F6, #2563EB)',
      delay: 0.1,
    },
    {
      icon: FiLayers,
      value: stats?.totalFlashcardSets ?? '—',
      label: 'Flashcard Sets',
      gradient: 'linear-gradient(135deg, #8B5CF6, #7C3AED)',
      delay: 0.15,
    },
    {
      icon: FiCheckCircle,
      value: stats?.totalQuizzes ?? '—',
      label: 'Quizzes Taken',
      gradient: 'linear-gradient(135deg, #10B981, #059669)',
      delay: 0.2,
    },
    {
      icon: FiTrendingUp,
      value: stats?.avgScore !== undefined ? `${stats.avgScore}%` : '—',
      label: 'Average Score',
      gradient: 'linear-gradient(135deg, #F59E0B, #D97706)',
      delay: 0.25,
    },
  ];

  return (
    <div className="page-container">
      {/* Hero welcome banner */}
      <motion.div
        className="hero-banner"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
      >
        <div className="hero-banner-content">
          <h1 className="hero-greeting">
            {getGreeting()}, {user?.name?.split(' ')[0]}! 👋
          </h1>
          <p className="hero-sub">
            Your AI-powered learning assistant is ready. Upload a PDF to get started.
          </p>
          <Link to="/upload" className="hero-cta">
            <FiUpload size={15} />
            Upload a PDF
          </Link>
        </div>
        <div className="hero-banner-decoration" aria-hidden="true">
          <div className="hero-circle hero-circle--1" />
          <div className="hero-circle hero-circle--2" />
          <div className="hero-circle hero-circle--3" />
        </div>
      </motion.div>

      {/* Statistics cards */}
      <section className="section">
        <h2 className="section-title">Overview</h2>
        <div className="stats-grid">
          {statCards.map((card) => (
            <StatCard key={card.label} {...card} />
          ))}
        </div>
      </section>

      {/* Recent activity */}
      <section className="section">
        <div className="section-header">
          <h2 className="section-title">Recent Documents</h2>
          <Link to="/documents" className="section-link">
            View all <FiArrowRight size={14} />
          </Link>
        </div>

        {loading ? (
          <div className="loading-rows">
            {[1, 2, 3].map((i) => (
              <div key={i} className="loading-row-skeleton" />
            ))}
          </div>
        ) : recentDocuments.length === 0 ? (
          <EmptyState
            icon={FiFileText}
            title="No documents yet"
            description="Upload your first PDF to start learning with AI assistance."
            action={
              <Link to="/upload" className="btn-primary-sm">
                Upload PDF
              </Link>
            }
          />
        ) : (
          <div className="recent-docs-list">
            {recentDocuments.map((doc, i) => (
              <motion.div
                key={doc._id}
                className="recent-doc-row"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
              >
                <div className="recent-doc-icon">
                  <FiFileText size={16} color="white" />
                </div>
                <div className="recent-doc-info">
                  <p className="recent-doc-title">{doc.title}</p>
                  <p className="recent-doc-meta">
                    {formatFileSize(doc.fileSize)} · {formatDate(doc.createdAt)}
                  </p>
                </div>
                <div className="recent-doc-time">
                  <FiClock size={12} />
                  {formatDate(doc.createdAt)}
                </div>
                <Link
                  to={`/viewer/${doc._id}`}
                  className="recent-doc-open"
                >
                  Open <FiArrowRight size={13} />
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default Dashboard;
