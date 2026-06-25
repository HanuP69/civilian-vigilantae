export const CATEGORY_COLORS = {
  pothole: 'oklch(0.68 0.16 55)',
  water_leak: 'oklch(0.62 0.14 240)',
  streetlight: 'oklch(0.80 0.15 90)',
  waste: 'oklch(0.65 0.16 155)',
  road_damage: 'oklch(0.58 0.20 30)',
  drainage: 'oklch(0.55 0.18 300)',
  other: 'oklch(0.65 0.02 260)',
};

export const SEVERITY_COLORS = {
  critical: 'var(--severity-critical)',
  high: 'var(--severity-high)',
  medium: 'var(--severity-medium)',
  low: 'var(--severity-low)',
};

export const STATUS_COLORS = {
  reported: 'var(--status-reported)',
  verified: 'var(--status-verified)',
  in_progress: 'var(--status-in-progress)',
  resolved: 'var(--status-resolved)',
  reopened: 'var(--status-reopened)',
};

export const CATEGORY_LABELS = {
  pothole: 'Pothole',
  water_leak: 'Water Leak',
  streetlight: 'Streetlight',
  waste: 'Waste',
  road_damage: 'Road Damage',
  drainage: 'Drainage',
  other: 'Other',
};

export const WARD_LIST = [
  'Hazratganj', 'Aminabad', 'Aliganj', 'Gomti Nagar', 'Indira Nagar',
  'Alambagh', 'Chowk', 'Rajajipuram',
];

export const WARD_CENTERS = {
  Hazratganj: [26.8500, 80.9450],
  Aminabad: [26.8467, 80.9310],
  Aliganj: [26.8850, 80.9390],
  'Gomti Nagar': [26.8560, 80.9830],
  'Indira Nagar': [26.8720, 80.9860],
  Alambagh: [26.8180, 80.9110],
  Chowk: [26.8580, 80.9170],
  Rajajipuram: [26.8530, 80.8920],
};

export function wardOf(lat, lng) {
  let closest = null;
  let minDist = Infinity;
  for (const [name, center] of Object.entries(WARD_CENTERS)) {
    const dLat = lat - center[0];
    const dLng = lng - center[1];
    const d = dLat * dLat + dLng * dLng;
    if (d < minDist) { minDist = d; closest = name; }
  }
  return closest;
}
