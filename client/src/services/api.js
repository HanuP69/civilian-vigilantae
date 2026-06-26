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
  // Use existing report_id from formData if present, otherwise generate one
  const existingId = formData.get('report_id');
  const reportId = existingId || `report-${Date.now()}`;
  if (!existingId) formData.append('report_id', reportId);
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

export async function apiRegister(email, password, displayName) {
  const res = await fetch(`${API}/users/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, display_name: displayName })
  });
  return handleResponse(res);
}

export async function apiLogin(email, password) {
  const res = await fetch(`${API}/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  return handleResponse(res);
}

export async function apiClaimQuest(questId) {
  const token = localStorage.getItem('userId');
  const res = await fetch(`${API}/users/quests/claim`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ quest_id: questId })
  });
  return handleResponse(res);
}

export async function apiBuyShopItem(itemId) {
  const token = localStorage.getItem('userId');
  const res = await fetch(`${API}/users/shop/buy`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ item_id: itemId })
  });
  return handleResponse(res);
}

export async function apiEquipAvatar(avatarValue) {
  const token = localStorage.getItem('userId');
  const res = await fetch(`${API}/users/shop/equip`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ avatar_value: avatarValue })
  });
  return handleResponse(res);
}

export async function sendCopilotMessage(message, chatHistory = []) {
  const token = localStorage.getItem('userId');
  const res = await fetch(`${API}/copilot/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ message, chatHistory })
  });
  return handleResponse(res);
}

export async function fetchAssets() {
  const res = await fetch(`${API}/dashboard/assets`);
  return handleResponse(res);
}
