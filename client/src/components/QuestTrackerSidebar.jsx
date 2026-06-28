import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../hooks/AuthContext';
import { fetchUserQuests, claimQuestReward } from '../services/api';
import { useQuestToast } from './QuestToast';
import { XPAnimation } from './XPAnimation';
import { useXPAnimation } from '../hooks/useXPAnimation';

const questIcons = {
  'verify_report': '🔍',
  'photo_evidence': '📸',
  'community_vote': '🗳️',
  'hotspot_prediction': '🔮',
  'first_report': '🎯',
  'streak': '🔥',
  'explorer': '🗺️',
  'helper': '🤝',
  'default': '📜'
};

const rarityColors = {
  common: { border: '#6b7280', glow: 'rgba(107, 114, 128, 0.3)', text: '#9ca3af' },
  uncommon: { border: '#22c55e', glow: 'rgba(34, 197, 94, 0.4)', text: '#4ade80' },
  rare: { border: '#3b82f6', glow: 'rgba(59, 130, 246, 0.4)', text: '#60a5fa' },
  epic: { border: '#a855f7', glow: 'rgba(168, 85, 247, 0.4)', text: '#c084fc' },
  legendary: { border: '#f59e0b', glow: 'rgba(245, 158, 11, 0.5)', text: '#fbbf24' }
};

function QuestTrackerSidebar({ isOpen, onClose, activeQuests = [], completedQuests = [] }) {
  const { user } = useAuth();
  const [quests, setQuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(null);
  const sidebarRef = useRef(null);
  
  // New XP Animation system
  const { currentAnimation, addXPAnimation, onAnimationComplete } = useXPAnimation();
  // New Quest Toast system
  const { showToast } = useQuestToast();

  // Fetch quests on mount and when sidebar opens
  useEffect(() => {
    if (isOpen) {
      loadQuests();
    }
  }, [isOpen]);

  const loadQuests = async () => {
    try {
      setLoading(true);
      const data = await fetchUserQuests();
      setQuests(data.quests || []);
    } catch (err) {
      console.error('Failed to load quests:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClaimReward = async (quest) => {
    setClaiming(quest.id);
    try {
      const result = await claimQuestReward(quest.id);
      if (result.success) {
        // Trigger XP animation (and level-up celebration in the same animation if applicable)
        addXPAnimation(result.xp_gained, result.leveled_up, result.new_level, result.new_level - (result.leveled_up ? 1 : 0));
        
        // Show Quest Toast for reward
        showToast({
          type: 'quest',
          title: 'QUEST COMPLETE!',
          message: `+${result.xp_gained} XP +${result.gold_gained} GOLD`,
          rarity: 'rare',
          xp: result.xp_gained,
          gold: result.gold_gained
        });
        
        // Update quest status
        setQuests(prev => prev.map(q => q.id === quest.id ? { ...q, status: 'completed', claimed: true } : q));
        
        // Show level up toast
        if (result.leveled_up) {
          showToast({
            type: 'levelup',
            title: 'LEVEL UP!',
            message: `You are now Level ${result.new_level}!`,
            rarity: 'legendary',
            level: result.new_level
          });
        }
      }
    } catch (err) {
      console.error('Failed to claim reward:', err);
      showToast({
        type: 'system',
        title: 'ERROR',
        message: 'Failed to claim reward',
        rarity: 'common'
      });
    } finally {
      setClaiming(null);
    }
  };

  const getQuestIcon = (type) => questIcons[type] || questIcons.default;
  const getRarityStyle = (rarity) => rarityColors[rarity] || rarityColors.common;

  const activeQuestList = quests.filter(q => q.status === 'active' || q.status === 'ready_to_claim');
  const completedQuestList = quests.filter(q => q.status === 'completed' && !q.claimed);


  return (
    <>
      {/* Overlay for mobile */}
      <motion.div
        className="quest-sidebar-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <motion.aside
        ref={sidebarRef}
        className="quest-sidebar-aside"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        role="dialog"
        aria-label="Quest Tracker"
      >
        <div className="quest-sidebar-container rpg-panel" style={{ 
          borderRadius: 0, 
          borderLeft: '2px solid var(--border-subtle)',
          background: 'linear-gradient(180deg, oklch(0.12 0.02 260 / 0.98) 0%, oklch(0.08 0.02 260 / 0.99) 100%)',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.5), inset 1px 0 0 rgba(255,255,255,0.05)'
        }}>
          
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)]" style={{ borderRadius: 0 }}>
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 flex items-center justify-center font-pixel text-xl" style={{ 
                  background: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
                  borderRadius: 0,
                  border: '2px solid #f59e0b',
                  boxShadow: '0 0 16px rgba(245, 158, 11, 0.4), inset 0 0 8px rgba(255,255,255,0.2)'
                }}>
                  📜
                </div>
                {/* Animated sparkles */}
                <div className="absolute -top-1 -right-1 w-6 h-6" style={{ pointerEvents: 'none' }}>
                  <svg viewBox="0 0 24 24" className="w-full h-full text-amber-400" style={{ animation: 'spin 8s linear infinite' }}>
                    <path d="M12 2l1 3h3l-2 2 1 3-3-1-3 1 1-3-2-2h3z" fill="currentColor" opacity="0.6"/>
                  </svg>
                </div>
              </div>
              <div>
                <h2 className="font-pixel" style={{ fontSize: '13px', color: '#fbbf24', letterSpacing: '1px', textShadow: '0 0 8px rgba(251, 191, 36, 0.5)' }}>
                  QUEST JOURNAL
                </h2>
                <p className="font-pixel text-muted" style={{ fontSize: '8px', marginTop: '-2px', letterSpacing: '0.5px' }}>
                  {activeQuestList.length} ACTIVE • {completedQuestList.length} READY TO CLAIM
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-none font-pixel text-muted hover:text-white transition-colors"
              style={{ fontSize: '10px', border: '1px solid transparent', background: 'transparent' }}
              aria-label="Close Quest Journal"
            >
              ✕ CLOSE
            </button>
          </div>

          {/* XP Bar at top */}
          <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
            <div className="flex items-center justify-between mb-2">
              <span className="font-pixel text-xs text-muted" style={{ letterSpacing: '0.5px' }}>
                ADVENTURER RANK
              </span>
              <span className="font-pixel text-xs text-amber-300" style={{ letterSpacing: '0.5px' }}>
                LV. {user?.level || 1} • {user?.xp || 0} / {((user?.level || 1) * 100)} XP
              </span>
            </div>
            <div className="relative h-2 bg-gray-900 border border-gray-700 overflow-hidden" style={{ borderRadius: 0 }}>
              <motion.div
                className="h-full"
                style={{ 
                  background: 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 50%, #fde047 100%)',
                  borderRadius: 0,
                  boxShadow: '0 0 8px rgba(245, 158, 11, 0.6), inset 0 0 8px rgba(255,255,255,0.3)'
                }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(((user?.xp || 0) / ((user?.level || 1) * 100)) * 100, 100)}%` }}
                transition={{ type: 'spring', stiffness: 100, damping: 15 }}
              />
              {/* XP bar shine */}
              <div className="absolute inset-0" style={{ 
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)',
                animation: 'shimmer 2s infinite'
              }} />
            </div>
          </div>

          {/* Quest List */}
          <div className="quest-sidebar-scroll space-y-3" style={{ scrollbarWidth: 'thin' }}>
            <AnimatePresence mode="popLayout">
              {loading ? (
                <motion.div 
                  key="loading"
                  className="flex flex-col items-center justify-center py-8"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" style={{ borderRadius: '50%' }} />
                  <p className="font-pixel text-xs text-muted mt-3" style={{ letterSpacing: '0.5px' }}>LOADING QUESTS...</p>
                </motion.div>
              ) : activeQuestList.length === 0 && completedQuestList.length === 0 ? (
                <motion.div
                  key="empty"
                  className="text-center py-8">
                  <p className="font-pixel text-muted" style={{ fontSize: '9px', letterSpacing: '1px' }}>NO ACTIVE QUESTS</p>
                  <p className="font-pixel text-muted mt-1" style={{ fontSize: '8px' }}>VISIT THE MISSION BOARD TO BEGIN YOUR ADVENTURE</p>
                </motion.div>
              ) : (
                <>
                  {/* Active Quests */}
                  {activeQuestList.length > 0 && (
                    <motion.div
                      key="active-section"
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-2"
                    >
                      <h3 className="font-pixel text-xs text-amber-300 mb-2 px-1" style={{ letterSpacing: '1px' }}>
                        ⚔️ ACTIVE QUESTS
                      </h3>
                      {activeQuestList.map((quest) => (
                        <QuestCard
                          key={quest.id}
                          quest={quest}
                          isActive={true}
                          onClaim={handleClaimReward}
                          claiming={claiming === quest.id}
                          getQuestIcon={getQuestIcon}
                          getRarityStyle={getRarityStyle}
                        />
                      ))}
                    </motion.div>
                  )}

                  {/* Ready to Claim */}
                  {completedQuestList.length > 0 && (
                    <motion.div
                      key="claim-section"
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-2 mt-4"
                    >
                      <h3 className="font-pixel text-xs text-green-400 mb-2 px-1" style={{ letterSpacing: '1px' }}>
                        ✨ REWARDS AWAIT
                      </h3>
                      {completedQuestList.map((quest) => (
                        <QuestCard
                          key={quest.id}
                          quest={quest}
                          isActive={false}
                          onClaim={handleClaimReward}
                          claiming={claiming === quest.id}
                          getQuestIcon={getQuestIcon}
                          getRarityStyle={getRarityStyle}
                        />
                      ))}
                    </motion.div>
                  )}
                </>
              )}
            </AnimatePresence>
          </div>

          {/* Footer with stats */}
          <div className="p-3 border-t border-[var(--border-subtle)] bg-black/20">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 bg-black/30" style={{ borderRadius: 0, border: '1px solid var(--border-subtle)' }}>
                <div className="font-pixel text-amber-400" style={{ fontSize: '14px' }}>{quests.filter(q => q.status === 'completed').length}</div>
                <div className="font-pixel text-muted" style={{ fontSize: '7px' }}>COMPLETED</div>
              </div>
              <div className="p-2 bg-black/30" style={{ borderRadius: 0, border: '1px solid var(--border-subtle)' }}>
                <div className="font-pixel text-green-400" style={{ fontSize: '14px' }}>{quests.reduce((sum, q) => sum + (q.xp_reward || 0), 0)}</div>
                <div className="font-pixel text-muted" style={{ fontSize: '7px' }}>TOTAL XP</div>
              </div>
              <div className="p-2 bg-black/30" style={{ borderRadius: 0, border: '1px solid var(--border-subtle)' }}>
                <div className="font-pixel text-amber-400" style={{ fontSize: '14px' }}>{quests.reduce((sum, q) => sum + (q.gold_reward || 0), 0)}</div>
                <div className="font-pixel text-muted" style={{ fontSize: '7px' }}>TOTAL GOLD</div>
              </div>
            </div>
          </div>
        </div>
      </motion.aside>

      {/* XP Animation Layer */}
      {currentAnimation && (
        <XPAnimation
          xpGained={currentAnimation.xpGained}
          levelUp={currentAnimation.levelUp}
          newLevel={currentAnimation.newLevel}
          oldLevel={currentAnimation.oldLevel}
          onComplete={onAnimationComplete}
        />
      )}

      <style jsx global>{`
        .quest-sidebar-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 1000;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
        }
        .quest-sidebar-aside {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          height: 100vh;
          width: 100%;
          max-width: 420px;
          z-index: 1001;
        }
        .quest-sidebar-container {
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        .quest-sidebar-scroll {
          flex: 1;
          overflow-y: auto;
          padding: var(--space-4);
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 8px rgba(245, 158, 11, 0.4); }
          50% { box-shadow: 0 0 20px rgba(245, 158, 11, 0.8), 0 0 32px rgba(245, 158, 11, 0.4); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @keyframes quest-pulse {
          0%, 100% { border-color: var(--accent); box-shadow: 0 0 8px var(--accent-glow); }
          50% { border-color: var(--warning); box-shadow: 0 0 16px var(--warning-glow); }
        }
      `}</style>
    </>
  );
}

function QuestCard({ quest, isActive, onClaim, claiming, getQuestIcon, getRarityStyle }) {
  const rarity = quest.rarity || 'common';
  const style = getRarityStyle(rarity);
  const icon = getQuestIcon(quest.type);
  const progress = quest.target > 0 ? Math.min((quest.progress / quest.target) * 100, 100) : 0;
  const isReady = quest.status === 'ready_to_claim';

  return (
    <motion.div
      className="rpg-panel relative overflow-hidden"
      style={{ 
        borderRadius: 0, 
        border: `2px solid ${style.border}`,
        background: `linear-gradient(135deg, oklch(0.15 0.02 260 / 0.9) 0%, oklch(0.1 0.02 260 / 0.95) 100%)`,
        boxShadow: `0 0 16px ${style.glow}, inset 0 0 16px rgba(0,0,0,0.3)`,
        animation: isReady ? 'quest-pulse 2s ease-in-out infinite' : 'none'
      }}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ type: 'spring', damping: 20, stiffness: 200 }}
    >
      {/* Rarity indicator bar */}
      <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: style.border }} />
      
      <div className="p-3 relative">
        <div className="flex items-start gap-3">
          {/* Quest Icon */}
          <div className="relative flex-shrink-0">
            <div className="w-12 h-12 flex items-center justify-center font-pixel text-xl" style={{ 
              fontSize: '18px',
              background: 'rgba(0,0,0,0.6)',
              border: `2px solid ${style.border}`,
              borderRadius: 0,
              boxShadow: `0 0 12px ${style.glow}`
            }}>
              {icon}
            </div>
            {isReady && (
              <motion.div
                className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center font-pixel"
                style={{ fontSize: '10px', background: '#f59e0b', border: '2px solid #fbbf24', borderRadius: 0 }}
                animate={{ scale: [1, 1.2, 1], rotate: [0, 5, -5, 0] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                !
              </motion.div>
            )}
          </div>

          {/* Quest Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h4 className="font-pixel truncate" style={{ fontSize: '11px', color: style.text, letterSpacing: '0.5px' }}>
                {quest.name}
              </h4>
              <span className="font-pixel text-xs px-1.5 py-0.5" style={{ 
                fontSize: '7px', 
                background: `rgba(${parseInt(style.border.slice(1,3),16)}, ${parseInt(style.border.slice(3,5),16)}, ${parseInt(style.border.slice(5,7),16)}, 0.2)`,
                border: `1px solid ${style.border}`,
                color: style.text,
                letterSpacing: '0.5px',
                borderRadius: 0
              }}>
                {rarity.toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-muted mt-1 line-clamp-2" style={{ fontSize: '9px', lineHeight: 1.4 }}>
              {quest.description}
            </p>

            {/* Progress Bar */}
            <div className="mt-2">
              <div className="flex justify-between text-[8px] font-mono mb-1">
                <span className="text-muted">PROGRESS</span>
                <span style={{ color: isReady ? '#4ade80' : style.text }}>
                  {quest.progress} / {quest.target}
                </span>
              </div>
              <div className="h-1.5 bg-gray-900 border border-gray-700 overflow-hidden relative" style={{ borderRadius: 0 }}>
                <motion.div
                  className="h-full"
                  style={{ 
                    background: isReady 
                      ? 'linear-gradient(90deg, #22c55e 0%, #4ade80 100%)' 
                      : `linear-gradient(90deg, ${style.border} 0%, ${style.text} 100%)`,
                    borderRadius: 0,
                    boxShadow: isReady ? '0 0 8px rgba(34, 197, 94, 0.6)' : `0 0 8px ${style.glow}`
                  }}
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ type: 'spring', stiffness: 100, damping: 15 }}
                />
              </div>
            </div>

            {/* Rewards */}
            <div className="flex items-center gap-3 mt-3 pt-2 border-t border-[var(--border-subtle)]">
              <div className="flex items-center gap-1 px-2 py-1 bg-black/30" style={{ border: '1px solid var(--border-subtle)', borderRadius: 0 }}>
                <span className="font-pixel text-amber-400" style={{ fontSize: '10px' }}>+{quest.xp_reward}</span>
                <span className="font-pixel text-muted" style={{ fontSize: '7px' }}>XP</span>
              </div>
              <div className="flex items-center gap-1 px-2 py-1 bg-black/30" style={{ border: '1px solid var(--border-subtle)', borderRadius: 0 }}>
                <span className="font-pixel text-yellow-300" style={{ fontSize: '10px' }}>+{quest.gold_reward}</span>
                <span className="font-pixel text-muted" style={{ fontSize: '7px' }}>GOLD</span>
              </div>
              {isReady && (
                <motion.span
                  className="font-pixel ml-auto"
                  style={{ fontSize: '8px', color: '#4ade80', letterSpacing: '0.5px' }}
                  animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  ✦ READY TO CLAIM ✦
                </motion.span>
              )}
            </div>
          </div>
        </div>

        {/* Claim Button */}
        {isReady && (
          <motion.button
            onClick={() => onClaim(quest)}
            disabled={claiming}
            className="w-full mt-3 py-2.5 font-pixel relative overflow-hidden"
            style={{ 
              fontSize: '9px', 
              letterSpacing: '1px',
              background: 'linear-gradient(90deg, #22c55e 0%, #4ade80 100%)',
              color: '#000',
              border: '2px solid #22c55e',
              borderRadius: 0,
              boxShadow: '0 0 16px rgba(34, 197, 94, 0.4), inset 0 0 16px rgba(255,255,255,0.1)'
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            animate={{ boxShadow: claiming ? 'none' : [ '0 0 16px rgba(34, 197, 94, 0.4)', '0 0 24px rgba(34, 197, 94, 0.7)', '0 0 16px rgba(34, 197, 94, 0.4)' ] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            {claiming ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" style={{ borderRadius: '50%' }} />
                CLAIMING...
              </span>
            ) : (
              '⚡ CLAIM REWARD'
            )}
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

export default QuestTrackerSidebar;