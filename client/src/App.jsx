import { useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Link, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSSE } from './hooks/useSSE';
import { ToastProvider } from './hooks/useToast.jsx';
import { QuestToastProvider } from './components/QuestToast.jsx';
import { AuthProvider, useAuth } from './hooks/AuthContext';
import HomePage from './pages/HomePage';
import ReportPage from './pages/ReportPage';
import TicketPage from './pages/TicketPage';
import DashboardPage from './pages/DashboardPage';
import LeaderboardPage from './pages/LeaderboardPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProfilePage from './pages/ProfilePage';
import ShopPage from './pages/ShopPage';
import MissionsPage from './pages/MissionsPage';
import CopilotDrawer from './components/copilot/CopilotDrawer';
import QuestTrackerSidebar from './components/QuestTrackerSidebar';
import WorldBackdrop from './components/world/WorldBackdrop';
import { useWorldState } from './hooks/useWorldState';
import { ScrollIcon, KeyIcon } from './components/ui/PixelIcons';
import './index.css';
import './styles/hud.css';

function NotFoundPage() {
  return (
    <div className="flex flex-col gap-4" style={{ textAlign: 'center', padding: 'var(--space-10)' }}>
      <h1 className="animate-reveal" style={{ fontSize: '3rem' }}>Page not found</h1>
      <p className="text-secondary">The page you're looking for doesn't exist or has moved.</p>
      <div className="flex items-center justify-center gap-3" style={{ marginTop: 'var(--space-4)' }}>
        <Link to="/" className="btn btn-primary">Back to Map</Link>
        <Link to="/report" className="btn btn-secondary">Report an Issue</Link>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        color: 'var(--accent)',
        fontFamily: 'var(--font-pixel)',
        fontSize: '1rem'
      }}>
        LOADING HUD CONSOLE...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

function PublicRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        color: 'var(--accent)',
        fontFamily: 'var(--font-pixel)',
        fontSize: '1rem'
      }}>
        LOADING HUD CONSOLE...
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function getArcPath(cx, cy, rOut, rIn, startAngleDeg, endAngleDeg) {
  const toRad = (angle) => (angle - 90) * Math.PI / 180;
  
  const startRadOut = toRad(startAngleDeg);
  const endRadOut = toRad(endAngleDeg);
  
  const x1Out = cx + rOut * Math.cos(startRadOut);
  const y1Out = cy + rOut * Math.sin(startRadOut);
  const x2Out = cx + rOut * Math.cos(endRadOut);
  const y2Out = cy + rOut * Math.sin(endRadOut);
  
  const x1In = cx + rIn * Math.cos(endRadOut);
  const y1In = cy + rIn * Math.sin(endRadOut);
  const x2In = cx + rIn * Math.cos(startRadOut);
  const y2In = cy + rIn * Math.sin(startRadOut);
  
  const largeArc = (endAngleDeg - startAngleDeg) > 180 ? 1 : 0;
  
  return [
    `M ${x1Out} ${y1Out}`,
    `A ${rOut} ${rOut} 0 ${largeArc} 1 ${x2Out} ${y2Out}`,
    `L ${x1In} ${y1In}`,
    `A ${rIn} ${rIn} 0 ${largeArc} 0 ${x2In} ${y2In}`,
    `Z`
  ].join(' ');
}

const MapIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
    <path d="M4 4h16v16H4z" />
    <path d="M6 6h12v12H6z" stroke="var(--accent)" strokeWidth="1.5" />
    <rect x="8" y="8" width="4" height="4" fill="currentColor" />
    <rect x="12" y="10" width="3" height="3" fill="currentColor" />
    <rect x="7" y="14" width="4" height="2" fill="currentColor" />
  </svg>
);

const CompassIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="6" stroke="var(--accent)" strokeWidth="1" />
    <path d="M12 5l2 7-2 1-2-1z" fill="currentColor" />
    <path d="M12 19l-2-7 2-1 2 1z" fill="none" stroke="currentColor" />
  </svg>
);

const StatsIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
    <path d="M3 21h18M3 3v18" />
    <rect x="6" y="13" width="3" height="5" fill="var(--accent)" stroke="currentColor" strokeWidth="1.5" />
    <rect x="11" y="9" width="3" height="9" fill="currentColor" stroke="currentColor" strokeWidth="1.5" />
    <rect x="16" y="5" width="3" height="13" fill="var(--accent)" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const TrophyIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
    <path d="M6 4h12v7c0 3-2 5-6 5s-6-2-6-5V4z" fill="var(--accent)" stroke="currentColor" strokeWidth="1.5" />
    <path d="M12 16v3M8 19h8" />
    <path d="M4 6H2v3c0 2 2 3 4 3M20 6h2v3c0 2-2 3-4 3" />
  </svg>
);

const ProfileIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
    <path d="M6 12V8a6 6 0 0 1 12 0v4H6z" />
    <rect x="8" y="9" width="8" height="2" fill="var(--accent)" />
    <path d="M6 12h12v5a3 3 0 0 1-6 3 3 3 0 0 1-6-3v-5z" />
    <path d="M12 5V2h3" stroke="var(--accent)" strokeWidth="1.5" />
  </svg>
);

const ReportIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
    <path d="M7 14l9 4V6l-9 4H4v4h3z" />
    <path d="M19 8c1 1.5 1 2.5 0 4" stroke="var(--accent)" strokeWidth="1.5" />
    <path d="M22 6c2 2.5 2 3.5 0 6" stroke="var(--accent)" strokeWidth="1.5" />
    <path d="M9 14v3h2v-3" />
  </svg>
);

const AuthIcon = ({ isOut }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
    {isOut ? (
      <>
        <path d="M4 20V4h11v16H4z" />
        <path d="M15 8h4v10h-4" stroke="var(--accent)" strokeWidth="1.5" />
        <path d="M12 12h8M17 9l3 3-3 3" stroke="var(--accent)" strokeWidth="1.5" />
      </>
    ) : (
      <>
        <circle cx="7" cy="12" r="4" stroke="var(--accent)" strokeWidth="2" />
        <path d="M11 12h10" />
        <path d="M18 12v3M21 12v3M15 12v2" stroke="var(--accent)" strokeWidth="1.5" />
      </>
    )}
  </svg>
);

const ShopIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
    <path d="M4 8h16l-1 10H5L4 8z" fill="var(--accent)" stroke="currentColor" strokeWidth="1.5" />
    <path d="M9 8V5a3 3 0 0 1 6 0v3" />
    <circle cx="9" cy="13" r="1.5" fill="currentColor" />
    <circle cx="15" cy="13" r="1.5" fill="currentColor" />
  </svg>
);

function RpgTriggerIcon({ isOpen }) {
  if (isOpen) {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    );
  }
  
  return (
    <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="square" strokeLinejoin="miter" style={{ filter: 'drop-shadow(0 0 8px var(--accent))' }}>
      {/* Central axis hole */}
      <circle cx="12" cy="12" r="3" stroke="var(--accent)" strokeWidth="1.8" />
      
      {/* Outer main wheel rim */}
      <circle cx="12" cy="12" r="7" stroke="var(--accent)" strokeWidth="1.5" />
      
      {/* Spokes */}
      <line x1="12" y1="5" x2="12" y2="19" stroke="var(--accent)" strokeWidth="1.5" />
      <line x1="5" y1="12" x2="19" y2="12" stroke="var(--accent)" strokeWidth="1.5" />
      
      {/* Gear teeth/cogs */}
      <path d="M11 2h2v3h-2z" fill="var(--accent)" />
      <path d="M11 19h2v3h-2z" fill="var(--accent)" />
      <path d="M2 11h3v2H2z" fill="var(--accent)" />
      <path d="M19 11h3v2h-3z" fill="var(--accent)" />
      <path d="M5 5l2 2" stroke="var(--accent)" strokeWidth="3" strokeLinecap="square" />
      <path d="M17 17l2 2" stroke="var(--accent)" strokeWidth="3" strokeLinecap="square" />
      <path d="M17 5l2-2" stroke="var(--accent)" strokeWidth="3" strokeLinecap="square" />
      <path d="M5 17l2-2" stroke="var(--accent)" strokeWidth="3" strokeLinecap="square" />
    </svg>
  );
}

function Navbar({ isConnected, onOpenQuestSidebar }) {
  const { isAuthenticated, user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredSlot, setHoveredSlot] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  const toggleOpen = () => setIsOpen(prev => !prev);

  const handleNav = (path, name) => {
    setIsOpen(false);
    if (name === 'Sign Out') {
      logout();
      navigate('/login');
    } else {
      navigate(path);
    }
  };

  const slots = [
    { name: 'Map', path: '/', icon: <MapIcon />, label: 'COMMUNITY MAP', desc: 'Browse active community issues' },
    { name: 'Missions', path: '/missions', icon: <CompassIcon />, label: 'MISSIONS', desc: 'Verify issues & earn rewards' },
    { name: 'Shop', path: '/shop', icon: <ShopIcon />, label: 'REWARD SHOP', desc: 'Spend gold on cosmetics & titles' },
    { name: 'Ledger', path: '/dashboard', icon: <StatsIcon />, label: 'CITY DASHBOARD', desc: 'SLA & issue statistics' },
    { name: 'Leaders', path: '/leaderboard', icon: <TrophyIcon />, label: 'HERO LEAGUE', desc: 'Citizen contribution rankings' },
    { 
      name: 'Profile', 
      path: isAuthenticated ? '/profile' : '/login', 
      icon: <ProfileIcon />, 
      label: 'HERO DASHBOARD', 
      desc: isAuthenticated ? 'Your impact & achievements' : 'Authenticate console' 
    },
    { name: 'Report', path: '/report', icon: <ReportIcon />, label: 'REPORT ISSUE', desc: 'Log new community issue' },
    {
      name: isAuthenticated ? 'Sign Out' : 'Sign In',
      path: isAuthenticated ? '/logout' : '/login',
      icon: <AuthIcon isOut={isAuthenticated} />,
      label: isAuthenticated ? 'DISMISS HERO' : 'HERO ACCESS',
      desc: isAuthenticated ? 'Sign out of console' : 'Authenticate console'
    }
  ];

  const activeIndex = slots.findIndex(s => location.pathname === s.path);
  const hoveredIndex = slots.findIndex(s => s.name === hoveredSlot?.name);
  const selectedIndex = hoveredIndex !== -1 ? hoveredIndex : (activeIndex !== -1 ? activeIndex : 0);

  const liveDotStyle = {
    width: 6,
    height: 6,
    borderRadius: 0,
    background: isConnected ? 'var(--success)' : 'var(--ink-muted)',
    display: 'inline-block',
  };

  const radius = 100;
  const coords = slots.map((_, index) => {
    const angle = (index * 2 * Math.PI) / slots.length;
    return {
      x: radius * Math.cos(angle),
      y: radius * Math.sin(angle)
    };
  });

  return (
    <>
      {/* Floating Navigation HUD Container */}
      <div 
        className="hud-navbar"
        style={{ 
          position: 'fixed', 
          top: '20px', 
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: '1400px', 
          padding: '0 20px',
          zIndex: 1001,
          pointerEvents: 'none',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >

        {/* Left Side: Quest Tracker Button */}
        <div style={{ pointerEvents: 'auto' }}>
          {isAuthenticated && onOpenQuestSidebar && (
            <motion.button
              onClick={onOpenQuestSidebar}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="rpg-panel flex items-center justify-center font-pixel"
              style={{
                padding: '12px 16px',
                borderRadius: 0,
                cursor: 'pointer',
                boxShadow: '4px 4px 0 rgba(0,0,0,0.6)',
                fontSize: '0.625rem',
                outline: 'none',
                border: '2px solid var(--border)',
                color: 'var(--accent)',
                background: 'var(--bg-surface)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s ease'
              }}
              aria-label="Open Quest Tracker"
            >
              <ScrollIcon width={14} height={14} />
              QUESTS
            </motion.button>
          )}
        </div>

        {/* Right Side: Floating Backpack Trigger Button (Top-Right) or Sign In button */}
        <div style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
          {isAuthenticated ? (
          <motion.div
            onClick={toggleOpen}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            style={{
              cursor: 'pointer',
              pointerEvents: 'auto',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              position: 'relative'
            }}
            aria-label={isOpen ? "Close Navigation" : "Open Inventory"}
          >
            <div style={{
              position: 'relative',
              width: '72px',
              height: '72px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: isOpen ? 'var(--bg-surface)' : 'radial-gradient(circle, rgba(252,211,77,0.2) 0%, rgba(0,0,0,0) 70%)',
              borderRadius: isOpen ? '0' : '50%',
              border: isOpen ? '2px solid var(--border)' : 'none',
              boxShadow: isOpen ? '4px 4px 0 rgba(0,0,0,0.6)' : 'none'
            }}>
              <RpgTriggerIcon isOpen={isOpen} />
            </div>
            
            {!isOpen && (
              <span className="font-pixel" style={{ 
                fontSize: '9px', 
                color: 'var(--accent)', 
                textShadow: '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000',
                letterSpacing: '1px'
              }}>
                HERO HUD
              </span>
            )}
          </motion.div>
        ) : (
          <Link
            to="/login"
            className="rpg-panel flex items-center justify-center animate-fade-up font-pixel"
            style={{
              padding: '10px 16px',
              borderRadius: 0,
              cursor: 'pointer',
              boxShadow: '4px 4px 0 rgba(0,0,0,0.6)',
              fontSize: '0.625rem',
              outline: 'none',
              border: 'none',
              color: 'var(--accent)',
              textDecoration: 'none',
              pointerEvents: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <KeyIcon width={14} height={14} />
            SIGN IN
          </Link>
        )}
        </div>
      </div>

      {/* Radial Wheel Overlay Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(16, 11, 8, 0.55)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
          <div className="rpg-radial-menu-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            <motion.div
              className="rpg-radial-menu-container"
              initial={{ scale: 0.9, rotate: -15 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0.9, rotate: 15 }}
              transition={{ type: 'spring', stiffness: 150, damping: 16 }}
              style={{
                width: '420px',
                height: '420px',
                borderRadius: '50%',
                position: 'relative',
                background: 'url(/wheel.png) no-repeat center/contain',
                filter: 'drop-shadow(0 0 25px rgba(0,0,0,0.95))',
                overflow: 'visible'
              }}
            >
              {/* Center Hub: Slot Details */}
              <div
                style={{
                  position: 'absolute',
                  left: '145px',
                  top: '145px',
                  width: '130px',
                  height: '130px',
                  borderRadius: '50%',
                  background: '#fcf8ee',
                  border: '4px solid #85613c',
                  boxShadow: 'inset 2px 2px 4px rgba(0,0,0,0.15)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '8px',
                  textAlign: 'center',
                  zIndex: 3,
                  pointerEvents: 'none'
                }}
              >
                <span className="font-pixel" style={{ fontSize: '9px', color: '#b45309', fontWeight: 'bold' }}>
                  {hoveredSlot ? hoveredSlot.name.toUpperCase() : (activeIndex !== -1 ? slots[activeIndex].name.toUpperCase() : 'HUD NAV')}
                </span>
                <span className="font-pixel text-muted" style={{ fontSize: '7px', marginTop: '4px', lineHeight: 1.2, display: 'block', maxWidth: '110px', textShadow: 'none' }}>
                  {hoveredSlot ? hoveredSlot.desc : (activeIndex !== -1 ? slots[activeIndex].desc : 'Select destination')}
                </span>
              </div>

              {/* Rotating Pointer Indicator (Coded) */}
              {selectedIndex !== -1 && (
                <div
                  style={{
                    position: 'absolute',
                    left: '0px',
                    top: '0px',
                    width: '420px',
                    height: '420px',
                    pointerEvents: 'none',
                    zIndex: 2,
                    transform: `rotate(${(selectedIndex + 0.5) * (360 / slots.length)}deg)`,
                    transition: 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                    transformOrigin: '210px 210px'
                  }}
                >
                  <svg width="420" height="420" viewBox="0 0 420 420" fill="none">
                    {/* Glowing Pointer Arrow pointing outwards from center hub to the hovered segment */}
                    <path
                      d="M 210 100 L 203 124 L 217 124 Z"
                      fill="#f59e0b"
                      stroke="#513a23"
                      strokeWidth="2"
                      style={{
                        filter: 'drop-shadow(0 0 10px rgba(245, 158, 11, 0.9))'
                      }}
                    />
                    {/* Dashed line connector */}
                    <line
                      x1="210"
                      y1="124"
                      x2="210"
                      y2="150"
                      stroke="#fbbf24"
                      strokeWidth="2.5"
                      strokeDasharray="4 3"
                      opacity="0.8"
                    />
                  </svg>
                </div>
              )}

              {/* Segmented Ring SVG container (Invisible hover zones) */}
              <svg style={{ position: 'absolute', inset: 0, width: '420px', height: '420px', pointerEvents: 'auto', zIndex: 1 }}>
                {slots.map((slot, index) => {
                  const startAngle = index * (360 / slots.length) + 1.5;
                  const endAngle = (index + 1) * (360 / slots.length) - 1.5;
                  const pathData = getArcPath(210, 210, 180, 105, startAngle, endAngle);
                  
                  return (
                    <path
                      key={slot.name}
                      d={pathData}
                      fill="transparent"
                      stroke="transparent"
                      strokeWidth="0"
                      style={{
                        cursor: 'pointer'
                      }}
                      onMouseEnter={() => setHoveredSlot(slot)}
                      onMouseLeave={() => setHoveredSlot(null)}
                      onClick={() => handleNav(slot.path, slot.name)}
                    />
                  );
                })}
              </svg>

              {/* Radial slots (Invisible click target buttons positioned at center of segments) */}
              {slots.map((slot, index) => {
                const angle = (index + 0.5) * (360 / slots.length);
                const rad = (angle - 90) * Math.PI / 180;
                const x = 210 + 147.5 * Math.cos(rad);
                const y = 210 + 147.5 * Math.sin(rad);

                return (
                  <button
                    key={slot.name}
                    onClick={() => handleNav(slot.path, slot.name)}
                    onMouseEnter={() => setHoveredSlot(slot)}
                    onMouseLeave={() => setHoveredSlot(null)}
                    style={{
                      position: 'absolute',
                      left: `${x - 30}px`,
                      top: `${y - 30}px`,
                      width: '60px',
                      height: '60px',
                      borderRadius: '50%',
                      cursor: 'pointer',
                      background: hoveredSlot?.name === slot.name ? 'rgba(251, 191, 36, 0.15)' : 'transparent',
                      border: hoveredSlot?.name === slot.name ? '2px solid #b45309' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: hoveredSlot?.name === slot.name ? '#b45309' : '#513a23',
                      outline: 'none',
                      padding: 0,
                      zIndex: 4,
                      pointerEvents: 'auto',
                      WebkitTapHighlightColor: 'transparent',
                      transition: 'all 0.2s ease'
                    }}
                    title={slot.name}
                  >
                    <span style={{ transform: 'scale(1.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {slot.icon}
                    </span>
                  </button>
                );
              })}
            </motion.div>
          </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Bottom RPG Hotbar */}
      <div className="mobile-rpg-hotbar">
        {slots.slice(0, 6).map((slot) => {
          const isActive = location.pathname === slot.path;
          return (
            <button
              key={slot.name}
              onClick={() => handleNav(slot.path, slot.name)}
              className={`hotbar-item ${isActive ? 'active' : ''}`}
              title={slot.name}
            >
              <span>{slot.icon}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

function AppContent() {
  const { isConnected } = useSSE();
  const { isAuthenticated } = useAuth();
  const [isQuestSidebarOpen, setIsQuestSidebarOpen] = useState(false);
  const mood = useWorldState({ isAuthenticated });

  return (
    <div className="app-layout">
      <WorldBackdrop mood={mood} />

      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Navbar isConnected={isConnected} onOpenQuestSidebar={() => setIsQuestSidebarOpen(true)} />
      <CopilotDrawer />
      <AnimatePresence>
        {isQuestSidebarOpen && (
          <QuestTrackerSidebar isOpen={isQuestSidebarOpen} onClose={() => setIsQuestSidebarOpen(false)} />
        )}
      </AnimatePresence>

      <main id="main-content" className="app-main animate-fade-up stagger-1" style={{ position: 'relative', zIndex: 1 }}>
        <Routes>
          <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
          <Route path="/report" element={<ProtectedRoute><ReportPage /></ProtectedRoute>} />
          <Route path="/ticket/:id" element={<ProtectedRoute><TicketPage /></ProtectedRoute>} />
          <Route path="/missions" element={<ProtectedRoute><MissionsPage /></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/leaderboard" element={<ProtectedRoute><LeaderboardPage /></ProtectedRoute>} />
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/shop" element={<ProtectedRoute><ShopPage /></ProtectedRoute>} />
          <Route path="*" element={<ProtectedRoute><NotFoundPage /></ProtectedRoute>} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <ToastProvider>
      <QuestToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <AppContent />
          </BrowserRouter>
        </AuthProvider>
      </QuestToastProvider>
    </ToastProvider>
  );
}

export default App;