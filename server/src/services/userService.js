import { db } from '../config/firebase.js';
import bcrypt from 'bcryptjs';

const XP_REWARDS = { report: 25, report_verified: 50, vote: 5, vote_accurate: 20, resolved: 30 };

const BADGES = [
  { id: 'neighborhood_watch', name: 'Neighborhood Watch', emoji: '🛡️', threshold: 1, type: 'reports' },
  { id: 'verified_reporter', name: 'Verified Reporter', emoji: '✅', threshold: 5, type: 'reports' },
  { id: 'eagle_eye', name: 'Eagle Eye', emoji: '🔍', threshold: 10, type: 'verifications' },
  { id: 'community_champion', name: 'Community Champion', emoji: '🏆', threshold: 500, type: 'xp' },
  { id: 'ward_guardian', name: 'Ward Guardian', emoji: '⭐', threshold: 20, type: 'reports' },
];

const SHOP_ITEMS = [
  { id: 'title_paladin', name: 'Lucknow Paladin Title', cost: 50, type: 'title', value: 'Lucknow Paladin' },
  { id: 'title_champion', name: 'Urban Champion Title', cost: 100, type: 'title', value: 'Urban Champion' },
  { id: 'avatar_knight', name: 'Glinting Knight Avatar', cost: 40, type: 'avatar', value: 'knight' },
  { id: 'avatar_cypher', name: 'Future Watcher Avatar', cost: 60, type: 'avatar', value: 'cypher' },
  { id: 'avatar_hero', name: 'Urban Legend Avatar', cost: 80, type: 'avatar', value: 'hero' },
  { id: 'badge_legend', name: 'Lucknow Legend Badge', cost: 80, type: 'badge', value: 'Lucknow Legend', emoji: '👑' },
  { id: 'badge_sentinel', name: 'SLA Sentinel Badge', cost: 40, type: 'badge', value: 'SLA Sentinel', emoji: '🛡️' }
];

const INITIAL_QUESTS = [
  { id: 'first_responder', name: 'First Responder', description: 'Report 1 hyperlocal civic issue', target: 1, type: 'reports', xpReward: 50, goldReward: 20 },
  { id: 'vigilant_citizen', name: 'Vigilant Citizen', description: 'Verify 3 community reports', target: 3, type: 'votes', xpReward: 30, goldReward: 15 },
  { id: 'lucknow_surveyor', name: 'Lucknow Surveyor', description: 'Submit reports in 2 different wards', target: 2, type: 'wards', xpReward: 100, goldReward: 50 }
];

export function getLevelFromXP(xp) {
  return Math.floor(Math.sqrt((xp || 0) / 50)) + 1;
}

export function getTitleFromLevel(level) {
  if (level >= 15) return 'Lucknow Paragon';
  if (level >= 10) return 'Civic Knight';
  if (level >= 7) return 'Eagle Watcher';
  if (level >= 4) return 'Street Guardian';
  return 'Novice Watchman';
}

export async function getUser(uid) {
  return ensureUser(uid);
}

export async function registerUser(email, password, displayName) {
  if (!password || password.length < 8) {
    throw new Error('Password must be at least 8 characters long');
  }

  const normalizedEmail = (email || '').toLowerCase().trim();
  if (!normalizedEmail) {
    throw new Error('Email is required');
  }

  return db.runTransaction(async (transaction) => {
    const query = db.collection('users').where('email', '==', normalizedEmail);
    const snap = await transaction.get(query);
    if (!snap.empty) throw new Error('Email already registered');

    const uid = `user-${Math.random().toString(36).slice(2, 8)}`;
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      uid,
      display_name: displayName || 'Citizen Hero',
      email: normalizedEmail,
      password: hashedPassword,
      photo_url: null,
      xp: 0,
      level: 1,
      title: 'Novice Watchman',
      gold: 50,
      badges: [],
      reports_submitted: 0,
      verifications_made: 0,
      accurate_verifications: 0,
      trust_score: 0.0,
      reports_verified: 0,
      reports_rejected: 0,
      verification_accuracy: null,
      unique_wards: [],
      unlocked_avatars: [],
      unlocked_badges: [],
      quests: INITIAL_QUESTS.map(q => ({
        ...q,
        current: 0,
        completed: false,
        claimed: false
      })),
      joined_at: new Date().toISOString(),
    };

    const docRef = db.collection('users').doc(uid);
    transaction.set(docRef, newUser);

    const stripped = { ...newUser };
    delete stripped.password;
    return stripped;
  });
}

export async function loginUser(email, password) {
  const normalizedEmail = (email || '').toLowerCase().trim();
  const snap = await db.collection('users').where('email', '==', normalizedEmail).get();
  if (snap.empty) throw new Error('Invalid email or password');

  const doc = snap.docs[0];
  const u = doc.data();

  if (!u.password || !(await bcrypt.compare(password, u.password))) {
    throw new Error('Invalid email or password');
  }

  const user = await ensureUser(u.uid);
  delete user.password;
  return user;
}

export async function ensureUser(uid) {
  const doc = await db.collection('users').doc(uid).get();
  if (doc.exists) {
    const data = doc.data();
    let needsUpdate = false;
    const updates = {};

    if (data.gold === undefined) { updates.gold = 50; needsUpdate = true; }
    if (data.level === undefined) { updates.level = getLevelFromXP(data.xp); needsUpdate = true; }
    if (data.title === undefined) { updates.title = getTitleFromLevel(updates.level || data.level || 1); needsUpdate = true; }
    if (data.quests === undefined || (Array.isArray(data.quests) && data.quests.length === 0)) {
      updates.quests = INITIAL_QUESTS.map(q => {
        let current = 0;
        if (q.type === 'reports') current = data.reports_submitted || 0;
        if (q.type === 'votes') current = data.verifications_made || 0;
        return {
          ...q,
          current,
          completed: current >= q.target,
          claimed: false
        };
      });
      needsUpdate = true;
    }
    if (data.unlocked_avatars === undefined) { updates.unlocked_avatars = []; needsUpdate = true; }
    if (data.unlocked_badges === undefined) { updates.unlocked_badges = []; needsUpdate = true; }
    if (data.unique_wards === undefined) { updates.unique_wards = []; needsUpdate = true; }
    if (data.trust_score === undefined) { updates.trust_score = 0.0; needsUpdate = true; }
    if (data.reports_verified === undefined) { updates.reports_verified = 0; needsUpdate = true; }
    if (data.reports_rejected === undefined) { updates.reports_rejected = 0; needsUpdate = true; }
    if (data.verification_accuracy === undefined) { 
      updates.verification_accuracy = (data.verifications_made && data.verifications_made > 0) 
        ? (data.reports_verified / data.verifications_made) 
        : null; 
      needsUpdate = true; 
    }

    if (needsUpdate) {
      const merged = { ...data, ...updates };
      await db.collection('users').doc(uid).update(updates);
      const stripped = { ...merged };
      delete stripped.password;
      return stripped;
    }
    const stripped = { ...data };
    delete stripped.password;
    return stripped;
  }

  const newUser = {
    uid,
    display_name: 'Citizen Hero',
    email: null,
    photo_url: null,
    xp: 0,
    level: 1,
    title: 'Novice Watchman',
    gold: 50,
    badges: [],
    reports_submitted: 0,
    verifications_made: 0,
    accurate_verifications: 0,
    trust_score: 0.0,
    reports_verified: 0,
    reports_rejected: 0,
    verification_accuracy: null,
    unique_wards: [],
    unlocked_avatars: [],
    unlocked_badges: [],
    quests: INITIAL_QUESTS.map(q => ({
      ...q,
      current: 0,
      completed: false,
      claimed: false
    })),
    joined_at: new Date().toISOString(),
  };
  await db.collection('users').doc(uid).set(newUser);
  const stripped = { ...newUser };
  delete stripped.password;
  return stripped;
}

export async function awardXP(uid, action, ticketIdOrWard = null) {
  const xp = XP_REWARDS[action] || 0;
  if (!xp) return null;
  const user = await ensureUser(uid);
  const newXP = (user.xp || 0) + xp;
  const newLevel = getLevelFromXP(newXP);
  const updates = { xp: newXP, level: newLevel, title: getTitleFromLevel(newLevel) };

  let reportsSubmitted = user.reports_submitted || 0;
  let verificationsMade = user.verifications_made || 0;
  let accurateVerifications = user.accurate_verifications || 0;

  if (action === 'report') {
    reportsSubmitted++;
    updates.reports_submitted = reportsSubmitted;
  } else if (action === 'vote') {
    verificationsMade++;
    updates.verifications_made = verificationsMade;
  } else if (action === 'vote_accurate') {
    accurateVerifications++;
    updates.accurate_verifications = accurateVerifications;
  }

  // Determine ward if possible for quests
  let ward = null;
  if (ticketIdOrWard) {
    if (ticketIdOrWard.startsWith('ticket-') || ticketIdOrWard.length > 10) {
      try {
        const ticketDoc = await db.collection('tickets').doc(ticketIdOrWard).get();
        if (ticketDoc.exists) {
          ward = ticketDoc.data().ward;
        }
      } catch (err) {
        console.error('[awardXP] Failed to lookup ticket ward:', err.message);
      }
    } else {
      ward = ticketIdOrWard;
    }
  }

  // Update quests
  let quests = user.quests || [];
  if (quests.length === 0) {
    quests = INITIAL_QUESTS.map(q => ({ ...q, current: 0, completed: false, claimed: false }));
  }
  quests = quests.map(q => {
    if (q.completed) return q;
    let current = q.current || 0;
    if (q.type === 'reports' && action === 'report') current++;
    if (q.type === 'votes' && action === 'vote') current++;
    if (q.type === 'wards' && action === 'report' && ward) {
      const uniqueWards = user.unique_wards || [];
      if (!uniqueWards.includes(ward)) {
        uniqueWards.push(ward);
        updates.unique_wards = uniqueWards;
      }
      current = uniqueWards.length;
    }
    const completed = current >= q.target;
    return { ...q, current, completed };
  });
  updates.quests = quests;

  const badges = user.badges || [];
  for (const badge of BADGES) {
    if (badges.includes(badge.name)) continue;
    if (badge.type === 'xp' && newXP >= badge.threshold) badges.push(badge.name);
    if (badge.type === 'reports' && reportsSubmitted >= badge.threshold) badges.push(badge.name);
    if (badge.type === 'verifications' && accurateVerifications >= badge.threshold) badges.push(badge.name);
  }
  updates.badges = badges;

  await db.collection('users').doc(uid).update(updates);
  return { uid, xp: newXP, level: newLevel, badges, awarded: xp };
}

export async function claimQuestReward(uid, questId) {
  const user = await ensureUser(uid);
  let quests = user.quests || [];
  const quest = quests.find(q => q.id === questId);
  if (!quest) throw new Error('Quest not found');
  if (!quest.completed) throw new Error('Quest not completed');
  if (quest.claimed) throw new Error('Quest reward already claimed');

  quest.claimed = true;
  const newXP = (user.xp || 0) + (quest.xpReward || 0);
  const newGold = (user.gold || 0) + (quest.goldReward || 0);
  const newLevel = getLevelFromXP(newXP);

  const updates = {
    quests,
    xp: newXP,
    gold: newGold,
    level: newLevel,
    title: getTitleFromLevel(newLevel)
  };

  await db.collection('users').doc(uid).update(updates);
  return { ...user, ...updates };
}

export async function buyShopItem(uid, itemId) {
  const user = await ensureUser(uid);
  const item = SHOP_ITEMS.find(i => i.id === itemId);
  if (!item) throw new Error('Item not found in shop');
  
  if ((user.gold || 0) < item.cost) {
    throw new Error(`Insufficient gold. Needs ${item.cost} Gold.`);
  }

  const updates = {};
  updates.gold = (user.gold || 0) - item.cost;

  if (item.type === 'title') {
    updates.title = item.value;
  } else if (item.type === 'avatar') {
    const unlocked = user.unlocked_avatars || [];
    if (unlocked.includes(item.value)) throw new Error('Avatar already unlocked');
    unlocked.push(item.value);
    updates.unlocked_avatars = unlocked;
    updates.photo_url = item.value; // Set active avatar
  } else if (item.type === 'badge') {
    const badges = user.badges || [];
    if (badges.includes(item.value)) throw new Error('Badge already unlocked');
    badges.push(item.value);
    updates.badges = badges;
  }

  await db.collection('users').doc(uid).update(updates);
  return { ...user, ...updates };
}

export async function equipAvatar(uid, avatarValue) {
  const user = await ensureUser(uid);
  const unlocked = user.unlocked_avatars || [];
  
  if (avatarValue !== 'default' && !avatarValue.startsWith('custom:') && !unlocked.includes(avatarValue)) {
    throw new Error('Avatar not unlocked');
  }

  const updates = {
    photo_url: avatarValue === 'default' ? null : avatarValue
  };

  await db.collection('users').doc(uid).update(updates);
  return { ...user, ...updates };
}

export async function getLeaderboard(limit = 20) {
  const snap = await db.collection('users').get();
  const users = [];
  snap.forEach(doc => {
    const data = doc.data();
    // Compute contribution score dynamically
    const xp = data.xp || 0;
    const reports = data.reports_submitted || data.reports || 0;
    const verifications = data.verifications_made !== undefined 
      ? data.verifications_made 
      : ((data.reports_verified || 0) + (data.reports_rejected || 0));
    const accurate = data.accurate_verifications !== undefined
      ? data.accurate_verifications
      : (data.reports_verified || 0);
    const trustScore = data.trust_score !== undefined ? data.trust_score : 0.5;
    const incorrect = Math.max(0, verifications - accurate);
    
    data.contribution_score = Math.round(
      (xp * 0.1) +
      (reports * 15) +
      (accurate * 25) -
      (incorrect * 10) +
      (trustScore * 100)
    );
    if (data.contribution_score < 0) data.contribution_score = 0;
    users.push(data);
  });
  
  users.sort((a, b) => b.contribution_score - a.contribution_score);
  
  return users.slice(0, limit).map((u, i) => ({
    rank: i + 1,
    uid: u.uid,
    display_name: u.display_name,
    xp: u.xp || 0,
    contribution_score: u.contribution_score,
    badges: u.badges || [],
    reports: u.reports_submitted || 0,
    photo_url: u.photo_url,
    verifications_made: u.verifications_made || 0,
    accurate_verifications: u.accurate_verifications || 0,
    trust_score: u.trust_score !== undefined ? u.trust_score : 0.5,
  }));
}

export { BADGES, XP_REWARDS, SHOP_ITEMS, INITIAL_QUESTS };
