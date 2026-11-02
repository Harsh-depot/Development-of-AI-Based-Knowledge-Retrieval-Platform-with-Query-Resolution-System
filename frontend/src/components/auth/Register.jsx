/**
 * Register.jsx — New Account Registration Screen
 * ================================================
 * Design: dark slate (#0B0F19) background, #111827 card, #3B82F6 accent.
 */

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Sparkles, Mail, Lock, User, UserPlus, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Email and password are required.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      await register(email.trim(), password, fullName.trim() || null);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const passwordsMatch = password && confirmPassword && password === confirmPassword;
  const passwordMismatch = password && confirmPassword && password !== confirmPassword;

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0B0F19] px-4">
      <div className="w-full max-w-md">

        {/* Brand header */}
        <div className="flex flex-col items-center mb-8 space-y-3">
          <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-blue-600 border border-blue-500/40">
            <Sparkles className="w-7 h-7 text-blue-100" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-slate-100 tracking-tight">
              Intelligent Query Resolution
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">
              LangGraph · Qdrant · FastEmbed · FlashRank
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-8 shadow-xl">
          <h2 className="text-lg font-semibold text-slate-100 mb-6">Create your account</h2>

          {error && (
            <div className="flex items-start gap-2.5 mb-5 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Full name (optional) */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
                Full name <span className="text-slate-600 normal-case">(optional)</span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your name"
                  autoComplete="name"
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[#0B0F19] border border-[#1F2937] text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 transition"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[#0B0F19] border border-[#1F2937] text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 transition"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  autoComplete="new-password"
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[#0B0F19] border border-[#1F2937] text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 transition"
                />
              </div>
            </div>

            {/* Confirm password */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
                Confirm password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  autoComplete="new-password"
                  required
                  className={`w-full pl-10 pr-9 py-2.5 rounded-lg bg-[#0B0F19] border text-slate-100 placeholder-slate-600 text-sm focus:outline-none transition focus:ring-1 ${
                    passwordMismatch
                      ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/30'
                      : passwordsMatch
                      ? 'border-emerald-500/50 focus:border-emerald-500 focus:ring-emerald-500/30'
                      : 'border-[#1F2937] focus:border-blue-500 focus:ring-blue-500/40'
                  }`}
                />
                {passwordsMatch && (
                  <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400 pointer-events-none" />
                )}
              </div>
              {passwordMismatch && (
                <p className="text-xs text-red-400 mt-1">Passwords do not match.</p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting || !!passwordMismatch}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
              {isSubmitting ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          {/* Login link */}
          <p className="text-center text-sm text-slate-500 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-400 hover:text-blue-300 font-medium transition">
              Sign in
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          Enterprise RAG · 5-Agent LangGraph Architecture
        </p>
      </div>
    </div>
  );
}
