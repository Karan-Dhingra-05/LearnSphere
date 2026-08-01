import { NavLink, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  FiGrid,
  FiFileText,
  FiUpload,
  FiBarChart2,
  FiHeart,
  FiUser,
  FiLogOut,
  FiSun,
} from 'react-icons/fi';
import useAuth from '../hooks/useAuth.js';

const NAV_ITEMS = [
  { path: '/dashboard', icon: FiGrid, label: 'Dashboard' },
  { path: '/documents', icon: FiFileText, label: 'Documents' },
  { path: '/upload', icon: FiUpload, label: 'Upload' },
  { path: '/progress', icon: FiBarChart2, label: 'Progress' },
  { path: '/favorites', icon: FiHeart, label: 'Favorites' },
  { path: '/profile', icon: FiUser, label: 'Profile' },
];

const getInitials = (name) =>
  (name || 'U')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

const Sidebar = ({ isOpen, onClose }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
      toast.success('Logged out successfully');
    } catch {
      toast.error('Logout failed');
    }
  };

  return (
    <aside className={`sidebar${isOpen ? ' sidebar--open' : ''}`}>
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <span className="sidebar-logo-text">LearnSphere</span>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ path, icon: Icon, label }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              `sidebar-nav-item${isActive ? ' active' : ''}`
            }
            onClick={onClose}
          >
            <Icon className="sidebar-nav-icon" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Bottom section */}
      <div className="sidebar-bottom">
        <button className="sidebar-theme-btn">
          <FiSun />
          <span>Light Mode</span>
        </button>

        <div className="sidebar-user-card">
          <div className="sidebar-avatar">{getInitials(user?.name)}</div>
          <div className="sidebar-user-info">
            <p className="sidebar-user-name">{user?.name}</p>
            <p className="sidebar-user-email">{user?.email}</p>
          </div>
        </div>

        <button className="sidebar-logout-btn" onClick={handleLogout}>
          <FiLogOut />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
