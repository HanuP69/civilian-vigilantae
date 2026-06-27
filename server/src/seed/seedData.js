import { computePriority } from '../math/priority.js';
import { weibullCDF, DEFAULT_PARAMS, weibullConditionalProbability } from '../math/weibull.js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const WARDS = [
  { name: 'Hazratganj', center: { lat: 26.8500, lng: 80.9450 }, radius: 0.008, landmarks: ['Hazratganj Market', 'Mayfair Cinema', 'Janpath Market', 'Halwasiya Market'] },
  { name: 'Aminabad', center: { lat: 26.8467, lng: 80.9310 }, radius: 0.006, landmarks: ['Aminabad Market', 'Ghantaghar', 'Naza Cinema', 'Tulsi Theatre'] },
  { name: 'Aliganj', center: { lat: 26.8850, lng: 80.9390 }, radius: 0.010, landmarks: ['Aliganj Crossing', 'Sector O', 'Kapoorthala', 'Nehru Enclave'] },
  { name: 'Gomti Nagar', center: { lat: 26.8560, lng: 80.9830 }, radius: 0.012, landmarks: ['Gomti Riverfront', 'Lohia Path', 'Vipin Khand', 'Saharaganj Mall'] },
  { name: 'Indira Nagar', center: { lat: 26.8720, lng: 80.9860 }, radius: 0.010, landmarks: ['Munshi Pulia', 'Faizabad Road', 'Sector 21', 'IT College Crossing'] },
  { name: 'Alambagh', center: { lat: 26.8180, lng: 80.9110 }, radius: 0.008, landmarks: ['Alambagh Bus Stand', 'Transport Nagar', 'Kanpur Road', 'Lekhraj Market'] },
  { name: 'Chowk', center: { lat: 26.8580, lng: 80.9170 }, radius: 0.006, landmarks: ['Bara Imambara', 'Rumi Darwaza', 'Choti Imambara', 'Akbari Gate'] },
  { name: 'Rajajipuram', center: { lat: 26.8530, lng: 80.8920 }, radius: 0.009, landmarks: ['Rajajipuram Crossing', 'Sector 1', 'Ambedkar Park', 'Kukrail Reserve'] },
];

const CATEGORIES = ['pothole', 'water_leak', 'streetlight', 'waste', 'road_damage', 'drainage', 'other'];

const DEPARTMENTS = {
  pothole: 'Roads & Infrastructure', water_leak: 'Water Supply', streetlight: 'Electrical & Lighting',
  waste: 'Sanitation & Waste Management', road_damage: 'Roads & Infrastructure',
  drainage: 'Drainage & Sewerage', other: 'General Maintenance',
};

const SEVERITY_DIST = [
  { value: 'critical', weight: 0.10 }, { value: 'high', weight: 0.25 },
  { value: 'medium', weight: 0.40 }, { value: 'low', weight: 0.25 },
];

const STATUS_DIST = [
  { value: 'resolved', weight: 0.60 }, { value: 'in_progress', weight: 0.15 },
  { value: 'verified', weight: 0.10 }, { value: 'reported', weight: 0.10 },
  { value: 'reopened', weight: 0.05 },
];

const TITLES = {
  pothole: ['Large pothole on main road', 'Deep pothole near school zone', 'Multiple potholes causing accidents', 'Pothole filled with water', 'Dangerous pothole near bus stop', 'Crater-sized pothole on highway', 'Pothole damaging vehicles daily', 'Unrepaired pothole for weeks', 'New pothole forming after rain', 'Pothole near hospital entrance'],
  water_leak: ['Water pipe burst on main road', 'Continuous water leakage from valve', 'Underground pipe leak flooding street', 'Water wastage from broken pipe', 'Sewage water mixing with supply', 'High pressure leak near junction', 'Water gushing from cracked pipe', 'Leak causing road erosion', 'Overflowing water tank leak', 'Rusty pipe leaking non-stop'],
  streetlight: ['Streetlight not working for days', 'Flickering streetlight causing darkness', 'Broken streetlight pole hazard', 'No lights on entire stretch', 'Damaged streetlight after storm', 'Streetlight sparking dangerously', 'LED streetlight malfunction', 'Dark lane needs lighting', 'Tilted streetlight about to fall', 'Burnt out bulb replacement needed'],
  waste: ['Garbage dump overflowing', 'Waste not collected for a week', 'Illegal dumping near residential area', 'Overflowing community dustbin', 'Construction debris blocking road', 'Medical waste dumped openly', 'Stray animals scattering garbage', 'No dustbin in public area', 'Burning waste causing pollution', 'Plastic waste clogging drain'],
  road_damage: ['Road surface completely damaged', 'Cracks spreading across road', 'Road caved in after rain', 'Broken speed breaker hazard', 'Road divider damaged by truck', 'Uneven road surface dangerous', 'Road edge crumbling away', 'Waterlogged damaged road', 'Newly paved road already broken', 'Road markings completely faded'],
  drainage: ['Drain blocked causing flooding', 'Open drain cover missing', 'Sewage overflow on street', 'Storm drain clogged with debris', 'Drainage water entering homes', 'Broken drain pipe leaking', 'Stagnant water breeding mosquitoes', 'Drain collapsed underground', 'Monsoon drain inadequate', 'Foul smell from blocked drain'],
  other: ['Fallen tree blocking road', 'Damaged park bench needs repair', 'Broken boundary wall dangerous', 'Public toilet not maintained', 'Stray animal menace in colony', 'Encroachment on public footpath', 'Missing road signage', 'Damaged public water fountain', 'Broken playground equipment', 'Illegal construction blocking path'],
};

const NAMES = ['Aarav Sharma', 'Priya Singh', 'Rahul Verma', 'Ananya Gupta', 'Vikram Patel', 'Neha Mishra', 'Arjun Kumar', 'Sneha Tiwari', 'Rohan Yadav', 'Kavya Pandey', 'Amit Srivastava', 'Pooja Chauhan', 'Raj Malhotra', 'Divya Joshi', 'Karan Agarwal', 'Ritu Saxena', 'Manish Dubey', 'Ankita Rawat', 'Saurabh Nigam', 'Meera Rastogi', 'Deepak Awasthi', 'Swati Bajpai', 'Nikhil Tripathi', 'Pallavi Shukla', 'Aditya Khanna', 'Shruti Bhatia', 'Gaurav Kapoor', 'Nidhi Mehta', 'Harsh Tandon', 'Isha Reddy', 'Varun Chandra', 'Sakshi Nair', 'Mohit Dixit', 'Tanvi Kulkarni', 'Abhishek Iyer', 'Bhavna Sethi', 'Tushar Jain', 'Komal Thakur', 'Yash Bansal', 'Megha Pillai', 'Suresh Prasad', 'Geeta Devi', 'Rakesh Ojha', 'Sunita Kumari', 'Pankaj Soni', 'Lata Bhargava', 'Ajay Pathak', 'Renu Goyal', 'Sanjay Khatri', 'Uma Chaturvedi'];

function rand(min, max) { return Math.random() * (max - min) + min; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function weightedPick(items) {
  const r = Math.random();
  let sum = 0;
  for (const item of items) { sum += item.weight; if (r < sum) return item.value; }
  return items[items.length - 1].value;
}
function gaussRand() { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v); }

function enrichAgentFields(ticket, priorityScore, vUp, vDown, category, severity, slaDeadline, slaProbability, createdAt) {
  const ai = ticket.ai_classification?.confidence ?? 0.8;
  const rep = 0.7;
  const near = ticket.cluster_id ? 0.6 : 0.0;
  const total = vUp + vDown;
  const comm = total > 0 ? (vUp + 1) / (total + 2) : 0.5;

  const l0 = Math.log(ai / (1 - ai));
  const lReporter = Math.log(rep / (1 - rep));
  const pNear = 0.5 + 0.4 * (near - 0.5);
  const lNearby = Math.log(pNear / (1 - pNear));
  const lComm = Math.log(comm / (1 - comm));

  const lFinal = l0 + lReporter + lNearby + lComm;
  const pFinal = 1 / (1 + Math.exp(-lFinal));
  const vScore = Math.round(pFinal * 100);

  const slaRisk = Math.round((1 - slaProbability) * 100);
  const createdDate = new Date(createdAt);
  const deadlineDate = new Date(slaDeadline);
  
  ticket.verification_score = vScore;
  ticket.verification_explanation = `Bayesian consensus calculated valid issue state at ${vScore}% probability. Supported by ${vUp} citizen upvotes, AI computer vision label validation, and proximity cluster confirmation.`;

  ticket.priority_explanation = `Civic priority index calibrated at ${Math.round(priorityScore)}/100. Factors weighed: ${severity.toUpperCase()} hazard level, asset category index, and community feedback weighting.`;

  ticket.sla_risk_score = slaRisk;
  ticket.sla_risk_explanation = `Weibull hazard reliability forecast predicts a ${slaRisk}% probability of SLA deadline breach, assuming active department maintenance backlogs.`;

  const DISPATCH_DATA = {
    pothole: {
      department: "Roads & Infrastructure",
      crew_size: 3,
      materials: ["Cold-mix asphalt", "Compactor", "Traffic cones", "Safety signage"],
      estimated_cost: 3500,
      eta: "24h",
      explanation: "Deploy patch repair crew for asphalt overlay during off-peak traffic window."
    },
    water_leak: {
      department: "Water Supply",
      crew_size: 2,
      materials: ["Pipe clamps", "Excavator", "Replacement PVC conduit"],
      estimated_cost: 6000,
      eta: "12h",
      explanation: "Isolate main pressure valve, excavate section, and install heavy-duty pressure clamp."
    },
    streetlight: {
      department: "Electrical & Lighting",
      crew_size: 1,
      materials: ["LED bulb array", "Cherry picker lift", "Replacement fuses"],
      estimated_cost: 1500,
      eta: "48h",
      explanation: "Inspect wiring terminals and replace burnt out bulb assembly using aerial lift."
    },
    waste: {
      department: "Sanitation & Waste Management",
      crew_size: 2,
      materials: ["Compactor truck", "Heavy waste bins", "Sanitizer spray"],
      estimated_cost: 1200,
      eta: "8h",
      explanation: "Deploy regional waste management crew for container clearance and sanitation sweep."
    },
    road_damage: {
      department: "Roads & Infrastructure",
      crew_size: 4,
      materials: ["Sub-base gravel", "Asphalt roller", "Milling machine"],
      estimated_cost: 9500,
      eta: "72h",
      explanation: "Mill degraded asphalt surface, re-compact base gravel layer, and lay fresh wear course."
    },
    drainage: {
      department: "Drainage & Sewerage",
      crew_size: 3,
      materials: ["Hydro-jetting unit", "Gully vacuum truck", "CCTV inspection camera"],
      estimated_cost: 4500,
      eta: "36h",
      explanation: "Inspect pipe blockage with gully camera, deploy high-pressure jetting to clear silt sediment."
    },
    other: {
      department: "General Maintenance",
      crew_size: 2,
      materials: ["General toolset", "Hazard tape", "Reflective signs"],
      estimated_cost: 2000,
      eta: "48h",
      explanation: "Dispatch inspections crew to evaluate asset condition and determine correction path."
    }
  };

  ticket.dispatch_plan = DISPATCH_DATA[category] || DISPATCH_DATA.other;

  const ROOT_CAUSE_DATA = {
    pothole: {
      cause: "Sub-base water logging and freeze-thaw cycles",
      confidence: 84,
      explanation: "Improper storm drainage allowed water to saturate the subgrade base, causing pavement fatigue under vehicle wheel loads."
    },
    water_leak: {
      cause: "High-pressure pipe corrosion rupture",
      confidence: 91,
      explanation: "Aging distribution main suffered galvanic corrosion, weakening the metal wall until pressure surges caused a longitudinal split."
    },
    streetlight: {
      cause: "Corroded luminaire starter circuit",
      confidence: 78,
      explanation: "Water ingress through damaged enclosure seal caused short circuit across terminal block, blowing the inline fuse."
    },
    waste: {
      cause: "Exceeded ward capacity container allocation",
      confidence: 88,
      explanation: "Rapid residential growth in sector outstripped the weekly municipal garbage container collection schedules."
    },
    road_damage: {
      cause: "Unregulated heavy commercial vehicle transit",
      confidence: 85,
      explanation: "Axle weights from unauthorized construction traffic exceeded pavement load capacity, initiating longitudinal rutting."
    },
    drainage: {
      cause: "Siltation blockage from upstream surface runoff",
      confidence: 80,
      explanation: "Unpaved road runoff washed high volumes of sand and debris into the gully, completely choking the connection pipe."
    },
    other: {
      cause: "General wear and tear deterioration",
      confidence: 70,
      explanation: "Normal environmental exposure and lack of preventative maintenance over extended life cycle."
    }
  };

  ticket.root_cause = ROOT_CAUSE_DATA[category] || ROOT_CAUSE_DATA.other;

  const trace = [];
  const tStr = createdDate.toISOString();
  
  trace.push({
    step: "classify_issue",
    timestamp: tStr,
    input: { text: ticket.description },
    output: { category, severity, confidence: ai },
    reasoning: `AI classifier processed description. Categorized as "${category}" with confidence ${Math.round(ai*100)}%.`,
    duration_ms: Math.round(150 + Math.random()*200),
    status: "success"
  });

  trace.push({
    step: "geo_resolve",
    timestamp: new Date(createdDate.getTime() + 1000).toISOString(),
    input: { lat: ticket.lat, lng: ticket.lng },
    output: { address: ticket.address, ward: ticket.ward },
    reasoning: `Inverse geocoding resolved coordinates to municipal ward "${ticket.ward}".`,
    duration_ms: Math.round(100 + Math.random()*150),
    status: "success"
  });

  trace.push({
    step: "find_cluster",
    timestamp: new Date(createdDate.getTime() + 2000).toISOString(),
    input: { lat: ticket.lat, lng: ticket.lng, category },
    output: { found: !!ticket.cluster_id, ticket_id: ticket.cluster_id ? ticket.id : null },
    reasoning: ticket.cluster_id 
      ? `Spatial clustering agent associated report with active duplicate hotspot group #${ticket.cluster_id}.`
      : `Spatial clustering agent scanned coordinates; no active duplicates located in proximity.`,
    duration_ms: Math.round(200 + Math.random()*300),
    status: "success"
  });

  trace.push({
    step: "compute_priority",
    timestamp: new Date(createdDate.getTime() + 3000).toISOString(),
    input: { severity, reportCount: vUp + 1, category },
    output: { priority_score: priorityScore },
    reasoning: `Priority evaluation calculated score of ${Math.round(priorityScore)} using multi-factor hazard weights.`,
    duration_ms: Math.round(120 + Math.random()*180),
    status: "success"
  });

  trace.push({
    step: "check_sla_status",
    timestamp: new Date(createdDate.getTime() + 4000).toISOString(),
    input: { category, created_at: tStr },
    output: { probability: slaProbability },
    reasoning: `Weibull distribution analyzed. Target resolution deadline set to ${deadlineDate.toLocaleString()}.`,
    duration_ms: Math.round(180 + Math.random()*250),
    status: "success"
  });

  trace.push({
    step: "create_ticket",
    timestamp: new Date(createdDate.getTime() + 5000).toISOString(),
    input: { ticket_id: ticket.id },
    output: { status: "created" },
    reasoning: `Orchestrator successfully compiled pipeline traces and initialized ticket #${ticket.id}.`,
    duration_ms: Math.round(90 + Math.random()*150),
    status: "success"
  });

  ticket.agent_trace = trace;
}

function seasonalWeight(month, category) {
  const monsoon = [6, 7, 8];
  const summer = [3, 4, 5];
  const winter = [11, 0, 1];
  if (monsoon.includes(month) && (category === 'water_leak' || category === 'drainage')) return 3.0;
  if (summer.includes(month) && (category === 'pothole' || category === 'road_damage')) return 2.0;
  if (winter.includes(month) && category === 'streetlight') return 1.5;
  return 1.0;
}

export function generateTickets(count = 800) {
  const tickets = [];
  const now = new Date();
  const seedStart = new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000);

  for (let i = 0; i < count; i++) {
    const createdAt = new Date(seedStart.getTime() + Math.random() * (now.getTime() - seedStart.getTime()));
    const month = createdAt.getMonth();
    let category;
    let attempts = 0;
    do {
      category = pick(CATEGORIES);
      attempts++;
    } while (Math.random() > (seasonalWeight(month, category) / 3.0) && attempts < 10);

    const ward = pick(WARDS);
    const severity = weightedPick(SEVERITY_DIST);
    const status = weightedPick(STATUS_DIST);
    const lat = ward.center.lat + gaussRand() * ward.radius * 0.5;
    const lng = ward.center.lng + gaussRand() * ward.radius * 0.5;
    const landmark = pick(ward.landmarks);
    const reporterIdx = Math.floor(Math.random() * 50) + 1;

    const slaHours = DEFAULT_PARAMS[category]?.lambda || 168;
    const slaDeadline = new Date(createdAt.getTime() + slaHours * 60 * 60 * 1000);
    const elapsedHours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

    let resolvedAt = null;
    if (status === 'resolved') {
      const params = DEFAULT_PARAMS[category] || DEFAULT_PARAMS.other;
      const u = Math.random();
      const resolutionHours = params.lambda * Math.pow(-Math.log(1 - u), 1 / params.k);
      resolvedAt = new Date(createdAt.getTime() + resolutionHours * 60 * 60 * 1000);
    }

    let vUp = 0;
    let vDown = 0;
    if (status === 'resolved') {
      vUp = Math.floor(rand(0, 3));
      vDown = Math.floor(rand(5, 15));
    } else if (status === 'verified' || status === 'in_progress' || status === 'reopened') {
      vUp = Math.floor(rand(3, 15));
      vDown = Math.floor(rand(0, 2));
    } else {
      vUp = Math.floor(rand(0, 2));
      vDown = 0;
    }
    const reportCount = Math.floor(rand(1, 6));

    const priorityScore = computePriority({
      severity, reportCount, verificationUp: vUp, verificationDown: vDown,
      elapsedHours: Math.min(elapsedHours, slaHours * 2), slaHours, category,
    });

    let cloudVisionResult = null;
    let classificationAgreement = true;
    const aiClassification = { category, severity, confidence: Math.round(rand(0.75, 0.95) * 100) / 100, source: 'llm' };

    // Simulate Cloud Vision labeling for 40% of reports
    if (Math.random() < 0.40) {
      const isAgreed = Math.random() >= 0.15; // 85% agreement
      const visionScore = Math.round(rand(0.60, 0.95) * 100) / 100;
      
      const matchedLabel = isAgreed
        ? (category === 'pothole' ? 'Pothole' : (category === 'water_leak' ? 'Water pipe' : (category === 'streetlight' ? 'Street light' : 'Garbage')))
        : (category === 'pothole' ? 'Water pipe' : 'Pothole');
        
      cloudVisionResult = {
        labels: [
          { description: matchedLabel, score: visionScore }
        ],
        confidence: visionScore,
        source: 'cloud_vision'
      };
      
      classificationAgreement = isAgreed;
      
      // Calculate Bayesian consensus probability and entropy
      const prior = {};
      const CATEGORIES_LIST = ['pothole', 'water_leak', 'streetlight', 'waste', 'road_damage', 'drainage', 'other'];
      CATEGORIES_LIST.forEach(c => {
        prior[c] = (c === category) ? aiClassification.confidence : (1 - aiClassification.confidence) / (CATEGORIES_LIST.length - 1);
      });
      
      const likelihood = {};
      CATEGORIES_LIST.forEach(c => { likelihood[c] = 0; });
      
      const VISION_TO_CATEGORY_MAPPING = {
        'Pothole': 'pothole', 'Road surface': 'pothole',
        'Water': 'water_leak', 'Pipe': 'water_leak', 'Leak': 'water_leak',
        'Street light': 'streetlight',
        'Garbage': 'waste', 'Waste': 'waste',
      };
      
      for (const [kw, cat] of Object.entries(VISION_TO_CATEGORY_MAPPING)) {
        if (matchedLabel.toLowerCase().includes(kw.toLowerCase())) {
          likelihood[cat] += visionScore;
        }
      }
      
      // Softmax likelihood
      const exps = {};
      let sumExp = 0;
      CATEGORIES_LIST.forEach(c => {
        exps[c] = Math.exp(likelihood[c]);
        sumExp += exps[c];
      });
      CATEGORIES_LIST.forEach(c => { likelihood[c] = exps[c] / sumExp; });
      
      // Posterior
      const posterior = {};
      let sumPost = 0;
      CATEGORIES_LIST.forEach(c => {
        posterior[c] = prior[c] * likelihood[c];
        sumPost += posterior[c];
      });
      
      let entropy = 0;
      CATEGORIES_LIST.forEach(c => {
        const p = posterior[c] / sumPost;
        if (p > 0) entropy -= p * Math.log2(p);
      });
      
      aiClassification.entropy = Math.round(entropy * 100) / 100;
    }

    const slaParams = DEFAULT_PARAMS[category] || DEFAULT_PARAMS.other;
    const slaProbability = status === 'resolved' && resolvedAt
      ? (resolvedAt.getTime() <= slaDeadline.getTime() ? 1.0 : 0.0)
      : Math.round(weibullConditionalProbability(elapsedHours, slaHours, slaParams.lambda, slaParams.k) * 100) / 100;

    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const ticket = {
      id: `ticket-${i}-${randomSuffix}`,
      title: pick(TITLES[category]),
      description: `${pick(TITLES[category])} near ${landmark} in ${ward.name}. Residents have been facing this issue and need urgent attention.`,
      category, severity, status,
      priority_score: priorityScore,
      lat, lng,
      address: `Near ${landmark}, ${ward.name}, Lucknow`,
      ward: ward.name,
      department: DEPARTMENTS[category],
      media_urls: [], media_type: 'image',
      ai_classification: aiClassification,
      cloud_vision_result: cloudVisionResult,
      classification_agreement: classificationAgreement,
      reporter_id: `user-${reporterIdx}`,
      reporter_name: NAMES[reporterIdx - 1],
      verification_up: vUp, verification_down: vDown,
      verified_by: [],
      cluster_id: null, merged_into: null, child_reports: [],
      sla_deadline: slaDeadline.toISOString(),
      sla_probability: slaProbability,
      agent_trace: [],
      resolution_media_url: null,
      created_at: createdAt.toISOString(),
      updated_at: createdAt.toISOString(),
      resolved_at: resolvedAt ? resolvedAt.toISOString() : null,
    };

    enrichAgentFields(ticket, priorityScore, vUp, vDown, category, severity, slaDeadline.toISOString(), slaProbability, createdAt.toISOString());
    tickets.push(ticket);
  }

  // Create ~5 duplicate clusters
  for (let c = 0; c < 5; c++) {
    const base = tickets[Math.floor(Math.random() * tickets.length)];
    const clusterId = `cluster-${c}`;
    base.cluster_id = clusterId;
    const dupeCount = Math.floor(rand(2, 4));
    for (let d = 0; d < dupeCount; d++) {
      const dupeTime = new Date(new Date(base.created_at).getTime() + rand(0, 24) * 60 * 60 * 1000);
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      tickets.push({
        ...base,
        id: `ticket-dupe-${c}-${d}-${randomSuffix}`,
        lat: base.lat + gaussRand() * 0.001,
        lng: base.lng + gaussRand() * 0.001,
        cluster_id: clusterId,
        merged_into: base.id,
        created_at: dupeTime.toISOString(),
        reporter_id: `user-${Math.floor(rand(1, 50))}`,
        reporter_name: pick(NAMES),
      });
    }
  }

  return tickets;
}

export function generateUsers() {
  return NAMES.map((name, i) => {
    const xp = Math.floor(rand(0, 600));
    const badges = [];
    if (xp > 0) badges.push('Neighborhood Watch');
    if (xp > 150) badges.push('Verified Reporter');
    if (xp > 300) badges.push('Eagle Eye');
    if (xp > 500) badges.push('Community Champion');

    const verifications_made = Math.floor(rand(0, 50));
    const accurate_verifications = Math.floor(rand(0, verifications_made));
    const reports_rejected = verifications_made - accurate_verifications;
    const reports_submitted = Math.floor(rand(1, 30));

    const totalActions = verifications_made + reports_submitted;
    const laplaceTrust = (accurate_verifications + 1) / (verifications_made + 2);
    const trust_score = Math.round(laplaceTrust * Math.min(totalActions / 20, 1) * 100) / 100;

    return {
      uid: `user-${i + 1}`, display_name: name,
      email: `${name.toLowerCase().replace(/\s/g, '.')}@example.com`,
      photo_url: null, xp, badges,
      reports_submitted,
      verifications_made,
      accurate_verifications,
      reports_verified: accurate_verifications,
      reports_rejected,
      trust_score,
      joined_at: new Date(Date.now() - rand(30, 180) * 24 * 60 * 60 * 1000).toISOString(),
    };
  });
}

export function generateDepartments(tickets) {
  const deptNames = [...new Set(Object.values(DEPARTMENTS))];
  return deptNames.map(name => {
    const deptTickets = tickets.filter(t => t.department === name);
    const resolved = deptTickets.filter(t => t.status === 'resolved');
    const categories = Object.entries(DEPARTMENTS).filter(([, v]) => v === name).map(([k]) => k);
    return {
      id: name.toLowerCase().replace(/[^a-z]/g, '_'),
      name, categories,
      ward: 'All',
      tickets_assigned: deptTickets.length,
      tickets_resolved: resolved.length,
      avg_resolution_hours: resolved.length > 0
        ? resolved.reduce((s, t) => s + (new Date(t.resolved_at) - new Date(t.created_at)) / 3600000, 0) / resolved.length
        : 0,
    };
  });
}

export function generateAll() {
  const tickets = generateTickets(75);
  const users = generateUsers();
  const departments = generateDepartments(tickets);
  return { tickets, users, departments };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const data = generateAll();
  const outPath = join(__dirname, 'seedOutput.json');
  writeFileSync(outPath, JSON.stringify(data, null, 2));
  console.log(`Generated ${data.tickets.length} tickets, ${data.users.length} users, ${data.departments.length} departments`);
  console.log(`Written to ${outPath}`);
}
