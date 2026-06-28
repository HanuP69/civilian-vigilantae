const API = '/api';

/**
 * Fetch wrapper that enforces a timeout and retry logic.
 * Note: Standard fetch() does not throw errors on 4xx/5xx status codes, meaning
 * this logic will ONLY retry on actual network connection failures or timeouts.
 */
export async function fetchWithTimeout(url, options = {}, timeoutMs = 15000, retries = 2) {
  const callerSignal = options.signal;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    
    if (callerSignal?.aborted) {
      throw new DOMException('Aborted by caller', 'AbortError');
    }

    const onCallerAbort = () => {
      controller.abort();
    };
    if (callerSignal) {
      callerSignal.addEventListener('abort', onCallerAbort);
    }

    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(id);
      if (callerSignal) {
        callerSignal.removeEventListener('abort', onCallerAbort);
      }
      return response;
    } catch (err) {
      clearTimeout(id);
      if (callerSignal) {
        callerSignal.removeEventListener('abort', onCallerAbort);
      }
      const isTimeout = err.name === 'AbortError' && !callerSignal?.aborted;
      if (callerSignal?.aborted) {
        throw err;
      }
      if (attempt < retries) {
        console.warn(`[API Retry] Request to ${url} failed (attempt ${attempt + 1}/${retries + 1}). Retrying...`);
        await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
        continue;
      }
      if (isTimeout) {
        throw new Error(`Request timed out after ${timeoutMs}ms`);
      }
      throw err;
    }
  }
}

async function handleResponse(res) {
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let errMsg = text;
    try {
      const parsed = JSON.parse(text);
      if (parsed && (parsed.error || parsed.message)) {
        errMsg = parsed.error || parsed.message;
      }
    } catch (_) {
      // Keep raw text if not JSON
    }
    throw new Error(errMsg || `Request failed with status ${res.status}`);
  }
  return res.json();
}

export async function fetchTickets(filters = {}, options = {}) {
  const params = new URLSearchParams(filters);
  const res = await fetchWithTimeout(`${API}/tickets?${params}`, options);
  return handleResponse(res);
}

export async function fetchTicket(id, options = {}) {
  const res = await fetchWithTimeout(`${API}/tickets/${id}`, options);
  return handleResponse(res);
}

export async function submitReport(formData, options = {}) {
  let userId = localStorage.getItem('userId');
  if (!userId) {
    userId = `user-${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem('userId', userId);
  }
  const existingId = formData.get('report_id');
  const reportId = existingId || `report-${Date.now()}`;
  if (!existingId) formData.append('report_id', reportId);
  const res = await fetchWithTimeout(`${API}/reports`, {
    ...options,
    method: 'POST',
    headers: { ...options.headers, 'Authorization': `Bearer ${userId}` },
    body: formData
  }, 45000);
  const data = await handleResponse(res);
  return { ...data, report_id: reportId };
}

export async function submitVerification(ticketId, voteType, userId, lat, lng, photo, options = {}) {
  const token = localStorage.getItem('userId') || userId;
  const res = await fetchWithTimeout(`${API}/verify/${ticketId}`, {
    ...options,
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers
    },
    body: JSON.stringify({ vote_type: voteType, user_id: userId, lat, lng, photo }),
  });
  return handleResponse(res);
}

export async function fetchDashboardStats(options = {}) {
  const res = await fetchWithTimeout(`${API}/dashboard/stats`, options);
  return handleResponse(res);
}

export async function fetchRecurrenceRisk(options = {}) {
  const res = await fetchWithTimeout(`${API}/dashboard/recurrence`, options);
  return handleResponse(res);
}

export async function fetchLeaderboard(options = {}) {
  const res = await fetchWithTimeout(`${API}/users/leaderboard`, options);
  return handleResponse(res);
}

export async function apiRegister(email, password, displayName, options = {}) {
  const res = await fetchWithTimeout(`${API}/users/register`, {
    ...options,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    body: JSON.stringify({ email, password, display_name: displayName })
  });
  return handleResponse(res);
}

export async function apiLogin(email, password, options = {}) {
  const res = await fetchWithTimeout(`${API}/users/login`, {
    ...options,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    body: JSON.stringify({ email, password })
  });
  return handleResponse(res);
}

export async function apiClaimQuest(questId, options = {}) {
  const token = localStorage.getItem('userId');
  const res = await fetchWithTimeout(`${API}/users/quests/claim`, {
    ...options,
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers
    },
    body: JSON.stringify({ quest_id: questId })
  });
  return handleResponse(res);
}

/**
 * Fetch the current user's quests.
 * Quests live on the user document itself (no separate endpoint), so this
 * pulls from /users/me and normalizes the shape QuestTrackerSidebar expects.
 */
export async function fetchUserQuests(options = {}) {
  const token = localStorage.getItem('userId');
  const res = await fetchWithTimeout(`${API}/users/me?uid=${token}`, {
    ...options,
    headers: { 'Authorization': `Bearer ${token}`, ...options.headers }
  });
  const user = await handleResponse(res);
  const quests = (user.quests || []).map(q => ({
    ...q,
    progress: q.current ?? q.progress ?? 0,
    target: q.target ?? q.required ?? 0,
    xp_reward: q.xpReward ?? q.xp_reward ?? 0,
    gold_reward: q.goldReward ?? q.gold_reward ?? 0,
    status: q.claimed ? 'completed' : (q.completed ? 'ready_to_claim' : 'active')
  }));
  return { quests };
}

/**
 * Claim a completed quest's reward.
 * Backend returns the full updated user doc; this normalizes it into the
 * { success, xp_gained, gold_gained, leveled_up, new_level } shape the UI needs.
 */
export async function claimQuestReward(questId, options = {}) {
  const beforeXP = JSON.parse(localStorage.getItem('lastKnownXP') || '0');
  const beforeLevel = JSON.parse(localStorage.getItem('lastKnownLevel') || '1');

  const updatedUser = await apiClaimQuest(questId, options);

  const claimedQuest = (updatedUser.quests || []).find(q => q.id === questId);
  const xpGained = claimedQuest?.xpReward ?? claimedQuest?.xp_reward ?? 0;
  const goldGained = claimedQuest?.goldReward ?? claimedQuest?.gold_reward ?? 0;
  const leveledUp = (updatedUser.level || 1) > beforeLevel;

  localStorage.setItem('lastKnownXP', JSON.stringify(updatedUser.xp || 0));
  localStorage.setItem('lastKnownLevel', JSON.stringify(updatedUser.level || 1));

  return {
    success: true,
    xp_gained: xpGained,
    gold_gained: goldGained,
    leveled_up: leveledUp,
    new_level: updatedUser.level || 1,
    user: updatedUser
  };
}

export async function apiBuyShopItem(itemId, options = {}) {
  const token = localStorage.getItem('userId');
  const res = await fetchWithTimeout(`${API}/users/shop/buy`, {
    ...options,
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers
    },
    body: JSON.stringify({ item_id: itemId })
  });
  return handleResponse(res);
}

export async function apiEquipAvatar(avatarValue, options = {}) {
  const token = localStorage.getItem('userId');
  const res = await fetchWithTimeout(`${API}/users/shop/equip`, {
    ...options,
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers
    },
    body: JSON.stringify({ avatar_value: avatarValue })
  });
  return handleResponse(res);
}

export async function sendCopilotMessage(message, chatHistory = [], options = {}) {
  const token = localStorage.getItem('userId');
  const res = await fetchWithTimeout(`${API}/copilot/chat`, {
    ...options,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers
    },
    body: JSON.stringify({ message, chatHistory })
  });
  return handleResponse(res);
}

export async function fetchAssets(options = {}) {
  const res = await fetchWithTimeout(`${API}/dashboard/assets`, options);
  return handleResponse(res);
}

export async function fetchMissions(options = {}) {
  const res = await fetchWithTimeout(`${API}/missions`, options);
  return handleResponse(res);
}
