const API = '/api';

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
  let userId = localStorage.getItem('userId');
  if (!userId) {
    userId = `user-${Math.random().toString(36).substr(2, 6)}`;
    localStorage.setItem('userId', userId);
  }
  const res = await fetch(`${API}/reports`, { 
    method: 'POST', 
    headers: { 'Authorization': `Bearer ${userId}` },
    body: formData 
  });
  return res.json();
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
