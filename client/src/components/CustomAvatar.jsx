import React from 'react';

export function CustomAvatar({ skin = 0, hair = 0, eyes = 0, fhair = 0, tattoo = 0, hcolor = 0, size = 80 }) {
  const SKIN_COLORS = ['#ffdbac', '#f1c27d', '#e0ac69', '#c68642', '#8d5524'];
  const SKIN_SHADOWS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#5c3511'];
  
  const sColor = SKIN_COLORS[skin] || SKIN_COLORS[0];
  const sShadow = SKIN_SHADOWS[skin] || SKIN_SHADOWS[0];

  const HAIR_COLORS = [
    '#1e1b4b', // Black / Dark Blue
    '#78350f', // Brown
    '#fbbf24', // Yellow / Blonde
    '#ef4444', // Red
    '#9ca3af'  // Gray / Silver
  ];
  const HAIR_HIGHLIGHTS = [
    '#312e81', // Black/Blue highlight
    '#92400e', // Brown highlight
    '#fde047', // Blonde highlight
    '#f87171', // Red highlight
    '#d1d5db'  // Gray highlight
  ];

  const hColor = HAIR_COLORS[hcolor] || HAIR_COLORS[0];
  const hHighlight = HAIR_HIGHLIGHTS[hcolor] || HAIR_HIGHLIGHTS[0];

  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ imageRendering: 'pixelated', display: 'block' }}>
      <rect x="3" y="12" width="10" height="4" fill="#3b82f6" />
      <rect x="6" y="12" width="4" height="2" fill={sShadow} />
      <rect x="6" y="11" width="4" height="2" fill={sColor} />
      <rect x="4" y="4" width="8" height="8" fill={sColor} />
      <rect x="4" y="11" width="8" height="1" fill={sShadow} />

      {tattoo === 1 && <rect x="10" y="5" width="1" height="4" fill="#ef4444" opacity="0.8" />}
      {tattoo === 2 && (
        <>
          <rect x="5" y="9" width="2" height="1" fill="#3b82f6" />
          <rect x="4" y="10" width="2" height="1" fill="#3b82f6" />
        </>
      )}
      {tattoo === 3 && <rect x="9" y="9" width="1" height="1" fill="#fbbf24" />}
      {tattoo === 4 && (
        <>
          <rect x="5" y="5" width="3" height="1" fill="#10b981" />
          <rect x="7" y="6" width="1" height="2" fill="#10b981" />
        </>
      )}

      {eyes === 0 && (
        <>
          <rect x="5" y="7" width="2" height="1" fill="#111827" />
          <rect x="9" y="7" width="2" height="1" fill="#111827" />
          <rect x="5" y="7" width="1" height="1" fill="#fff" />
          <rect x="9" y="7" width="1" height="1" fill="#fff" />
        </>
      )}
      {eyes === 1 && (
        <>
          <rect x="4" y="6" width="4" height="3" fill="none" stroke="#ef4444" strokeWidth="1" />
          <rect x="8" y="6" width="4" height="3" fill="none" stroke="#ef4444" strokeWidth="1" />
          <rect x="5" y="7" width="2" height="1" fill="#111827" />
          <rect x="9" y="7" width="2" height="1" fill="#111827" />
        </>
      )}
      {eyes === 2 && (
        <>
          <rect x="3" y="6" width="10" height="3" fill="#10b981" />
          <rect x="4" y="7" width="8" height="1" fill="#a7f3d0" />
        </>
      )}
      {eyes === 3 && (
        <>
          <path d="M5,8 L6,7 M6,7 L7,8" stroke="#111827" strokeWidth="1" fill="none" strokeLinecap="round" />
          <path d="M9,8 L10,7 M10,7 L11,8" stroke="#111827" strokeWidth="1" fill="none" strokeLinecap="round" />
        </>
      )}
      {eyes === 4 && (
        <>
          <rect x="3" y="6" width="10" height="3" fill="#e2e8f0" />
          <rect x="3" y="7" width="10" height="1" fill="#cbd5e1" />
        </>
      )}

      {fhair === 1 && <rect x="6" y="10" width="4" height="1" fill={hColor} />}
      {fhair === 2 && <rect x="7" y="11" width="2" height="2" fill={hColor} />}
      {fhair === 3 && (
        <>
          <rect x="4" y="9" width="1" height="3" fill={hColor} />
          <rect x="11" y="9" width="1" height="3" fill={hColor} />
          <rect x="5" y="11" width="6" height="2" fill={hColor} />
          <rect x="6" y="10" width="4" height="1" fill={hColor} />
        </>
      )}
      {fhair === 4 && <rect x="4" y="10" width="8" height="2" fill={hColor} opacity="0.35" />}

      {hair === 1 && (
        <>
          <rect x="4" y="3" width="8" height="2" fill={hColor} />
          <rect x="3" y="4" width="1" height="3" fill={hColor} />
          <rect x="12" y="4" width="1" height="3" fill={hColor} />
        </>
      )}
      {hair === 2 && (
        <>
          <rect x="4" y="3" width="8" height="1" fill={hColor} />
          <rect x="5" y="2" width="1" height="1" fill={hColor} />
          <rect x="7" y="2" width="1" height="1" fill={hColor} />
          <rect x="9" y="2" width="1" height="1" fill={hColor} />
          <rect x="11" y="2" width="1" height="1" fill={hColor} />
        </>
      )}
      {hair === 3 && (
        <>
          <rect x="4" y="3" width="8" height="1" fill={hColor} />
          <rect x="3" y="4" width="2" height="7" fill={hColor} />
          <rect x="11" y="4" width="2" height="7" fill={hColor} />
        </>
      )}
      {hair === 4 && (
        <>
          <rect x="5" y="2" width="6" height="2" fill={hColor} />
          <rect x="4" y="3" width="8" height="1" fill={hColor} />
          <rect x="6" y="1" width="4" height="1" fill={hHighlight} />
        </>
      )}
    </svg>
  );
}

export function parseCustomAvatar(photoUrl) {
  if (photoUrl && photoUrl.startsWith('custom:')) {
    const parts = photoUrl.split(':')[1].split('-');
    return {
      skin: parseInt(parts[0]) || 0,
      hair: parseInt(parts[1]) || 0,
      eyes: parseInt(parts[2]) || 0,
      fhair: parseInt(parts[3]) || 0,
      tattoo: parseInt(parts[4]) || 0,
      hcolor: parseInt(parts[5]) || 0
    };
  }
  return { skin: 0, hair: 0, eyes: 0, fhair: 0, tattoo: 0, hcolor: 0 };
}
