import React, { useState } from 'react';
import {
  X,
  BarChart3,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  TrendingUp,
  HelpCircle,
  Clock,
  Layers
} from 'lucide-react';

export default function AnalyticsModal({
  analyticsData,
  onDeleteGap,
  onClearAllGaps,
  onClose,
}) {
  const [deletingId, setDeletingId] = useState(null);
  const [isClearingAll, setIsClearingAll] = useState(false);

  if (!analyticsData) return null;

  const {
    total_queries = 0,
    unanswered_count = 0,
    low_confidence_count = 0,
    average_confidence = 0.0,
    recent_knowledge_gaps = [],
  } = analyticsData;

  const handleDelete = async (gapId) => {
    setDeletingId(gapId);
    try {
      if (onDeleteGap) await onDeleteGap(gapId);
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm("Are you sure you want to delete all knowledge gap reports?")) return;
    setIsClearingAll(true);
    try {
      if (onClearAllGaps) await onClearAllGaps();
    } finally {
      setIsClearingAll(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-xl border border-[#1F2937] bg-[#111827] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-[#1F2937] flex items-center justify-between bg-[#0B0F19]">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100 tracking-tight">
                Query Analytics & Knowledge Gap Detection
              </h3>
              <p className="text-xs text-slate-400">
                Continuous Tracking of Low-Confidence (&lt;0.40) & Unanswered Queries
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-[#1F2937] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Metric Cards Grid */}
        <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#0B0F19] border-b border-[#1F2937]">
          
          <div className="rounded-lg p-3 bg-[#111827] border border-[#1F2937]">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Total Queries
            </span>
            <span className="text-2xl font-bold text-slate-100 font-mono">
              {total_queries}
            </span>
          </div>

          <div className="rounded-lg p-3 bg-[#111827] border border-[#1F2937]">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Avg Confidence
            </span>
            <span className="text-2xl font-bold text-blue-400 font-mono">
              {(average_confidence * 100).toFixed(1)}%
            </span>
          </div>

          <div className="rounded-lg p-3 bg-[#111827] border border-[#1F2937]">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Low Confidence (&lt;40%)
            </span>
            <span className="text-2xl font-bold text-amber-400 font-mono">
              {low_confidence_count}
            </span>
          </div>

          <div className="rounded-lg p-3 bg-[#111827] border border-[#1F2937]">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Unanswered Gaps
            </span>
            <span className="text-2xl font-bold text-rose-400 font-mono">
              {unanswered_count}
            </span>
          </div>

        </div>

        {/* Knowledge Gaps Table */}
        <div className="p-5 flex-1 overflow-y-auto bg-[#111827]">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Recent Knowledge Gaps Detected ({recent_knowledge_gaps.length})
            </h4>
            
            {recent_knowledge_gaps.length > 0 && (
              <button
                onClick={handleClearAll}
                disabled={isClearingAll}
                className="flex items-center space-x-1.5 px-2.5 py-1 text-xs font-medium text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 rounded-md border border-rose-500/30 transition disabled:opacity-50"
                title="Delete all previous knowledge gap reports"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isClearingAll ? 'Clearing...' : 'Clear All Reports'}</span>
              </button>
            )}
          </div>

          {recent_knowledge_gaps.length === 0 ? (
            <div className="p-8 rounded-lg bg-[#0B0F19] border border-[#1F2937] text-center">
              <CheckCircle2 className="w-8 h-8 text-blue-400 mx-auto mb-2 opacity-80" />
              <p className="text-sm font-semibold text-slate-200">
                No Knowledge Gaps Detected
              </p>
              <p className="text-xs text-slate-400 mt-1">
                All previous gap reports cleared or queries met the 0.40 confidence threshold.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-[#1F2937] overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0B0F19] text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-[#1F2937]">
                  <tr>
                    <th className="py-2.5 px-3">Query Text</th>
                    <th className="py-2.5 px-3">Intent</th>
                    <th className="py-2.5 px-3">Confidence</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Logged At</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1F2937] text-slate-300">
                  {recent_knowledge_gaps.map((gap) => (
                    <tr key={gap.id} className="hover:bg-[#0B0F19] transition">
                      <td className="py-2.5 px-3 font-medium text-slate-200 max-w-xs truncate" title={gap.query_text}>
                        "{gap.query_text}"
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-blue-400 uppercase">
                        {gap.query_type}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-rose-400">
                        {(Number(gap.confidence_score) * 100).toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          Gap Logged
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                        {new Date(gap.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => handleDelete(gap.id)}
                          disabled={deletingId === gap.id}
                          className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition disabled:opacity-30"
                          title="Delete this gap report"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[#1F2937] bg-[#0B0F19] flex items-center justify-between text-xs text-slate-400">
          <span>Relational Schema: <code>query_analytics</code> table</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-md bg-[#1F2937] hover:bg-[#374151] text-slate-200 transition font-medium"
          >
            Close Dashboard
          </button>
        </div>

      </div>
    </div>
  );
}
