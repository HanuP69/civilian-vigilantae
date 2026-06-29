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
        transform: flip ? 'scaleX(-1)' : 'scaleX(1)',
        transformOrigin: 'center center',
        width: `${24 * s}px`,
        height: `${24 * s}px`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2px'
      }}
      animate={bobAnim}
      transition={bobTransition}
    >
      <img
        src="/robo.png"
        alt="Sentinel Robo"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.2))'
        }}
      />
    </motion.div>
  );
}

export default SentinelSprite;