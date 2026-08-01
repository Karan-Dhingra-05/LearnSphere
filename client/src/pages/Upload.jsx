import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { FiUploadCloud, FiFile, FiX } from 'react-icons/fi';
import { uploadDocument } from '../services/documentService.js';
import { formatFileSize } from '../utils/formatters.js';

const Upload = () => {
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

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
      navigate(`/viewer/${data._id}`);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Upload failed. Please try again.');
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className="page-container">
      <motion.div
        className="page-header"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div>
          <h1 className="page-title">Upload Document</h1>
          <p className="page-subtitle">Upload a PDF to unlock AI-powered learning tools</p>
        </div>
      </motion.div>

      <motion.div
        className="upload-wrapper"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        {/* Drop zone */}
        <div
          id="upload-dropzone"
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
            id="upload-file-input"
            type="file"
            accept="application/pdf"
            onChange={handleFileInput}
            style={{ display: 'none' }}
          />

          {!file ? (
            <div className="upload-placeholder">
              <div className={`upload-icon-wrap${isDragging ? ' upload-icon-wrap--active' : ''}`}>
                <FiUploadCloud size={36} />
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
                <FiFile size={28} color="white" />
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

        {/* Progress bar */}
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

        {/* Upload button */}
        {file && (
          <motion.button
            id="upload-submit-btn"
            className="upload-submit-btn"
            onClick={handleUpload}
            disabled={uploading}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {uploading ? (
              <>
                <span className="btn-spinner" />
                Uploading…
              </>
            ) : (
              <>
                <FiUploadCloud size={16} />
                Upload & Open
              </>
            )}
          </motion.button>
        )}
      </motion.div>
    </div>
  );
};

export default Upload;
