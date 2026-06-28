/**
 * @module math/dbscan
 * @description DBSCAN clustering with a composite distance metric that blends
 * spatial proximity (haversine), temporal proximity, and category similarity.
 *
 * Designed for clustering community-reported civic issues so that
 * geographically close, temporally recent, and categorically related reports
 * are grouped together.
 */

import { haversineNormalized } from './haversine.js';

// ─── Distance weights ────────────────────────────────────────────────
/** Spatial weight */
const ALPHA = 0.4;
/** Temporal weight */
const BETA = 0.35;
/** Category weight */
const GAMMA = 0.25;

// Maximum spatial normalizing distance (meters).
const MAX_DISTANCE_M = 500;

// ─── Adaptive Category Temporal Windows ─────────────────────────────
/**
 * Returns the maximum temporal window (milliseconds) based on category frequency.
 * Potholes and waste cluster faster, streetlight issues cluster slower.
 *
 * @param {string} category
 * @returns {number} window in milliseconds
 */
export function getMaxTimeWindowForCategory(category) {
  const cat = (category || '').toLowerCase();
  if (['pothole', 'waste'].includes(cat)) {
    return 24 * 60 * 60 * 1000; // 24 hours (potholes cluster faster)
  }
  if (['water_leak', 'road_damage', 'drainage'].includes(cat)) {
    return 48 * 60 * 60 * 1000; // 48 hours
  }
  return 72 * 60 * 60 * 1000; // 72 hours (streetlight/other cluster slower)
}

// ─── Semantic Category Similarity Matrix ────────────────────────────
/**
 * Continuous semantic similarity lookup table between categories.
 * Remaps unrelated categories (0.0), partially related (0.4 - 0.7), and highly related (0.8).
 */
const SIMILARITY_MATRIX = {
  pothole: { road_damage: 0.8, other: 0.1 },
  road_damage: { pothole: 0.8, other: 0.1 },
  water_leak: { drainage: 0.6, other: 0.1 },
  drainage: { water_leak: 0.6, waste: 0.4, other: 0.1 },
  waste: { drainage: 0.4, other: 0.1 },
  electricity: { streetlight: 0.7, other: 0.1 },
  streetlight: { electricity: 0.7, other: 0.1 }
};

/**
 * Return category similarity between two category strings.
 *
 * - 1.0  — identical categories
 * - 0.4-0.8 — related categories (semantic mapping)
 * - 0.0  — unrelated
 *
 * @param {string} cat1
 * @param {string} cat2
 * @returns {number} similarity in [0, 1]
 */
function categorySimilarity(cat1, cat2) {
  if (cat1 === cat2) return 1.0;
  const c1 = (cat1 || '').toLowerCase();
  const c2 = (cat2 || '').toLowerCase();
  if (SIMILARITY_MATRIX[c1]?.[c2] !== undefined) {
    return SIMILARITY_MATRIX[c1][c2];
  }
  return 0.0;
}

/**
 * @typedef {Object} ClusterPoint
 * @property {number}  lat       — latitude (degrees)
 * @property {number}  lng       — longitude (degrees)
 * @property {Date}    timestamp — when the report was created
 * @property {string}  category  — issue category (e.g. "pothole")
 * @property {string}  id        — unique report identifier
 */

/**
 * Compute the composite distance between two cluster points.
 *
 * ```
 * d(p1, p2) = α · d_spatial + β · d_temporal + γ · d_category
 * ```
 *
 * Each component is normalized to [0, 1] before weighting.
 *
 * @param {ClusterPoint} p1
 * @param {ClusterPoint} p2
 * @returns {number} composite distance in [0, 1]
 */
export function compositeDistance(p1, p2) {
  // Spatial component — haversine normalized over 500 m
  const dSpatial = haversineNormalized(p1.lat, p1.lng, p2.lat, p2.lng, MAX_DISTANCE_M);

  // Temporal component — absolute time difference normalized over adaptive window
  const t1 = p1.timestamp instanceof Date ? p1.timestamp.getTime() : new Date(p1.timestamp).getTime();
  const t2 = p2.timestamp instanceof Date ? p2.timestamp.getTime() : new Date(p2.timestamp).getTime();
  const maxTimeMs = Math.min(
    getMaxTimeWindowForCategory(p1.category),
    getMaxTimeWindowForCategory(p2.category)
  );
  const dTemporal = Math.min(Math.abs(t1 - t2) / maxTimeMs, 1);

  // Category component — 1 - similarity
  const dCategory = 1 - categorySimilarity(p1.category, p2.category);

  return ALPHA * dSpatial + BETA * dTemporal + GAMMA * dCategory;
}

/**
 * @typedef {Object} DBSCANResult
 * @property {string[][]} clusters — array of clusters, each containing point ids
 * @property {string[]}   noise    — ids of points classified as noise
 */

/**
 * Run DBSCAN clustering on a set of civic-issue points using the
 * composite distance metric.
 *
 * @param {ClusterPoint[]} points   — array of points to cluster
 * @param {number}         [epsilon=0.35] — maximum neighborhood distance
 * @param {number}         [minPts=2]     — minimum points to form a cluster
 * @returns {DBSCANResult} clustering result
 *
 * @example
 * const { clusters, noise } = dbscan(reports);
 * clusters[0]; // ['id-1', 'id-4', 'id-7']
 */
export function dbscan(points, epsilon = 0.35, minPts = 2) {
  if (!Array.isArray(points) || points.length === 0) {
    return { clusters: [], noise: [] };
  }

  const n = points.length;

  /** @type {number[]} label per point — undefined = unvisited, -1 = noise, ≥ 0 = cluster id */
  const labels = new Array(n);

  let clusterId = 0;

  /**
   * Find all points within epsilon of `idx`.
   * @param {number} idx
   * @returns {number[]}
   */
  function regionQuery(idx) {
    const neighbors = [];
    for (let i = 0; i < n; i++) {
      if (compositeDistance(points[idx], points[i]) <= epsilon) {
        neighbors.push(i);
      }
    }
    return neighbors;
  }

  for (let i = 0; i < n; i++) {
    // Skip already-visited points
    if (labels[i] !== undefined) continue;

    const neighbors = regionQuery(i);

    if (neighbors.length < minPts) {
      labels[i] = -1; // noise (may be reclaimed later)
      continue;
    }

    // Start a new cluster
    const currentCluster = clusterId++;
    labels[i] = currentCluster;

    // Seed set — use a queue to expand
    const queue = [...neighbors];
    const queued = new Set(queue);
    let qi = 0;

    while (qi < queue.length) {
      const j = queue[qi++];

      // Reclaim noise points into this cluster
      if (labels[j] === -1) {
        labels[j] = currentCluster;
      }

      // Skip if already assigned to any cluster
      if (labels[j] !== undefined) continue;

      labels[j] = currentCluster;

      const jNeighbors = regionQuery(j);
      if (jNeighbors.length >= minPts) {
        for (const k of jNeighbors) {
          if (!queued.has(k) && labels[k] === undefined) {
            queue.push(k);
            queued.add(k);
          }
        }
      }
    }
  }

  // ── Build result ────────────────────────────────────────────────────
  /** @type {Map<number, string[]>} */
  const clusterMap = new Map();
  /** @type {string[]} */
  const noise = [];

  for (let i = 0; i < n; i++) {
    const id = points[i].id;
    if (labels[i] === -1) {
      noise.push(id);
    } else {
      if (!clusterMap.has(labels[i])) {
        clusterMap.set(labels[i], []);
      }
      clusterMap.get(labels[i]).push(id);
    }
  }

  return {
    clusters: [...clusterMap.values()],
    noise,
  };
}

/**
 * Calculates Jaccard text similarity based on word tokens.
 *
 * @param {string} text1
 * @param {string} text2
 * @returns {number} similarity in [0, 1]
 */
export function calculateTextSimilarity(text1, text2) {
  const words1 = (text1 || '').toLowerCase().match(/\w+/g) || [];
  const words2 = (text2 || '').toLowerCase().match(/\w+/g) || [];
  if (words1.length === 0 || words2.length === 0) return 0.0;
  const set1 = new Set(words1);
  const set2 = new Set(words2);
  const intersection = new Set([...set1].filter(w => set2.has(w)));
  const union = new Set([...set1, ...set2]);
  return intersection.size / union.size;
}
