/**
 * Sentinel Civic E2E Test Script
 * 
 * This script tests the core features of the backend API:
 * 1. Fetching tickets
 * 2. Submitting a new issue report (which triggers the AI agent)
 * 3. Fetching the created ticket
 * 4. Voting on the ticket to verify it
 * 5. Fetching dashboard stats
 * 6. Fetching recurrence risk
 * 7. Fetching the leaderboard
 * 
 * Usage: node test_e2e.js
 */

const API_URL = 'http://localhost:3001/api';
const USER_ID = `test-user-${Math.random().toString(36).substring(2, 8)}`;

async function runTests() {
  console.log('🚀 Starting Sentinel Civic E2E Tests...\n');
  
  try {
    // 1. Fetch Tickets
    console.log('1️⃣ Fetching recent tickets...');
    let res = await fetch(`${API_URL}/tickets?status=reported`);
    let data = await res.json();
    console.log(`   ✅ Successfully fetched ${data.tickets ? data.tickets.length : data.length} reported tickets.\n`);

    // 2. Submit a Report
    console.log('2️⃣ Submitting a new civic issue report...');
    const formData = new FormData();
    formData.append('text', 'There is a massive pothole causing traffic jams near the main intersection. Please fix it immediately!');
    formData.append('lat', '26.8500'); // Hazratganj coordinates
    formData.append('lng', '80.9450');
    formData.append('reporter_name', 'Test User');

    res = await fetch(`${API_URL}/reports`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${USER_ID}` },
      body: formData
    });
    
    data = await res.json();
    const ticketId = data.ticket_id;
    if (!ticketId) {
      console.log("Trace:", JSON.stringify(data.trace, null, 2));
      throw new Error("Agent failed to create a ticket (ticketId is null)");
    }
    console.log(`   ✅ Report submitted! Agent created ticket ID: ${ticketId}\n`);

    // Wait a brief moment for any async background tasks to settle
    await new Promise(r => setTimeout(r, 1000));

    // 3. Fetch the Specific Ticket
    console.log('3️⃣ Fetching the newly created ticket...');
    res = await fetch(`${API_URL}/tickets/${ticketId}`);
    const ticket = await res.json();
    if (!ticket || !ticket.id) throw new Error("Failed to fetch the created ticket");
    console.log(`   ✅ Fetched Ticket: "${ticket.title}" (Priority: ${Math.round((ticket.priority_score || 0)*100)}%, Status: ${ticket.status})\n`);

    // 4. Vote on the Ticket (Verification)
    console.log('4️⃣ Voting on the ticket (Still an issue)...');
    res = await fetch(`${API_URL}/verify/${ticketId}`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${USER_ID}`
      },
      body: JSON.stringify({ vote_type: 'still_issue' })
    });
    data = await res.json();
    if (!res.ok) throw new Error(`Voting failed: ${JSON.stringify(data)}`);
    if (data.verification_up === undefined) throw new Error("Voting response is missing verification counts");
    console.log(`   ✅ Voted successfully. Upvotes: ${data.verification_up}, Downvotes: ${data.verification_down}\n`);

    // 5. Dashboard Stats
    console.log('5️⃣ Fetching Dashboard Stats...');
    res = await fetch(`${API_URL}/dashboard/stats`);
    data = await res.json();
    console.log(`   ✅ Dashboard stats fetched. Total tickets: ${data.total}, Active Reporters: ${data.activeReporters}\n`);

    // 6. Recurrence Risk
    console.log('6️⃣ Fetching Recurrence Risks...');
    res = await fetch(`${API_URL}/dashboard/recurrence`);
    data = await res.json();
    console.log(`   ✅ Fetched recurrence risks. Found ${data.total || (data.risks ? data.risks.length : 'unknown')} wards with data.\n`);

    // 7. Leaderboard (User XP)
    console.log('7️⃣ Fetching User Leaderboard...');
    res = await fetch(`${API_URL}/users/leaderboard`);
    data = await res.json();
    console.log(`   ✅ Leaderboard fetched. Top user has ${data[0]?.xp || 0} XP.\n`);

    console.log('🎉 All E2E tests completed successfully!');

  } catch (err) {
    console.error('❌ Test failed:', err.message);
  }
}

runTests();
