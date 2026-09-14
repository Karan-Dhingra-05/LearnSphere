import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiMenu, FiSearch, FiFileText } from 'react-icons/fi';
import { getDocuments } from '../services/documentService.js';

const Navbar = ({ onMenuClick }) => {
  const navigate = useNavigate();

  const [documents, setDocuments] = useState([]);
  const [documentsLoaded, setDocumentsLoaded] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const searchRef = useRef(null);

  // Fetch the user's documents once — reused for client-side title search
  // rather than adding a dedicated search endpoint.
  useEffect(() => {
    getDocuments()
      .then(({ data }) => setDocuments(data))
      .catch(() => setDocuments([]))
      .finally(() => setDocumentsLoaded(true));
  }, []);

  // Short debounce so filtering doesn't recompute on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(timer);
  }, [query]);

  // Close the dropdown on outside click.
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const trimmedQuery = debouncedQuery.trim().toLowerCase();
  const results = trimmedQuery
    ? documents.filter((doc) => doc.title.toLowerCase().includes(trimmedQuery))
    : [];

  const handleSelect = useCallback(
    (docId) => {
      setQuery('');
      setDebouncedQuery('');
      setIsOpen(false);
      navigate(`/viewer/${docId}`);
    },
    [navigate]
  );

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setQuery('');
      setDebouncedQuery('');
      setIsOpen(false);
      e.target.blur();
    }
  };

  const showDropdown = isOpen && trimmedQuery.length > 0;

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
      <div className="navbar-search" ref={searchRef}>
        <FiSearch className="navbar-search-icon" />
        <input
          id="navbar-search-input"
          type="text"
          className="navbar-search-input"
          placeholder="Search documents..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
        />

        {showDropdown && (
          <div className="navbar-search-dropdown">
            {!documentsLoaded ? (
              <div className="navbar-search-status">Loading…</div>
            ) : results.length === 0 ? (
              <div className="navbar-search-status">No documents found</div>
            ) : (
              results.map((doc) => (
                <button
                  key={doc._id}
                  className="navbar-search-result"
                  onClick={() => handleSelect(doc._id)}
                >
                  <FiFileText size={14} />
                  <span>{doc.title}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </header>
  );
};

export default Navbar;
