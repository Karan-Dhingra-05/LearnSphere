import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { FiUploadCloud, FiFile, FiX } from 'react-icons/fi';
import { uploadDocument } from '../services/documentService.js';
import { formatFileSize } from '../utils/formatters.js';

/**
 * UploadModal — compact upload dialog reused across Dashboard, Documents,
 * and Progress. Ports the same validation/drag-drop/progress logic that
 * previously lived in the standalone Upload page; the only difference is
 * what happens after a successful upload (stay put + let the caller refresh
 * its own data, instead of navigating to the document viewer).
 *
 * @param {boolean}  isOpen     - Whether the modal is visible.
 * @param {Function} onClose    - Called to dismiss the modal (ignored while uploading).
 * @param {Function} onUploaded - Called with the created document after the
 *                                parent's refresh callback has run, right before closing.
 */
const UploadModal = ({ isOpen, onClose, onUploaded }) => {
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef(null);

  // Reset local state whenever the modal opens fresh, so a stale selection
  // from a previous open (or a cancelled upload) never lingers.
  useEffect(() => {
    if (isOpen) {
      setFile(null);
      setIsDragging(false);
      setUploading(false);
      setProgress(0);
    }
  }, [isOpen]);

  const requestClose = useCallback(() => {
    if (uploading) return; // never close mid-upload
    onClose();
  }, [uploading, onClose]);

  // Escape closes the modal, but only when it's safe to do so.
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') requestClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, requestClose]);

  const validateAndSetFile = useCallback((selectedFile) => {
    if (!selectedFile) return;
    if (selectedFile.type !== 'application/pdf') {
      toast.error('Only PDF files are allowed');
      return;
    }
    if (selectedFile.size > 50 * 1024 * 1024) {
      toast.error('File size must be under 50 MB');
      return;
    }
    setFile(selectedFile);
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setIsDragging(false);
      validateAndSetFile(e.dataTransfer.files[0]);
    },
    [validateAndSetFile]
  );

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleFileInput = (e) => {
    validateAndSetFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', file.name.replace(/\.pdf$/i, ''));

    setUploading(true);
    setProgress(0);

    try {
      const { data } = await uploadDocument(formData, (pct) => setProgress(pct));
      toast.success('Document uploaded successfully!');
      // 1. Upload request has completed. 2. Let the parent refresh its own
      // data. 3. Only then close — so the modal never disappears before the
      // new document is actually reflected on the page underneath.
      await onUploaded?.(data);
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Upload failed. Please try again.');
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onMouseDown={requestClose}
        >
          <motion.div
            className="modal-card"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 className="modal-title">Upload Document</h2>
              <button
                className="modal-close-btn"
                onClick={requestClose}
                disabled={uploading}
                aria-label="Close"
              >
                <FiX size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div
                id="upload-modal-dropzone"
                className={`upload-dropzone${isDragging ? ' upload-dropzone--active' : ''}${file ? ' upload-dropzone--has-file' : ''}`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => !file && fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && !file && fileInputRef.current?.click()}
                aria-label="PDF upload dropzone"
              >
                <input
                  ref={fileInputRef}
                  id="upload-modal-file-input"
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileInput}
                  style={{ display: 'none' }}
                />

                {!file ? (
                  <div className="upload-placeholder">
                    <div className={`upload-icon-wrap${isDragging ? ' upload-icon-wrap--active' : ''}`}>
                      <FiUploadCloud size={30} />
                    </div>
                    <p className="upload-primary-text">
                      {isDragging ? 'Drop your PDF here' : 'Drag & drop your PDF here'}
                    </p>
                    <p className="upload-secondary-text">or click to browse</p>
                    <p className="upload-hint">PDF files only · Maximum 50 MB</p>
                  </div>
                ) : (
                  <div className="upload-file-preview">
                    <div className="upload-file-icon">
                      <FiFile size={24} color="white" />
                    </div>
                    <div className="upload-file-info">
                      <p className="upload-file-name">{file.name}</p>
                      <p className="upload-file-size">{formatFileSize(file.size)}</p>
                    </div>
                    <button
                      className="upload-file-remove"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                        setProgress(0);
                      }}
                      aria-label="Remove selected file"
                    >
                      <FiX size={16} />
                    </button>
                  </div>
                )}
              </div>

              {uploading && (
                <div className="upload-progress-wrap">
                  <div className="upload-progress-bar">
                    <motion.div
                      className="upload-progress-fill"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ ease: 'easeOut' }}
                    />
                  </div>
                  <p className="upload-progress-label">{progress}% uploaded</p>
                </div>
              )}

              {file && (
                <button
                  id="upload-modal-submit-btn"
                  className="upload-submit-btn"
                  onClick={handleUpload}
                  disabled={uploading}
                >
                  {uploading ? (
                    <>
                      <span className="btn-spinner" />
                      Uploading…
                    </>
                  ) : (
                    <>
                      <FiUploadCloud size={16} />
                      Upload
                    </>
                  )}
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default UploadModal;
