import React, { useEffect, useState, useRef } from 'react';
import './XPAnimation.css';

/**
 * XPAnimation - Visual feedback component for XP gains and level ups
 * Features: floating XP numbers, level up celebration, progress bar animation
 */
export function XPAnimation({ 
  xpGained = 0, 
  levelUp = false, 
  newLevel = 1, 
  oldLevel = 1,
  onComplete = () => {},
  position = 'center' // 'center', 'top-right', 'bottom-right'
}) {
  const [showXP, setShowXP] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [progress, setProgress] = useState(0);
  const xpElementsRef = useRef([]);
  const containerRef = useRef(null);

  useEffect(() => {
    if (xpGained > 0) {
      setShowXP(true);
      // Trigger XP animation sequence
      const timer = setTimeout(() => {
        setShowXP(false);
        if (levelUp) {
          setTimeout(() => {
            setShowLevelUp(true);
            // Level up celebration duration
            setTimeout(() => {
              setShowLevelUp(false);
              onComplete();
            }, 3000);
          }, 500);
        } else {
          onComplete();
        }
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [xpGained, levelUp, onComplete]);

  // Generate random positions for floating XP numbers
  const generateXPElements = () => {
    const count = Math.min(Math.max(Math.floor(xpGained / 10), 1), 8);
    const elements = [];
    for (let i = 0; i < count; i++) {
      elements.push({
        id: i,
        value: Math.floor(xpGained / count) + (i < xpGained % count ? 1 : 0),
        offsetX: (Math.random() - 0.5) * 120,
        offsetY: -Math.random() * 100 - 50,
        delay: Math.random() * 300,
        rotation: (Math.random() - 0.5) * 30,
      });
    }
    return elements;
  };

  const xpElements = generateXPElements();

  const positionClasses = {
    center: 'xp-animation-center',
    'top-right': 'xp-animation-top-right',
    'bottom-right': 'xp-animation-bottom-right',
  };

  return (
    <div 
      ref={containerRef} 
      className={`xp-animation-container ${positionClasses[position]}`}
      style={{ pointerEvents: 'none', zIndex: 1000 }}
    >
      {/* Floating XP Numbers */}
      {showXP && (
        <div className="xp-floating-container">
          {xpElements.map((el) => (
            <div
              key={el.id}
              className="xp-floating-number"
              style={{
                '--offset-x': `${el.offsetX}px`,
                '--offset-y': `${el.offsetY}px`,
                '--rotation': `${el.rotation}deg`,
                '--delay': `${el.delay}ms`,
              }}
            >
              +{el.value} XP
            </div>
          ))}
          <div className="xp-total-display">
            <span className="xp-label">EXPERIENCE GAINED</span>
            <span className="xp-value">+{xpGained}</span>
          </div>
        </div>
      )}

      {/* Level Up Celebration */}
      {showLevelUp && (
        <div className="level-up-celebration">
          <div className="level-up-bg">
            <div className="level-up-rings">
              <div className="level-up-ring"></div>
              <div className="level-up-ring"></div>
              <div className="level-up-ring"></div>
            </div>
            <div className="level-up-particles">
              {[...Array(12)].map((_, i) => (
                <div 
                  key={i} 
                  className="level-up-particle"
                  style={{
                    '--angle': `${i * 30}deg`,
                    '--delay': `${i * 50}ms`,
                  }}
                ></div>
              ))}
            </div>
            <div className="level-up-sparkles">
              {[...Array(20)].map((_, i) => (
                <div 
                  key={i} 
                  className="level-up-sparkle"
                  style={{
                    '--delay': `${Math.random() * 500}ms`,
                    '--duration': `${1500 + Math.random() * 1000}ms`,
                  }}
                >✦</div>
              ))}
            </div>
          </div>
          <div className="level-up-content">
            <div className="level-up-text">
              <span className="level-up-label">LEVEL UP!</span>
              <span className="level-up-number">{newLevel}</span>
            </div>
            <div className="level-up-subtext">
              {oldLevel} → {newLevel}
            </div>
            <div className="level-up-rewards">
              <span>NEW ABILITIES UNLOCKED</span>
              <span>STATS INCREASED</span>
            </div>
          </div>
        </div>
      )}

      {/* XP Progress Bar (for persistent display) */}
      <div className="xp-progress-container">
        <div className="xp-progress-header">
          <span className="xp-level-badge">LV.{newLevel}</span>
          <span className="xp-progress-label">EXPERIENCE</span>
        </div>
        <div className="xp-progress-bar">
          <div 
            className="xp-progress-fill" 
            style={{ width: `${Math.min(progress, 100)}%` }}
          ></div>
          <div className="xp-progress-glint"></div>
        </div>
        <div className="xp-progress-values">
          <span>{progress}%</span>
          <span>NEXT LEVEL</span>
        </div>
      </div>
    </div>
  );
}

export default XPAnimation;