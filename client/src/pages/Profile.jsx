import { motion } from 'framer-motion';
import { FiUser } from 'react-icons/fi';
import useAuth from '../hooks/useAuth.js';
import { formatDate } from '../utils/formatters.js';

const Profile = () => {
  const { user } = useAuth();

  const getInitials = (name) =>
    (name || 'U')
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  return (
    <div className="page-container">
      <motion.div
        className="page-header"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div>
          <h1 className="page-title">Profile</h1>
          <p className="page-subtitle">Your account information</p>
        </div>
      </motion.div>

      <motion.div
        className="profile-card"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <div className="profile-avatar-lg">
          {getInitials(user?.name)}
        </div>
        <div className="profile-info">
          <h2 className="profile-name">{user?.name}</h2>
          <p className="profile-email">{user?.email}</p>
          <p className="profile-since">
            Member since {user?.createdAt ? formatDate(user.createdAt) : '—'}
          </p>
        </div>
        <div className="profile-fields">
          <div className="profile-field">
            <label className="profile-field-label">Full Name</label>
            <p className="profile-field-value">{user?.name}</p>
          </div>
          <div className="profile-field">
            <label className="profile-field-label">Email Address</label>
            <p className="profile-field-value">{user?.email}</p>
          </div>
        </div>
        <p className="profile-edit-note">
          Profile editing will be available in a future update.
        </p>
      </motion.div>
    </div>
  );
};

export default Profile;
