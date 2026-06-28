import React, { useState, useEffect, useCallback, useRef } from 'react';
import './QuestToast.css';

/**
 * QuestToast - RPG-style notification toast system
 * Features: pixel-art styling, quest notifications, XP gains, level ups, item rewards
 */
export function QuestToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((toast) => {
    const id = Date.now() + Math.random();
    const newToast = {
      id,
      type: 'info',
      title: '',
      message: '',
      duration: 4000,
      icon: null,
      rarity: 'common',
      actions: [],
      ...toast,
    };
    
    setToasts(prev => [...prev, newToast]);
    return id;
  }, []);

  const hideToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showQuestToast = useCallback((quest, action = 'new') => {
    const titles = {
      new: 'NEW QUEST DISCOVERED',
      updated: 'QUEST UPDATED',
      completed: 'QUEST COMPLETED!',
      failed: 'QUEST FAILED',
      reward: 'QUEST REWARD CLAIMED',
    };
    
    const icons = {
      new: '📜',
      updated: '🔄',
      completed: '✨',
      failed: '💀',
      reward: '💰',
    };

    const rarities = {
      common: 'common',
      uncommon: 'uncommon',
      rare: 'rare',
      epic: 'epic',
      legendary: 'legendary',
    };

    return showToast({
      type: 'quest',
      title: titles[action] || titles.new,
      message: quest.title || 'Unknown Quest',
      subtitle: quest.description,
      icon: icons[action] || icons.new,
      rarity: rarities[quest.rarity] || 'common',
      duration: action === 'completed' ? 6000 : 5000,
      data: quest,
      actions: action === 'new' ? [
        { label: 'VIEW QUEST', action: () => window.location.href = '/missions' },
        { label: 'DISMISS', action: () => {} },
      ] : [],
    });
  }, [showToast]);

  const showXPToast = useCallback((xpGained, source = 'ACTION') => {
    return showToast({
      type: 'xp',
      title: 'EXPERIENCE GAINED',
      message: `+${xpGained} XP`,
      subtitle: source,
      icon: '⭐',
      rarity: 'uncommon',
      duration: 3000,
    });
  }, [showToast]);

  const showLevelUpToast = useCallback((newLevel, rewards = []) => {
    return showToast({
      type: 'levelup',
      title: 'LEVEL UP!',
      message: `REACHED LEVEL ${newLevel}`,
      subtitle: rewards.length > 0 ? `Rewards: ${rewards.join(', ')}` : '',
      icon: '🎉',
      rarity: 'legendary',
      duration: 8000,
      actions: rewards.length > 0 ? [
        { label: 'VIEW REWARDS', action: () => window.location.href = '/profile' },
      ] : [],
    });
  }, [showToast]);

  const showItemToast = useCallback((item, action = 'received') => {
    const titles = {
      received: 'ITEM OBTAINED',
      equipped: 'ITEM EQUIPPED',
      sold: 'ITEM SOLD',
      crafted: 'ITEM CRAFTED',
    };

    return showToast({
      type: 'item',
      title: titles[action] || titles.received,
      message: item.name,
      subtitle: item.description,
      icon: item.icon || '📦',
      rarity: item.rarity || 'common',
      duration: 4000,
    });
  }, [showToast]);

  const showAchievementToast = useCallback((achievement) => {
    return showToast({
      type: 'achievement',
      title: 'ACHIEVEMENT UNLOCKED',
      message: achievement.name,
      subtitle: achievement.description,
      icon: achievement.icon || '🏆',
      rarity: achievement.rarity || 'epic',
      duration: 6000,
    });
  }, [showToast]);

  const showSystemToast = useCallback((title, message, type = 'info') => {
    const icons = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌',
    };

    const rarities = {
      info: 'common',
      success: 'uncommon',
      warning: 'rare',
      error: 'epic',
    };

    return showToast({
      type: 'system',
      title,
      message,
      icon: icons[type] || icons.info,
      rarity: rarities[type] || 'common',
      duration: type === 'error' ? 6000 : 4000,
    });
  }, [showToast]);

  const contextValue = {
    toasts,
    showToast,
    hideToast,
    showQuestToast,
    showXPToast,
    showLevelUpToast,
    showItemToast,
    showAchievementToast,
    showSystemToast,
  };

  return (
    <QuestToastContext.Provider value={contextValue}>
      {children}
      <div className="quest-toast-container" role="region" aria-live="polite" aria-label="Notifications">
        {toasts.map(toast => (
          <QuestToastItem key={toast.id} toast={toast} onClose={hideToast} />
        ))}
      </div>
    </QuestToastContext.Provider>
  );
}

const QuestToastContext = React.createContext(null);

/**
 * useQuestToast - Hook for accessing toast functions
 */
export function useQuestToast() {
  const context = React.useContext(QuestToastContext);
  if (!context) {
    throw new Error('useQuestToast must be used within a QuestToastProvider');
  }
  return context;
}

/**
 * QuestToastItem - Individual toast component
 */
function QuestToastItem({ toast, onClose }) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const timeoutRef = useRef(null);

  useEffect(() => {
    // Enter animation
    requestAnimationFrame(() => setVisible(true));
    
    // Auto-dismiss
    if (toast.duration > 0) {
      timeoutRef.current = setTimeout(() => {
        setExiting(true);
        setTimeout(() => onClose(toast.id), 300);
      }, toast.duration);
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [toast, onClose]);

  const rarityColors = {
    common: '#10b981',
    uncommon: '#3b82f6',
    rare: '#8b5cf6',
    epic: '#f59e0b',
    legendary: '#ef4444',
  };

  const rarityColor = rarityColors[toast.rarity] || rarityColors.common;

  const handleActionClick = (action) => {
    action.action();
    onClose(toast.id);
  };

  return (
    <div
      className={`quest-toast quest-toast-${toast.type} quest-toast-${toast.rarity} ${visible ? 'visible' : ''} ${exiting ? 'exiting' : ''}`}
      style={{
        '--rarity-color': rarityColor,
        '--rarity-glow': `${rarityColor}80`,
      }}
      role="alert"
      aria-live="polite"
    >
      <div className="quest-toast-bg">
        <div className="quest-toast-border" />
        <div className="quest-toast-glow" />
      </div>
      
      <div className="quest-toast-content">
        <div className="quest-toast-icon" style={{ color: rarityColor }}>
          {toast.icon}
        </div>
        
        <div className="quest-toast-text">
          <div className="quest-toast-title" style={{ color: rarityColor }}>
            {toast.title}
          </div>
          <div className="quest-toast-message">{toast.message}</div>
          {toast.subtitle && (
            <div className="quest-toast-subtitle">{toast.subtitle}</div>
          )}
        </div>

        <button 
          className="quest-toast-close"
          onClick={() => {
            setExiting(true);
            setTimeout(() => onClose(toast.id), 300);
          }}
          aria-label="Dismiss notification"
        >
          ×
        </button>
      </div>

      {toast.actions && toast.actions.length > 0 && (
        <div className="quest-toast-actions">
          {toast.actions.map((action, index) => (
            <button
              key={index}
              className="quest-toast-action"
              onClick={() => handleActionClick(action)}
              style={{ borderColor: rarityColor, color: rarityColor }}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Progress bar for auto-dismiss */}
      {toast.duration > 0 && (
        <div className="quest-toast-progress">
          <div 
            className="quest-toast-progress-bar"
            style={{
              backgroundColor: rarityColor,
              animationDuration: `${toast.duration}ms`,
            }}
          />
        </div>
      )}
    </div>
  );
}