import { useState, useEffect } from'react';
import { useAuth } from'../hooks/AuthContext';
import { useToast } from'../hooks/useToast.jsx';
import { apiBuyShopItem } from'../services/api';
import { PageShell } from'../components/ui/PixelKit';

const SHOP_ITEMS = [
  { id:'title_paladin', name:'Lucknow Paladin Title', cost: 50, type:'title', value:'Lucknow Paladin', desc:'A legendary title representing honor'},
  { id:'title_champion', name:'Urban Champion Title', cost: 100, type:'title', value:'Urban Champion', desc:'Granted to elite city surveyors'},
  { id:'avatar_knight', name:'Glinting Knight Avatar', cost: 40, type:'avatar', value:'knight', desc:'Cyber-ops pixel armor sprite'},
  { id:'avatar_cypher', name:'Future Watcher Avatar', cost: 60, type:'avatar', value:'cypher', desc:'Netrunner pixel visor sprite'},
  { id:'avatar_hero', name:'Urban Legend Avatar', cost: 80, type:'avatar', value:'hero', desc:'Neon cape superhero sprite'},
  { id:'badge_legend', name:'Lucknow Legend Badge', cost: 80, type:'badge', value:'Lucknow Legend', desc:'A royal crown next to your username'},
  { id:'badge_sentinel', name:'Vigilantae Badge', cost: 40, type:'badge', value:'Vigilantae', desc:'A tactical shield badge'}
];

const CoinIcon = ({ size = 16, style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 16 16"fill="none"style={{ display:'inline-block', verticalAlign:'middle', imageRendering:'pixelated', ...style }}>
    {/* Outer border */}
    <rect x="5"y="1"width="6"height="14"fill="#513a23"/>
    <rect x="1"y="5"width="14"height="6"fill="#513a23"/>
    <rect x="3"y="3"width="10"height="10"fill="#513a23"/>
    {/* Golden face */}
    <rect x="5"y="2"width="6"height="12"fill="#fbbf24"/>
    <rect x="2"y="5"width="12"height="6"fill="#fbbf24"/>
    <rect x="4"y="3"width="8"height="10"fill="#fbbf24"/>
    {/* Highlights */}
    <rect x="6"y="3"width="4"height="2"fill="#fffbeb"/>
    <rect x="3"y="6"width="2"height="4"fill="#fffbeb"/>
    {/* Inner details */}
    <rect x="7"y="5"width="2"height="6"fill="#d97706"/>
    <rect x="5"y="7"width="6"height="2"fill="#d97706"/>
  </svg>
);

function ShopItemIcon({ id }) {
  const renderPixelArt = () => {
    switch (id) {
      case'title_paladin':
        return (
          <svg width="24"height="24"viewBox="0 0 16 16"fill="none"style={{ imageRendering:'pixelated'}}>
            <rect x="9"y="5"width="2"height="2"fill="#fcd34d"/>
            <rect x="10"y="4"width="2"height="2"fill="#fcd34d"/>
            <rect x="11"y="3"width="2"height="2"fill="#fcd34d"/>
            <rect x="12"y="2"width="2"height="2"fill="#fbbf24"/>
            <rect x="13"y="1"width="2"height="2"fill="#d97706"/>
            <rect x="8"y="6"width="2"height="2"fill="#fbbf24"/>
            <rect x="7"y="7"width="2"height="2"fill="#f59e0b"/>
            <rect x="14"y="0"width="2"height="1"fill="#fff"/>
            <rect x="5"y="9"width="4"height="2"fill="#4b5563"/>
            <rect x="4"y="8"width="2"height="2"fill="#9ca3af"/>
            <rect x="9"y="7"width="2"height="2"fill="#9ca3af"/>
            <rect x="4"y="10"width="2"height="2"fill="#78350f"/>
            <rect x="3"y="11"width="2"height="2"fill="#78350f"/>
            <rect x="1"y="13"width="2"height="2"fill="#fbbf24"/>
            <rect x="2"y="12"width="2"height="2"fill="#fbbf24"/>
            <rect x="0"y="14"width="2"height="2"fill="#d97706"/>
          </svg>
        );
      case'title_champion':
        return (
          <svg width="24"height="24"viewBox="0 0 16 16"fill="none"style={{ imageRendering:'pixelated'}}>
            <rect x="7"y="1"width="2"height="2"fill="#fbbf24"/>
            <rect x="6"y="3"width="4"height="2"fill="#fbbf24"/>
            <rect x="5"y="5"width="6"height="2"fill="#fbbf24"/>
            <rect x="1"y="7"width="14"height="2"fill="#f59e0b"/>
            <rect x="3"y="9"width="10"height="2"fill="#f59e0b"/>
            <rect x="4"y="11"width="8"height="2"fill="#d97706"/>
            <rect x="3"y="13"width="2"height="2"fill="#78350f"/>
            <rect x="11"y="13"width="2"height="2"fill="#78350f"/>
            <rect x="7"y="4"width="2"height="5"fill="#fff"opacity="0.6"/>
            <rect x="5"y="7"width="6"height="2"fill="#fff"opacity="0.6"/>
          </svg>
        );
      case'avatar_knight':
        return (
          <svg width="24"height="24"viewBox="0 0 16 16"fill="none"style={{ imageRendering:'pixelated'}}>
            <rect x="5"y="0"width="3"height="3"fill="#ef4444"/>
            <rect x="4"y="2"width="2"height="2"fill="#dc2626"/>
            <rect x="7"y="1"width="3"height="2"fill="#ef4444"/>
            <rect x="3"y="4"width="10"height="9"fill="#3b82f6"/>
            <rect x="2"y="6"width="12"height="6"fill="#1d4ed8"/>
            <rect x="4"y="7"width="8"height="2"fill="#1e1b4b"/>
            <rect x="4"y="9"width="8"height="1"fill="#93c5fd"/>
            <rect x="4"y="13"width="8"height="2"fill="#1e3a8a"/>
          </svg>
        );
      case'avatar_cypher':
        return (
          <svg width="24"height="24"viewBox="0 0 16 16"fill="none"style={{ imageRendering:'pixelated'}}>
            <rect x="1"y="6"width="14"height="3"fill="#4b5563"/>
            <rect x="3"y="5"width="10"height="5"fill="#10b981"/>
            <rect x="4"y="6"width="8"height="3"fill="#34d399"/>
            <rect x="5"y="7"width="6"height="1"fill="#a7f3d0"/>
            <rect x="2"y="5"width="2"height="4"fill="#fbbf24"/>
            <rect x="12"y="5"width="2"height="4"fill="#fbbf24"/>
          </svg>
        );
      case'avatar_hero':
        return (
          <svg width="24"height="24"viewBox="0 0 16 16"fill="none"style={{ imageRendering:'pixelated'}}>
            <rect x="9"y="0"width="4"height="2"fill="#ffe080"/>
            <rect x="8"y="2"width="4"height="2"fill="#fbbf24"/>
            <rect x="6"y="4"width="5"height="2"fill="#fbbf24"/>
            <rect x="4"y="6"width="8"height="2"fill="#f59e0b"/>
            <rect x="3"y="8"width="6"height="2"fill="#fbbf24"/>
            <rect x="2"y="10"width="5"height="2"fill="#f59e0b"/>
            <rect x="1"y="12"width="4"height="2"fill="#d97706"/>
            <rect x="0"y="14"width="2"height="2"fill="#9a3412"/>
          </svg>
        );
      case'badge_legend':
        return (
          <svg width="24"height="24"viewBox="0 0 16 16"fill="none"style={{ imageRendering:'pixelated'}}>
            <rect x="1"y="11"width="14"height="3"fill="#d97706"/>
            <rect x="2"y="12"width="12"height="1"fill="#b45309"/>
            <rect x="1"y="7"width="2"height="4"fill="#fbbf24"/>
            <rect x="13"y="7"width="2"height="4"fill="#fbbf24"/>
            <rect x="4"y="5"width="2"height="6"fill="#fbbf24"/>
            <rect x="10"y="5"width="2"height="6"fill="#fbbf24"/>
            <rect x="7"y="3"width="2"height="8"fill="#fbbf24"/>
            <rect x="7"y="4"width="1"height="4"fill="#fff"opacity="0.6"/>
            <rect x="4"y="8"width="2"height="2"fill="#ef4444"/>
            <rect x="10"y="8"width="2"height="2"fill="#ef4444"/>
            <rect x="7"y="6"width="2"height="2"fill="#ef4444"/>
            <rect x="3"y="12"width="1"height="1"fill="#3b82f6"/>
            <rect x="12"y="12"width="1"height="1"fill="#3b82f6"/>
            <rect x="7"y="12"width="2"height="1"fill="#10b981"/>
          </svg>
        );
      case'badge_sentinel':
        return (
          <svg width="24"height="24"viewBox="0 0 16 16"fill="none"style={{ imageRendering:'pixelated'}}>
            <path d="M 2 1 L 14 1 L 14 10 L 8 15 L 2 10 Z"fill="#9ca3af"/>
            <path d="M 3 2 L 13 2 L 13 9 L 8 13.5 L 3 9 Z"fill="#dc2626"/>
            <rect x="7"y="4"width="2"height="6"fill="#fbbf24"/>
            <rect x="5"y="6"width="6"height="2"fill="#fbbf24"/>
            <rect x="4"y="3"width="1"height="5"fill="#fff"opacity="0.4"/>
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div style={{
      width: 48,
      height: 48,
      background:'var(--bg-secondary)',
      border:'2px solid var(--border)',
      display:'flex',
      alignItems:'center',
      justifyContent:'center',
      boxShadow:'1px 1px 0 rgba(0,0,0,0.5)',
      flexShrink: 0
    }}>
      {renderPixelArt()}
    </div>
  );
}

function ShopPage() {
  const { user, refreshProfile } = useAuth();
  const toast = useToast();
  const [shopCategory, setShopCategory] = useState('all');
  const [buying, setBuying] = useState(null);

  const isItemOwned = (item) => {
    if (!user) return false;
    if (item.type ==='title') return user.title === item.value;
    if (item.type ==='avatar') return (user.unlocked_avatars || []).includes(item.value);
    if (item.type ==='badge') return (user.badges || []).includes(item.value);
    return false;
  };

  const handleBuyItem = async (itemId, cost) => {
    if (!user) {
      toast('Please authenticate first!','error');
      return;
    }
    if ((user.gold || 0) < cost) {
      toast('Insufficient gold balance!','error');
      return;
    }

    setBuying(itemId);
    try {
      await apiBuyShopItem(itemId);
      toast('Purchase successful! Item unlocked and equipped.','success');
      await refreshProfile();
    } catch (err) {
      toast(err.message ||'Purchase failed','error');
    } finally {
      setBuying(null);
    }
  };

  if (!user) {
    return (
      <PageShell title="Reward Shop"subtitle="Authenticate to browse items">
        <div className="card rpg-panel rpg-panel-sandstone text-center" style={{ padding:'var(--space-8)'}}>
          <span className="font-pixel text-muted">A HERO LICENSE IS REQUIRED TO TRADE HERE.</span>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell 
      title="Lucknow Merchant's Shop"
      subtitle="Spend your hard-earned gold on legendary titles, badges, and avatar cosmetics"
    >
      <div style={{ display:'flex', flexDirection:'row', gap:'var(--space-6)', flexWrap:'wrap', alignItems:'flex-start'}}>
        
        {/* LEFT COLUMN: SHOPKEEPER CARD (320px) */}
        <div style={{ width:'100%', maxWidth:'320px', display:'flex', flexDirection:'column', gap:'var(--space-6)'}} className="profile-left-col">
          
          <div className="card rpg-panel rpg-panel-sandstone" style={{ borderRadius: 0, padding:'var(--space-5)'}}>
            <div className="card pixel-border" style={{ padding:'var(--space-4)', display:'flex', flexDirection:'column', gap:'var(--space-4)', margin: 0, background:'#fcf8ee'}}>
              
              {/* Shopkeeper Portrait SVG */}
              <div style={{ display:'flex', justifyContent:'center', marginBottom:'var(--space-2)'}}>
                <svg width="80"height="80"viewBox="0 0 16 16"fill="none"style={{ imageRendering:'pixelated', border:'3px solid #513a23', background:'#e3b878'}}>
                  {/* Skin */}
                  <rect x="3"y="4"width="10"height="9"fill="#fcd34d"/>
                  {/* Hair / Turban */}
                  <rect x="2"y="1"width="12"height="3"fill="#d97706"/>
                  <rect x="5"y="0"width="6"height="2"fill="#fbbf24"/>
                  <rect x="7"y="0"width="2"height="2"fill="#ef4444"/>
                  {/* Eyes */}
                  <rect x="5"y="6"width="2"height="2"fill="#000"/>
                  <rect x="9"y="6"width="2"height="2"fill="#000"/>
                  <rect x="6"y="6"width="1"height="1"fill="#fff"/>
                  <rect x="10"y="6"width="1"height="1"fill="#fff"/>
                  {/* Beard */}
                  <rect x="4"y="9"width="8"height="4"fill="#78350f"/>
                  <rect x="6"y="11"width="4"height="3"fill="#78350f"/>
                  <rect x="7"y="9"width="2"height="1"fill="#d97706"/>
                  {/* Clothes */}
                  <rect x="1"y="13"width="14"height="3"fill="#047857"/>
                  <rect x="6"y="13"width="4"height="3"fill="#fbbf24"/>
                </svg>
              </div>

              {/* Merchant Dialogue */}
              <div style={{ textAlign:'center'}}>
                <span className="font-pixel" style={{ fontSize:'10px', color:'#b45309', display:'block', fontWeight: 800 }}>MERCHANT KABIR</span>
                <p className="text-secondary" style={{ fontSize:'0.85rem', lineHeight: 1.4, margin:'8px 0 0 0', fontStyle:'italic'}}>
                 "Welcome, hero! My shelves are stocked with the finest accolades. Have you got the gold?"
                </p>
              </div>

              {/* Gold Box */}
              <div className="pixel-border gold-balance-box" style={{ marginTop:'var(--space-2)'}}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'6px'}}>
                  <CoinIcon size={20} />
                  <span className="font-pixel gold-value">{user.gold || 0}</span>
                </div>
                <span className="font-pixel gold-label">YOUR GOLD BALANCE</span>
              </div>

            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: ITEMS CATALOG CARD */}
        <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-6)', flex: 1 }} className="profile-right-col">
          
          <div className="card rpg-panel rpg-panel-sandstone" style={{ borderRadius: 0, padding:'var(--space-5)'}}>
            <h3 className="font-pixel" style={{ margin:'0 0 var(--space-4) 0', fontSize:'0.75rem', paddingBottom:'var(--space-2)'}}>MERCHANDISE CATALOG</h3>
            
            <div className="flex flex-col gap-5">
              {/* Category Filter Buttons */}
              <div style={{ display:'flex', gap:'4px', flexWrap:'wrap', paddingBottom:'var(--space-3)'}}>
                {['all','title','avatar','badge'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setShopCategory(cat)}
                    className="font-pixel"
                    style={{
                      padding:'6px 10px',
                      fontSize:'10px',
                      border:'1px solid var(--border)',
                      borderRadius: 0,
                      background: shopCategory === cat ?'var(--accent)':'var(--bg-surface)',
                      color: shopCategory === cat ?'#000':'var(--ink-secondary)',
                      cursor:'pointer'
                    }}
                  >
                    {cat.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* Items List */}
              <div className="flex flex-col gap-3 rpg-scrollbar" style={{ maxHeight:'520px', overflowY:'auto', paddingRight:'8px'}}>
                {SHOP_ITEMS
                  .filter(item => shopCategory ==='all'|| item.type === shopCategory)
                  .map((item) => {
                    const owned = isItemOwned(item);
                    const canAfford = (user.gold || 0) >= item.cost;
                    
                    return (
                      <div 
                        key={item.id} 
                        className="card pixel-border"
                        style={{
                          borderRadius: 0,
                          padding:'var(--space-3) var(--space-4)',
                          display:'flex',
                          flexDirection:'row',
                          alignItems:'center',
                          justifyContent:'space-between',
                          background:'var(--bg-surface)',
                          borderColor: owned ?'var(--border-hover)':'var(--border)',
                          gap:'var(--space-4)'
                        }}
                      >
                        <div className="flex items-center gap-3" style={{ flex: 1, minWidth: 0 }}>
                          <ShopItemIcon id={item.id} />
                          
                          <div className="flex flex-col gap-0.5" style={{ minWidth: 0, flex: 1 }}>
                            <span className="font-pixel truncate" style={{ fontSize:'0.55rem', color: owned ?'var(--accent)':'var(--ink-primary)'}}>
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
                                fontSize:'0.45rem',
                                background:'#14532d', 
                                padding:'4px 8px', 
                                border:'1px solid #166534',
                                color:'#4ade80'
                              }}
                            >UNLOCKED
                            </span>
                          ) : (
                            <button
                              onClick={() => handleBuyItem(item.id, item.cost)}
                              disabled={buying === item.id || !canAfford}
                              className="font-pixel"
                              style={{
                                padding:'8px 12px',
                                fontSize:'10px',
                                border: canAfford ?'2px solid #000':'2px solid #513a23',
                                boxShadow: canAfford ?'2px 2px 0 rgba(0,0,0,0.5)':'none',
                                background: canAfford ?'var(--accent)':'#1c130c',
                                color: canAfford ?'#000':'#a17c55',
                                cursor: canAfford ?'pointer':'not-allowed',
                                fontWeight: 800
                              }}
                            >
                              {buying === item.id ?'...': (
                                <span style={{ display:'inline-flex', alignItems:'center', gap:'4px'}}>BUY <CoinIcon size={12} style={{ marginRight: 0 }} /> {item.cost}
                                </span>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

          </div>

        </div>

      </div>
    </PageShell>
  );
}

export default ShopPage;
