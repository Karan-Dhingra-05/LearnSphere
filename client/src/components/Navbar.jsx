import { FiMenu, FiSearch, FiBell } from 'react-icons/fi';
import useAuth from '../hooks/useAuth.js';

const getInitials = (name) =>
  (name || 'U')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

const Navbar = ({ onMenuClick }) => {
  const { user } = useAuth();

  return (
    <header className="app-navbar">
      {/* Mobile hamburger */}
      <button
        id="navbar-menu-toggle"
        className="navbar-hamburger"
        onClick={onMenuClick}
        aria-label="Toggle sidebar"
      >
        <FiMenu />
      </button>

      {/* Search bar */}
      <div className="navbar-search">
        <FiSearch className="navbar-search-icon" />
        <input
          id="navbar-search-input"
          type="text"
          className="navbar-search-input"
          placeholder="Search documents..."
          readOnly
        />
      </div>

      <div className="navbar-right">
        {/* Notifications */}
        <button
          id="navbar-notifications"
          className="navbar-icon-btn"
          aria-label="Notifications"
        >
          <FiBell />
          <span className="navbar-notif-badge" />
        </button>

        {/* User avatar */}
        <div className="navbar-avatar" title={user?.name}>
          {getInitials(user?.name)}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
