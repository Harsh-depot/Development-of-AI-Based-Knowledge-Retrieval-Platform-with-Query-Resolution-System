import React from 'react';
import {
  X,
  BarChart3,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  HelpCircle,
  Clock,
  Layers
} from 'lucide-react';

export default function AnalyticsModal({
  analyticsData,
  onClose,
}) {
  if (!analyticsData) return null;

  const {
    total_queries = 0,
    unanswered_count = 0,
    low_confidence_count = 0,
    average_confidence = 0.0,
    recent_knowledge_gaps = [],
  } = analyticsData;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="glass-panel w-full max-w-3xl rounded-2xl border border-slate-800 bg-slate-950/95 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Query Analytics & Knowledge Gap Detection
              </h3>
              <p className="text-xs text-slate-400">
                Milestone 4: Continuous Tracking of Low-Confidence (&lt;0.40) & Unanswered Queries
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Metric Cards Grid */}
        <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-900/30 border-b border-slate-800/80">
          
          <div className="glass-card rounded-xl p-3 border border-slate-800">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Total Queries
            </span>
            <span className="text-2xl font-extrabold text-white font-mono">
              {total_queries}
            </span>
          </div>

          <div className="glass-card rounded-xl p-3 border border-slate-800">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Avg Confidence
            </span>
            <span className="text-2xl font-extrabold text-emerald-400 font-mono">
              {(average_confidence * 100).toFixed(1)}%
            </span>
          </div>

          <div className="glass-card rounded-xl p-3 border border-slate-800">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Low Confidence (&lt;40%)
            </span>
            <span className="text-2xl font-extrabold text-amber-400 font-mono">
              {low_confidence_count}
            </span>
          </div>

          <div className="glass-card rounded-xl p-3 border border-slate-800">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Unanswered Gaps
            </span>
            <span className="text-2xl font-extrabold text-rose-400 font-mono">
              {unanswered_count}
            </span>
          </div>

        </div>

        {/* Knowledge Gaps Table */}
        <div className="p-5 flex-1 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Recent Knowledge Gaps Detected
            </h4>
            <span className="text-xs text-slate-500">
              Auto-logged to PostgreSQL query_analytics
            </span>
          </div>

          {recent_knowledge_gaps.length === 0 ? (
            <div className="p-8 rounded-xl bg-slate-900/40 border border-slate-800/80 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
              <p className="text-sm font-semibold text-slate-200">
                No Knowledge Gaps Detected!
              </p>
              <p className="text-xs text-slate-400 mt-1">
                All queried queries met or exceeded the 0.40 confidence threshold.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/80 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Query Text</th>
                    <th className="py-2.5 px-3">Intent</th>
                    <th className="py-2.5 px-3">Confidence</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Logged At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-slate-300">
                  {recent_knowledge_gaps.map((gap) => (
                    <tr key={gap.id} className="hover:bg-slate-900/40 transition">
                      <td className="py-2.5 px-3 font-medium text-slate-200 max-w-xs truncate" title={gap.query_text}>
                        "{gap.query_text}"
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-cyan-400 uppercase">
                        {gap.query_type}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-rose-400">
                        {(Number(gap.confidence_score) * 100).toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          Gap Logged
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                        {new Date(gap.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-900/60 flex items-center justify-between text-xs text-slate-400">
          <span>Relational Schema: <code>query_analytics</code> table</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition font-medium"
          >
            Close Dashboard
          </button>
        </div>

      </div>
    </div>
  );
}
