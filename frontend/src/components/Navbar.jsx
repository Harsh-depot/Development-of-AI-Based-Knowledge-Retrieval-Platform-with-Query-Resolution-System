import React from 'react';
import { Sparkles, Database, ShieldAlert, Cpu, RefreshCw, BarChart3, Layers } from 'lucide-react';

export default function Navbar({
  systemHealth,
  analyticsData,
  onOpenAnalytics,
  onSeedData,
  isSeeding,
  documentCount,
}) {
  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand & Project Identity */}
        <div className="flex items-center space-x-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-500 shadow-lg shadow-emerald-500/20 text-white font-bold text-xl">
            <Sparkles className="w-5 h-5 text-emerald-100 animate-pulse-slow" />
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-[#070a13]" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-1.5">
                Intelligent Query Resolution System
              </h1>
              <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Infosys Internship • $0.00 Stack
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Multi-Agent LangGraph • Qdrant • FastEmbed • FlashRank Reranker
            </p>
          </div>
        </div>

        {/* Status Indicators & Action Buttons */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Subsystem Health Pill */}
          <div className="hidden lg:flex items-center space-x-2 px-2.5 py-1 rounded-lg bg-slate-900/80 border border-slate-800 text-xs text-slate-300">
            <span className="flex h-2 w-2 relative">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${systemHealth?.status === 'healthy' ? 'bg-emerald-400' : 'bg-amber-400'} opacity-75`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${systemHealth?.status === 'healthy' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
            </span>
            <span>Qdrant + FastEmbed (384d)</span>
          </div>

          {/* Seed Sample KB Button */}
          <button
            onClick={onSeedData}
            disabled={isSeeding}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800/90 hover:bg-slate-700/90 hover:text-white rounded-lg border border-slate-700 transition disabled:opacity-50 shadow-sm"
            title="Load sample HR, Academic & FAQ documents"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isSeeding ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isSeeding ? 'Seeding...' : 'Load Sample KB'}</span>
          </button>

          {/* Knowledge Gap Analytics Button */}
          <button
            onClick={onOpenAnalytics}
            className="relative flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-emerald-300 bg-emerald-950/40 hover:bg-emerald-900/40 rounded-lg border border-emerald-500/30 transition shadow-sm"
          >
            <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Gap Analytics</span>
            {analyticsData?.low_confidence_count > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {analyticsData.low_confidence_count}
              </span>
            )}
          </button>
        </div>

      </div>
    </header>
  );
}
