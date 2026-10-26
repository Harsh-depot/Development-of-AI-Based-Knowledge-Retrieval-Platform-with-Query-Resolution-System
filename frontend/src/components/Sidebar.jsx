import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  Trash2,
  Filter,
  CheckCircle2,
  FolderOpen,
  ChevronRight,
  AlertCircle,
  FileCode,
  Table,
  Files
} from 'lucide-react';

export default function Sidebar({
  documents,
  activeDomain,
  setActiveDomain,
  onUpload,
  onDeleteDocument,
  isUploading,
  isOpen,
  onToggle,
}) {
  const [selectedDomain, setSelectedDomain] = useState('General');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const domainOptions = [
    'General',
    'Human Resources',
    'Academic Regulations',
    'System FAQs',
    'Technical Specs',
  ];

  const filterDomains = ['All', 'Human Resources', 'Academic Regulations', 'System FAQs'];

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file, selectedDomain);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      onUpload(file, selectedDomain);
    }
  };

  const getFileIcon = (fileType) => {
    const type = fileType?.toLowerCase();
    if (type === 'pdf') return <FileText className="w-4 h-4 text-rose-400" />;
    if (type === 'csv') return <Table className="w-4 h-4 text-emerald-400" />;
    if (type === 'docx' || type === 'doc') return <FileCode className="w-4 h-4 text-blue-400" />;
    return <FileText className="w-4 h-4 text-slate-400" />;
  };

  return (
    <aside
      className={`fixed lg:static inset-y-0 left-0 z-30 w-80 glass-panel border-r border-slate-800/80 bg-slate-950/95 lg:bg-slate-950/60 backdrop-blur-xl flex flex-col transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}
    >
      {/* Sidebar Header */}
      <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <FolderOpen className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-bold text-white tracking-wide uppercase">Knowledge Base</h2>
        </div>
        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
          {documents.length} Docs
        </span>
      </div>

      {/* Domain Filtering Tabs */}
      <div className="p-3 border-b border-slate-800/80 bg-slate-900/40">
        <div className="flex items-center space-x-1 mb-2 text-xs text-slate-400 font-medium">
          <Filter className="w-3 h-3 text-emerald-400" />
          <span>Active Domain Scope:</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {filterDomains.map((dom) => (
            <button
              key={dom}
              onClick={() => setActiveDomain(dom)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium text-left truncate transition ${
                activeDomain === dom
                  ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-slate-900/60 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 border border-slate-800/60'
              }`}
            >
              {dom}
            </button>
          ))}
        </div>
      </div>

      {/* Upload Zone */}
      <div className="p-4 border-b border-slate-800/80">
        <div className="mb-2.5 flex items-center justify-between">
          <label className="text-xs font-medium text-slate-300">Target Category:</label>
          <select
            value={selectedDomain}
            onChange={(e) => setSelectedDomain(e.target.value)}
            className="text-xs bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            {domainOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`cursor-pointer rounded-xl border-2 border-dashed p-4 text-center transition flex flex-col items-center justify-center ${
            dragOver
              ? 'border-emerald-400 bg-emerald-950/20'
              : 'border-slate-700/80 hover:border-slate-600 bg-slate-900/30'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.doc,.txt,.csv"
            onChange={handleFileChange}
            className="hidden"
          />
          <UploadCloud className={`w-7 h-7 mb-1.5 ${isUploading ? 'animate-bounce text-emerald-400' : 'text-slate-400'}`} />
          <p className="text-xs font-semibold text-slate-200">
            {isUploading ? 'Ingesting Chunks...' : 'Click or Drag Document Here'}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            PDF, DOCX, TXT, FAQ CSV (Max 25MB)
          </p>
        </div>
      </div>

      {/* Document List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {documents.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs">
            <Files className="w-8 h-8 mx-auto mb-2 opacity-30 text-slate-400" />
            <p>No documents indexed yet.</p>
            <p className="text-[11px] text-slate-600 mt-1">
              Click "Load Sample KB" or upload above.
            </p>
          </div>
        ) : (
          documents.map((doc) => (
            <div
              key={doc.id}
              className="glass-card glass-card-hover rounded-xl p-3 flex items-start justify-between group"
            >
              <div className="flex items-start space-x-2.5 min-w-0">
                <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 shrink-0">
                  {getFileIcon(doc.file_type)}
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-semibold text-slate-200 truncate group-hover:text-emerald-300 transition" title={doc.filename}>
                    {doc.filename}
                  </h4>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-medium">
                      {doc.domain_category}
                    </span>
                    <span className="text-[10px] text-emerald-400/90 font-mono">
                      {doc.chunk_count} chunks
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteDocument(doc.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition shrink-0 ml-1"
                title="Delete document and indexed vectors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950 text-[11px] text-slate-500 flex items-center justify-between">
        <span>384d FastEmbed • Qdrant</span>
        <span className="text-emerald-400 font-mono">Free Tier $0.00</span>
      </div>
    </aside>
  );
}
