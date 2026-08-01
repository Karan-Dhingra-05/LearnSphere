import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { FiSend, FiMessageSquare, FiAlertCircle, FiCopy, FiCheck } from 'react-icons/fi';

// ─── Copy button for code blocks ─────────────────────────────────────────────
const CopyButton = ({ text }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (e.g. HTTP)
    }
  }, [text]);

  return (
    <button
      className="chat-code-copy-btn"
      onClick={handleCopy}
      title={copied ? 'Copied!' : 'Copy code'}
      aria-label={copied ? 'Copied!' : 'Copy code'}
    >
      {copied ? <FiCheck size={12} /> : <FiCopy size={12} />}
      <span>{copied ? 'Copied!' : 'Copy'}</span>
    </button>
  );
};

// ─── Code block wrapper (syntax highlighting + copy) ─────────────────────────
const CodeBlock = ({ language, children }) => {
  const code = String(children).replace(/\n$/, '');
  return (
    <div className="chat-code-block-wrap">
      <div className="chat-code-block-header">
        <span className="chat-code-lang">{language || 'code'}</span>
        <CopyButton text={code} />
      </div>
      <SyntaxHighlighter
        language={language || 'text'}
        style={oneDark}
        customStyle={{
          margin: 0,
          borderRadius: '0 0 8px 8px',
          fontSize: '0.8125rem',
          lineHeight: 1.6,
          padding: '14px 16px',
        }}
        codeTagProps={{ style: { fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace" } }}
        wrapLongLines={false}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
};

// ─── Custom ReactMarkdown component renderers ─────────────────────────────────
const markdownComponents = {
  // Detect inline vs block code: react-markdown v10 passes no `inline` prop —
  // we detect single-line with no language as inline code.
  code({ node, className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || '');
    const language = match ? match[1] : '';
    const raw = String(children).replace(/\n$/, '');

    // If it has a language tag OR spans multiple lines → fenced block
    const isBlock = language || raw.includes('\n');
    if (isBlock) {
      return <CodeBlock language={language}>{raw}</CodeBlock>;
    }

    // Otherwise render as inline badge
    return (
      <code className="chat-inline-code" {...props}>
        {children}
      </code>
    );
  },

  // Tables — responsive wrapper
  table({ children }) {
    return (
      <div className="chat-table-wrap">
        <table>{children}</table>
      </div>
    );
  },

  // Blockquotes — styled with left accent
  blockquote({ children }) {
    return <blockquote className="chat-blockquote">{children}</blockquote>;
  },

  // Headings — visual hierarchy
  h1: ({ children }) => <h1 className="chat-md-h1">{children}</h1>,
  h2: ({ children }) => <h2 className="chat-md-h2">{children}</h2>,
  h3: ({ children }) => <h3 className="chat-md-h3">{children}</h3>,

  // Lists — proper spacing
  ul: ({ children }) => <ul className="chat-md-ul">{children}</ul>,
  ol: ({ children }) => <ol className="chat-md-ol">{children}</ol>,
  li: ({ children }) => <li className="chat-md-li">{children}</li>,

  // Paragraphs
  p: ({ children }) => <p className="chat-md-p">{children}</p>,
};

// ─── Typing Indicator ─────────────────────────────────────────────────────────
const TypingIndicator = () => (
  <div className="chat-bubble chat-bubble--ai">
    <div className="chat-typing">
      <span className="chat-typing-dot" style={{ animationDelay: '0ms' }} />
      <span className="chat-typing-dot" style={{ animationDelay: '160ms' }} />
      <span className="chat-typing-dot" style={{ animationDelay: '320ms' }} />
    </div>
  </div>
);

// ─── Single Message ───────────────────────────────────────────────────────────
const Message = ({ msg }) => {
  const isUser = msg.role === 'user';

  return (
    <motion.div
      className={`chat-message ${isUser ? 'chat-message--user' : 'chat-message--ai'}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      {!isUser && (
        <div className="chat-avatar-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      )}

      <div className={`chat-bubble ${isUser ? 'chat-bubble--user' : 'chat-bubble--ai'}`}>
        {isUser ? (
          <p className="chat-bubble-text">{msg.content}</p>
        ) : (
          <div className="chat-markdown">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={markdownComponents}
            >
              {msg.content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </motion.div>
  );
};

// ─── Error Banner ─────────────────────────────────────────────────────────────
const ErrorBanner = ({ message, onDismiss }) => (
  <motion.div
    className="chat-error"
    initial={{ opacity: 0, y: 4 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0 }}
  >
    <FiAlertCircle size={14} />
    <span>{message}</span>
    <button className="chat-error-dismiss" onClick={onDismiss}>×</button>
  </motion.div>
);

// ─── Empty State ──────────────────────────────────────────────────────────────
const ChatEmptyState = () => (
  <div className="chat-empty">
    <div className="chat-empty-icon">
      <FiMessageSquare size={22} />
    </div>
    <p className="chat-empty-title">Ask anything about this document</p>
    <p className="chat-empty-hint">
      LearnSphere AI answers using only the content of this PDF.
    </p>
  </div>
);

/**
 * ChatPanel — presentational component.
 *
 * All chat state (messages, loading, input, error) is owned by DocumentViewer
 * and passed in as props. The component is never unmounted during tab switches —
 * DocumentViewer hides it with CSS — so conversation is always preserved.
 */
const ChatPanel = ({
  hasExtractedText,
  messages,
  loading,
  input,
  error,
  onInputChange,
  onSend,
  onDismissError,
}) => {
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Auto-scroll to newest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [input]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  if (!hasExtractedText) {
    return (
      <div className="chat-no-text">
        <FiAlertCircle size={22} color="#F59E0B" />
        <p className="chat-no-text-title">No extractable text</p>
        <p className="chat-no-text-desc">
          This PDF appears to be a scanned image. AI Chat requires a text-based PDF.
        </p>
      </div>
    );
  }

  return (
    <div className="chat-panel">
      {/* Message list */}
      <div className="chat-messages">
        {messages.length === 0 && !loading && <ChatEmptyState />}

        {messages.map((msg, i) => (
          <Message key={i} msg={msg} />
        ))}

        {loading && <TypingIndicator />}

        <div ref={messagesEndRef} />
      </div>

      {/* Error banner */}
      <AnimatePresence>
        {error && (
          <ErrorBanner message={error} onDismiss={onDismissError} />
        )}
      </AnimatePresence>

      {/* Input area */}
      <div className="chat-input-area">
        <div className="chat-input-wrap">
          <textarea
            ref={textareaRef}
            id="chat-input"
            className="chat-textarea"
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about this document…"
            rows={1}
            disabled={loading}
            aria-label="Chat message input"
          />
          <button
            id="chat-send-btn"
            className="chat-send-btn"
            onClick={onSend}
            disabled={loading || !input.trim()}
            aria-label="Send message"
          >
            <FiSend size={15} />
          </button>
        </div>
        <p className="chat-input-hint">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
};

export default ChatPanel;
