const API = 'http://localhost:3001/api';

export async function fetchTickets(filters = {}) {
  const params = new URLSearchParams(filters);
  const res = await fetch(`${API}/tickets?${params}`);
  return res.json();
}

export async function fetchTicket(id) {
  const res = await fetch(`${API}/tickets/${id}`);
  return res.json();
}

export async function submitReport(formData) {
  const res = await fetch(`${API}/reports`, { method: 'POST', body: formData });
  return res.json();
}

export async function submitVerification(ticketId, voteType, userId) {
  const res = await fetch(`${API}/verify/${ticketId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vote_type: voteType, user_id: userId }),
  });
  return res.json();
}

export async function fetchDashboardStats() {
  const res = await fetch(`${API}/dashboard/stats`);
  return res.json();
}

export async function fetchRecurrenceRisk() {
  const res = await fetch(`${API}/dashboard/recurrence`);
  return res.json();
}

export async function fetchLeaderboard() {
  const res = await fetch(`${API}/users/leaderboard`);
  return res.json();
}
