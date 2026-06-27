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

  // Color palette - Sleek Cyberpunk Gold Droid with Neon Cyan Visor & Thruster Flames
  const colors = {
    body: '#2d271c', // dark brass/gold charcoal
    bodyLight: '#4d4330', // light brass
    accent: '#ffb300', // gold chrome
    accentBright: '#ffe57f', // glowing gold
    accentDim: '#ff8f00', // orange accent
    eye: '#00e5ff', // neon cyan sensor lens
    eyeGlow: '#e0f7fa', // glowing cyan
    visor: '#0e1d24', // dark cyber glass
    boots: '#3e3f42', // metal nozzles
    antenna: '#ffb300',
    antennaTip: '#00e5ff',
  };

  // Hovering flight physics animations
  const bobAnim = celebrating
    ? { 
        y: [0, -12, -4, -12, 0], 
        rotate: [0, 180, 360],
        scale: [1, 1.25, 0.9, 1.25, 1]
      }
    : { 
        y: [0, -6, 0],
        rotate: [-2, 2, -2],
        scale: [1, 1.03, 1]
      };

  const bobTransition = celebrating
    ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' }
    : { duration: 0.9, repeat: Infinity, ease: 'easeInOut' };

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
        {/* Eyes — glowing neon cyan */}
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
        <rect x={0} y={7} width={1 * p} height={1 * p} fill={colors.accentDim} />
        {/* Right arm */}
        <rect x={10 * p} y={5} width={1 * p} height={3 * p} fill={colors.body} />
        <rect x={11 * p} y={7} width={1 * p} height={1 * p} fill={colors.accentDim} />

        {/* === Jet Thrusters & Fire Flames (Replaced Legs/Boots) === */}
        {/* Metal nozzles */}
        <rect x={3 * p} y={9} width={2 * p} height={1 * p} fill={colors.boots} />
        <rect x={7 * p} y={9} width={2 * p} height={1 * p} fill={colors.boots} />
        {/* Flame core - fire orange & yellow */}
        <rect x={3 * p} y={10} width={2 * p} height={2 * p} fill="#ff3d00" />
        <rect x={7 * p} y={10} width={2 * p} height={2 * p} fill="#ff3d00" />
        
        <rect x={4 * p} y={10} width={1 * p} height={4 * p} fill="#ffeb3b" />
        <rect x={8 * p} y={10} width={1 * p} height={4 * p} fill="#ffeb3b" />
        
        <rect x={3 * p} y={12} width={2 * p} height={1 * p} fill="#ff9100" />
        <rect x={7 * p} y={12} width={2 * p} height={1 * p} fill="#ff9100" />

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
