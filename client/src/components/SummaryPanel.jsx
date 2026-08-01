import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { FiAlignLeft, FiCopy, FiRefreshCw, FiAlertCircle, FiCheck } from 'react-icons/fi';
import { useState } from 'react';

/* ─── Presentational — all state owned by DocumentViewer ─────────────────── */

const SummaryPanel = ({
  summary,
  loading,
  error,
  onGenerate,
  onRegenerate,
  onDismissError,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!summary) return;
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  /* ── Loading state ──────────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="summary-panel summary-panel--loading">
        <div className="summary-loading-icon">
          <div className="btn-spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
        </div>
        <p className="summary-loading-text">Generating summary…</p>
        <p className="summary-loading-hint">This may take a few seconds.</p>
      </div>
    );
  }

  /* ── Empty state — no summary yet ──────────────────────────────────────── */
  if (!summary) {
    return (
      <div className="summary-panel summary-panel--empty">
        {/* Error banner */}
        <AnimatePresence>
          {error && (
            <motion.div
              className="summary-error"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <FiAlertCircle size={14} />
              <span>{error}</span>
              <button className="summary-error-dismiss" onClick={onDismissError}>×</button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="summary-empty-icon">
          <FiAlignLeft size={28} />
        </div>
        <h3 className="summary-empty-title">AI Summary</h3>
        <p className="summary-empty-desc">
          Generate a structured summary of this document including key points,
          important concepts, definitions, dates, and numbers.
        </p>
        <button
          id="summary-generate-btn"
          className="summary-generate-btn"
          onClick={onGenerate}
        >
          <FiAlignLeft size={15} />
          Generate Summary
        </button>
      </div>
    );
  }

  /* ── Summary exists ─────────────────────────────────────────────────────── */
  return (
    <div className="summary-panel summary-panel--result">
      {/* Action bar */}
      <div className="summary-action-bar">
        <span className="summary-action-label">AI Summary</span>
        <div className="summary-actions">
          <button
            id="summary-copy-btn"
            className="summary-action-btn"
            onClick={handleCopy}
            title="Copy summary"
          >
            {copied ? <FiCheck size={14} /> : <FiCopy size={14} />}
            <span>{copied ? 'Copied!' : 'Copy'}</span>
          </button>
          <button
            id="summary-regenerate-btn"
            className="summary-action-btn"
            onClick={onRegenerate}
            title="Regenerate summary"
          >
            <FiRefreshCw size={14} />
            <span>Regenerate</span>
          </button>
        </div>
      </div>

      {/* Error banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            className="summary-error"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <FiAlertCircle size={14} />
            <span>{error}</span>
            <button className="summary-error-dismiss" onClick={onDismissError}>×</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Markdown content */}
      <div className="summary-content">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code({ node, inline, className, children, ...props }) {
              if (inline) {
                return <code className="chat-inline-code" {...props}>{children}</code>;
              }
              return (
                <pre className="chat-code-block">
                  <code className={className} {...props}>{children}</code>
                </pre>
              );
            },
            table({ children }) {
              return <div className="chat-table-wrap"><table>{children}</table></div>;
            },
          }}
        >
          {summary}
        </ReactMarkdown>
      </div>
    </div>
  );
};

export default SummaryPanel;
