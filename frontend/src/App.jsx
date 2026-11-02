/**
 * App.jsx — Root Application Component
 * ======================================
 * Handles top-level routing:
 *   /login    → Login screen (public)
 *   /register → Register screen (public)
 *   /         → Main chat interface (protected — requires JWT)
 *
 * Unauthenticated users visiting "/" are redirected to "/login".
 * Authenticated users visiting "/login" or "/register" are redirected to "/".
 */

import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';

import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import TransparencyPanel from './components/TransparencyPanel';
import AnalyticsModal from './components/AnalyticsModal';
import Login from './components/auth/Login';
import Register from './components/auth/Register';

import {
  fetchHealth,
  fetchDocuments,
  uploadDocument,
  deleteDocument,
  sendQuery,
  fetchAnalytics,
  deleteAnalyticsGap,
  clearAllAnalytics,
  seedSampleData,
} from './utils/api';

// ---------------------------------------------------------------------------
// Protected Route wrapper
// ---------------------------------------------------------------------------

function ProtectedRoute({ children }) {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    // Show a minimal spinner while checking localStorage token
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0B0F19]">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  return user ? children : <Navigate to="/login" replace />;
}

// ---------------------------------------------------------------------------
// Public Route wrapper (redirect logged-in users to home)
// ---------------------------------------------------------------------------

function PublicRoute({ children }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  return user ? <Navigate to="/" replace /> : children;
}

// ---------------------------------------------------------------------------
// Main Chat App (rendered when authenticated)
// ---------------------------------------------------------------------------

function ChatApp() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [sessionId, setSessionId] = useState(() => {
    return localStorage.getItem('query_sys_session_id') || crypto.randomUUID();
  });
  const [documents, setDocuments] = useState([]);
  const [messages, setMessages] = useState([]);
  const [activeDomain, setActiveDomain] = useState('All');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [systemHealth, setSystemHealth] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const [activeInspection, setActiveInspection] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Load initial data on mount
  useEffect(() => {
    localStorage.setItem('query_sys_session_id', sessionId);
    loadInitialData();
  }, [sessionId]);

  const loadInitialData = async () => {
    try {
      const [health, docs, analytics] = await Promise.all([
        fetchHealth().catch(() => null),
        fetchDocuments().catch(() => []),
        fetchAnalytics().catch(() => null),
      ]);
      setSystemHealth(health);
      setDocuments(docs);
      setAnalyticsData(analytics);
    } catch (err) {
      console.warn('Failed to load initial data:', err);
    }
  };

  const handleSendMessage = async (queryText) => {
    if (!queryText.trim() || isLoading) return;

    const userMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: queryText,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await sendQuery({
        query: queryText,
        sessionId,
        domainFilter: activeDomain,
      });

      const assistantMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.generated_answer,
        raw_query: response.raw_query,
        standalone_query: response.standalone_query,
        query_type: response.query_type,
        is_ambiguous: response.is_ambiguous,
        confidence_score: response.confidence_score,
        citations: response.citations || [],
        reranked_chunks: response.reranked_chunks || [],
        is_knowledge_gap: response.is_knowledge_gap,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setActiveInspection(assistantMessage);
      fetchAnalytics().then(setAnalyticsData).catch(() => {});
    } catch (err) {
      const errorMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Error resolving query: ${err.message || 'Server connection error'}.`,
        confidence_score: 0.0,
        is_knowledge_gap: true,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpload = async (file, domain) => {
    setIsUploading(true);
    try {
      await uploadDocument(file, domain);
      const docs = await fetchDocuments();
      setDocuments(docs);
    } catch (err) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteDocument = async (docId) => {
    if (!confirm('Are you sure you want to delete this document and its indexed vectors?')) return;
    try {
      await deleteDocument(docId);
      const docs = await fetchDocuments();
      setDocuments(docs);
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleSeedData = async () => {
    setIsSeeding(true);
    try {
      await seedSampleData();
      const [docs, analytics] = await Promise.all([
        fetchDocuments(),
        fetchAnalytics().catch(() => null),
      ]);
      setDocuments(docs);
      if (analytics) setAnalyticsData(analytics);
    } catch (err) {
      alert(`Seeding failed: ${err.message}`);
    } finally {
      setIsSeeding(false);
    }
  };

  const handleDeleteGap = async (gapId) => {
    try {
      await deleteAnalyticsGap(gapId);
      setAnalyticsData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          total_queries: Math.max(0, (prev.total_queries || 1) - 1),
          low_confidence_count: Math.max(0, (prev.low_confidence_count || 1) - 1),
          unanswered_count: Math.max(0, (prev.unanswered_count || 1) - 1),
          recent_knowledge_gaps: (prev.recent_knowledge_gaps || []).filter((g) => g.id !== gapId),
        };
      });
    } catch (err) {
      alert(`Failed to delete gap report: ${err.message}`);
    }
  };

  const handleClearAllGaps = async () => {
    try {
      await clearAllAnalytics();
      setAnalyticsData((prev) => ({
        ...prev,
        low_confidence_count: 0,
        unanswered_count: 0,
        recent_knowledge_gaps: [],
      }));
    } catch (err) {
      alert(`Failed to clear gap reports: ${err.message}`);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0B0F19] text-slate-100 overflow-hidden font-sans">
      {/* Top Navbar */}
      <Navbar
        systemHealth={systemHealth}
        analyticsData={analyticsData}
        onOpenAnalytics={() => setIsAnalyticsOpen(true)}
        onSeedData={handleSeedData}
        isSeeding={isSeeding}
        documentCount={documents.length}
        user={user}
        onLogout={handleLogout}
      />

      {/* Main Workspace */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Sidebar */}
        <Sidebar
          documents={documents}
          activeDomain={activeDomain}
          setActiveDomain={setActiveDomain}
          onUpload={handleUpload}
          onDeleteDocument={handleDeleteDocument}
          isUploading={isUploading}
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        />

        {/* Center Chat Interface */}
        <main className="flex-1 flex flex-col h-full overflow-hidden relative">
          <ChatInterface
            messages={messages}
            documents={documents}
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            onInspectResponse={(msg) => setActiveInspection(msg)}
            activeDomain={activeDomain}
          />
        </main>

        {/* Right Transparency Panel */}
        {activeInspection && (
          <TransparencyPanel
            activeInspection={activeInspection}
            onClose={() => setActiveInspection(null)}
          />
        )}
      </div>

      {/* Knowledge Gap Analytics Modal */}
      {isAnalyticsOpen && (
        <AnalyticsModal
          analyticsData={analyticsData}
          onDeleteGap={handleDeleteGap}
          onClearAllGaps={handleClearAllGaps}
          onClose={() => setIsAnalyticsOpen(false)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root App with Routes
// ---------------------------------------------------------------------------

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <Register />
          </PublicRoute>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <ChatApp />
          </ProtectedRoute>
        }
      />
      {/* Catch-all: redirect any unknown path to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
