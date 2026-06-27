import { motion } from 'framer-motion';

/**
 * Pixel-art sentinel mascot — a small cyberpunk agent character.
 * Drawn with SVG <rect> elements at pixel-grid level, scaled up
 * with image-rendering: pixelated for crisp pixels.
 *
 * Colors derived from the design system's amber/gold accent palette.
 *
 * @param {{ scale?: number, flip?: boolean, celebrating?: boolean }} props
 */
function SentinelSprite({ scale = 3, flip = false, celebrating = false }) {
  // Each pixel is 1x1 unit, scaled by `scale` prop
  // Character is 12w x 16h pixels
  const s = scale;
  const p = 1; // pixel size

  // Color palette - High-end Cyberpunk Gold Drone with Neon Visor & Flame Nozzles
  const colors = {
    body: '#262421', // deep charcoal metal
    bodyLight: '#4a4235', // dark copper
    accent: '#ffb300', // golden chrome outer casing
    accentBright: '#ffd54f', // bright gold highlight
    accentDim: '#ff6f00', // hazard orange stripes
    eye: '#00e5ff', // neon cyan circular core
    eyeGlow: '#e0f7fa', // white-cyan glowing pupil
    visor: '#09141a', // black cyber visor glass
    boots: '#455a64', // slate blue thruster nozzles
    antenna: '#ffb300',
    antennaTip: '#00e5ff',
  };

  // Hovering flight physics animations - active stabilizers
  const bobAnim = celebrating
    ? { 
        y: [0, -12, -4, -12, 0], 
        rotate: [0, 180, 360],
        scale: [1, 1.25, 0.95, 1.25, 1]
      }
    : { 
        y: [0, -6, 0],
        rotate: [-3, 3, -3],
        scale: [1, 1.04, 1]
      };

  const bobTransition = celebrating
    ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' }
    : { duration: 0.8, repeat: Infinity, ease: 'easeInOut' };

  return (
    <motion.div
      className="sentinel-sprite"
      style={{
        imageRendering: 'pixelated',
        transform: flip ? 'scaleX(-1)' : 'scaleX(1)',
        transformOrigin: 'center bottom',
      }}
      animate={bobAnim}
      transition={bobTransition}
    >
      <svg
        width={12 * s}
        height={16 * s}
        viewBox="0 0 12 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ imageRendering: 'pixelated' }}
      >
        {/* === Antenna details at top === */}
        <rect x={5 * p} y={1 * p} width={2 * p} height={1 * p} fill={colors.body} />
        <rect x={5 * p} y={0} width={2 * p} height={1 * p} fill={colors.eye} />

        {/* === Spheroid Cyber Body === */}
        {/* Row 2: top curve */}
        <rect x={4 * p} y={2 * p} width={4 * p} height={1 * p} fill={colors.body} />
        {/* Row 3: shoulder top */}
        <rect x={3 * p} y={3 * p} width={6 * p} height={1 * p} fill={colors.body} />
        <rect x={4 * p} y={3 * p} width={4 * p} height={1 * p} fill={colors.bodyLight} />
        {/* Row 4-10: Main round body shell */}
        <rect x={2 * p} y={4 * p} width={8 * p} height={7 * p} fill={colors.body} />
        <rect x={3 * p} y={4 * p} width={6 * p} height={7 * p} fill={colors.bodyLight} />
        
        {/* Outer gold chrome plating stripes */}
        <rect x={2 * p} y={5 * p} width={1 * p} height={5 * p} fill={colors.accent} />
        <rect x={9 * p} y={5 * p} width={1 * p} height={5 * p} fill={colors.accent} />
        <rect x={3 * p} y={4 * p} width={6 * p} height={1 * p} fill={colors.accentDim} />
        <rect x={4 * p} y={4 * p} width={4 * p} height={1 * p} fill={colors.accent} />

        {/* Row 11: bottom curve */}
        <rect x={3 * p} y={11 * p} width={6 * p} height={1 * p} fill={colors.body} />
        <rect x={4 * p} y={11 * p} width={4 * p} height={1 * p} fill={colors.accentDim} />
        <rect x={4 * p} y={12 * p} width={4 * p} height={1 * p} fill={colors.body} />

        {/* === HUGE GLOWING CYBER-EYE (Center) === */}
        {/* Visor shield backing */}
        <rect x={4 * p} y={5 * p} width={4 * p} height={4 * p} fill={colors.visor} />
        {/* Cyan core ring */}
        <rect x={5 * p} y={5 * p} width={2 * p} height={4 * p} fill={colors.eye} />
        <rect x={4 * p} y={6 * p} width={4 * p} height={2 * p} fill={colors.eye} />
        {/* Glowing pupil core */}
        <rect x={5 * p} y={6 * p} width={2 * p} height={2 * p} fill={colors.eyeGlow} />
        {/* Tiny white reflection spark */}
        <rect x={5 * p} y={6 * p} width={1 * p} height={1 * p} fill="#ffffff" />

        {/* === Fluttering Side Wings (Mechanical flap panels) === */}
        {/* Left wing (angled) */}
        <rect x={0} y={5 * p} width={2 * p} height={1 * p} fill={colors.accentDim} />
        <rect x={1 * p} y={6 * p} width={1 * p} height={2 * p} fill={colors.body} />
        <rect x={0} y={7 * p} width={1 * p} height={2 * p} fill={colors.accent} />
        {/* Right wing (angled) */}
        <rect x={10 * p} y={5 * p} width={2 * p} height={1 * p} fill={colors.accentDim} />
        <rect x={10 * p} y={6 * p} width={1 * p} height={2 * p} fill={colors.body} />
        <rect x={11 * p} y={7 * p} width={1 * p} height={2 * p} fill={colors.accent} />

        {/* === Jet thruster fire at bottom center === */}
        <rect x={5 * p} y={13 * p} width={2 * p} height={1 * p} fill={colors.boots} />
        <rect x={4 * p} y={14 * p} width={4 * p} height={1 * p} fill="#ff3d00" />
        <rect x={5 * p} y={15 * p} width={2 * p} height={1 * p} fill="#ffeb3b" />

        {/* Celebration sparkles */}
        {celebrating && (
          <>
            <rect x={0} y={1} width={1} height={1} fill={colors.accentBright} opacity={0.8} />
            <rect x={11} y={2} width={1} height={1} fill={colors.eyeGlow} opacity={0.6} />
            <rect x={1} y={4} width={1} height={1} fill={colors.accent} opacity={0.7} />
            <rect x={10} y={5} width={1} height={1} fill={colors.accentBright} opacity={0.5} />
          </>
        )}
      </svg>
    </motion.div>
  );
}

export default SentinelSprite;
