import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiBarChart2 } from 'react-icons/fi';

const Progress = () => (
  <div className="page-container">
    <motion.div
      className="stub-page"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="stub-page-icon">
        <FiBarChart2 size={28} />
      </div>
      <h1 className="stub-page-title">Progress</h1>
      <p className="stub-page-desc">
        Track your quiz scores, flashcard performance, and overall learning progress.
        This feature will be available in an upcoming phase.
      </p>
      <Link to="/dashboard" className="btn-primary-sm">
        Back to Dashboard
      </Link>
    </motion.div>
  </div>
);

export default Progress;
