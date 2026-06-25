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

/** Maximum spatial normalizing distance (meters). */
const MAX_DISTANCE_M = 500;
/** Maximum temporal window (milliseconds) — 72 hours. */
const MAX_TIME_MS = 72 * 60 * 60 * 1000;

// ─── Category similarity ────────────────────────────────────────────
/**
 * Bi-directional map of related categories.
 * Related categories receive a similarity of 0.5 (between identical = 1.0
 * and unrelated = 0.0).
 *
 * @type {Map<string, Set<string>>}
 */
const RELATED_CATEGORIES = new Map([
  ['pothole', new Set(['road_damage'])],
  ['road_damage', new Set(['pothole'])],
  ['water_leak', new Set(['drainage'])],
  ['drainage', new Set(['water_leak'])],
]);

/**
 * Return category similarity between two category strings.
 *
 * - 1.0  — identical categories
 * - 0.5  — related categories (see {@link RELATED_CATEGORIES})
 * - 0.0  — unrelated
 *
 * @param {string} cat1
 * @param {string} cat2
 * @returns {number} similarity in [0, 1]
 */
function categorySimilarity(cat1, cat2) {
  if (cat1 === cat2) return 1.0;
  const related = RELATED_CATEGORIES.get(cat1);
  if (related && related.has(cat2)) return 0.5;
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

  // Temporal component — absolute time difference normalized over 72 h
  const t1 = p1.timestamp instanceof Date ? p1.timestamp.getTime() : new Date(p1.timestamp).getTime();
  const t2 = p2.timestamp instanceof Date ? p2.timestamp.getTime() : new Date(p2.timestamp).getTime();
  const dTemporal = Math.min(Math.abs(t1 - t2) / MAX_TIME_MS, 1);

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
          queue.push(k);
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
