import { useEffect, useMemo, useRef, useState } from 'react';
import './WorldBackdrop.css';

/**
 * WorldBackdrop — reactive layered pixel-art scene.
 *
 * Mood is derived from live civic data instead of the clock:
 *   - "storm"  : SLA breaches present (urgent, things are overdue)
 *   - "dusk"   : high proportion of critical/high severity open issues
 *   - "clear"  : healthy / default state
 *   - "dawn"   : used briefly right after a resolution (celebratory)
 *
 * Pure CSS/SVG — no image assets, so it never breaks on deploy.
 */

const MOODS = {
  clear: {
    sky: ['#87ceeb', '#b0d9f5', '#d4ebfc'],
    sun: '#ffd966',
    cloud: '#ffffff',
    cloudShadow: '#d8e9f3',
    hillFar: '#5fa777',
    hillNear: '#4a8f63',
    ground: '#3d7a52',
    groundDark: '#2a5c3d',
    treeDark: '#2d5f3e',
    treeLight: '#3d7a52',
    vignette: 'rgba(0, 0, 0, 0)',
    starOpacity: 0,
  },
  dawn: {
    sky: ['#ffaa66', '#ffcc88', '#ffe5b8'],
    sun: '#fff5cc',
    cloud: '#ffeedd',
    cloudShadow: '#f5c9a8',
    hillFar: '#5a8170',
    hillNear: '#456657',
    ground: '#3d7a52',
    groundDark: '#2a5c3d',
    treeDark: '#2f5c42',
    treeLight: '#3f6f4f',
    vignette: 'rgba(180, 80, 30, 0.12)',
    starOpacity: 0,
  },
  dusk: {
    sky: ['#4d3a6b', '#8d6a9c', '#c98d82'],
    sun: '#ff9966',
    cloud: '#6b5a7d',
    cloudShadow: '#4a3a5a',
    hillFar: '#3a2f52',
    hillNear: '#2a2240',
    ground: '#2e2842',
    groundDark: '#1a1828',
    treeDark: '#1f1a30',
    treeLight: '#2d2640',
    vignette: 'rgba(100, 40, 80, 0.22)',
    starOpacity: 0.65,
  },
  storm: {
    sky: ['#3a4252', '#4d5666', '#606d7e'],
    sun: '#95a0b5',
    cloud: '#52596a',
    cloudShadow: '#2e3440',
    hillFar: '#2d333f',
    hillNear: '#1f242e',
    ground: '#252930',
    groundDark: '#15181d',
    treeDark: '#1a1d24',
    treeLight: '#23262f',
    vignette: 'rgba(30, 40, 70, 0.35)',
    starOpacity: 0,
  },
};

function lerpColorStops(stops) {
  return `linear-gradient(180deg, ${stops.join(', ')})`;
}

/**
 * Determine current mood from live ticket/SLA data.
 * Falls back gracefully if data isn't loaded yet.
 */
export function useWorldMood({ tickets = [], slaBreachCount = 0, justResolved = false } = {}) {
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (justResolved) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 4000);
      return () => clearTimeout(t);
    }
  }, [justResolved]);

  return useMemo(() => {
    if (pulse) return 'dawn';
    if (slaBreachCount > 0) return 'storm';
    const open = tickets.filter(t => t.status !== 'resolved');
    const severe = open.filter(t => t.severity === 'critical' || t.severity === 'high').length;
    if (open.length > 0 && severe / open.length > 0.4) return 'dusk';
    return 'clear';
  }, [tickets, slaBreachCount, pulse]);
}

function CloudLayer({ count, sizeClass, speedClass, fill }) {
  const clouds = useMemo(() => Array.from({ length: count }, (_, i) => ({
    id: i,
    top: 8 + ((i * 37) % 55),
    delay: -(i * 23) % 90,
    scale: 0.7 + ((i * 13) % 50) / 100,
  })), [count]);

  return (
    <div className={`wb-cloud-layer ${sizeClass}`} aria-hidden="true">
      {clouds.map(c => (
        <svg
          key={c.id}
          className={`wb-cloud ${speedClass}`}
          style={{ top: `${c.top}%`, animationDelay: `${c.delay}s`, transform: `scale(${c.scale})` }}
          viewBox="0 0 64 24"
          width="64"
          height="24"
        >
          <g fill={fill}>
            <rect x="8" y="12" width="48" height="8" />
            <rect x="14" y="6" width="20" height="8" />
            <rect x="32" y="4" width="16" height="8" />
            <rect x="2" y="16" width="8" height="4" />
            <rect x="54" y="16" width="8" height="4" />
          </g>
        </svg>
      ))}
    </div>
  );
}

function TreeSilhouette({ x, scale, dark, light }) {
  return (
    <g transform={`translate(${x},0) scale(${scale})`}>
      <rect x="14" y="40" width="6" height="20" fill="#1a140f" />
      <rect x="0" y="8" width="34" height="8" fill={dark} />
      <rect x="6" y="0" width="22" height="8" fill={dark} />
      <rect x="-4" y="16" width="42" height="8" fill={light} />
      <rect x="2" y="24" width="30" height="8" fill={light} />
      <rect x="8" y="32" width="18" height="8" fill={dark} />
    </g>
  );
}

function Stars({ opacity }) {
  const stars = useMemo(() => Array.from({ length: 28 }, (_, i) => ({
    id: i,
    x: (i * 37 + 5) % 100,
    y: (i * 53 + 3) % 60,
    delay: (i * 0.37) % 4,
  })), []);
  return (
    <div className="wb-stars" style={{ opacity }} aria-hidden="true">
      {stars.map(s => (
        <span
          key={s.id}
          className="wb-star"
          style={{ left: `${s.x}%`, top: `${s.y}%`, animationDelay: `${s.delay}s` }}
        />
      ))}
    </div>
  );
}

function RainLayer() {
  const drops = useMemo(() => Array.from({ length: 40 }, (_, i) => ({
    id: i,
    x: (i * 2.6) % 100,
    delay: (i * 0.11) % 1.4,
    dur: 0.5 + (i % 5) * 0.07,
  })), []);
  return (
    <div className="wb-rain" aria-hidden="true">
      {drops.map(d => (
        <span
          key={d.id}
          className="wb-raindrop"
          style={{ left: `${d.x}%`, animationDelay: `${d.delay}s`, animationDuration: `${d.dur}s` }}
        />
      ))}
    </div>
  );
}

function BirdsLayer({ count, fill }) {
  const birds = useMemo(() => Array.from({ length: count }, (_, i) => ({
    id: i,
    top: 12 + ((i * 17) % 35),
    delay: -(i * 13) % 45,
    scale: 0.6 + ((i * 7) % 40) / 100,
    speed: 25 + (i * 9) % 25,
  })), [count]);

  return (
    <div className="wb-birds-layer" aria-hidden="true">
      {birds.map(b => (
        <svg
          key={b.id}
          className="wb-bird"
          style={{
            top: `${b.top}%`,
            animationDelay: `${b.delay}s`,
            animationDuration: `${b.speed}s`,
            transform: `scale(${b.scale})`,
          }}
          viewBox="0 0 16 16"
          width="16"
          height="16"
        >
          <g fill={fill}>
            {/* Frame 1: Wings Up */}
            <g className="wb-bird-up">
              <rect x="3" y="2" width="2" height="4" />
              <rect x="11" y="2" width="2" height="4" />
              <rect x="5" y="5" width="6" height="3" />
              <rect x="1" y="5" width="2" height="2" />
              <rect x="11" y="5" width="1" height="1" fill="#fff" />
            </g>
            {/* Frame 2: Wings Down */}
            <g className="wb-bird-down">
              <rect x="3" y="6" width="2" height="4" />
              <rect x="11" y="6" width="2" height="4" />
              <rect x="5" y="5" width="6" height="3" />
              <rect x="1" y="5" width="2" height="2" />
              <rect x="11" y="5" width="1" height="1" fill="#fff" />
            </g>
          </g>
        </svg>
      ))}
    </div>
  );
}

function LeavesLayer({ count, fill }) {
  const leaves = useMemo(() => Array.from({ length: count }, (_, i) => ({
    id: i,
    x: (i * 12.3) % 100,
    delay: -(i * 2.7) % 20,
    dur: 8 + (i % 4) * 3,
    scale: 0.8 + (i % 3) * 0.3,
  })), [count]);

  return (
    <div className="wb-leaves-layer" aria-hidden="true">
      {leaves.map(l => (
        <svg
          key={l.id}
          className="wb-leaf"
          style={{
            left: `${l.x}%`,
            animationDelay: `${l.delay}s`,
            animationDuration: `${l.dur}s`,
            transform: `scale(${l.scale})`,
          }}
          viewBox="0 0 8 8"
          width="8"
          height="8"
        >
          <g fill={fill}>
            <rect x="3" y="1" width="2" height="6" />
            <rect x="2" y="2" width="4" height="4" />
            <rect x="1" y="3" width="6" height="2" />
          </g>
        </svg>
      ))}
    </div>
  );
}

export default function WorldBackdrop({ mood = 'clear' }) {
  const palette = MOODS[mood] || MOODS.clear;
  const [currentHour, setCurrentHour] = useState(() => new Date().getHours());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentHour(new Date().getHours());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const timeStyle = useMemo(() => {
    // Night: 22:00 to 05:00
    if (currentHour >= 22 || currentHour < 5) {
      return {
        blendMode: 'multiply',
        background: 'rgba(15, 20, 60, 0.72)'
      };
    }
    // Dawn: 05:00 to 07:00
    if (currentHour >= 5 && currentHour < 7) {
      return {
        blendMode: 'overlay',
        background: 'rgba(251, 146, 60, 0.45)'
      };
    }
    // Day: 07:00 to 17:00
    if (currentHour >= 7 && currentHour < 17) {
      return {
        blendMode: 'normal',
        background: 'rgba(0, 0, 0, 0)'
      };
    }
    // Dusk/Sunset: 17:00 to 19:00
    if (currentHour >= 17 && currentHour < 19) {
      return {
        blendMode: 'overlay',
        background: 'rgba(244, 63, 94, 0.35)'
      };
    }
    // Evening: 19:00 to 22:00
    return {
      blendMode: 'multiply',
      background: 'rgba(30, 41, 59, 0.45)'
    };
  }, [currentHour]);

  const showStars = currentHour >= 19 || currentHour < 5;

  return (
    <div
      className={`world-backdrop mood-${mood}`}
      style={{
        backgroundImage: "url('/bg.gif')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
      aria-hidden="true"
    >
      {/* Time-of-Day Dynamic Color Tint Overlay */}
      <div 
        style={{
          position: 'absolute',
          inset: 0,
          mixBlendMode: timeStyle.blendMode,
          background: timeStyle.background,
          pointerEvents: 'none',
          transition: 'background 2s ease, mix-blend-mode 2s ease',
          zIndex: 1
        }}
      />

      {showStars && <Stars opacity={0.6} />}

      {(mood === 'clear' || mood === 'dawn') && (
        <>
          <BirdsLayer count={3} fill="rgba(26, 18, 25, 0.35)" />
          <LeavesLayer count={6} fill={mood === 'clear' ? '#5fa777' : '#ffcc88'} />
        </>
      )}

      {mood === 'storm' && <RainLayer />}

      <div className="wb-vignette" style={{ background: palette.vignette, zIndex: 2 }} />
      <div className="wb-scanlines" style={{ zIndex: 3 }} />
    </div>
  );
}
