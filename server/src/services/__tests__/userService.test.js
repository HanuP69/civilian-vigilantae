import test from 'node:test';
import assert from 'node:assert';
import { db } from '../../config/firebase.js';
import { registerUser, claimQuestReward, getUser, awardXP } from '../userService.js';

test('claimQuestReward preserves all other quests when claiming a reward', async () => {
  // 1. Register a test user
  const email = 'test_quests@example.com';
  const user = await registerUser(email, 'Password123!', 'Quest Tester');
  assert.ok(user.uid);
  assert.equal(user.quests.length, 3);
  assert.equal(user.quests[0].claimed, false);
  assert.equal(user.quests[1].claimed, false);
  assert.equal(user.quests[2].claimed, false);

  // 2. Simulate completing the first quest (reports_submitted = 1)
  await awardXP(user.uid, 'report', 'Hazratganj');

  // Verify first quest is completed but not claimed
  let updatedUser = await getUser(user.uid);
  assert.equal(updatedUser.quests.length, 3);
  const firstQuest = updatedUser.quests.find(q => q.id === 'first_responder');
  assert.equal(firstQuest.completed, true);
  assert.equal(firstQuest.claimed, false);

  // 3. Claim the reward for the first quest
  const claimResult = await claimQuestReward(user.uid, 'first_responder');
  assert.equal(claimResult.quests.length, 3);
  
  const claimedQuest = claimResult.quests.find(q => q.id === 'first_responder');
  assert.equal(claimedQuest.claimed, true);

  // Check the other quests in the returned result
  const otherQuest1 = claimResult.quests.find(q => q.id === 'vigilant_citizen');
  assert.equal(otherQuest1.claimed, false);
  assert.equal(otherQuest1.completed, false);

  const otherQuest2 = claimResult.quests.find(q => q.id === 'lucknow_surveyor');
  assert.equal(otherQuest2.claimed, false);
  assert.equal(otherQuest2.completed, false);

  // 4. Fetch the user again from database to verify persistence
  const finalUser = await getUser(user.uid);
  assert.equal(finalUser.quests.length, 3);

  const finalClaimed = finalUser.quests.find(q => q.id === 'first_responder');
  assert.equal(finalClaimed.claimed, true);
  assert.equal(finalClaimed.completed, true);

  const finalOther1 = finalUser.quests.find(q => q.id === 'vigilant_citizen');
  assert.ok(finalOther1, 'vigilant_citizen quest should still exist');
  assert.equal(finalOther1.claimed, false);

  const finalOther2 = finalUser.quests.find(q => q.id === 'lucknow_surveyor');
  assert.ok(finalOther2, 'lucknow_surveyor quest should still exist');
  assert.equal(finalOther2.claimed, false);
});
