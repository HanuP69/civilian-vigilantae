import { CATEGORY_COLORS, STATUS_COLORS } from '../utils/constants.js';

const FALLBACK = {
  '--border-subtle': 'rgba(255,255,255,0.06)',
  '--ink-muted': '#8b8da3',
  '--font-sans': 'Outfit, sans-serif',
  '--accent': '#c9a35a',
};

const cache = new Map();

function resolveVar(value) {
  if (!value) return FALLBACK['--accent'];
  const trimmed = String(value).trim();
  const m = trimmed.match(/var\((--[^)]+)\)/);
  if (!m) return trimmed;
  const varName = m[1];
  if (cache.has(varName)) {
    return trimmed.replace(/var\(--[^)]+\)/, cache.get(varName));
  }
  let resolved = FALLBACK[varName];
  if (typeof window !== 'undefined') {
    const computed = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    if (computed) resolved = computed;
  }
  cache.set(varName, resolved);
  return trimmed.replace(/var\(--[^)]+\)/, resolved);
}

function resolvePalette(values = []) {
  return values.map(resolveVar);
}

export const GRID_COLOR = resolveVar('var(--border-subtle)');
export const TICK_COLOR = resolveVar('var(--ink-muted)');

export const categoryPalette = (keys = []) =>
  resolvePalette(keys.map((k) => CATEGORY_COLORS[k] || 'var(--accent)'));

export const statusColor = (key) => {
  const v = STATUS_COLORS[key];
  return resolveVar(v?.startsWith('--') ? `var(${v})` : v);
};

export const statusPalette = (keys = []) =>
  resolvePalette(keys.map((k) => {
    const v = STATUS_COLORS[k];
    return v?.startsWith('--') ? `var(${v})` : v;
  }));

export { resolveVar, resolvePalette };

export function refreshChartTheme() {
  cache.clear();
}

export const baseScales = {
  x: {
    grid: { color: GRID_COLOR, drawBorder: false },
    ticks: { color: TICK_COLOR },
    border: { display: false },
  },
  y: {
    grid: { color: GRID_COLOR, drawBorder: false },
    ticks: { color: TICK_COLOR },
    border: { display: false },
  },
};

export const baseChartProps = {
  responsive: true,
  maintainAspectRatio: false,
};
