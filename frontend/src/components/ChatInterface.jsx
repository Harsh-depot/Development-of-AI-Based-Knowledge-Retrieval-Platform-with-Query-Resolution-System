import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Send,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Layers,
  Sparkles,
  Bot,
  User,
  ShieldCheck,
  ShieldAlert,
  Activity,
  FileText,
  CornerDownLeft,
  HelpCircle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  XCircle,
  Files,
  RefreshCw,
} from 'lucide-react';
import { speechEngine } from '../utils/speech';

export default function ChatInterface({
  messages,
  documents = [],
  onSendMessage,
  isLoading,
  currentPipelineStage,
  onInspectResponse,
  activeDomain,
  onSeedData,
  isSeeding,
}) {
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [speechError, setSpeechError] = useState(null);
  const [speakingMessageId, setSpeakingMessageId] = useState(null);
  const [isPipelineExpanded, setIsPipelineExpanded] = useState(false); // Collapsed by default per user request
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, interimText]);

  // Voice Input Handler (Web Speech API)
  const toggleListening = async () => {
    setSpeechError(null);

    if (!speechEngine.isRecognitionSupported()) {
      setSpeechError("Browser Speech Recognition is not supported. Please use Google Chrome or Microsoft Edge.");
      return;
    }

    if (isListening) {
      speechEngine.stopListening();
      setIsListening(false);
      setInterimText('');
    } else {
      setIsListening(true);
      setInterimText('');

      await speechEngine.startListening({
        onInterim: (text) => {
          setInterimText(text);
          setSpeechError(null);
        },
        onFinal: (text) => {
          setInputText((prev) => (prev ? `${prev} ${text}` : text));
          setInterimText('');
          setIsListening(false);
          setSpeechError(null);
        },
        onError: (errMessage) => {
          console.warn("Speech recognition error:", errMessage);
          setIsListening(false);
          setInterimText('');
          setSpeechError(errMessage);
        },
        onEnd: () => {
          setIsListening(false);
          setInterimText('');
        },
      });
    }
  };

  // Text-to-Speech Output Handler (Web Speech API)
  const toggleSpeech = (msgId, text) => {
    if (speakingMessageId === msgId) {
      speechEngine.stopSpeaking();
      setSpeakingMessageId(null);
    } else {
      speechEngine.speak(text, {
        onStart: () => setSpeakingMessageId(msgId),
        onEnd: () => setSpeakingMessageId(null),
        onError: () => setSpeakingMessageId(null),
      });
    }
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!inputText.trim() || isLoading) return;
    const query = inputText.trim();
    setInputText('');
    setSpeechError(null);
    onSendMessage(query);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Dynamically compute suggestions strictly from currently active uploaded documents
  const dynamicSuggestions = useMemo(() => {
    if (!documents || documents.length === 0) return [];

    return documents.slice(0, 4).map((doc) => {
      const name = doc.filename;
      const lower = name.toLowerCase();
      const domain = doc.domain_category || 'General';

      let title = name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
      title = title.charAt(0).toUpperCase() + title.slice(1);

      let query = `What are the key points and details in ${name}?`;
      if (lower.includes('hr') || lower.includes('leave') || lower.includes('policy')) {
        query = `How many days of annual leave and casual leave are specified in ${name}?`;
      } else if (lower.includes('student') || lower.includes('handbook') || lower.includes('academic') || lower.includes('regulation')) {
        query = `What are the attendance requirements and condonation rules in ${name}?`;
      } else if (lower.includes('faq') || lower.includes('csv')) {
        query = `What are the frequently asked questions and troubleshooting steps in ${name}?`;
      } else if (lower.includes('cloud') || lower.includes('arch') || lower.includes('tech')) {
        query = `What are the architectural patterns and tech stack components in ${name}?`;
      }

      return {
        title,
        domain,
        filename: name,
        query,
      };
    });
  }, [documents]);

  const getConfidenceBadge = (confidence) => {
    const val = Number(confidence || 0);
    if (val >= 0.75) {
      return {
        label: `${(val * 100).toFixed(0)}% High`,
        classes: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      };
    } else if (val >= 0.40) {
      return {
        label: `${(val * 100).toFixed(0)}% Medium`,
        classes: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      };
    } else {
      return {
        label: `${(val * 100).toFixed(0)}% Knowledge Gap`,
        classes: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
      };
    }
  };

  const pipelineStages = [
    { id: 1, name: 'Memory Resolution' },
    { id: 2, name: 'Query Understanding' },
    { id: 3, name: 'Qdrant Retrieval' },
    { id: 4, name: 'FlashRank Reranking' },
    { id: 5, name: 'Response Synthesis' },
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0B0F19] relative overflow-hidden">
      
      {/* LangGraph Pipeline Dropdown Header (Collapsible) — matched height with Sidebar header */}
      <div className="border-b border-[#1F2937] bg-[#111827]">
        <div className="h-11 px-4 flex items-center justify-between text-xs">
          
          {/* Dropdown Toggle Button */}
          <button
            onClick={() => setIsPipelineExpanded(!isPipelineExpanded)}
            className="flex items-center space-x-2 text-slate-300 hover:text-white transition group focus:outline-none"
            title="Click to hide or show LangGraph pipeline stages"
          >
            <span className="font-semibold text-slate-200">LangGraph Pipeline:</span>
            <span className="text-[11px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 flex items-center gap-1 font-mono">
              5 Agents
              {isPipelineExpanded ? (
                <ChevronUp className="w-3.5 h-3.5 text-blue-400" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-blue-400" />
              )}
            </span>
          </button>

          {/* Active Domain Scope Indicator */}
          <div className="flex items-center space-x-2">
            <span className="text-slate-400 text-[11px]">Scope:</span>
            <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
              {activeDomain}
            </span>
          </div>

        </div>

        {/* Collapsible Pipeline Stages Ribbon */}
        {isPipelineExpanded && (
          <div className="px-4 py-2 bg-[#0B0F19] border-t border-[#1F2937] flex items-center space-x-2 font-mono text-[11px] overflow-x-auto transition-all animate-fadeIn">
            {pipelineStages.map((st, i) => (
              <React.Fragment key={st.id}>
                <span
                  className={`px-2 py-0.5 rounded whitespace-nowrap transition ${
                    isLoading
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                      : 'bg-[#111827] text-slate-300 border border-[#1F2937]'
                  }`}
                >
                  {st.name}
                </span>
                {i < pipelineStages.length - 1 && (
                  <span className="text-slate-600">→</span>
                )}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {messages.length === 0 ? (
          <div className="max-w-2xl mx-auto py-8 sm:py-12 text-center space-y-6">
            {/* Hero Icon */}
            <div className="w-14 h-14 rounded-xl bg-blue-600 text-white flex items-center justify-center mx-auto border border-blue-500/40">
              <Sparkles className="w-7 h-7 text-blue-100" />
            </div>

            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight">
                AI-Powered Intelligent Query Resolution
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-2 max-w-lg mx-auto leading-relaxed">
                Conversational assistant powered by a 5-Agent LangGraph architecture, FastEmbed vectors, and FlashRank cross-encoder reranking.
              </p>
            </div>

            {/* Dynamic Suggestions Generated from Uploaded Documents */}
            {dynamicSuggestions.length === 0 ? (
              <div className="rounded-xl p-6 bg-[#111827] border border-[#1F2937] text-center max-w-md mx-auto space-y-3">
                <Files className="w-8 h-8 text-slate-500 mx-auto opacity-50" />
                <h4 className="text-sm font-semibold text-slate-200">Knowledge Base is Empty</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  No documents currently indexed. Upload files in the sidebar, or load our pre-configured sample documents to get started.
                </p>
                {onSeedData && (
                  <button
                    onClick={onSeedData}
                    disabled={isSeeding}
                    className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition disabled:opacity-50 shadow-sm"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSeeding ? 'animate-spin' : ''}`} />
                    <span>{isSeeding ? 'Indexing Sample Knowledge Base...' : 'Load Sample Knowledge Base'}</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left pt-2">
                {dynamicSuggestions.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setInputText(p.query);
                      inputRef.current?.focus();
                    }}
                    className="rounded-lg p-3.5 bg-[#111827] border border-[#1F2937] hover:border-blue-500/50 text-left transition group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-blue-400 group-hover:text-blue-300 truncate max-w-[180px]">
                        {p.title}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#0B0F19] text-slate-400 uppercase font-mono border border-[#1F2937]">
                        {p.domain}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                      {p.query}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          messages.map((msg, index) => {
            const isUser = msg.role === 'user';
            const badge = !isUser && msg.confidence_score !== undefined ? getConfidenceBadge(msg.confidence_score) : null;
            const isSpeaking = speakingMessageId === msg.id;

            return (
              <div
                key={msg.id || index}
                className={`flex gap-3 sm:gap-4 max-w-3xl ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
              >
                {/* Avatar */}
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                    isUser
                      ? 'bg-[#1F2937] border-slate-700 text-slate-200'
                      : 'bg-blue-600 border-blue-500/40 text-white'
                  }`}
                >
                  {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                {/* Message Container */}
                <div className={`space-y-2 max-w-[85%] sm:max-w-[78%] ${isUser ? 'items-end' : 'items-start'}`}>
                  
                  {/* Assistant Meta Badge Bar */}
                  {!isUser && (
                    <div className="flex flex-wrap items-center gap-2">
                      {msg.query_type && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-[#111827] text-blue-400 border border-[#1F2937] font-mono">
                          {msg.query_type}
                        </span>
                      )}

                      {badge && (
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${badge.classes}`}>
                          {badge.label}
                        </span>
                      )}

                      {/* TTS Speak Button */}
                      <button
                        onClick={() => toggleSpeech(msg.id, msg.content)}
                        className={`flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-medium transition ${
                          isSpeaking
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                            : 'bg-[#111827] text-slate-400 hover:text-slate-200 border border-[#1F2937]'
                        }`}
                        title={isSpeaking ? 'Stop speaking' : 'Read aloud with browser Web Speech API'}
                      >
                        {isSpeaking ? (
                          <>
                            <div className="flex items-center space-x-0.5 h-3">
                              <span className="w-0.5 bg-blue-400 audio-bar-1" />
                              <span className="w-0.5 bg-blue-400 audio-bar-2" />
                              <span className="w-0.5 bg-blue-400 audio-bar-3" />
                            </div>
                            <span className="text-blue-400 ml-1">Stop Voice</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-3 h-3" />
                            <span>Read Aloud</span>
                          </>
                        )}
                      </button>

                      {/* Transparency Inspector Button */}
                      {msg.reranked_chunks && msg.reranked_chunks.length > 0 && (
                        <button
                          onClick={() => onInspectResponse(msg)}
                          className="flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-medium bg-[#111827] text-slate-400 hover:text-blue-300 border border-[#1F2937] transition"
                        >
                          <Layers className="w-3 h-3 text-blue-400" />
                          <span>Inspect Sources</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Message Bubble */}
                  <div
                    className={`rounded-lg p-4 text-sm leading-relaxed border ${
                      isUser
                        ? 'bg-blue-600/15 text-slate-100 border-blue-500/30'
                        : 'bg-[#111827] text-slate-200 border-[#1F2937]'
                    }`}
                  >
                    <div className="whitespace-pre-wrap font-sans">
                      {msg.content}
                    </div>

                    {/* Citations Footer */}
                    {!isUser && msg.citations && msg.citations.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-[#1F2937] flex flex-wrap gap-1.5">
                        <span className="text-[10px] uppercase font-semibold text-slate-400 self-center mr-1">
                          Sources:
                        </span>
                        {msg.citations.map((cite, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] bg-[#0B0F19] border border-[#1F2937] text-slate-300 font-mono"
                          >
                            <FileText className="w-3 h-3 text-blue-400" />
                            <span>
                              {cite.document_name} (p.{cite.page_number})
                            </span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Timestamp */}
                  <div className={`text-[10px] text-slate-500 px-1 ${isUser ? 'text-right' : 'text-left'}`}>
                    {msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                  </div>

                </div>
              </div>
            );
          })
        )}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex items-center space-x-3 text-slate-400 text-xs py-3 max-w-xl">
            <div className="w-8 h-8 rounded-lg bg-[#111827] border border-[#1F2937] flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-blue-400 animate-spin" />
            </div>
            <div className="rounded-lg px-4 py-2.5 bg-[#111827] border border-[#1F2937] flex items-center space-x-3">
              <div className="flex space-x-1">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="font-mono text-slate-300">
                Multi-Agent LangGraph resolving query...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 sm:p-4 border-t border-[#1F2937] bg-[#111827]">
        
        {/* Live Interim Voice Recognition Transcript Bubble */}
        {(isListening || interimText) && (
          <div className="mb-2 max-w-2xl mx-auto px-3 py-1.5 rounded-md bg-blue-950/40 border border-blue-500/40 flex items-center justify-between text-xs text-blue-300">
            <div className="flex items-center space-x-2">
              <span className="h-2 w-2 rounded-full bg-blue-400 animate-ping" />
              <span>Listening via Web Speech API: <em>"{interimText || 'Speak clearly now...'}"</em></span>
            </div>
            <button
              onClick={toggleListening}
              className="text-[10px] text-slate-400 hover:text-white"
            >
              Done / Stop
            </button>
          </div>
        )}

        {/* Speech Error Alert Banner */}
        {speechError && (
          <div className="mb-2 max-w-2xl mx-auto px-3 py-1.5 rounded-md bg-rose-950/40 border border-rose-500/40 flex items-center justify-between text-xs text-rose-300 animate-fadeIn">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{speechError}</span>
            </div>
            <button
              onClick={() => setSpeechError(null)}
              className="text-slate-400 hover:text-white ml-2"
            >
              <XCircle className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto relative flex items-center">
          
          {/* Microphone Voice Button */}
          <button
            type="button"
            onClick={toggleListening}
            className={`absolute left-2.5 p-2 rounded-md transition ${
              isListening
                ? 'bg-rose-600 text-white animate-pulse'
                : 'text-slate-400 hover:text-blue-400 hover:bg-[#0B0F19]'
            }`}
            title={isListening ? 'Stop recording voice' : 'Click to speak via Web Speech API'}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          {/* Textarea Input */}
          <textarea
            ref={inputRef}
            rows={1}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isListening ? "Listening to your voice..." : "Ask a query or speak naturally across knowledge bases..."}
            className="w-full pl-11 pr-14 py-2.5 bg-[#0B0F19] border border-[#1F2937] rounded-lg text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
          />

          {/* Send Button */}
          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="absolute right-2 p-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white transition disabled:opacity-30 disabled:hover:bg-blue-600"
            title="Send query (Enter)"
          >
            <Send className="w-4 h-4" />
          </button>

        </form>

        <p className="text-[10px] text-center text-slate-500 mt-2">
          AI Query Resolution System • Press <code>Enter</code> to send, <code>Shift + Enter</code> for newline
        </p>

      </div>

    </div>
  );
}
