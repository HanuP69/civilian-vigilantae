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

  // Color palette - Cyberpunk Ginger Cat
  const colors = {
    fur: '#e69d45',       // warm ginger cat orange
    furLight: '#ffb766',  // light orange fur highlight
    furDark: '#b86d1d',   // dark orange fur shadows/stripes
    belly: '#ffffff',     // white kitty belly/paws
    visor: '#00e5ff',     // neon cyan cyber-goggles
    visorGlow: '#e0f7fa', // glowing visor shine
    pink: '#ff80ab',      // cute pink nose & inner ears
    collar: '#ff1744',    // red collar
    bell: '#ffd700',      // gold collar bell
  };

  // Hovering/walking physics animations (No rotation)
  const bobAnim = celebrating
    ? {
        y: [0, -10, -2, -10, 0],
        scale: [1, 1.2, 0.95, 1.2, 1]
      }
    : {
        y: [0, -4, 0],
        scale: [1, 1.03, 1]
      };

  const bobTransition = celebrating
    ? { duration: 1.0, repeat: Infinity, ease: 'easeInOut' }
    : { duration: 0.7, repeat: Infinity, ease: 'easeInOut' };

  return (
    <motion.div
      className="sentinel-sprite"
      style={{
        imageRendering: 'pixelated',
        transform: flip ? 'scaleX(-1)' : 'scaleX(1)',
        transformOrigin: 'center center',
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
        {/* === EARS === */}
        <rect x={4.5 * p} y={1 * p} width={2 * p} height={2 * p} fill={colors.fur} />
        <rect x={5.5 * p} y={2 * p} width={1 * p} height={1 * p} fill={colors.pink} />
        <rect x={7.5 * p} y={1 * p} width={2 * p} height={2 * p} fill={colors.fur} />
        <rect x={8.5 * p} y={2 * p} width={1 * p} height={1 * p} fill={colors.pink} />

        {/* === HEAD === */}
        <rect x={4 * p} y={3 * p} width={4 * p} height={6 * p} fill={colors.fur} />
        <rect x={5.5 * p} y={3.5 * p} width={2.8 * p} height={4.5 * p} fill={colors.furLight} />

        {/* === EYES === */}
        {/* Left Eye */}
        <rect x={5 * p} y={4.5 * p} width={1.5 * p} height={2.5 * p} fill="#ffffff" />
        <rect x={6 * p} y={4.75 * p} width={0.8 * p} height={1.3 * p} fill="#4caf50" />
        <rect x={6 * p} y={5.25 * p} width={0.8 * p} height={0.5 * p} fill="#000000" />
        {/* Right Eye */}
        <rect x={7 * p} y={4.5 * p} width={1.5 * p} height={2.5 * p} fill="#ffffff" />
        <rect x={8 * p} y={4.75 * p} width={0.8 * p} height={1.3 * p} fill="#4caf50" />
        <rect x={8 * p} y={5.25 * p} width={0.8 * p} height={0.5 * p} fill="#000000" />

        {/* === SNOUT & NOSE === */}
        <rect x={6 * p} y={7.3 * p} width={2.4 * p} height={1.5 * p} fill={colors.belly} />
        <rect x={6.7 * p} y={6.8 * p} width={0.9 * p} height={1.2 * p} fill={colors.pink} />

        {/* === COLLAR & BELL === */}
        <rect x={4.5 * p} y={10 * p} width={3 * p} height={1 * p} fill={colors.collar} />
        <rect x={6.5 * p} y={10 * p} width={2 * p} height={1 * p} fill={colors.bell} />

        {/* === HOVER BODY === */}
        <rect x={4.5 * p} y={11 * p} width={3 * p} height={5 * p} fill={colors.fur} />
        <rect x={6 * p} y={11 * p} width={2 * p} height={5 * p} fill={colors.belly} />

        {/* === CYBER THRUSTERS (No paws, flying!) === */}
        <rect x={4.5 * p} y={15 * p} width={2 * p} height={1 * p} fill={colors.visor} />
        <rect x={8.5 * p} y={15 * p} width={2 * p} height={1 * p} fill={colors.visor} />
        <rect x={4.5 * p} y={16 * p} width={1 * p} height={1 * p} fill={colors.visorGlow} />
        <rect x={8.5 * p} y={16 * p} width={1 * p} height={1 * p} fill={colors.visorGlow} />

        {/* Celebration sparkles */}
        {celebrating && (
          <>
            <rect x={0} y={2} width={1} height={1} fill={colors.visor} opacity={0.8} />
            <rect x={11} y={3} width={1} height={1} fill={colors.visorGlow} opacity={0.6} />
            <rect x={1} y={5} width={1} height={1} fill={colors.collar} opacity={0.7} />
            <rect x={10} y={6} width={1} height={1} fill={colors.bell} opacity={0.5} />
          </>
        )}
      </svg>
    </motion.div>
  );
}

export default SentinelSprite;