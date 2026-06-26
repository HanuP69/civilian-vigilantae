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

  // Color palette (oklch hex approximations for SVG)
  const colors = {
    // Body — dark charcoal with blue tint
    body: '#2a2b36',
    bodyLight: '#353648',
    // Accent — amber/gold
    accent: '#d4a030',
    accentBright: '#f0c050',
    accentDim: '#8b6a20',
    // Eyes — glowing amber
    eye: '#f5d060',
    eyeGlow: '#ffe080',
    // Visor — dark glass
    visor: '#1a1b24',
    // Boots
    boots: '#1e1f28',
    // Antenna
    antenna: '#d4a030',
    antennaTip: '#ff6040',
  };

  const bobAnim = celebrating
    ? { y: [0, -4, 0, -2, 0], rotate: [0, -3, 3, -3, 0] }
    : { y: [0, -1, 0] };

  const bobTransition = celebrating
    ? { duration: 0.6, repeat: Infinity, ease: 'easeInOut' }
    : { duration: 1.2, repeat: Infinity, ease: 'easeInOut' };

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
        {/* === Antenna === */}
        <rect x={5 * p} y={0} width={2 * p} height={1 * p} fill={colors.antenna} />
        <rect x={5 * p} y={0} width={1 * p} height={1 * p} fill={colors.antennaTip} />

        {/* === Head === */}
        {/* Row 1-2: helmet top */}
        <rect x={3 * p} y={1} width={6 * p} height={1 * p} fill={colors.body} />
        <rect x={2 * p} y={2} width={8 * p} height={1 * p} fill={colors.body} />
        {/* Row 3: visor band */}
        <rect x={2 * p} y={3} width={8 * p} height={1 * p} fill={colors.visor} />
        {/* Eyes — glowing amber */}
        <rect x={3 * p} y={3} width={2 * p} height={1 * p} fill={colors.eye} />
        <rect x={7 * p} y={3} width={2 * p} height={1 * p} fill={colors.eye} />
        {/* Eye highlight */}
        <rect x={3 * p} y={3} width={1 * p} height={1 * p} fill={colors.eyeGlow} />
        <rect x={7 * p} y={3} width={1 * p} height={1 * p} fill={colors.eyeGlow} />
        {/* Row 4: chin / jaw */}
        <rect x={3 * p} y={4} width={6 * p} height={1 * p} fill={colors.body} />
        {/* Accent stripe on helmet */}
        <rect x={3 * p} y={1} width={6 * p} height={1 * p} fill={colors.accentDim} />
        <rect x={4 * p} y={1} width={4 * p} height={1 * p} fill={colors.accent} />

        {/* === Body === */}
        {/* Row 5-6: shoulders + chest */}
        <rect x={2 * p} y={5} width={8 * p} height={1 * p} fill={colors.body} />
        <rect x={2 * p} y={6} width={8 * p} height={1 * p} fill={colors.bodyLight} />
        {/* Accent chest stripe */}
        <rect x={4 * p} y={5} width={4 * p} height={1 * p} fill={colors.accentDim} />
        <rect x={5 * p} y={6} width={2 * p} height={1 * p} fill={colors.accent} />
        {/* Core light on chest */}
        <rect x={5 * p} y={6} width={1 * p} height={1 * p} fill={colors.accentBright} />

        {/* Row 7-8: mid body */}
        <rect x={3 * p} y={7} width={6 * p} height={1 * p} fill={colors.body} />
        <rect x={3 * p} y={8} width={6 * p} height={1 * p} fill={colors.bodyLight} />
        {/* Belt */}
        <rect x={3 * p} y={8} width={6 * p} height={1 * p} fill={colors.accentDim} />
        <rect x={5 * p} y={8} width={2 * p} height={1 * p} fill={colors.accent} />

        {/* === Arms === */}
        {/* Left arm */}
        <rect x={1 * p} y={5} width={1 * p} height={3 * p} fill={colors.body} />
        <rect x={0 * p} y={7} width={1 * p} height={1 * p} fill={colors.accentDim} />
        {/* Right arm */}
        <rect x={10 * p} y={5} width={1 * p} height={3 * p} fill={colors.body} />
        <rect x={11 * p} y={7} width={1 * p} height={1 * p} fill={colors.accentDim} />

        {/* === Legs === */}
        <rect x={3 * p} y={9} width={2 * p} height={2 * p} fill={colors.body} />
        <rect x={7 * p} y={9} width={2 * p} height={2 * p} fill={colors.body} />

        {/* === Boots === */}
        <rect x={2 * p} y={11} width={3 * p} height={1 * p} fill={colors.boots} />
        <rect x={7 * p} y={11} width={3 * p} height={1 * p} fill={colors.boots} />
        <rect x={2 * p} y={12} width={4 * p} height={1 * p} fill={colors.boots} />
        <rect x={6 * p} y={12} width={4 * p} height={1 * p} fill={colors.boots} />
        {/* Boot accent soles */}
        <rect x={2 * p} y={12} width={4 * p} height={1 * p} fill={colors.accentDim} />
        <rect x={6 * p} y={12} width={4 * p} height={1 * p} fill={colors.accentDim} />

        {/* === Jetpack / backpack === */}
        <rect x={11 * p} y={6} width={1 * p} height={2 * p} fill={colors.bodyLight} />
        <rect x={11 * p} y={7} width={1 * p} height={1 * p} fill={colors.accent} />

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
