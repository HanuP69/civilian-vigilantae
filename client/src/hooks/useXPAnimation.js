import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * useXPAnimation - Hook for managing XP gain and level up animations
 * Provides a queue system for sequential XP animations
 */
export function useXPAnimation() {
  const [animationQueue, setAnimationQueue] = useState([]);
  const [currentAnimation, setCurrentAnimation] = useState(null);
  const isAnimatingRef = useRef(false);

  const processQueue = useCallback(() => {
    if (animationQueue.length > 0 && !isAnimatingRef.current) {
      const nextAnimation = animationQueue[0];
      isAnimatingRef.current = true;
      setCurrentAnimation(nextAnimation);
      setAnimationQueue(prev => prev.slice(1));
    } else if (animationQueue.length === 0) {
      setCurrentAnimation(null);
      isAnimatingRef.current = false;
    }
  }, [animationQueue]);

  const addXPAnimation = useCallback((xpGained, levelUp = false, newLevel = 1, oldLevel = 1) => {
    if (xpGained <= 0) return;
    
    const animation = {
      id: Date.now() + Math.random(),
      xpGained,
      levelUp,
      newLevel,
      oldLevel,
      timestamp: Date.now(),
    };
    
    setAnimationQueue(prev => [...prev, animation]);
  }, []);

  const onAnimationComplete = useCallback(() => {
    isAnimatingRef.current = false;
    processQueue();
  }, [processQueue]);

  // Process queue when it changes
  // Using a ref to avoid stale closure issues
  const queueLengthRef = useRef(animationQueue.length);
  queueLengthRef.current = animationQueue.length;

  return {
    currentAnimation,
    addXPAnimation,
    onAnimationComplete,
    isAnimating: isAnimatingRef.current || animationQueue.length > 0,
  };
}

/**
 * useLevelUp - Hook for tracking user level and XP progress
 * Calculates level from total XP and provides level up detection
 */
export function useLevelUp(totalXP = 0) {
  const [level, setLevel] = useState(1);
  const [xpInCurrentLevel, setXpInCurrentLevel] = useState(0);
  const [xpForNextLevel, setXpForNextLevel] = useState(100);
  const [progress, setProgress] = useState(0);
  const prevLevelRef = useRef(1);

  // XP formula: level^2 * 100 + level * 50
  const calculateLevelFromXP = useCallback((xp) => {
    let lvl = 1;
    let remainingXP = xp;
    let xpForLevel = 100;
    
    while (remainingXP >= xpForLevel) {
      remainingXP -= xpForLevel;
      lvl++;
      xpForLevel = lvl * lvl * 100 + lvl * 50;
    }
    
    return { level: lvl, xpInLevel: remainingXP, xpForNextLevel: xpForLevel };
  }, []);

  // Update level when totalXP changes
  useEffect(() => {
    const { level: newLevel, xpInLevel, xpForNextLevel } = calculateLevelFromXP(totalXP);
    const leveledUp = newLevel > prevLevelRef.current;
    
    if (leveledUp) {
      prevLevelRef.current = newLevel;
    }
    
    setLevel(newLevel);
    setXpInCurrentLevel(xpInLevel);
    setXpForNextLevel(xpForNextLevel);
    setProgress((xpInLevel / xpForNextLevel) * 100);
    
    return { leveledUp, newLevel, oldLevel: prevLevelRef.current };
  }, [totalXP, calculateLevelFromXP]);

  return {
    level,
    xpInCurrentLevel,
    xpForNextLevel,
    progress,
    calculateLevelFromXP,
  };
}

/**
 * XP Reward Constants - Standardized XP values for different actions
 */
export const XP_REWARDS = {
  TICKET_SUBMITTED: 25,
  TICKET_VERIFIED: 15,
  MISSION_COMPLETED: 100,
  MISSION_CONFIRMED: 20,
  DAILY_LOGIN: 10,
  WEEKLY_STREAK: 50,
  FIRST_TICKET: 50,
  FIRST_MISSION: 75,
  HOTSPOT_PREDICTED: 30,
  COMMUNITY_HELP: 10,
  LEVEL_UP_BONUS: (level) => level * 25,
};

/**
 * Calculate XP reward for a mission based on its properties
 */
export function calculateMissionXP(mission) {
  let baseXP = mission.xp_reward || 50;
  
  // Bonus for mission type
  if (mission.type === 'hotspot_prediction') {
    baseXP *= 1.5;
  }
  
  // Bonus for difficulty (based on target confirmations)
  const difficultyMultiplier = Math.min(mission.target_confirmations / 3, 3);
  baseXP *= difficultyMultiplier;
  
  // Bonus for ward activity
  if (mission.ward_activity === 'high') {
    baseXP *= 1.2;
  }
  
  return Math.floor(baseXP);
}

/**
 * Calculate gold reward for a mission
 */
export function calculateMissionGold(mission) {
  let baseGold = mission.gold_reward || 25;
  
  if (mission.type === 'hotspot_prediction') {
    baseGold *= 2;
  }
  
  const difficultyMultiplier = Math.min(mission.target_confirmations / 3, 3);
  baseGold *= difficultyMultiplier;
  
  return Math.floor(baseGold);
}