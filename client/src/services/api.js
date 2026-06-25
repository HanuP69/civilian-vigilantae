const API = '/api';

async function handleResponse(res) {
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Request failed with status ${res.status}`);
  }
  return res.json();
}

export async function fetchTickets(filters = {}) {
  const params = new URLSearchParams(filters);
  const res = await fetch(`${API}/tickets?${params}`);
  return handleResponse(res);
}

export async function fetchTicket(id) {
  const res = await fetch(`${API}/tickets/${id}`);
  return handleResponse(res);
}

export async function submitReport(formData) {
  let userId = localStorage.getItem('userId');
  if (!userId) {
    userId = `user-${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem('userId', userId);
  }
  const reportId = `report-${Date.now()}`;
  formData.append('report_id', reportId);
  const res = await fetch(`${API}/reports`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${userId}` },
    body: formData
  });
  const data = await handleResponse(res);
  return { ...data, report_id: reportId };
}

export async function submitVerification(ticketId, voteType, userId) {
  const token = localStorage.getItem('userId') || userId;
  const res = await fetch(`${API}/verify/${ticketId}`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ vote_type: voteType, user_id: userId }),
  });
  return handleResponse(res);
}

export async function fetchDashboardStats() {
  const res = await fetch(`${API}/dashboard/stats`);
  return handleResponse(res);
}

export async function fetchRecurrenceRisk() {
  const res = await fetch(`${API}/dashboard/recurrence`);
  return handleResponse(res);
}

export async function fetchLeaderboard() {
  const res = await fetch(`${API}/users/leaderboard`);
  return handleResponse(res);
}
