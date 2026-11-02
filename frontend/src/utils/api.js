/**
 * api.js — Centralized API Client
 * =================================
 * All requests to the FastAPI backend go through this module.
 *
 * Auth flow:
 *   - getAuthHeaders() reads the JWT from localStorage and injects it as
 *     Authorization: Bearer <token> on every protected request.
 *   - handle401() clears the stale token and reloads the page to the login screen.
 *   - Public endpoints (login, register, health) do NOT attach auth headers.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const TOKEN_KEY = 'auth_token';

// ---------------------------------------------------------------------------
// Auth header helper
// ---------------------------------------------------------------------------

function getAuthHeaders() {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Called when any protected endpoint returns 401.
 * Clears the invalid token and redirects to login.
 */
function handle401() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem('query_sys_session_id');
  // Redirect to login page (BrowserRouter handles the route)
  window.location.href = '/login';
}

// ---------------------------------------------------------------------------
// Generic fetch wrapper with optional auth
// ---------------------------------------------------------------------------

async function apiFetch(path, options = {}, withAuth = true) {
  const headers = {
    ...(options.headers || {}),
    ...(withAuth ? getAuthHeaders() : {}),
  };

  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });

  if (res.status === 401 && withAuth) {
    handle401();
    throw new Error('Session expired. Redirecting to login…');
  }

  return res;
}

// ---------------------------------------------------------------------------
// Public endpoints (no auth header)
// ---------------------------------------------------------------------------

export async function fetchHealth() {
  const res = await apiFetch('/api/health', {}, false);
  if (!res.ok) throw new Error('Failed to fetch system health');
  return res.json();
}

export async function loginUser(email, password) {
  const res = await apiFetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  }, false);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Login failed.');
  }
  return res.json();
}

export async function registerUser(email, password, fullName = null) {
  const res = await apiFetch('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, full_name: fullName }),
  }, false);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Registration failed.');
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Protected endpoints (Bearer token required)
// ---------------------------------------------------------------------------

export async function sendQuery({ query, sessionId, domainFilter }) {
  const res = await apiFetch('/api/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      session_id: sessionId || null,
      domain_filter: domainFilter || 'All',
    }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(errorData.detail || 'Query processing failed');
  }
  return res.json();
}

export async function uploadDocument(file, domainCategory = 'General') {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('domain_category', domainCategory);

  // Note: do NOT set Content-Type manually for FormData — browser sets boundary automatically
  const res = await apiFetch('/api/upload', {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(errorData.detail || 'Document upload failed');
  }
  return res.json();
}

export async function fetchDocuments() {
  const res = await apiFetch('/api/documents');
  if (!res.ok) throw new Error('Failed to fetch documents');
  return res.json();
}

export async function deleteDocument(documentId) {
  const res = await apiFetch(`/api/documents/${documentId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete document');
  return res.json();
}

export async function fetchAnalytics() {
  const res = await apiFetch('/api/analytics');
  if (!res.ok) throw new Error('Failed to fetch analytics');
  return res.json();
}

export async function deleteAnalyticsGap(gapId) {
  const res = await apiFetch(`/api/analytics/${gapId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete analytics report');
  return res.json();
}

export async function clearAllAnalytics() {
  const res = await apiFetch('/api/analytics', { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to clear analytics reports');
  return res.json();
}

export async function seedSampleData() {
  const res = await apiFetch('/api/seed-samples', { method: 'POST' });
  if (!res.ok) throw new Error('Failed to seed sample knowledge base');
  return res.json();
}

export async function fetchChatHistory(sessionId) {
  // Chat history is a public endpoint (no auth header needed)
  const res = await apiFetch(`/api/chat/history/${sessionId}`, {}, false);
  if (!res.ok) throw new Error('Failed to fetch chat history');
  return res.json();
}
