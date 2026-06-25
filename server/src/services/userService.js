import { db } from '../config/firebase.js';

const XP_REWARDS = { report: 25, report_verified: 50, vote: 5, vote_accurate: 20, resolved: 30 };
const BADGES = [
  { id: 'neighborhood_watch', name: 'Neighborhood Watch', emoji: '🛡️', threshold: 1, type: 'reports' },
  { id: 'verified_reporter', name: 'Verified Reporter', emoji: '✅', threshold: 5, type: 'reports' },
  { id: 'eagle_eye', name: 'Eagle Eye', emoji: '🔍', threshold: 10, type: 'verifications' },
  { id: 'community_champion', name: 'Community Champion', emoji: '🏆', threshold: 500, type: 'xp' },
  { id: 'ward_guardian', name: 'Ward Guardian', emoji: '⭐', threshold: 20, type: 'reports' },
];

export async function getUser(uid) {
  const doc = await db.collection('users').doc(uid).get();
  return doc.exists ? doc.data() : null;
}

export async function ensureUser(uid) {
  const doc = await db.collection('users').doc(uid).get();
  if (doc.exists) return doc.data();
  const newUser = {
    uid,
    display_name: 'Citizen',
    email: null,
    photo_url: null,
    xp: 0,
    badges: [],
    reports_submitted: 0,
    verifications_made: 0,
    accurate_verifications: 0,
    joined_at: new Date().toISOString(),
  };
  await db.collection('users').doc(uid).set(newUser);
  return newUser;
}

export async function awardXP(uid, action) {
  const xp = XP_REWARDS[action] || 0;
  if (!xp) return null;
  const user = await ensureUser(uid);
  const newXP = (user.xp || 0) + xp;
  const updates = { xp: newXP };

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

  const badges = user.badges || [];
  for (const badge of BADGES) {
    if (badges.includes(badge.name)) continue;
    if (badge.type === 'xp' && newXP >= badge.threshold) badges.push(badge.name);
    if (badge.type === 'reports' && reportsSubmitted >= badge.threshold) badges.push(badge.name);
    if (badge.type === 'verifications' && accurateVerifications >= badge.threshold) badges.push(badge.name);
  }
  updates.badges = badges;
  await db.collection('users').doc(uid).update(updates);
  return { uid, xp: newXP, badges, awarded: xp };
}

export async function getLeaderboard(limit = 20) {
  const snap = await db.collection('users').get();
  const users = [];
  snap.forEach(doc => users.push(doc.data()));
  users.sort((a, b) => (b.xp || 0) - (a.xp || 0));
  return users.slice(0, limit).map((u, i) => ({
    rank: i + 1, uid: u.uid, display_name: u.display_name,
    xp: u.xp || 0, badges: u.badges || [], reports: u.reports_submitted || 0,
    photo_url: u.photo_url,
  }));
}

export { BADGES, XP_REWARDS };
