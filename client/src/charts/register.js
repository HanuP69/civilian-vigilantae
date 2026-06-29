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
import {
  SANDSTONE_TICK_COLOR,
  SANDSTONE_TOOLTIP_BG,
  SANDSTONE_TOOLTIP_BORDER,
  SANDSTONE_TOOLTIP_TITLE,
  SANDSTONE_TOOLTIP_BODY,
} from './theme.js';

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

/*
 * NOTE: these were previously read via getComputedStyle(document.documentElement)
 * at import time, which only ever sees the page's root dark theme. Every chart
 * in this app is rendered inside a `.rpg-panel-sandstone` panel (light
 * parchment background), so the dark-theme tooltip/tick colors that resulted
 * (e.g. #8b8da3 ticks, #292a37 tooltip bg) were low-contrast or visually
 * mismatched against the sandstone texture — the "patchy" look. Hardcoding
 * the sandstone-correct palette here keeps it consistent everywhere charts
 * appear, and keeps it correct even before the DOM/theme has painted.
 */
ChartJS.defaults.color = SANDSTONE_TICK_COLOR;
ChartJS.defaults.font.family = 'Outfit, sans-serif';
ChartJS.defaults.font.size = 11;
ChartJS.defaults.plugins.tooltip.backgroundColor = SANDSTONE_TOOLTIP_BG;
ChartJS.defaults.plugins.tooltip.borderColor = SANDSTONE_TOOLTIP_BORDER;
ChartJS.defaults.plugins.tooltip.borderWidth = 1;
ChartJS.defaults.plugins.tooltip.padding = 10;
ChartJS.defaults.plugins.tooltip.cornerRadius = 4;
ChartJS.defaults.plugins.tooltip.titleColor = SANDSTONE_TOOLTIP_TITLE;
ChartJS.defaults.plugins.tooltip.bodyColor = SANDSTONE_TOOLTIP_BODY;
ChartJS.defaults.plugins.tooltip.displayColors = false;
ChartJS.defaults.animation.duration = 900;
ChartJS.defaults.animation.easing = 'easeOutQuart';

export { ChartJS };
