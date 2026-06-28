/* Small, consistent pixel-icon vocabulary — replaces emoji everywhere.
   Matches the line-art style already used for nav icons in App.jsx
   (square caps, 2-2.5px stroke, one accent fill). Keep new icons in
   this style: no rounded caps, no soft shadows, no color gradients. */

const base = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.5,
  strokeLinecap: 'square',
};

export function ScrollIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="5" y="4" width="14" height="16" />
      <path d="M5 4c0-1 1-1 2-1M19 4c0-1-1-1-2-1" />
      <path d="M8 9h8M8 13h8M8 17h5" stroke="var(--accent)" strokeWidth="1.5" />
    </svg>
  );
}

export function SparkleIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3v6M12 15v6M3 12h6M15 12h6" stroke="var(--accent)" strokeWidth="2" />
      <rect x="11" y="11" width="2" height="2" />
    </svg>
  );
}

export function BoltIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M13 2 5 14h5l-1 8 8-12h-5l1-8z" fill="var(--accent)" stroke="currentColor" />
    </svg>
  );
}

export function FlameIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 2c2 4-3 5-3 9a3 3 0 0 0 6 0c0-1-1-2-1-2 1 2 3 3 3 6a5 5 0 1 1-10 0c0-5 5-8 5-13z" fill="var(--accent)" />
    </svg>
  );
}

export function TrophyMiniIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M6 4h12v7c0 3-2 5-6 5s-6-2-6-5V4z" fill="var(--accent)" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 16v3M8 19h8" />
      <path d="M4 6H2v3c0 2 2 3 4 3M20 6h2v3c0 2-2 3-4 3" />
    </svg>
  );
}

export function RobotIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="5" y="9" width="14" height="11" />
      <rect x="9" y="12" width="2" height="2" fill="var(--accent)" />
      <rect x="13" y="12" width="2" height="2" fill="var(--accent)" />
      <path d="M9 16h6M12 9V5M9 5h6" stroke="var(--accent)" strokeWidth="1.5" />
      <rect x="3" y="13" width="2" height="4" />
      <rect x="19" y="13" width="2" height="4" />
    </svg>
  );
}

export function PersonIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="7" r="3.5" stroke="var(--accent)" strokeWidth="2" />
      <path d="M5 20c0-4 3-6 7-6s7 2 7 6" />
    </svg>
  );
}

export function TargetIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" stroke="var(--accent)" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}

export function CrosshairIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="7" stroke="var(--accent)" strokeWidth="1.5" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
    </svg>
  );
}

export function KeyIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="7" cy="14" r="4" stroke="var(--accent)" strokeWidth="2" />
      <path d="M10 11l9-9M16 5l3 3M13 8l2 2" />
    </svg>
  );
}

export function PinIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7z" />
      <circle cx="12" cy="9" r="2.5" fill="var(--accent)" />
    </svg>
  );
}
