import { Blob } from 'node:buffer';
import fs from 'node:fs';
import path from 'node:path';

const dataset = [
  {
    category: 'pothole',
    text: 'A dangerous pothole has formed in the middle of Hazratganj main market street. It is causing vehicular damage and traffic congestion.',
    imageUrl: 'https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&w=600&q=80',
    lat: 26.8502,
    lng: 80.9455,
    reporter_name: 'Aditya Sharma'
  },
  {
    category: 'waste',
    text: 'Overflowing public garbage bin causing waste accumulation on the street side. It smells terrible and is blocking the footpath.',
    imageUrl: 'https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?auto=format&fit=crop&w=600&q=80',
    lat: 26.8465,
    lng: 80.9315,
    reporter_name: 'Priya Verma'
  },
  {
    category: 'water_leak',
    text: 'Water pipe leak on Gomti Nagar road. A huge volume of water is leaking from a cracked municipal pipe, flooding the lane.',
    imageUrl: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?auto=format&fit=crop&w=600&q=80',
    lat: 26.8565,
    lng: 80.9832,
    reporter_name: 'Rohan Mishra'
  },
  {
    category: 'streetlight',
    text: 'The street lamp is completely dead and the lane is pitch black at night near Munshi Pulia in Indira Nagar.',
    imageUrl: 'https://images.unsplash.com/photo-1517059224940-d4af9eec41b7?auto=format&fit=crop&w=600&q=80',
    lat: 26.8724,
    lng: 80.9862,
    reporter_name: 'Sneha Pandey'
  }
];

const API_URL = 'http://127.0.0.1:3001/api'; // Point back to default port 3001

async function downloadImage(url) {
  console.log(`   Downloading fallback: ${url.substring(0, 60)}...`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download fallback image (${res.status}): ${res.statusText}`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function getImageBuffer(report) {
  const imagesDir = path.join(process.cwd(), 'stress_images');
  const localPath = path.join(imagesDir, `${report.category}.jpg`);
  
  if (fs.existsSync(localPath)) {
    console.log(`   Found local image: ${localPath}`);
    return fs.readFileSync(localPath);
  }
  
  return downloadImage(report.imageUrl);
}

async function runStressTest() {
  console.log('🚀 Starting Agent & Database Stress Test...');
  console.log('📂 Drop your custom test images in server/stress_images/ as pothole.jpg, waste.jpg, water_leak.jpg, streetlight.jpg\n');

  // Create stress_images directory if it doesn't exist
  const imagesDir = path.join(process.cwd(), 'stress_images');
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }

  for (let i = 0; i < dataset.length; i++) {
    const report = dataset[i];
    console.log(`----------------------------------------------------------------------`);
    console.log(`📋 Test Case ${i + 1}/${dataset.length}: [Expected: ${report.category.toUpperCase()}]`);
    console.log(`   Description: "${report.text}"`);

    try {
      // 1. Get image buffer
      const buffer = await getImageBuffer(report);
      console.log(`   Image buffer size: ${(buffer.length / 1024).toFixed(1)} KB`);

      // 2. Build FormData
      const formData = new FormData();
      const imageBlob = new Blob([buffer], { type: 'image/jpeg' });
      
      formData.append('media', imageBlob, `issue_${report.category}.jpg`);
      formData.append('text', report.text);
      formData.append('lat', report.lat.toString());
      formData.append('lng', report.lng.toString());
      formData.append('reporter_name', report.reporter_name);

      // 3. Post to API
      console.log(`   Posting report to API: ${API_URL}/reports ...`);
      const postStart = Date.now();
      
      const res = await fetch(`${API_URL}/reports`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer test-user-stress-${i + 1}`
        },
        body: formData
      });

      const duration = ((Date.now() - postStart) / 1000).toFixed(1);
      
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`API returned error (${res.status}): ${errText}`);
      }

      const result = await res.json();
      console.log(`   ✅ API responded successfully in ${duration}s.`);
      console.log(`   🎫 Created/Merged Ticket ID: ${result.ticket_id}`);
      console.log(`   🔗 Deduplication: ${result.merged ? 'Merged into duplicate cluster' : 'New ticket created'}`);
      console.log(`   🏷️ Agent Classification: Category: ${result.classification?.category}, Severity: ${result.classification?.severity}, Confidence: ${Math.round(result.classification?.confidence * 100)}%`);
      
      if (result.classification?.entropy !== undefined) {
        console.log(`   📊 Shannon Entropy: ${result.classification.entropy.toFixed(3)}`);
      }

      if (result.trace && result.trace.length > 0) {
        console.log(`   🔄 Agent Steps Executed:`);
        result.trace.forEach(step => {
          console.log(`      - [${step.step.toUpperCase()}] status: ${step.status} (${step.duration_ms}ms)`);
        });
      }

    } catch (err) {
      console.error(`   ❌ Failed Test Case ${i + 1}:`, err.message);
    }
    console.log();
  }

  console.log('🎉 Stress test execution finished!');
}

runStressTest().catch(err => {
  console.error('Fatal error running stress test:', err);
});
