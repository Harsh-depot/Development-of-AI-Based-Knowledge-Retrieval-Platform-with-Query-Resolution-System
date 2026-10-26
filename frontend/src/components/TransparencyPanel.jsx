import React from 'react';
import {
  X,
  ShieldCheck,
  ShieldAlert,
  Layers,
  ArrowRight,
  BookOpen,
  Copy,
  Check,
  FileText,
  Activity,
  Sliders,
  Filter
} from 'lucide-react';

export default function TransparencyPanel({
  activeInspection,
  onClose,
}) {
  const [copiedId, setCopiedId] = React.useState(null);

  if (!activeInspection) return null;

  const {
    raw_query,
    standalone_query,
    query_type,
    is_ambiguous,
    confidence_score,
    reranked_chunks = [],
    citations = [],
    is_knowledge_gap,
  } = activeInspection;

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getConfidenceBadge = (score) => {
    const val = Number(score);
    if (val >= 0.75) {
      return {
        label: 'High Confidence',
        classes: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
        barClass: 'bg-emerald-500',
        icon: <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
      };
    } else if (val >= 0.40) {
      return {
        label: 'Medium Confidence',
        classes: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
        barClass: 'bg-amber-500',
        icon: <Activity className="w-3.5 h-3.5 text-amber-400" />
      };
    } else {
      return {
        label: 'Low (Knowledge Gap)',
        classes: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
        barClass: 'bg-rose-500',
        icon: <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
      };
    }
  };

  const badge = getConfidenceBadge(confidence_score);

  return (
    <aside className="fixed inset-y-0 right-0 z-50 w-full sm:w-[460px] glass-panel border-l border-slate-800/80 bg-slate-950/95 backdrop-blur-2xl flex flex-col shadow-2xl transition-all duration-300 ease-in-out">
      
      {/* Panel Header */}
      <div className="p-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/60">
        <div className="flex items-center space-x-2">
          <Layers className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-bold text-white tracking-wide">
            Response Transparency Panel
          </h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        
        {/* Calibrated Confidence Score Card */}
        <div className="glass-card rounded-xl p-4 border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Calibrated Confidence Score
            </span>
            <div className={`flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border ${badge.classes}`}>
              {badge.icon}
              <span>{badge.label}</span>
            </div>
          </div>

          <div className="flex items-baseline space-x-2 mb-2">
            <span className="text-3xl font-extrabold text-white font-mono">
              {(confidence_score * 100).toFixed(1)}%
            </span>
            <span className="text-xs text-slate-400">
              (Threshold: 40.0% cutoff)
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mb-2">
            <div
              className={`h-full ${badge.barClass} transition-all duration-500`}
              style={{ width: `${Math.min(confidence_score * 100, 100)}%` }}
            />
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed font-mono">
            Formula: C = 1 / (1 + exp(-z)) via FlashRank cross-encoder logit z.
          </p>
        </div>

        {/* Multi-Agent Query Transformation */}
        <div className="glass-card rounded-xl p-4 border border-slate-800 space-y-3">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            Agent Reasoning & Resolution
          </span>

          {/* Raw Query */}
          <div>
            <label className="text-[11px] font-medium text-slate-400 block mb-1">
              Raw User Query:
            </label>
            <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs text-slate-300 italic">
              "{raw_query}"
            </div>
          </div>

          {/* Standalone Query */}
          <div>
            <div className="flex items-center space-x-1 mb-1">
              <ArrowRight className="w-3 h-3 text-emerald-400" />
              <label className="text-[11px] font-medium text-emerald-300">
                Coreference Resolved Standalone Query:
              </label>
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-500/30 text-xs text-emerald-100 font-medium">
              "{standalone_query}"
            </div>
          </div>

          {/* Classification & Routing */}
          <div className="flex items-center space-x-2 pt-1">
            <span className="text-xs text-slate-400">Intent Classification:</span>
            <span className="px-2 py-0.5 rounded text-xs font-semibold uppercase bg-slate-800 text-cyan-300 border border-cyan-500/30 font-mono">
              {query_type}
            </span>
            {is_ambiguous && (
              <span className="px-2 py-0.5 rounded text-xs font-semibold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Ambiguous
              </span>
            )}
          </div>
        </div>

        {/* Retrieved & Reranked Source Chunks */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5">
              <BookOpen className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Precision Reranked Chunks ({reranked_chunks.length})
              </span>
            </div>
            <span className="text-[11px] text-slate-400">
              Top-4 Filtered Chunks
            </span>
          </div>

          {reranked_chunks.length === 0 ? (
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-center text-xs text-slate-500">
              No chunks passed the 0.40 confidence threshold. Query flagged as a Knowledge Gap.
            </div>
          ) : (
            reranked_chunks.map((chunk, idx) => (
              <div
                key={chunk.chunk_id || idx}
                className="glass-card rounded-xl p-3.5 border border-slate-800 hover:border-slate-700 transition space-y-2"
              >
                {/* Chunk Meta Header */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-1.5 font-medium text-slate-200">
                    <FileText className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="truncate max-w-[190px]" title={chunk.filename}>
                      {chunk.filename}
                    </span>
                    <span className="text-slate-400">•</span>
                    <span className="text-slate-400">p.{chunk.page_number}</span>
                    <span className="text-slate-400">•</span>
                    <span className="text-slate-400">#{chunk.chunk_index}</span>
                  </div>

                  <div className="flex items-center space-x-1 font-mono text-[11px] text-emerald-400 bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-500/20">
                    <span>C: {(Number(chunk.confidence_score) * 100).toFixed(1)}%</span>
                  </div>
                </div>

                {/* Chunk Text Body */}
                <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800/80 text-xs text-slate-300 leading-relaxed max-h-36 overflow-y-auto font-sans">
                  {chunk.chunk_text}
                </div>

                {/* Copy Chunk Action */}
                <div className="flex items-center justify-end">
                  <button
                    onClick={() => copyToClipboard(chunk.chunk_text, chunk.chunk_id || idx)}
                    className="flex items-center space-x-1 text-[11px] text-slate-400 hover:text-slate-200 transition"
                  >
                    {copiedId === (chunk.chunk_id || idx) ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy chunk</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

      </div>

      {/* Panel Footer */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950 text-[11px] text-slate-500 text-center">
        Zero-Cost Reranking • Local CPU FlashRank ms-marco
      </div>
    </aside>
  );
}
