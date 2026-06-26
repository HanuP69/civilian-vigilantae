import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

function InteractiveCommunity({ isPasswordFocused = false, isSuccess = false }) {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const svgRef = useRef(null);

  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  // Compute pupil offsets
  const getPupilOffset = (headCenterX, headCenterY) => {
    if (isPasswordFocused) {
      // Look up and away when typing password
      return { dx: -1.5, dy: -1.2 };
    }

    if (!svgRef.current) return { dx: 0, dy: 0 };

    const rect = svgRef.current.getBoundingClientRect();
    // Translate head center to viewport coordinates
    const viewportHeadX = rect.left + (headCenterX / 60) * rect.width;
    const viewportHeadY = rect.top + (headCenterY / 20) * rect.height;

    const angle = Math.atan2(mousePos.y - viewportHeadY, mousePos.x - viewportHeadX);
    const dist = Math.hypot(mousePos.x - viewportHeadX, mousePos.y - viewportHeadY);
    const maxDist = 400; // distance at which offset saturates
    const intensity = Math.min(dist / maxDist, 1.0);

    // Max offset inside the eye is ~0.8 grid units
    const dx = Math.cos(angle) * intensity * 0.8;
    const dy = Math.sin(angle) * intensity * 0.6;

    return { dx, dy };
  };

  const leftOffset = getPupilOffset(12, 10);
  const centerOffset = getPupilOffset(30, 10);
  const rightOffset = getPupilOffset(48, 10);

  // RPG color palettes
  const colors = {
    // Skin
    skin: '#ffdbac',
    skinShadow: '#f1c27d',
    // Citizen Cap (Lucknow green)
    cap: '#10b981',
    capDark: '#047857',
    // Visor/Helmet (Cyber Agent)
    helmet: '#4b5563',
    helmetLight: '#9ca3af',
    visor: '#1f2937',
    glow: 'var(--accent)',
    glowBright: '#ffe080',
    // Engineer Hat (Yellow)
    hat: '#fbbf24',
    hatDark: '#d97706',
    // General
    hair: '#1e1b4b',
    mouth: '#374151',
    mouthHappy: '#f43f5e',
    eyeSocket: '#ffffff',
    pupil: '#111827'
  };

  // Jump animation when successful
  const containerVariants = {
    idle: {},
    success: {
      y: [0, -15, 0, -10, 0],
      transition: {
        duration: 0.8,
        repeat: Infinity,
        repeatDelay: 0.1,
        ease: 'easeInOut'
      }
    }
  };

  return (
    <motion.div
      ref={svgRef}
      variants={containerVariants}
      animate={isSuccess ? 'success' : 'idle'}
      style={{
        width: '100%',
        maxWidth: 240,
        margin: '0 auto var(--space-4) auto',
        display: 'flex',
        justifyContent: 'center',
        imageRendering: 'pixelated'
      }}
    >
      <svg
        width={240}
        height={80}
        viewBox="0 0 60 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ overflow: 'visible' }}
      >
        {/* ========================================================================= */}
        {/* CHARACTER 1: CITIZEN (LEFT)                                               */}
        {/* ========================================================================= */}
        {/* Hair */}
        <rect x={6} y={7} width={12} height={7} fill={colors.hair} rx={1} />
        {/* Face */}
        <rect x={7} y={6} width={10} height={7} fill={colors.skin} />
        <rect x={7} y={12} width={10} height={1} fill={colors.skinShadow} />
        {/* Cap */}
        <rect x={7} y={3} width={10} height={3} fill={colors.cap} />
        <rect x={6} y={5} width={12} height={1} fill={colors.capDark} />
        {/* Eyes */}
        {isSuccess ? (
          // Happy Eyes (Arches)
          <>
            <path d="M 8.5 8.5 Q 9.5 7.0 10.5 8.5" stroke={colors.pupil} strokeWidth={0.8} fill="none" strokeLinecap="round" />
            <path d="M 13.5 8.5 Q 14.5 7.0 15.5 8.5" stroke={colors.pupil} strokeWidth={0.8} fill="none" strokeLinecap="round" />
          </>
        ) : isPasswordFocused ? (
          // Shy/Closed Eyes
          <>
            <rect x={8} y={8} width={3} height={1} fill={colors.hair} opacity={0.6} />
            <rect x={13} y={8} width={3} height={1} fill={colors.hair} opacity={0.6} />
          </>
        ) : (
          // Standard Tracking Eyes
          <>
            {/* Eye Sockets */}
            <rect x={8} y={7} width={3} height={2} fill={colors.eyeSocket} rx={0.5} />
            <rect x={13} y={7} width={3} height={2} fill={colors.eyeSocket} rx={0.5} />
            {/* Pupils */}
            <rect x={9 + leftOffset.dx} y={7.5 + leftOffset.dy} width={1.2} height={1.2} fill={colors.pupil} />
            <rect x={14 + leftOffset.dx} y={7.5 + leftOffset.dy} width={1.2} height={1.2} fill={colors.pupil} />
          </>
        )}
        {/* Mouth */}
        {isSuccess ? (
          <path d="M 11 10.5 Q 12 12 13 10.5" stroke={colors.mouthHappy} strokeWidth={1} fill="none" strokeLinecap="round" />
        ) : (
          <rect x={11} y={10} width={2} height={1} fill={colors.mouth} />
        )}

        {/* ========================================================================= */}
        {/* CHARACTER 2: CYBER SENTINEL (CENTER)                                     */}
        {/* ========================================================================= */}
        {/* Helmet */}
        <rect x={24} y={3} width={12} height={10} fill={colors.helmet} rx={2} />
        <rect x={25} y={4} width={10} height={8} fill={colors.helmetLight} rx={1} />
        {/* Visor shield */}
        <rect x={24} y={5} width={12} height={4} fill={colors.visor} />
        {/* Glowing Eyes */}
        {isSuccess ? (
          // Happy Glowing arches
          <>
            <path d="M 26.5 7.5 Q 27.5 6.0 28.5 7.5" stroke={colors.glow} strokeWidth={1} fill="none" strokeLinecap="round" />
            <path d="M 31.5 7.5 Q 32.5 6.0 33.5 7.5" stroke={colors.glow} strokeWidth={1} fill="none" strokeLinecap="round" />
          </>
        ) : isPasswordFocused ? (
          // Visor offline / dim
          <>
            <rect x={26} y={6} width={3} height={1} fill={colors.helmet} />
            <rect x={31} y={6} width={3} height={1} fill={colors.helmet} />
          </>
        ) : (
          // Active tracking glowing pupils
          <>
            <rect x={26} y={6} width={3} height={2} fill={colors.visor} />
            <rect x={31} y={6} width={3} height={2} fill={colors.visor} />
            <rect x={27 + centerOffset.dx} y={6.5 + centerOffset.dy} width={1.2} height={1.2} fill={colors.glow} />
            <rect x={32 + centerOffset.dx} y={6.5 + centerOffset.dy} width={1.2} height={1.2} fill={colors.glow} />
            <rect x={27 + centerOffset.dx} y={6.5 + centerOffset.dy} width={0.6} height={0.6} fill={colors.glowBright} />
            <rect x={32 + centerOffset.dx} y={6.5 + centerOffset.dy} width={0.6} height={0.6} fill={colors.glowBright} />
          </>
        )}
        {/* Digital mouth line */}
        {isSuccess ? (
          <rect x={28} y={10} width={4} height={1} fill={colors.cap} /> // Green active pulse
        ) : (
          <rect x={29} y={10} width={2} height={1} fill={colors.glow} opacity={0.6} />
        )}

        {/* ========================================================================= */}
        {/* CHARACTER 3: ENGINEER (RIGHT)                                           */}
        {/* ========================================================================= */}
        {/* Hair */}
        <rect x={42} y={7} width={12} height={7} fill={colors.hair} rx={1} />
        {/* Face */}
        <rect x={43} y={6} width={10} height={7} fill={colors.skin} />
        <rect x={43} y={12} width={10} height={1} fill={colors.skinShadow} />
        {/* Yellow Safety Hat */}
        <rect x={43} y={2} width={10} height={4} fill={colors.hat} rx={0.5} />
        <rect x={41} y={5} width={14} height={1.5} fill={colors.hatDark} />
        <rect x={47} y={1} width={2} height={2} fill={colors.hat} />
        {/* Eyes */}
        {isSuccess ? (
          // Happy Eyes
          <>
            <path d="M 44.5 8.5 Q 45.5 7.0 46.5 8.5" stroke={colors.pupil} strokeWidth={0.8} fill="none" strokeLinecap="round" />
            <path d="M 49.5 8.5 Q 50.5 7.0 51.5 8.5" stroke={colors.pupil} strokeWidth={0.8} fill="none" strokeLinecap="round" />
          </>
        ) : isPasswordFocused ? (
          // Eyes closed
          <>
            <rect x={44} y={8} width={3} height={1} fill={colors.hair} opacity={0.6} />
            <rect x={49} y={8} width={3} height={1} fill={colors.hair} opacity={0.6} />
          </>
        ) : (
          // Tracking Eyes
          <>
            <rect x={44} y={7} width={3} height={2} fill={colors.eyeSocket} rx={0.5} />
            <rect x={49} y={7} width={3} height={2} fill={colors.eyeSocket} rx={0.5} />
            <rect x={45 + rightOffset.dx} y={7.5 + rightOffset.dy} width={1.2} height={1.2} fill={colors.pupil} />
            <rect x={50 + rightOffset.dx} y={7.5 + rightOffset.dy} width={1.2} height={1.2} fill={colors.pupil} />
          </>
        )}
        {/* Mouth */}
        {isSuccess ? (
          <path d="M 47 10.5 Q 48 12 49 10.5" stroke={colors.mouthHappy} strokeWidth={1} fill="none" strokeLinecap="round" />
        ) : (
          <rect x={47} y={10} width={2} height={1} fill={colors.mouth} />
        )}
      </svg>
    </motion.div>
  );
}

export default InteractiveCommunity;
