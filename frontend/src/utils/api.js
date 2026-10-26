const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export async function fetchHealth() {
  const res = await fetch(`${API_BASE_URL}/api/health`);
  if (!res.ok) throw new Error("Failed to fetch system health");
  return res.json();
}

export async function sendQuery({ query, sessionId, domainFilter, userId }) {
  const res = await fetch(`${API_BASE_URL}/api/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      session_id: sessionId || null,
      domain_filter: domainFilter || 'All',
      user_id: userId || 'web_user',
    }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(errorData.detail || "Query processing failed");
  }

  return res.json();
}

export async function uploadDocument(file, domainCategory = 'General') {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('domain_category', domainCategory);

  const res = await fetch(`${API_BASE_URL}/api/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(errorData.detail || "Document upload failed");
  }

  return res.json();
}

export async function fetchDocuments() {
  const res = await fetch(`${API_BASE_URL}/api/documents`);
  if (!res.ok) throw new Error("Failed to fetch documents");
  return res.json();
}

export async function deleteDocument(documentId) {
  const res = await fetch(`${API_BASE_URL}/api/documents/${documentId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error("Failed to delete document");
  return res.json();
}

export async function fetchAnalytics() {
  const res = await fetch(`${API_BASE_URL}/api/analytics`);
  if (!res.ok) throw new Error("Failed to fetch analytics");
  return res.json();
}

export async function seedSampleData() {
  const res = await fetch(`${API_BASE_URL}/api/seed-samples`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error("Failed to seed sample knowledge base");
  return res.json();
}

export async function fetchChatHistory(sessionId) {
  const res = await fetch(`${API_BASE_URL}/api/chat/history/${sessionId}`);
  if (!res.ok) throw new Error("Failed to fetch chat history");
  return res.json();
}
