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
      {/* Blurred Backdrop */}
      <motion.div
        key="quest-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1001,
          background: 'rgba(16, 11, 8, 0.45)',
          backdropFilter: 'blur(5px)',
          WebkitBackdropFilter: 'blur(5px)'
        }}
      />

      {/* Sidebar Drawer Panel (Left-Aligned) */}
      <motion.aside
        key="quest-drawer"
        ref={sidebarRef}
        initial={{ x: '-100%' }}
        animate={{ x: 0 }}
        exit={{ x: '-100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 220 }}
        role="dialog"
        aria-label="Quest Tracker"
        className="rpg-panel-sandstone"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: '100%',
          maxWidth: '420px',
          zIndex: 1002,
          background: 'url(/sandstone.png) repeat',
          borderRight: '4px solid #513a23',
          outline: '2px solid #d8a96d',
          outlineOffset: '-6px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '10px 0 30px rgba(0,0,0,0.85)',
          borderRadius: 0,
          padding: '6px'
        }}
      >
        <div className="quest-sidebar-container" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          
          {/* Header */}
          <div 
            style={{ 
              padding: '16px 20px', 
              borderBottom: '3px solid #513a23', 
              background: '#1c130c',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              margin: '2px'
            }}
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 flex items-center justify-center font-pixel text-xl" style={{ 
                  background: '#100b08',
                  borderRadius: 0,
                  border: '2px solid #d8a96d',
                  boxShadow: '1px 1px 0 rgba(0,0,0,0.5)'
                }}>
                  📜
                </div>
              </div>
              <div>
                <h2 className="font-pixel" style={{ fontSize: '11px', color: '#fcd34d', letterSpacing: '1px', textShadow: '1px 1px 0 #000', margin: 0 }}>
                  QUEST JOURNAL
                </h2>
                <p className="font-pixel" style={{ fontSize: '7px', marginTop: '2px', letterSpacing: '0.5px', color: '#ecdcb9', textShadow: '1px 1px 0 #000', margin: 0 }}>
                  {activeQuestList.length} ACTIVE • {completedQuestList.length} READY TO CLAIM
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="font-pixel"
              style={{ fontSize: '10px', color: '#ecdcb9', background: 'transparent', border: 'none', cursor: 'pointer', textShadow: '1px 1px 0 #000' }}
              aria-label="Close Quest Journal"
            >
              ✕ CLOSE
            </button>
          </div>

          {/* XP Bar at top */}
          <div className="px-4 py-3 border-b border-[#513a23]" style={{ background: 'rgba(0,0,0,0.1)' }}>
            <div className="card pixel-border" style={{ background: '#fcf8ee', border: '2px solid #85613c', padding: '10px 12px', margin: 0, boxPattern: 'none' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-pixel" style={{ fontSize: '9px', color: '#6b5139', letterSpacing: '0.5px', fontWeight: 600 }}>
                  ADVENTURER RANK
                </span>
                <span className="font-pixel" style={{ fontSize: '9px', color: '#b45309', letterSpacing: '0.5px', fontWeight: 700 }}>
                  LV. {user?.level || 1} • {user?.xp || 0} / {((user?.level || 1) * 100)} XP
                </span>
              </div>
              <div className="relative h-2 bg-amber-100 border border-[#85613c] overflow-hidden" style={{ borderRadius: 0 }}>
                <motion.div
                  className="h-full"
                  style={{ 
                    background: 'linear-gradient(90deg, #b45309 0%, #d8a96d 100%)',
                    borderRadius: 0
                  }}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(((user?.xp || 0) / ((user?.level || 1) * 100)) * 100, 100)}%` }}
                  transition={{ type: 'spring', stiffness: 100, damping: 15 }}
                />
              </div>
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
          <div className="p-3 border-t border-[#513a23] bg-[#1c130c]" style={{ margin: '2px' }}>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2" style={{ background: '#fcf8ee', borderRadius: 0, border: '2px solid #85613c' }}>
                <div className="font-pixel" style={{ fontSize: '12px', color: '#b45309', fontWeight: 700 }}>{quests.filter(q => q.status === 'completed').length}</div>
                <div className="font-pixel" style={{ fontSize: '7px', color: '#6b5139', fontWeight: 600 }}>COMPLETED</div>
              </div>
              <div className="p-2" style={{ background: '#fcf8ee', borderRadius: 0, border: '2px solid #85613c' }}>
                <div className="font-pixel" style={{ fontSize: '12px', color: '#b45309', fontWeight: 700 }}>{quests.reduce((sum, q) => sum + (q.xp_reward || 0), 0)}</div>
                <div className="font-pixel" style={{ fontSize: '7px', color: '#6b5139', fontWeight: 600 }}>TOTAL XP</div>
              </div>
              <div className="p-2" style={{ background: '#fcf8ee', borderRadius: 0, border: '2px solid #85613c' }}>
                <div className="font-pixel" style={{ fontSize: '12px', color: '#b45309', fontWeight: 700 }}>{quests.reduce((sum, q) => sum + (q.gold_reward || 0), 0)}</div>
                <div className="font-pixel" style={{ fontSize: '7px', color: '#6b5139', fontWeight: 600 }}>TOTAL GOLD</div>
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
      className="card pixel-border relative overflow-hidden"
      style={{ 
        borderRadius: 0, 
        border: isReady ? '2px solid #b45309' : '2px solid #85613c',
        background: isReady ? '#fffbeb' : '#fcf8ee',
        boxShadow: '2px 2px 0 rgba(0,0,0,0.15)',
        animation: isReady ? 'quest-pulse 2s ease-in-out infinite' : 'none'
      }}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
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
              background: '#fffbeb',
              border: `2px solid #85613c`,
              borderRadius: 0,
              boxShadow: '1px 1px 0 rgba(0,0,0,0.1)'
            }}>
              {icon}
            </div>
            {isReady && (
              <motion.div
                className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center font-pixel"
                style={{ fontSize: '10px', background: '#b45309', border: '2px solid #513a23', color: '#fff', borderRadius: 0 }}
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
              <h4 className="font-pixel truncate" style={{ fontSize: '11px', color: '#291d12', letterSpacing: '0.5px', fontWeight: 700 }}>
                {quest.name}
              </h4>
              <span className="font-pixel text-xs px-1.5 py-0.5" style={{ 
                fontSize: '7px', 
                background: style.border,
                border: `1px solid ${style.border}`,
                color: '#fff',
                letterSpacing: '0.5px',
                borderRadius: 0,
                textShadow: 'none'
              }}>
                {rarity.toUpperCase()}
              </span>
            </div>
            <p className="text-xs mt-1 line-clamp-2" style={{ fontSize: '9px', lineHeight: 1.4, color: '#4a3522', fontWeight: 500 }}>
              {quest.description}
            </p>

            {/* Progress Bar */}
            <div className="mt-2">
              <div className="flex justify-between text-[8px] font-mono mb-1">
                <span style={{ color: '#6b5139', fontWeight: 600 }}>PROGRESS</span>
                <span style={{ color: isReady ? '#15803d' : '#4a3522', fontWeight: 600 }}>
                  {quest.progress} / {quest.target}
                </span>
              </div>
              <div className="h-1.5 bg-amber-100 border border-[#85613c] overflow-hidden relative" style={{ borderRadius: 0 }}>
                <motion.div
                  className="h-full"
                  style={{ 
                    background: isReady 
                      ? 'linear-gradient(90deg, #16803d 0%, #22c55e 100%)' 
                      : `linear-gradient(90deg, #85613c 0%, #b45309 100%)`,
                    borderRadius: 0
                  }}
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ type: 'spring', stiffness: 100, damping: 15 }}
                />
              </div>
            </div>

            {/* Rewards */}
            <div className="flex items-center gap-3 mt-3 pt-2 border-t border-[#85613c]/30">
              <div className="flex items-center gap-1 px-2 py-1 bg-[#fffbeb]" style={{ border: '1px solid #85613c', borderRadius: 0 }}>
                <span className="font-pixel" style={{ fontSize: '10px', color: '#b45309', fontWeight: 600 }}>+{quest.xp_reward}</span>
                <span className="font-pixel" style={{ fontSize: '7px', color: '#6b5139' }}>XP</span>
              </div>
              <div className="flex items-center gap-1 px-2 py-1 bg-[#fffbeb]" style={{ border: '1px solid #85613c', borderRadius: 0 }}>
                <span className="font-pixel" style={{ fontSize: '10px', color: '#b45309', fontWeight: 600 }}>+{quest.gold_reward}</span>
                <span className="font-pixel" style={{ fontSize: '7px', color: '#6b5139' }}>GOLD</span>
              </div>
              {isReady && (
                <motion.span
                  className="font-pixel ml-auto"
                  style={{ fontSize: '8px', color: '#15803d', letterSpacing: '0.5px', fontWeight: 700 }}
                  animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  ✦ READY ✦
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
              background: '#b45309',
              color: '#fff',
              border: '2px solid #513a23',
              borderRadius: 0,
              boxShadow: '1px 1px 0 rgba(0,0,0,0.2)'
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
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