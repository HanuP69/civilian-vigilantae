import { db } from '../config/firebase.js';
import { generateTickets, generateUsers, generateDepartments } from './seedData.js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function clearCollection(collectionName) {
  console.log(`Clearing collection "${collectionName}"...`);
  const collectionRef = db.collection(collectionName);
  let totalDeleted = 0;
  
  if (typeof collectionRef.limit !== 'function' || typeof db.batch !== 'function') {
    // Mock environment
    const snapshot = await collectionRef.get();
    if (!snapshot.empty) {
      for (const doc of snapshot.docs) {
        await collectionRef.doc(doc.id).delete();
        totalDeleted++;
      }
    }
  } else {
    // Real Firebase environment
    while (true) {
      const snapshot = await collectionRef.limit(400).get();
      if (snapshot.empty) break;
      
      const batch = db.batch();
      snapshot.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      totalDeleted += snapshot.size;
    }
  }
  console.log(`Successfully cleared "${collectionName}" (deleted ${totalDeleted} documents).`);
}

async function run() {
  try {
    console.log('=== STARTING FIREBASE DB CLEANUP ===');
    await clearCollection('tickets');
    await clearCollection('users');
    await clearCollection('departments');
    console.log('=== DB CLEANUP COMPLETE ===\n');

    console.log('Generating 50 realistic data points...');
    // We generate 40 base tickets, which with duplicates usually adds ~12-15 more.
    // Slicing to exactly 50 ensures we have exactly 50 tickets.
    const rawTickets = generateTickets(40);
    const tickets = rawTickets.slice(0, 50);
    const users = generateUsers().slice(0, 50);
    const departments = generateDepartments(tickets);

    console.log(`Generated:`);
    console.log(`- ${tickets.length} tickets (including duplicates)`);
    console.log(`- ${users.length} users`);
    console.log(`- ${departments.length} departments`);

    console.log('\nPopulating Firestore database with new data...');
    
    // Write tickets
    console.log('Writing tickets...');
    if (typeof db.batch !== 'function') {
      for (const ticket of tickets) {
        await db.collection('tickets').doc(ticket.id).set(ticket);
      }
    } else {
      const ticketBatch = db.batch();
      tickets.forEach((ticket) => {
        ticketBatch.set(db.collection('tickets').doc(ticket.id), ticket);
      });
      await ticketBatch.commit();
    }
    console.log(`Wrote ${tickets.length} tickets.`);

    // Write users
    console.log('Writing users...');
    if (typeof db.batch !== 'function') {
      for (const user of users) {
        await db.collection('users').doc(user.uid).set(user);
      }
    } else {
      const userBatch = db.batch();
      users.forEach((user) => {
        userBatch.set(db.collection('users').doc(user.uid), user);
      });
      await userBatch.commit();
    }
    console.log(`Wrote ${users.length} users.`);

    // Write departments
    console.log('Writing departments...');
    if (typeof db.batch !== 'function') {
      for (const dept of departments) {
        await db.collection('departments').doc(dept.id).set(dept);
      }
    } else {
      const deptBatch = db.batch();
      departments.forEach((dept) => {
        deptBatch.set(db.collection('departments').doc(dept.id), dept);
      });
      await deptBatch.commit();
    }
    console.log(`Wrote ${departments.length} departments.`);

    console.log('\nUpdating local seedOutput.json...');
    const outPath = join(__dirname, 'seedOutput.json');
    writeFileSync(outPath, JSON.stringify({ tickets, users, departments }, null, 2));
    console.log(`Successfully wrote local seed data to ${outPath}`);

    console.log('\n=== FIREBASE POPULATION COMPLETED SUCCESSFULLY ===');
    process.exit(0);
  } catch (err) {
    console.error('Error during cleanup and population:', err);
    process.exit(1);
  }
}

run();
