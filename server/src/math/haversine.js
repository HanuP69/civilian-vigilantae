/**
 * @module math/haversine
 * @description Great-circle distance calculations using the Haversine formula.
 *
 * The Haversine formula determines the shortest distance between two points
 * on the surface of a sphere given their latitudes and longitudes.
 */

/** Mean Earth radius in meters (WGS-84 volumetric mean). */
const EARTH_RADIUS_M = 6_371_000;

/**
 * Convert degrees to radians.
 *
 * @param {number} deg — angle in degrees
 * @returns {number} angle in radians
 */
function toRad(deg) {
  return (deg * Math.PI) / 180;
}

/**
 * Compute the great-circle distance between two geographic coordinates
 * using the Haversine formula.
 *
 * @param {number} lat1 — latitude of the first point (degrees)
 * @param {number} lng1 — longitude of the first point (degrees)
 * @param {number} lat2 — latitude of the second point (degrees)
 * @param {number} lng2 — longitude of the second point (degrees)
 * @returns {number} distance in meters
 *
 * @example
 * // Mumbai CST → Gateway of India ≈ 1 200 m
 * haversine(18.9398, 72.8355, 18.9220, 72.8347);
 */
export function haversine(lat1, lng1, lat2, lng2) {
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lng2 - lng1);

  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;

  const c = 2 * Math.asin(Math.sqrt(a));

  return EARTH_RADIUS_M * c;
}

/**
 * Compute the haversine distance normalized to the [0, 1] range.
 *
 * Distances at or beyond `maxDistance` are clamped to 1.0.
 * This is useful as a spatial component in composite distance metrics
 * (e.g. DBSCAN clustering) where every dimension should share a common scale.
 *
 * @param {number} lat1 — latitude of the first point (degrees)
 * @param {number} lng1 — longitude of the first point (degrees)
 * @param {number} lat2 — latitude of the second point (degrees)
 * @param {number} lng2 — longitude of the second point (degrees)
 * @param {number} [maxDistance=500] — normalizing ceiling in meters
 * @returns {number} normalized distance in [0, 1]
 *
 * @example
 * haversineNormalized(18.94, 72.84, 18.94, 72.84);  // 0
 * haversineNormalized(0, 0, 0, 1);                    // 1  (>> 500 m)
 */
export function haversineNormalized(lat1, lng1, lat2, lng2, maxDistance = 500) {
  if (maxDistance <= 0) {
    throw new RangeError('maxDistance must be a positive number');
  }

  const d = haversine(lat1, lng1, lat2, lng2);
  return Math.min(d / maxDistance, 1);
}
