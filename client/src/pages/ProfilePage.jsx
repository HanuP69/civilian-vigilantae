import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/AuthContext';
import { useToast } from '../hooks/useToast.jsx';
import { apiClaimQuest, apiBuyShopItem, apiEquipAvatar } from '../services/api';
import { CustomAvatar, parseCustomAvatar } from '../components/CustomAvatar';

const SHOP_ITEMS = [
  { id: 'title_paladin', name: 'Lucknow Paladin Title', cost: 50, type: 'title', value: 'Lucknow Paladin', desc: 'A legendary title representing honor' },
  { id: 'title_champion', name: 'Urban Champion Title', cost: 100, type: 'title', value: 'Urban Champion', desc: 'Granted to elite city surveyors' },
  { id: 'avatar_knight', name: 'Glinting Knight Avatar', cost: 40, type: 'avatar', value: 'knight', desc: 'Cyber-ops pixel armor sprite' },
  { id: 'avatar_cypher', name: 'Future Watcher Avatar', cost: 60, type: 'avatar', value: 'cypher', desc: 'Netrunner pixel visor sprite' },
  { id: 'avatar_hero', name: 'Urban Legend Avatar', cost: 80, type: 'avatar', value: 'hero', desc: 'Neon cape superhero sprite' },
  { id: 'badge_legend', name: 'Lucknow Legend Badge', cost: 80, type: 'badge', value: 'Lucknow Legend', desc: 'A royal crown next to your username' },
  { id: 'badge_sentinel', name: 'SLA Sentinel Badge', cost: 40, type: 'badge', value: 'SLA Sentinel', desc: 'A tactical shield badge' }
];

function ShopItemIcon({ id }) {
  const renderPixelArt = () => {
    switch (id) {
      case 'title_paladin':
        return (
          <svg width="24" height="24" viewBox="0 0 16 16" fill="none" style={{ imageRendering: 'pixelated' }}>
            <rect x="9" y="5" width="2" height="2" fill="#fcd34d" />
            <rect x="10" y="4" width="2" height="2" fill="#fcd34d" />
            <rect x="11" y="3" width="2" height="2" fill="#fcd34d" />
            <rect x="12" y="2" width="2" height="2" fill="#fbbf24" />
            <rect x="13" y="1" width="2" height="2" fill="#d97706" />
            <rect x="8" y="6" width="2" height="2" fill="#fbbf24" />
            <rect x="7" y="7" width="2" height="2" fill="#f59e0b" />
            <rect x="14" y="0" width="2" height="1" fill="#fff" />
            <rect x="5" y="9" width="4" height="2" fill="#4b5563" />
            <rect x="4" y="8" width="2" height="2" fill="#9ca3af" />
            <rect x="9" y="7" width="2" height="2" fill="#9ca3af" />
            <rect x="4" y="10" width="2" height="2" fill="#78350f" />
            <rect x="3" y="11" width="2" height="2" fill="#78350f" />
            <rect x="1" y="13" width="2" height="2" fill="#fbbf24" />
            <rect x="2" y="12" width="2" height="2" fill="#fbbf24" />
            <rect x="0" y="14" width="2" height="2" fill="#d97706" />
          </svg>
        );
      case 'title_champion':
        return (
          <svg width="24" height="24" viewBox="0 0 16 16" fill="none" style={{ imageRendering: 'pixelated' }}>
            <rect x="7" y="1" width="2" height="2" fill="#fbbf24" />
            <rect x="6" y="3" width="4" height="2" fill="#fbbf24" />
            <rect x="5" y="5" width="6" height="2" fill="#fbbf24" />
            <rect x="1" y="7" width="14" height="2" fill="#f59e0b" />
            <rect x="3" y="9" width="10" height="2" fill="#f59e0b" />
            <rect x="4" y="11" width="8" height="2" fill="#d97706" />
            <rect x="3" y="13" width="2" height="2" fill="#78350f" />
            <rect x="11" y="13" width="2" height="2" fill="#78350f" />
            <rect x="7" y="4" width="2" height="5" fill="#fff" opacity="0.6" />
            <rect x="5" y="7" width="6" height="2" fill="#fff" opacity="0.6" />
          </svg>
        );
      case 'avatar_knight':
        return (
          <svg width="24" height="24" viewBox="0 0 16 16" fill="none" style={{ imageRendering: 'pixelated' }}>
            <rect x="5" y="0" width="3" height="3" fill="#ef4444" />
            <rect x="4" y="2" width="2" height="2" fill="#dc2626" />
            <rect x="7" y="1" width="3" height="2" fill="#ef4444" />
            <rect x="3" y="4" width="10" height="9" fill="#3b82f6" />
            <rect x="2" y="6" width="12" height="6" fill="#1d4ed8" />
            <rect x="4" y="7" width="8" height="2" fill="#1e1b4b" />
            <rect x="4" y="9" width="8" height="1" fill="#93c5fd" />
            <rect x="4" y="13" width="8" height="2" fill="#1e3a8a" />
          </svg>
        );
      case 'avatar_cypher':
        return (
          <svg width="24" height="24" viewBox="0 0 16 16" fill="none" style={{ imageRendering: 'pixelated' }}>
            <rect x="1" y="6" width="14" height="3" fill="#4b5563" />
            <rect x="3" y="5" width="10" height="5" fill="#10b981" />
            <rect x="4" y="6" width="8" height="3" fill="#34d399" />
            <rect x="5" y="7" width="6" height="1" fill="#a7f3d0" />
            <rect x="2" y="5" width="2" height="4" fill="#fbbf24" />
            <rect x="12" y="5" width="2" height="4" fill="#fbbf24" />
          </svg>
        );
      case 'avatar_hero':
        return (
          <svg width="24" height="24" viewBox="0 0 16 16" fill="none" style={{ imageRendering: 'pixelated' }}>
            <rect x="9" y="0" width="4" height="2" fill="#ffe080" />
            <rect x="8" y="2" width="4" height="2" fill="#fbbf24" />
            <rect x="6" y="4" width="5" height="2" fill="#fbbf24" />
            <rect x="4" y="6" width="8" height="2" fill="#f59e0b" />
            <rect x="3" y="8" width="6" height="2" fill="#fbbf24" />
            <rect x="2" y="10" width="5" height="2" fill="#f59e0b" />
            <rect x="1" y="12" width="4" height="2" fill="#d97706" />
            <rect x="0" y="14" width="2" height="2" fill="#9a3412" />
          </svg>
        );
      case 'badge_legend':
        return (
          <svg width="24" height="24" viewBox="0 0 16 16" fill="none" style={{ imageRendering: 'pixelated' }}>
            <rect x="1" y="11" width="14" height="3" fill="#d97706" />
            <rect x="2" y="12" width="12" height="1" fill="#b45309" />
            <rect x="1" y="7" width="2" height="4" fill="#fbbf24" />
            <rect x="13" y="7" width="2" height="4" fill="#fbbf24" />
            <rect x="4" y="5" width="2" height="6" fill="#fbbf24" />
            <rect x="10" y="5" width="2" height="6" fill="#fbbf24" />
            <rect x="7" y="3" width="2" height="8" fill="#fbbf24" />
            <rect x="7" y="4" width="1" height="4" fill="#fff" opacity="0.6" />
            <rect x="4" y="8" width="2" height="2" fill="#ef4444" />
            <rect x="10" y="8" width="2" height="2" fill="#ef4444" />
            <rect x="7" y="6" width="2" height="2" fill="#ef4444" />
            <rect x="3" y="12" width="1" height="1" fill="#3b82f6" />
            <rect x="12" y="12" width="1" height="1" fill="#3b82f6" />
            <rect x="7" y="12" width="2" height="1" fill="#10b981" />
          </svg>
        );
      case 'badge_sentinel':
        return (
          <svg width="24" height="24" viewBox="0 0 16 16" fill="none" style={{ imageRendering: 'pixelated' }}>
            <path d="M 2 1 L 14 1 L 14 10 L 8 15 L 2 10 Z" fill="#9ca3af" />
            <path d="M 3 2 L 13 2 L 13 9 L 8 13.5 L 3 9 Z" fill="#dc2626" />
            <rect x="7" y="4" width="2" height="6" fill="#fbbf24" />
            <rect x="5" y="6" width="6" height="2" fill="#fbbf24" />
            <rect x="4" y="3" width="1" height="5" fill="#fff" opacity="0.4" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div style={{
      width: 32,
      height: 32,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'oklch(0.2 0.01 260)',
      border: '2px solid var(--border)',
      boxShadow: '1px 1px 0 rgba(0,0,0,0.5)',
      flexShrink: 0
    }}>
      {renderPixelArt()}
    </div>
  );
}

function ProfilePage() {
  const { user, logout, refreshProfile, isAuthenticated, loading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [claiming, setClaiming] = useState(null);
  const [buying, setBuying] = useState(null);
  const [activeTab, setActiveTab] = useState('quests');
  const [shopCategory, setShopCategory] = useState('all');
  const [questFilter, setQuestFilter] = useState('active');
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [customSkin, setCustomSkin] = useState(0);
  const [customHair, setCustomHair] = useState(0);
  const [customEyes, setCustomEyes] = useState(0);
  const [customFhair, setCustomFhair] = useState(0);
  const [customTattoo, setCustomTattoo] = useState(0);
  const [customHcolor, setCustomHcolor] = useState(0);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, loading, navigate]);

  if (loading || !user) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading profile">
        <div className="skeleton" style={{ height: 160, borderRadius: 'var(--radius-lg)' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 'var(--space-6)' }}>
          <div className="skeleton" style={{ height: 300, borderRadius: 'var(--radius-lg)' }} />
          <div className="skeleton" style={{ height: 300, borderRadius: 'var(--radius-lg)' }} />
        </div>
      </div>
    );
  }

  // RPG Level computations
  const level = user.level || 1;
  const currentXP = user.xp || 0;
  const xpStart = 50 * Math.pow(level - 1, 2);
  const xpEnd = 50 * Math.pow(level, 2);
  const xpDiff = xpEnd - xpStart;
  const currentProgress = currentXP - xpStart;
  const progressPercent = Math.min((currentProgress / xpDiff) * 100, 100);

  const handleClaimReward = async (questId) => {
    setClaiming(questId);
    try {
      await apiClaimQuest(questId);
      toast('Quest Reward Claimed! Level Up!', 'success');
      await refreshProfile();
    } catch (err) {
      toast(err.message || 'Failed to claim reward', 'error');
    } finally {
      setClaiming(null);
    }
  };

  const handleBuyItem = async (itemId, cost) => {
    if ((user.gold || 0) < cost) {
      toast('Insufficient gold balance!', 'error');
      return;
    }

    setBuying(itemId);
    try {
      await apiBuyShopItem(itemId);
      toast('Purchase successful! Unlocked and equipped!', 'success');
      await refreshProfile();
    } catch (err) {
      toast(err.message || 'Purchase failed', 'error');
    } finally {
      setBuying(null);
    }
  };

  const handleEquipAvatar = async (avatarValue) => {
    try {
      await apiEquipAvatar(avatarValue);
      toast('Avatar equipped!', 'success');
      await refreshProfile();
    } catch (err) {
      toast(err.message || 'Failed to equip avatar', 'error');
    }
  };

  const openAvatarCustomizer = () => {
    const current = parseCustomAvatar(user.photo_url);
    setCustomSkin(current.skin);
    setCustomHair(current.hair);
    setCustomEyes(current.eyes);
    setCustomFhair(current.fhair);
    setCustomTattoo(current.tattoo);
    setCustomHcolor(current.hcolor || 0);
    setShowCustomizer(true);
  };

  const isItemOwned = (item) => {
    if (item.type === 'title') return user.title === item.value;
    if (item.type === 'avatar') return (user.unlocked_avatars || []).includes(item.value);
    if (item.type === 'badge') return (user.badges || []).includes(item.value);
    return false;
  };

  const accuracyRate = user.verifications_made > 0 
    ? Math.round((user.accurate_verifications / user.verifications_made) * 100) 
    : 100;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 'var(--space-10)' }}>
      
      {/* 2-Column Responsive Dashboard Container */}
      <div 
        style={{ 
          display: 'flex', 
          flexDirection: 'row', 
          gap: 'var(--space-6)', 
          flexWrap: 'wrap',
          alignItems: 'flex-start'
        }}
      >
        {/* LEFT COLUMN: CHARACTER SHEET SIDEBAR (320px) */}
        <div style={{ flex: '0 0 320px', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }} className="flex flex-col gap-6">
          
          {/* Hero Profile Details Card */}
          <div className="card rpg-panel" style={{ borderRadius: 0, padding: 'var(--space-5)' }}>
            
            {/* Avatar & Level Frame */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-4)' }}>
              <div style={{ position: 'relative' }}>
                {user.photo_url && user.photo_url.startsWith('custom:') ? (
                  <div 
                    className="pixel-avatar"
                    style={{
                      width: 96,
                      height: 96,
                      borderRadius: 0,
                      background: 'var(--bg-surface)',
                      padding: '4px',
                      border: '2px solid var(--border)',
                      boxShadow: '2px 2px 0 rgba(0,0,0,0.5)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <CustomAvatar {...parseCustomAvatar(user.photo_url)} size={84} />
                  </div>
                ) : (
                  <img
                    src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(user.photo_url || user.display_name)}`}
                    alt={user.display_name}
                    className="pixel-avatar"
                    style={{
                      width: 96,
                      height: 96,
                      borderRadius: 0,
                      background: 'var(--bg-surface)',
                      padding: '4px',
                      display: 'block'
                    }}
                  />
                )}

                {/* Pencil Edit Icon */}
                <button
                  onClick={openAvatarCustomizer}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.1)';
                    e.currentTarget.style.backgroundColor = 'var(--accent)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
                  }}
                  style={{
                    position: 'absolute',
                    top: -6,
                    left: -6,
                    background: 'var(--bg-surface)',
                    border: '2px solid var(--border)',
                    boxShadow: '1px 1px 0 rgba(0,0,0,0.5)',
                    borderRadius: 0,
                    width: 24,
                    height: 24,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    padding: 0,
                    zIndex: 5,
                    transition: 'transform 0.1s ease, background-color 0.1s ease'
                  }}
                  title="Customize Avatar"
                >
                  ✏️
                </button>

                <div 
                  className="font-pixel"
                  style={{
                    position: 'absolute',
                    bottom: -6,
                    right: -6,
                    background: 'var(--accent)',
                    color: '#000',
                    fontWeight: 800,
                    width: 26,
                    height: 26,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px solid #000',
                    boxShadow: '2px 2px 0 rgba(0,0,0,0.5)',
                    fontSize: '0.65rem',
                    zIndex: 5
                  }}
                  title={`Level ${level}`}
                >
                  {level}
                </div>
              </div>
            </div>

            {/* Display Name & Titles */}
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
              <h2 className="font-pixel" style={{ margin: 0, fontSize: '1rem', letterSpacing: '0.5px' }}>{user.display_name}</h2>
              
              {/* Equipped Badges */}
              {(user.badges || []).length > 0 && (
                <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', margin: '2px 0' }}>
                  {(user.badges || []).map((badgeName) => {
                    const shopItem = SHOP_ITEMS.find(i => i.value === badgeName);
                    if (!shopItem) return null;
                    return (
                      <div key={badgeName} title={badgeName} style={{ transform: 'scale(0.85)', transformOrigin: 'center' }}>
                        <ShopItemIcon id={shopItem.id} />
                      </div>
                    );
                  })}
                </div>
              )}

              <span 
                className="font-pixel" 
                style={{ 
                  background: 'var(--accent-muted)', 
                  color: 'var(--accent)', 
                  fontSize: '0.5rem',
                  padding: '3px 8px',
                  border: '1px solid var(--accent)',
                  fontWeight: 600,
                  display: 'inline-block'
                }}
              >
                {user.title || 'Novice Watchman'}
              </span>
            </div>

            {/* XP progress bar */}
            <div style={{ marginTop: 'var(--space-5)' }} className="flex flex-col gap-1.5">
              <div className="flex justify-between font-pixel text-muted" style={{ fontSize: '0.5rem' }}>
                <span>XP: {currentXP} / {xpEnd}</span>
                <span>{Math.round(progressPercent)}%</span>
              </div>
              <div style={{ height: '14px', background: 'var(--bg-surface)', border: '2px solid var(--border)', padding: '1px', position: 'relative' }}>
                <div 
                  style={{ 
                    width: `${progressPercent}%`, 
                    height: '100%',
                    background: 'var(--accent)',
                  }} 
                />
              </div>
            </div>



          </div>

          {/* Telemetry Stats Card */}
          <div className="card rpg-panel" style={{ borderRadius: 0, padding: 'var(--space-4)' }}>
            <h3 className="font-pixel" style={{ margin: '0 0 var(--space-4) 0', fontSize: '0.65rem', borderBottom: '2px solid var(--border)', paddingBottom: 'var(--space-2)' }}>📊 Telemetry</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div className="flex justify-between items-center" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 'var(--space-2)' }}>
                <span className="font-pixel text-muted" style={{ fontSize: '0.45rem' }}>REPORTS</span>
                <span className="font-pixel" style={{ fontSize: '0.65rem', color: 'var(--accent)' }}>{user.reports_submitted || 0}</span>
              </div>
              <div className="flex justify-between items-center" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 'var(--space-2)' }}>
                <span className="font-pixel text-muted" style={{ fontSize: '0.45rem' }}>VOTES</span>
                <span className="font-pixel" style={{ fontSize: '0.65rem', color: 'var(--accent)' }}>{user.verifications_made || 0}</span>
              </div>
              <div className="flex justify-between items-center" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 'var(--space-2)' }}>
                <span className="font-pixel text-muted" style={{ fontSize: '0.45rem' }}>ACCURACY</span>
                <span className="font-pixel" style={{ fontSize: '0.65rem', color: accuracyRate >= 70 ? 'var(--success)' : 'var(--warning)' }}>{accuracyRate}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-pixel text-muted" style={{ fontSize: '0.45rem' }}>REGISTRY</span>
                <span className="font-pixel" style={{ fontSize: '0.45rem', color: 'var(--ink-primary)' }}>
                  {new Date(user.joined_at).toLocaleDateString(undefined, { year: '2-digit', month: 'short', day: '2-digit' })}
                </span>
              </div>
            </div>
          </div>

          {/* Action: Logout */}
          <button 
            onClick={logout} 
            className="font-pixel"
            style={{ 
              border: '2px solid var(--border)', 
              background: 'var(--bg-surface)',
              color: 'var(--ink-muted)', 
              fontSize: '0.55rem',
              padding: '10px 14px',
              cursor: 'pointer',
              boxShadow: '2px 2px 0 rgba(0,0,0,0.5)',
              width: '100%',
              textAlign: 'center',
              borderRadius: 0
            }}
          >
            Sign Out
          </button>

        </div>

        {/* RIGHT COLUMN: ACTION CONSOLE VIEW (FLEX-1) */}
        <div style={{ flex: '1 1 450px', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }} className="flex flex-col gap-6">
          
          {/* Main Action Tabs */}
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => setActiveTab('quests')}
              className="font-pixel"
              style={{
                padding: '10px 16px',
                fontSize: '0.65rem',
                border: '2px solid #000',
                borderRadius: 0,
                background: activeTab === 'quests' ? 'var(--accent)' : 'var(--bg-secondary)',
                color: activeTab === 'quests' ? '#000' : 'var(--ink-secondary)',
                boxShadow: activeTab === 'quests' ? 'none' : '2px 2px 0 rgba(0,0,0,0.5)',
                cursor: 'pointer',
                fontWeight: 800
              }}
            >
              📜 QUEST JOURNAL
            </button>
            
            <button
              onClick={() => setActiveTab('shop')}
              className="font-pixel"
              style={{
                padding: '10px 16px',
                fontSize: '0.65rem',
                border: '2px solid #000',
                borderRadius: 0,
                background: activeTab === 'shop' ? 'var(--accent)' : 'var(--bg-secondary)',
                color: activeTab === 'shop' ? '#000' : 'var(--ink-secondary)',
                boxShadow: activeTab === 'shop' ? 'none' : '2px 2px 0 rgba(0,0,0,0.5)',
                cursor: 'pointer',
                fontWeight: 800
              }}
            >
              🛒 MERCHANT SHOP
            </button>
          </div>

          {/* TAB CONTENT PANEL */}
          <div className="card rpg-panel" style={{ borderRadius: 0, padding: 'var(--space-5)', minHeight: 400 }}>
            
            {/* Quest Journal Tab Content */}
            {activeTab === 'quests' && (
              <div className="flex flex-col gap-5">
                {/* Quest Filters */}
                <div style={{ display: 'flex', gap: '4px', borderBottom: '2px solid var(--border)', paddingBottom: 'var(--space-3)' }}>
                  {['active', 'completed'].map((f) => (
                    <button
                      key={f}
                      onClick={() => setQuestFilter(f)}
                      className="font-pixel"
                      style={{
                        padding: '6px 10px',
                        fontSize: '0.5rem',
                        border: '1px solid var(--border)',
                        borderRadius: 0,
                        background: questFilter === f ? 'var(--accent)' : 'var(--bg-surface)',
                        color: questFilter === f ? '#000' : 'var(--ink-secondary)',
                        cursor: 'pointer'
                      }}
                    >
                      {f.toUpperCase()}
                    </button>
                  ))}
                </div>

                <div className="flex flex-col gap-4 rpg-scrollbar" style={{ maxHeight: '450px', overflowY: 'auto', paddingRight: '8px' }}>
                  {(user.quests || [])
                    .filter(quest => questFilter === 'active' ? !quest.claimed : quest.claimed)
                    .map((quest) => {
                    const progress = Math.min((quest.current || 0) / quest.target, 1);
                    const isClaimable = quest.completed && !quest.claimed;
                    
                    return (
                      <div 
                        key={quest.id} 
                        className="card pixel-border"
                        style={{
                          borderRadius: 0,
                          background: quest.claimed 
                            ? 'rgba(32, 34, 42, 0.4)' 
                            : isClaimable 
                              ? 'linear-gradient(135deg, var(--bg-secondary) 0%, rgba(201, 163, 90, 0.04) 100%)' 
                              : 'var(--bg-surface)',
                          borderColor: isClaimable ? 'var(--accent)' : 'var(--border)',
                          boxShadow: isClaimable ? '3px 3px 0 oklch(0 0 0 / 0.5)' : 'none',
                          opacity: quest.claimed ? 0.7 : 1,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 'var(--space-3)',
                          padding: 'var(--space-4)'
                        }}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex flex-col gap-1" style={{ flex: 1, paddingRight: '8px' }}>
                            <span className="font-pixel" style={{ fontSize: '0.6rem', color: isClaimable ? 'var(--accent)' : 'var(--ink-primary)' }}>
                              {quest.name}
                            </span>
                            <span className="text-xs text-muted">
                              {quest.description}
                            </span>
                          </div>

                          <div className="flex flex-col items-end font-pixel text-right" style={{ color: 'var(--accent)', fontSize: '0.45rem', gap: '2px' }}>
                            <span>+{quest.xpReward} XP</span>
                          </div>
                        </div>

                        {/* Progress info */}
                        <div className="flex flex-col gap-1.5">
                          <div className="flex justify-between font-pixel text-muted" style={{ fontSize: '0.45rem' }}>
                            <span>{quest.claimed ? 'CLAIMED' : quest.completed ? 'COMPLETED' : 'IN PROGRESS'}</span>
                            <span>{quest.current || 0} / {quest.target}</span>
                          </div>
                          
                          {!quest.claimed && (
                            <div style={{ height: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', padding: '1px' }}>
                              <div 
                                style={{ 
                                  width: `${progress * 100}%`, 
                                  height: '100%',
                                  background: quest.completed ? 'var(--success)' : 'var(--accent)' 
                                }} 
                              />
                            </div>
                          )}
                        </div>

                        {/* Action button */}
                        {isClaimable && (
                          <button
                            onClick={() => handleClaimReward(quest.id)}
                            disabled={claiming === quest.id}
                            className="font-pixel"
                            style={{
                              padding: '8px 12px',
                              fontSize: '0.55rem',
                              background: 'var(--success)',
                              color: '#000',
                              border: '2px solid #000',
                              boxShadow: '2px 2px 0 rgba(0,0,0,0.5)',
                              width: '100%',
                              cursor: 'pointer',
                              fontWeight: 800,
                              marginTop: '2px'
                            }}
                          >
                            {claiming === quest.id ? 'CLAIMING...' : 'CLAIM REWARD!'}
                          </button>
                        )}

                        {quest.claimed && (
                          <span className="font-pixel text-success" style={{ fontSize: '0.5rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            ✓ MISSION REWARD COLLECTED
                          </span>
                        )}
                      </div>
                    );
                  })}

                  {(user.quests || []).length === 0 && (
                    <div className="text-center text-muted font-pixel" style={{ padding: 'var(--space-6)', fontSize: '0.55rem' }}>
                      NO ACTIVE QUESTS DETECTED
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Merchant Shop Tab Content */}
            {activeTab === 'shop' && (
              <div className="flex flex-col gap-5">
                
                {/* Shop Sub-category Filter Buttons */}
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', borderBottom: '2px solid var(--border)', paddingBottom: 'var(--space-3)' }}>
                  {['all', 'title', 'avatar', 'badge'].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setShopCategory(cat)}
                      className="font-pixel"
                      style={{
                        padding: '6px 10px',
                        fontSize: '0.5rem',
                        border: '1px solid var(--border)',
                        borderRadius: 0,
                        background: shopCategory === cat ? 'var(--accent)' : 'var(--bg-surface)',
                        color: shopCategory === cat ? '#000' : 'var(--ink-secondary)',
                        cursor: 'pointer'
                      }}
                    >
                      {cat.toUpperCase()}
                    </button>
                  ))}
                </div>

                {/* Items Grid */}
                <div className="flex flex-col gap-3 rpg-scrollbar" style={{ maxHeight: '450px', overflowY: 'auto', paddingRight: '8px' }}>
                  {SHOP_ITEMS
                    .filter(item => shopCategory === 'all' || item.type === shopCategory)
                    .map((item) => {
                      const owned = isItemOwned(item);
                      const canAfford = true;
                      
                      return (
                        <div 
                          key={item.id} 
                          className="card pixel-border"
                          style={{
                            borderRadius: 0,
                            padding: 'var(--space-3) var(--space-4)',
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: 'var(--bg-surface)',
                            borderColor: owned ? 'var(--border-hover)' : 'var(--border)',
                            gap: 'var(--space-4)'
                          }}
                        >
                          <div className="flex items-center gap-3" style={{ flex: 1, minWidth: 0 }}>
                            <ShopItemIcon id={item.id} />
                            
                            <div className="flex flex-col gap-0.5" style={{ minWidth: 0, flex: 1 }}>
                              <span className="font-pixel truncate" style={{ fontSize: '0.55rem', color: owned ? 'var(--accent)' : 'var(--ink-primary)' }}>
                                {item.name}
                              </span>
                              <span className="text-xs text-muted truncate">{item.desc}</span>
                            </div>
                          </div>

                          <div>
                            {owned ? (
                              <span 
                                className="font-pixel" 
                                style={{ 
                                  fontSize: '0.45rem',
                                  background: 'oklch(0.2 0.01 260)', 
                                  padding: '4px 8px', 
                                  border: '1px solid var(--border)',
                                  color: 'var(--ink-muted)'
                                }}
                              >
                                EQUIPPED
                              </span>
                            ) : (
                              <button
                                onClick={() => handleBuyItem(item.id, item.cost)}
                                disabled={buying === item.id || !canAfford}
                                className="font-pixel"
                                style={{
                                  padding: '8px 12px',
                                  fontSize: '0.5rem',
                                  border: '2px solid #000',
                                  boxShadow: canAfford ? '2px 2px 0 rgba(0,0,0,0.5)' : 'none',
                                  background: canAfford ? 'var(--accent)' : 'oklch(0.22 0.01 260)',
                                  color: canAfford ? '#000' : 'var(--ink-muted)',
                                  cursor: canAfford ? 'pointer' : 'not-allowed',
                                  fontWeight: 800
                                }}
                              >
                                {buying === item.id ? '...' : 'UNLOCK'}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>

              </div>
            )}

          </div>

        </div>

      </div>


      {/* Custom Avatar Creator Modal */}
      {showCustomizer && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(15, 17, 23, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
        >
          <div 
            className="card rpg-panel" 
            style={{ 
              width: '100%', 
              maxWidth: '380px', 
              padding: 'var(--space-5)', 
              borderRadius: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 'var(--space-5)'
            }}
          >
            <h3 className="font-pixel" style={{ margin: 0, fontSize: '0.8rem', color: 'var(--accent)', borderBottom: '2px solid var(--border)', paddingBottom: 'var(--space-2)', width: '100%', textAlign: 'center' }}>
              👤 AVATAR CREATOR
            </h3>

            {/* Avatar Preview */}
            <div 
              className="pixel-avatar"
              style={{
                width: 108,
                height: 108,
                borderRadius: 0,
                background: 'var(--bg-surface)',
                padding: '6px',
                border: '3px solid var(--border)',
                boxShadow: '4px 4px 0 rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <CustomAvatar skin={customSkin} hair={customHair} eyes={customEyes} fhair={customFhair} tattoo={customTattoo} hcolor={customHcolor} size={96} />
            </div>

            {/* Attributes Adjusters Grid */}
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              {/* Skin Adjuster */}
              <div className="flex justify-between items-center" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>
                <span className="font-pixel text-muted" style={{ fontSize: '0.45rem' }}>SKIN TONE</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button 
                    onClick={() => setCustomSkin(prev => (prev - 1 + 5) % 5)}
                    className="font-pixel"
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.3)'; e.currentTarget.style.color = '#fff'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.color = 'var(--accent)'; }}
                    style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.65rem', padding: '2px 6px', transition: 'transform 0.1s ease, color 0.1s ease', display: 'inline-block' }}
                  >
                    ◀
                  </button>
                  <span className="font-pixel" style={{ fontSize: '0.5rem', minWidth: '42px', textAlign: 'center', display: 'inline-block' }}>
                    {customSkin + 1} / 5
                  </span>
                  <button 
                    onClick={() => setCustomSkin(prev => (prev + 1) % 5)}
                    className="font-pixel"
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.3)'; e.currentTarget.style.color = '#fff'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.color = 'var(--accent)'; }}
                    style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.65rem', padding: '2px 6px', transition: 'transform 0.1s ease, color 0.1s ease', display: 'inline-block' }}
                  >
                    ▶
                  </button>
                </div>
              </div>

              {/* Hair Style Adjuster */}
              <div className="flex justify-between items-center" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>
                <span className="font-pixel text-muted" style={{ fontSize: '0.45rem' }}>HAIR STYLE</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button 
                    onClick={() => setCustomHair(prev => (prev - 1 + 5) % 5)}
                    className="font-pixel"
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.3)'; e.currentTarget.style.color = '#fff'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.color = 'var(--accent)'; }}
                    style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.65rem', padding: '2px 6px', transition: 'transform 0.1s ease, color 0.1s ease', display: 'inline-block' }}
                  >
                    ◀
                  </button>
                  <span className="font-pixel" style={{ fontSize: '0.5rem', minWidth: '42px', textAlign: 'center', display: 'inline-block' }}>
                    {customHair + 1} / 5
                  </span>
                  <button 
                    onClick={() => setCustomHair(prev => (prev + 1) % 5)}
                    className="font-pixel"
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.3)'; e.currentTarget.style.color = '#fff'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.color = 'var(--accent)'; }}
                    style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.65rem', padding: '2px 6px', transition: 'transform 0.1s ease, color 0.1s ease', display: 'inline-block' }}
                  >
                    ▶
                  </button>
                </div>
              </div>

              {/* Hair Color Adjuster */}
              <div className="flex justify-between items-center" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>
                <span className="font-pixel text-muted" style={{ fontSize: '0.45rem' }}>HAIR COLOR</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button 
                    onClick={() => setCustomHcolor(prev => (prev - 1 + 5) % 5)}
                    className="font-pixel"
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.3)'; e.currentTarget.style.color = '#fff'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.color = 'var(--accent)'; }}
                    style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.65rem', padding: '2px 6px', transition: 'transform 0.1s ease, color 0.1s ease', display: 'inline-block' }}
                  >
                    ◀
                  </button>
                  <span className="font-pixel" style={{ fontSize: '0.5rem', minWidth: '42px', textAlign: 'center', display: 'inline-block' }}>
                    {customHcolor + 1} / 5
                  </span>
                  <button 
                    onClick={() => setCustomHcolor(prev => (prev + 1) % 5)}
                    className="font-pixel"
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.3)'; e.currentTarget.style.color = '#fff'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.color = 'var(--accent)'; }}
                    style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.65rem', padding: '2px 6px', transition: 'transform 0.1s ease, color 0.1s ease', display: 'inline-block' }}
                  >
                    ▶
                  </button>
                </div>
              </div>

              {/* Eyes Adjuster */}
              <div className="flex justify-between items-center" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>
                <span className="font-pixel text-muted" style={{ fontSize: '0.45rem' }}>EYES TYPE</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button 
                    onClick={() => setCustomEyes(prev => (prev - 1 + 5) % 5)}
                    className="font-pixel"
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.3)'; e.currentTarget.style.color = '#fff'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.color = 'var(--accent)'; }}
                    style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.65rem', padding: '2px 6px', transition: 'transform 0.1s ease, color 0.1s ease', display: 'inline-block' }}
                  >
                    ◀
                  </button>
                  <span className="font-pixel" style={{ fontSize: '0.5rem', minWidth: '42px', textAlign: 'center', display: 'inline-block' }}>
                    {customEyes + 1} / 5
                  </span>
                  <button 
                    onClick={() => setCustomEyes(prev => (prev + 1) % 5)}
                    className="font-pixel"
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.3)'; e.currentTarget.style.color = '#fff'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.color = 'var(--accent)'; }}
                    style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.65rem', padding: '2px 6px', transition: 'transform 0.1s ease, color 0.1s ease', display: 'inline-block' }}
                  >
                    ▶
                  </button>
                </div>
              </div>

              {/* Beard Adjuster */}
              <div className="flex justify-between items-center" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>
                <span className="font-pixel text-muted" style={{ fontSize: '0.45rem' }}>FACIAL HAIR</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button 
                    onClick={() => setCustomFhair(prev => (prev - 1 + 5) % 5)}
                    className="font-pixel"
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.3)'; e.currentTarget.style.color = '#fff'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.color = 'var(--accent)'; }}
                    style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.65rem', padding: '2px 6px', transition: 'transform 0.1s ease, color 0.1s ease', display: 'inline-block' }}
                  >
                    ◀
                  </button>
                  <span className="font-pixel" style={{ fontSize: '0.5rem', minWidth: '42px', textAlign: 'center', display: 'inline-block' }}>
                    {customFhair + 1} / 5
                  </span>
                  <button 
                    onClick={() => setCustomFhair(prev => (prev + 1) % 5)}
                    className="font-pixel"
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.3)'; e.currentTarget.style.color = '#fff'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.color = 'var(--accent)'; }}
                    style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.65rem', padding: '2px 6px', transition: 'transform 0.1s ease, color 0.1s ease', display: 'inline-block' }}
                  >
                    ▶
                  </button>
                </div>
              </div>

              {/* Tattoo Adjuster */}
              <div className="flex justify-between items-center" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>
                <span className="font-pixel text-muted" style={{ fontSize: '0.45rem' }}>TATTOOS</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button 
                    onClick={() => setCustomTattoo(prev => (prev - 1 + 5) % 5)}
                    className="font-pixel"
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.3)'; e.currentTarget.style.color = '#fff'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.color = 'var(--accent)'; }}
                    style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.65rem', padding: '2px 6px', transition: 'transform 0.1s ease, color 0.1s ease', display: 'inline-block' }}
                  >
                    ◀
                  </button>
                  <span className="font-pixel" style={{ fontSize: '0.5rem', minWidth: '42px', textAlign: 'center', display: 'inline-block' }}>
                    {customTattoo + 1} / 5
                  </span>
                  <button 
                    onClick={() => setCustomTattoo(prev => (prev + 1) % 5)}
                    className="font-pixel"
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.3)'; e.currentTarget.style.color = '#fff'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.color = 'var(--accent)'; }}
                    style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.65rem', padding: '2px 6px', transition: 'transform 0.1s ease, color 0.1s ease', display: 'inline-block' }}
                  >
                    ▶
                  </button>
                </div>
              </div>

            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '10px', width: '100%', marginTop: 'var(--space-2)' }}>
              <button
                onClick={() => {
                  handleEquipAvatar(`custom:${customSkin}-${customHair}-${customEyes}-${customFhair}-${customTattoo}-${customHcolor}`);
                  setShowCustomizer(false);
                }}
                className="font-pixel"
                style={{
                  flex: 1,
                  padding: '10px',
                  fontSize: '0.55rem',
                  background: 'var(--success)',
                  color: '#000',
                  border: '2px solid #000',
                  boxShadow: '2px 2px 0 rgba(0,0,0,0.5)',
                  cursor: 'pointer',
                  fontWeight: 800
                }}
              >
                SAVE AVATAR
              </button>
              
              <button
                onClick={() => setShowCustomizer(false)}
                className="font-pixel"
                style={{
                  flex: 1,
                  padding: '10px',
                  fontSize: '0.55rem',
                  background: 'var(--bg-surface)',
                  color: 'var(--ink-secondary)',
                  border: '2px solid var(--border)',
                  boxShadow: '2px 2px 0 rgba(0,0,0,0.5)',
                  cursor: 'pointer'
                }}
              >
                CANCEL
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

export default ProfilePage;
