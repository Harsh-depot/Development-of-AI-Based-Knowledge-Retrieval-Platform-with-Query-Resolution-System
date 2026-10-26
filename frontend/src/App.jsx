import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import TransparencyPanel from './components/TransparencyPanel';
import AnalyticsModal from './components/AnalyticsModal';
import {
  fetchHealth,
  fetchDocuments,
  uploadDocument,
  deleteDocument,
  sendQuery,
  fetchAnalytics,
  seedSampleData,
} from './utils/api';

export default function App() {
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

  // Initial load
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
      console.warn("Failed to load initial data:", err);
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
      // Automatically inspect response in Transparency Panel
      setActiveInspection(assistantMessage);

      // Refresh analytics in background
      fetchAnalytics().then(setAnalyticsData).catch(() => {});
    } catch (err) {
      const errorMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Error resolving query: ${err.message || 'Server connection error'}. Please check if the backend service is running.`,
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
    if (!confirm("Are you sure you want to delete this document and its indexed vectors?")) return;
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
      const docs = await fetchDocuments();
      setDocuments(docs);
    } catch (err) {
      alert(`Seeding failed: ${err.message}`);
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#070a13] text-slate-100 overflow-hidden font-sans">
      
      {/* Top Navbar */}
      <Navbar
        systemHealth={systemHealth}
        analyticsData={analyticsData}
        onOpenAnalytics={() => setIsAnalyticsOpen(true)}
        onSeedData={handleSeedData}
        isSeeding={isSeeding}
        documentCount={documents.length}
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
          onClose={() => setIsAnalyticsOpen(false)}
        />
      )}

    </div>
  );
}
