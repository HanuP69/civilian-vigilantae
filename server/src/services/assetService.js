import { db } from '../config/firebase.js';

const SEEDED_ASSETS = [
  { id: 'asset_hazratganj_road', name: 'Hazratganj Main Tarmac', type: 'road', ward: 'Hazratganj', health: 100 },
  { id: 'asset_hazratganj_lights', name: 'Hazratganj Commercial Light Grid', type: 'streetlight', ward: 'Hazratganj', health: 100 },
  { id: 'asset_hazratganj_pipes', name: 'Hazratganj Core Water Conduit', type: 'pipe', ward: 'Hazratganj', health: 100 },
  { id: 'asset_hazratganj_drains', name: 'Hazratganj Storm Sump System', type: 'drainage', ward: 'Hazratganj', health: 100 },

  { id: 'asset_aliganj_pipes', name: 'Aliganj Main Water Distributor', type: 'pipe', ward: 'Aliganj', health: 100 },
  { id: 'asset_aliganj_road', name: 'Aliganj Sector B Highway', type: 'road', ward: 'Aliganj', health: 100 },
  { id: 'asset_aliganj_waste', name: 'Aliganj Central Sanitation Hub', type: 'waste_bin', ward: 'Aliganj', health: 100 },

  { id: 'asset_gomti_road', name: 'Gomti Nagar Bypass Flyover', type: 'road', ward: 'Gomti Nagar', health: 100 },
  { id: 'asset_gomti_lights', name: 'Gomti Nagar Substation Lights', type: 'streetlight', ward: 'Gomti Nagar', health: 100 },
  { id: 'asset_gomti_pipes', name: 'Gomti Nagar Residential Supply Line', type: 'pipe', ward: 'Gomti Nagar', health: 100 },

  { id: 'asset_indira_road', name: 'Indira Nagar Ring Road Sector 14', type: 'road', ward: 'Indira Nagar', health: 100 },
  { id: 'asset_indira_drains', name: 'Indira Nagar Main Sewerage Duct', type: 'drainage', ward: 'Indira Nagar', health: 100 },

  { id: 'asset_alambagh_road', name: 'Alambagh Market Boulevard', type: 'road', ward: 'Alambagh', health: 100 },
  { id: 'asset_alambagh_waste', name: 'Alambagh Junction Refuse Site', type: 'waste_bin', ward: 'Alambagh', health: 100 },

  { id: 'asset_chowk_drains', name: 'Chowk Historic Sewage Culvert', type: 'drainage', ward: 'Chowk', health: 100 },
  { id: 'asset_chowk_road', name: 'Chowk Bazaar Narrow Laneway', type: 'road', ward: 'Chowk', health: 100 },

  { id: 'asset_aminabad_waste', name: 'Aminabad Market Dumpster Grid', type: 'waste_bin', ward: 'Aminabad', health: 100 },
  { id: 'asset_aminabad_road', name: 'Aminabad Central Square Roadway', type: 'road', ward: 'Aminabad', health: 100 },
  { id: 'asset_aminabad_lights', name: 'Aminabad Bazaar Lighting Grid', type: 'streetlight', ward: 'Aminabad', health: 100 },
  { id: 'asset_aminabad_drains', name: 'Aminabad Naala Drainage Culvert', type: 'drainage', ward: 'Aminabad', health: 100 },

  { id: 'asset_rajajipuram_pipes', name: 'Rajajipuram Sector E Trunk Line', type: 'pipe', ward: 'Rajajipuram', health: 100 },
  { id: 'asset_rajajipuram_lights', name: 'Rajajipuram Sector F Lighting Grid', type: 'streetlight', ward: 'Rajajipuram', health: 100 }
];

export async function seedAssets() {
  try {
    for (const asset of SEEDED_ASSETS) {
      const docRef = db.collection('assets').doc(asset.id);
      const doc = await docRef.get();
      if (!doc.exists) {
        await docRef.set(asset);
      }
    }
    console.log(`[Assets] ${SEEDED_ASSETS.length} infrastructure assets verified/seeded.`);
    return true;
  } catch (err) {
    console.warn('[Assets] Seeding error:', err.message);
    return false;
  }
}

/**
 * Links a ticket category to an asset type
 */
export function getAssetTypeForCategory(category) {
  const mapping = {
    pothole: 'road',
    road_damage: 'road',
    water_leak: 'pipe',
    streetlight: 'streetlight',
    waste: 'waste_bin',
    drainage: 'drainage'
  };
  return mapping[category] || 'road'; // fallback to road
}

/**
 * Resolves the appropriate asset for a given ward and category
 */
export async function resolveNearestAsset(ward, category) {
  const targetType = getAssetTypeForCategory(category);
  try {
    const snap = await db.collection('assets')
      .where('ward', '==', ward)
      .where('type', '==', targetType)
      .get();
    
    if (!snap.empty) {
      return snap.docs[0].data();
    }
    
    // Fallback: try finding any asset in the same ward
    const wardSnap = await db.collection('assets').where('ward', '==', ward).get();
    if (!wardSnap.empty) {
      return wardSnap.docs[0].data();
    }
    
    // Absolute fallback: return the first seeded asset
    return SEEDED_ASSETS[0];
  } catch (err) {
    console.warn('[Assets] Resolve nearest asset failed:', err.message);
    return SEEDED_ASSETS[0];
  }
}

/**
 * Dynamic Health Index calculation for an asset.
 * H = max(0, 100 - sum(SeverityWeights of active tickets attached to this asset))
 */
export async function updateAssetHealth(assetId) {
  try {
    const assetRef = db.collection('assets').doc(assetId);
    const assetDoc = await assetRef.get();
    if (!assetDoc.exists) return;

    const ticketsSnap = await db.collection('tickets')
      .where('asset_id', '==', assetId)
      .get();

    let openIssuesCount = 0;
    let severityDeduction = 0;

    const severityWeights = {
      critical: 30,
      high: 20,
      medium: 10,
      low: 5
    };

    ticketsSnap.forEach(doc => {
      const ticket = doc.data();
      if (ticket.status !== 'resolved') {
        openIssuesCount++;
        const sev = (ticket.severity || 'low').toLowerCase();
        severityDeduction += severityWeights[sev] || 5;
      }
    });

    const assetData = assetDoc.data();
    const seedDate = assetData.created_at ? (assetData.created_at.toDate?.() ?? new Date(assetData.created_at)) : new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const ageDays = (Date.now() - seedDate.getTime()) / (24 * 3600 * 1000);
    const decayRate = 0.05; // 0.05% health decay per day
    const ageDecay = ageDays * decayRate;

    // Simulate sensor integration (telemetry)
    const type = assetData.type;
    let sensorPenalty = 0;
    const telemetry = assetData.telemetry || {};

    if (type === 'road') {
      telemetry.vibration_index = telemetry.vibration_index ?? (1.2 + Math.random() * 2.5);
      if (telemetry.vibration_index > 3) sensorPenalty += (telemetry.vibration_index - 3) * 15;
    } else if (type === 'pipe') {
      telemetry.flow_rate_efficiency = telemetry.flow_rate_efficiency ?? (80 + Math.random() * 20);
      if (telemetry.flow_rate_efficiency < 90) sensorPenalty += (90 - telemetry.flow_rate_efficiency) * 2.5;
    } else if (type === 'streetlight') {
      telemetry.lux_level = telemetry.lux_level ?? (25 + Math.random() * 30);
      if (telemetry.lux_level < 40) sensorPenalty += (40 - telemetry.lux_level) * 1.5;
    } else if (type === 'waste_bin') {
      telemetry.fill_level = telemetry.fill_level ?? (Math.random() * 95);
      if (telemetry.fill_level > 80) sensorPenalty += (telemetry.fill_level - 80) * 2.0;
    } else if (type === 'drainage') {
      telemetry.blockage_index = telemetry.blockage_index ?? (Math.random() * 50);
      if (telemetry.blockage_index > 30) sensorPenalty += (telemetry.blockage_index - 30) * 1.8;
    }

    const calculatedHealth = Math.max(0, 100 - severityDeduction - ageDecay - sensorPenalty);
    const newHealth = Math.round(calculatedHealth * 100) / 100;

    await assetRef.update({
      health: newHealth,
      open_issues_count: openIssuesCount,
      telemetry,
      updated_at: new Date().toISOString()
    });

    return { assetId, health: newHealth, openIssuesCount };
  } catch (err) {
    console.warn(`[Assets] Failed to update asset health for ${assetId}:`, err.message);
  }
}

/**
 * Helper to update health for all assets
 */
export async function updateAllAssetsHealth() {
  try {
    const snap = await db.collection('assets').get();
    for (const doc of snap.docs) {
      await updateAssetHealth(doc.id);
    }
  } catch (err) {
    console.warn('[Assets] Update all assets health failed:', err.message);
  }
}
