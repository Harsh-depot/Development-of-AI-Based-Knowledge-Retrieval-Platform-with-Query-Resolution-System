/**
 * Navbar.jsx — Top Application Navigation Bar
 * =============================================
 * Displays brand identity, system health pill, action buttons,
 * and the authenticated user's email with a Sign Out control.
 * Full-width edge-to-edge alignment with the workspace.
 */

import React from 'react';
import { Sparkles, RefreshCw, BarChart3, LogOut, User } from 'lucide-react';

export default function Navbar({
  systemHealth,
  analyticsData,
  onOpenAnalytics,
  onSeedData,
  isSeeding,
  documentCount,
  user,
  onLogout,
}) {
  return (
    <header className="sticky top-0 z-40 w-full bg-[#111827] border-b border-[#1F2937]">
      <div className="w-full px-4 sm:px-6 h-16 flex items-center justify-between">

        {/* Brand & Project Identity */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-600 text-white font-bold text-xl border border-blue-500/40 shadow-sm flex-shrink-0">
            <Sparkles className="w-5 h-5 text-blue-100" />
          </div>
          <div className="flex flex-col justify-center">
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-slate-100 tracking-tight leading-tight">
                Intelligent Query Resolution System
              </h1>
              <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 leading-none">
                Enterprise RAG · 5-Agent
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block leading-normal">
              LangGraph State Machine · Qdrant · FastEmbed · FlashRank Reranker
            </p>
          </div>
        </div>

        {/* Status Indicators & Action Buttons — Unified h-8 height */}
        <div className="flex items-center space-x-2 sm:space-x-2.5">

          {/* Subsystem Health Pill */}
          <div className="hidden lg:flex items-center space-x-2 h-8 px-2.5 rounded-md bg-[#0B0F19] border border-[#1F2937] text-xs text-slate-300">
            <span className="flex h-2 w-2 relative flex-shrink-0">
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  systemHealth?.status === 'healthy' ? 'bg-blue-500' : 'bg-amber-500'
                }`}
              />
            </span>
            <span className="whitespace-nowrap">Qdrant + FastEmbed (384d)</span>
          </div>

          {/* Seed Sample KB Button */}
          <button
            onClick={onSeedData}
            disabled={isSeeding}
            className="flex items-center space-x-1.5 h-8 px-3 text-xs font-medium text-slate-200 bg-[#0B0F19] hover:bg-[#1F2937] hover:text-white rounded-md border border-[#1F2937] transition disabled:opacity-50"
            title="Load sample HR, Academic & FAQ documents"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-400 flex-shrink-0 ${isSeeding ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline whitespace-nowrap">{isSeeding ? 'Seeding...' : 'Load Sample KB'}</span>
          </button>

          {/* Knowledge Gap Analytics Button */}
          <button
            onClick={onOpenAnalytics}
            className="relative flex items-center space-x-1.5 h-8 px-3 text-xs font-medium text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 rounded-md border border-blue-500/30 transition"
          >
            <BarChart3 className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
            <span className="whitespace-nowrap">Gap Analytics</span>
            {analyticsData?.low_confidence_count > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {analyticsData.low_confidence_count}
              </span>
            )}
          </button>

          {/* User identity + Sign Out */}
          {user && (
            <>
              {/* Divider */}
              <div className="hidden sm:block w-px h-5 bg-[#1F2937]" />

              <div className="flex items-center gap-2">
                {/* User email/name pill */}
                <div className="hidden md:flex items-center gap-1.5 h-8 px-2.5 rounded-md bg-[#0B0F19] border border-[#1F2937]">
                  <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <span className="text-xs text-slate-300 max-w-[130px] truncate">
                    {user.full_name || user.email}
                  </span>
                </div>

                {/* Sign Out button */}
                <button
                  onClick={onLogout}
                  title="Sign out"
                  className="flex items-center gap-1.5 h-8 px-2.5 text-xs font-medium text-slate-400 hover:text-red-400 bg-[#0B0F19] hover:bg-red-500/10 rounded-md border border-[#1F2937] hover:border-red-500/30 transition"
                >
                  <LogOut className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="hidden sm:inline whitespace-nowrap">Sign Out</span>
                </button>
              </div>
            </>
          )}
        </div>

      </div>
    </header>
  );
}
