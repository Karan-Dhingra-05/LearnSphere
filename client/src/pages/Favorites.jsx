import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiHeart } from 'react-icons/fi';

const Favorites = () => (
  <div className="page-container">
    <motion.div
      className="stub-page"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="stub-page-icon">
        <FiHeart size={28} />
      </div>
      <h1 className="stub-page-title">Favorites</h1>
      <p className="stub-page-desc">
        All your starred flashcards will live here for quick review.
        This feature will be available once flashcards are implemented.
      </p>
      <Link to="/dashboard" className="btn-primary-sm">
        Back to Dashboard
      </Link>
    </motion.div>
  </div>
);

export default Favorites;
