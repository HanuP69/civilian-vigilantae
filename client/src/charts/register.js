import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
);

const cssVar = (name) => {
  if (typeof window === 'undefined') return undefined;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
};

ChartJS.defaults.color = cssVar('--ink-muted') || '#8b8da3';
ChartJS.defaults.font.family = cssVar('--font-sans') || 'Outfit, sans-serif';
ChartJS.defaults.font.size = 11;
ChartJS.defaults.plugins.tooltip.backgroundColor = cssVar('--bg-elevated') || '#292a37';
ChartJS.defaults.plugins.tooltip.borderColor = cssVar('--border-subtle') || 'rgba(255,255,255,0.05)';
ChartJS.defaults.plugins.tooltip.borderWidth = 1;
ChartJS.defaults.plugins.tooltip.padding = 10;
ChartJS.defaults.plugins.tooltip.cornerRadius = 8;
ChartJS.defaults.plugins.tooltip.titleColor = cssVar('--ink-primary') || '#f0eee6';
ChartJS.defaults.plugins.tooltip.bodyColor = cssVar('--ink-secondary') || '#d6d2c4';
ChartJS.defaults.plugins.tooltip.displayColors = false;
ChartJS.defaults.animation.duration = 900;
ChartJS.defaults.animation.easing = 'easeOutQuart';

export { ChartJS };
