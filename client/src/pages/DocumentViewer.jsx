import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Worker, Viewer } from '@react-pdf-viewer/core';
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';
import {
  FiFileText,
  FiMessageSquare,
  FiAlignLeft,
  FiLayers,
  FiCheckSquare,
  FiArrowLeft,
} from 'react-icons/fi';
import { getDocument } from '../services/documentService.js';
import { sendChatMessage } from '../services/aiService.js';
import { createSummary, regenerateSummary } from '../services/summaryService.js';
import { getFlashcards } from '../services/flashcardService.js';
import ChatPanel from '../components/ChatPanel.jsx';
import SummaryPanel from '../components/SummaryPanel.jsx';
import FlashcardPanel from '../components/FlashcardPanel.jsx';

const WORKER_URL =
  'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

const TABS = [
  { id: 'content',    label: 'Content',    icon: FiFileText },
  { id: 'chat',       label: 'Chat',       icon: FiMessageSquare },
  { id: 'summary',    label: 'Summary',    icon: FiAlignLeft },
  { id: 'flashcards', label: 'Flashcards', icon: FiLayers },
  { id: 'quiz',       label: 'Quiz',       icon: FiCheckSquare },
];

const PLACEHOLDERS = {
  flashcards: {
    icon: FiLayers,
    title: 'Flashcard Generator',
    description: 'Automatically generate flashcards from your document for active recall.',
  },
  quiz: {
    icon: FiCheckSquare,
    title: 'Quiz Generator',
    description: 'Create multiple-choice quizzes from your document to test your knowledge.',
  },
};

const TabPlaceholder = ({ tabId }) => {
  const config = PLACEHOLDERS[tabId];
  if (!config) return null;
  const Icon = config.icon;
  return (
    <div className="viewer-placeholder">
      <div className="viewer-placeholder-icon">
        <Icon size={28} />
      </div>
      <h3 className="viewer-placeholder-title">{config.title}</h3>
      <p className="viewer-placeholder-desc">{config.description}</p>
      <div className="viewer-placeholder-badge">
        <span>Powered by AI · Coming soon</span>
      </div>
    </div>
  );
};

const DocumentViewer = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  // ── Document ─────────────────────────────────────────────────────────────────
  const [document, setDocument] = useState(null);
  const [docLoading, setDocLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('content');

  // ── Chat state ───────────────────────────────────────────────────────────────
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState(null);

  // ── Summary state ────────────────────────────────────────────────────────────
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState(null);

  // ── Flashcard state ──────────────────────────────────────────────────────────
  const [flashcardSet, setFlashcardSet] = useState(null);
  const [flashcardLoading, setFlashcardLoading] = useState(false);
  const [flashcardError, setFlashcardError] = useState(null);

  // ── PDF viewer plugin ─────────────────────────────────────────────────────────
  const defaultLayoutPluginInstance = defaultLayoutPlugin({
    sidebarTabs: () => [],
    renderToolbar: (Toolbar) => (
      <Toolbar>
        {(slots) => {
          const {
            CurrentPageInput,
            GoToNextPage,
            GoToPreviousPage,
            NumberOfPages,
            ZoomIn,
            ZoomOut,
            Zoom,
          } = slots;
          return (
            <div className="pdf-toolbar">
              <GoToPreviousPage />
              <div className="pdf-toolbar-page">
                <CurrentPageInput />
                <span className="pdf-toolbar-sep">/</span>
                <NumberOfPages />
              </div>
              <GoToNextPage />
              <div className="pdf-toolbar-divider" />
              <ZoomOut />
              <Zoom />
              <ZoomIn />
            </div>
          );
        }}
      </Toolbar>
    ),
  });

  // ── Fetch document (also hydrates cached summary from MongoDB) ───────────────
  useEffect(() => {
    const fetchDocument = async () => {
      try {
        const [{ data: docData }, { data: fcData }] = await Promise.all([
          getDocument(id),
          getFlashcards(id).catch(() => ({ data: { flashcardSet: null } })),
        ]);
        setDocument(docData);
        if (docData.summary) setSummary(docData.summary);
        if (fcData.flashcardSet) setFlashcardSet(fcData.flashcardSet);
      } catch {
        toast.error('Document not found');
        navigate('/documents');
      } finally {
        setDocLoading(false);
      }
    };
    fetchDocument();
  }, [id, navigate]);

  // ── Chat ─────────────────────────────────────────────────────────────────────
  const handleChatSend = useCallback(async () => {
    const trimmed = chatInput.trim();
    if (!trimmed || chatLoading) return;
    setChatError(null);

    const userMessage = { role: 'user', content: trimmed };
    const updatedMessages = [...chatMessages, userMessage];

    setChatMessages(updatedMessages);
    setChatInput('');
    setChatLoading(true);

    try {
      const historyForApi = updatedMessages
        .slice(0, -1)
        .map(({ role, content }) => ({ role, content }));

      const { data } = await sendChatMessage(id, trimmed, historyForApi);

      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.response },
      ]);
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        (err?.response?.status === 429
          ? 'The AI service is temporarily busy. Please wait a moment and try again.'
          : err?.response?.status === 503
          ? 'The AI service is temporarily unavailable. Please try again.'
          : 'Failed to get a response. Please try again.');
      setChatError(message);
      setChatMessages(chatMessages);
    } finally {
      setChatLoading(false);
    }
  }, [chatInput, chatLoading, chatMessages, id]);

  // ── Summary ──────────────────────────────────────────────────────────────────
  const handleGenerateSummary = useCallback(async () => {
    if (summaryLoading) return;
    setSummaryError(null);
    setSummaryLoading(true);
    try {
      const { data } = await createSummary(id);
      setSummary(data.summary);
    } catch (err) {
      setSummaryError(
        err?.response?.data?.message || 'Failed to generate summary. Please try again.'
      );
    } finally {
      setSummaryLoading(false);
    }
  }, [id, summaryLoading]);

  const handleRegenerateSummary = useCallback(async () => {
    if (summaryLoading) return;
    setSummaryError(null);
    setSummaryLoading(true);
    try {
      const { data } = await regenerateSummary(id);
      setSummary(data.summary);
    } catch (err) {
      setSummaryError(
        err?.response?.data?.message || 'Failed to regenerate summary. Please try again.'
      );
    } finally {
      setSummaryLoading(false);
    }
  }, [id, summaryLoading]);

  // ── Render ────────────────────────────────────────────────────────────────────
  const pdfUrl = document
    ? `${import.meta.env.VITE_API_URL.replace('/api', '')}/uploads/${document.pdfPath}`
    : null;

  if (docLoading) {
    return (
      <div className="viewer-loading">
        <div className="btn-spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
      </div>
    );
  }

  return (
    <div className="viewer-root">
      {/* Header */}
      <div className="viewer-header">
        <button
          className="viewer-back-btn"
          onClick={() => navigate('/documents')}
          aria-label="Back to documents"
        >
          <FiArrowLeft size={16} />
          <span>Documents</span>
        </button>
        <h1 className="viewer-doc-title">{document?.title}</h1>
      </div>

      {/* Full-width tab bar */}
      <div className="viewer-tabs">
        {TABS.map(({ id: tabId, label, icon: Icon }) => (
          <button
            key={tabId}
            id={`viewer-tab-${tabId}`}
            className={`viewer-tab-btn${activeTab === tabId ? ' active' : ''}`}
            onClick={() => setActiveTab(tabId)}
            aria-selected={activeTab === tabId}
          >
            <Icon size={14} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="viewer-tab-area">

        {/* Content — PDF viewer */}
        <div
          className="viewer-tab-panel"
          style={{ display: activeTab === 'content' ? 'flex' : 'none' }}
        >
          <motion.div
            className="viewer-pdf-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {pdfUrl && (
              <Worker workerUrl={WORKER_URL}>
                <Viewer
                  fileUrl={pdfUrl}
                  plugins={[defaultLayoutPluginInstance]}
                  theme="light"
                />
              </Worker>
            )}
          </motion.div>
        </div>

        {/* Chat — always mounted */}
        <div
          className="viewer-tab-panel viewer-tab-panel--chat"
          style={{ display: activeTab === 'chat' ? 'flex' : 'none' }}
        >
          <ChatPanel
            hasExtractedText={Boolean(document?.fileSize)}
            messages={chatMessages}
            loading={chatLoading}
            input={chatInput}
            error={chatError}
            onInputChange={setChatInput}
            onSend={handleChatSend}
            onDismissError={() => setChatError(null)}
          />
        </div>

        {/* Summary — always mounted */}
        <div
          className="viewer-tab-panel viewer-tab-panel--summary"
          style={{ display: activeTab === 'summary' ? 'flex' : 'none' }}
        >
          <SummaryPanel
            summary={summary}
            loading={summaryLoading}
            error={summaryError}
            onGenerate={handleGenerateSummary}
            onRegenerate={handleRegenerateSummary}
            onDismissError={() => setSummaryError(null)}
          />
        </div>

        {/* Flashcards — always mounted */}
        <div
          className="viewer-tab-panel viewer-tab-panel--flashcards"
          style={{ display: activeTab === 'flashcards' ? 'flex' : 'none' }}
        >
          <FlashcardPanel
            documentId={id}
            flashcardSet={flashcardSet}
            loading={flashcardLoading}
            error={flashcardError}
            onSetLoaded={setFlashcardSet}
            onDismissError={() => setFlashcardError(null)}
          />
        </div>

        {/* Placeholder tab — Quiz */}
        <div
          className="viewer-tab-panel viewer-tab-panel--placeholder"
          style={{ display: activeTab === 'quiz' ? 'flex' : 'none' }}
        >
          <TabPlaceholder tabId="quiz" />
        </div>
      </div>
    </div>
  );
};

export default DocumentViewer;
