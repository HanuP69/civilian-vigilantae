import { useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Link, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSSE } from './hooks/useSSE';
import { ToastProvider } from './hooks/useToast.jsx';
import { AuthProvider, useAuth } from './hooks/AuthContext';
import HomePage from './pages/HomePage';
import ReportPage from './pages/ReportPage';
import TicketPage from './pages/TicketPage';
import DashboardPage from './pages/DashboardPage';
import LeaderboardPage from './pages/LeaderboardPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProfilePage from './pages/ProfilePage';
import MissionsPage from './pages/MissionsPage';
import CopilotDrawer from './components/copilot/CopilotDrawer';
import './index.css';

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
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ filter: 'drop-shadow(0 0 8px var(--accent))' }}>
      {/* Outer Gear Ring */}
      <circle cx="16" cy="16" r="11" stroke="var(--accent)" strokeWidth="2" strokeDasharray="3 3" />
      {/* Inner Scope Radar Crosshairs */}
      <circle cx="16" cy="16" r="7" stroke="var(--accent)" strokeWidth="1.5" />
      <circle cx="16" cy="16" r="3" fill="var(--accent)" />
      <path d="M16 2v4M16 26v4M2 16h4M26 16h4" stroke="var(--accent)" strokeWidth="1.5" />
    </svg>
  );
}

function Navbar({ isConnected }) {
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
    { name: 'Map', path: '/', icon: '🗺️', label: 'COMMUNITY MAP', desc: 'Browse active community issues' },
    { name: 'Missions', path: '/missions', icon: '🧭', label: 'MISSIONS', desc: 'Verify issues & earn rewards' },
    { name: 'Ledger', path: '/dashboard', icon: '📊', label: 'CITY DASHBOARD', desc: 'SLA & issue statistics' },
    { name: 'Leaders', path: '/leaderboard', icon: '🏆', label: 'HERO LEAGUE', desc: 'Citizen contribution rankings' },
    { 
      name: 'Profile', 
      path: isAuthenticated ? '/profile' : '/login', 
      icon: '👤', 
      label: 'HERO DASHBOARD', 
      desc: isAuthenticated ? 'Your impact & achievements' : 'Authenticate console' 
    },
    { name: 'Report', path: '/report', icon: '📢', label: 'REPORT ISSUE', desc: 'Log new community issue' },
    {
      name: isAuthenticated ? 'Sign Out' : 'Sign In',
      path: isAuthenticated ? '/logout' : '/login',
      icon: isAuthenticated ? '🚪' : '🔑',
      label: isAuthenticated ? 'DISMISS HERO' : 'HERO ACCESS',
      desc: isAuthenticated ? 'Sign out of console' : 'Authenticate console'
    }
  ];

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
          justifyContent: 'flex-end',
          alignItems: 'center'
        }}
      >

        {/* Floating Backpack Trigger Button (Top-Right) or Sign In button */}
        {isAuthenticated ? (
          <motion.div
            onClick={toggleOpen}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            animate={!isOpen ? { y: [0, -6, 0] } : {}}
            transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
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
              width: '56px',
              height: '56px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: isOpen ? 'var(--bg-surface)' : 'radial-gradient(circle, rgba(99,102,241,0.25) 0%, rgba(0,0,0,0) 70%)',
              borderRadius: isOpen ? '0' : '50%',
              border: isOpen ? '2px solid var(--border)' : 'none',
              boxShadow: isOpen ? '4px 4px 0 rgba(0,0,0,0.6)' : 'none'
            }}>
              <RpgTriggerIcon isOpen={isOpen} />
              
              {/* Notification Badge to intrigue user */}
              {!isOpen && (
                <motion.div
                  initial={{ scale: 0.8 }}
                  animate={{ scale: [0.8, 1.2, 0.8] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className="font-pixel"
                  style={{
                    position: 'absolute',
                    top: '2px',
                    right: '0px',
                    background: 'var(--error)',
                    color: '#fff',
                    fontSize: '0.45rem',
                    padding: '3px 4px',
                    border: '1px solid #fff',
                    boxShadow: '0 0 8px var(--error)',
                    zIndex: 10
                  }}
                >
                  !
                </motion.div>
              )}
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
            🔑 SIGN IN
          </Link>
        )}
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
              background: 'rgba(15, 17, 23, 0.85)',
              backdropFilter: 'blur(8px)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <motion.div
              className="rpg-panel rpg-radial-menu-container"
              initial={{ scale: 0.9, rotate: -15 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0.9, rotate: 15 }}
              transition={{ type: 'spring', stiffness: 150, damping: 16 }}
              style={{
                width: '420px',
                height: '420px',
                borderRadius: 0,
                position: 'relative',
                boxShadow: '16px 16px 0 rgba(0,0,0,0.8)',
                overflow: 'visible'
              }}
            >
              {/* Segmented Ring SVG container */}
              <svg style={{ position: 'absolute', inset: 0, width: '420px', height: '420px', pointerEvents: 'auto', zIndex: 1 }}>
                {slots.map((slot, index) => {
                  const startAngle = index * (360 / slots.length) + 3;
                  const endAngle = (index + 1) * (360 / slots.length) - 3;
                  const isHovered = hoveredSlot?.name === slot.name;
                  const pathData = getArcPath(210, 210, 180, 115, startAngle, endAngle);
                  
                  return (
                    <path
                      key={slot.name}
                      d={pathData}
                      fill={isHovered ? 'rgba(251, 191, 36, 0.4)' : 'rgba(255, 255, 255, 0.12)'}
                      stroke={isHovered ? 'var(--accent)' : 'rgba(255, 255, 255, 0.15)'}
                      strokeWidth={isHovered ? '2' : '1'}
                      style={{
                        cursor: 'pointer',
                        transition: 'all 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
                        filter: isHovered ? 'drop-shadow(0 0 10px rgba(251, 191, 36, 0.6))' : 'none'
                      }}
                      onMouseEnter={() => setHoveredSlot(slot)}
                      onMouseLeave={() => setHoveredSlot(null)}
                      onClick={() => handleNav(slot.path, slot.name)}
                    />
                  );
                })}
              </svg>

              {/* Center Circular Display HUD */}
              <div 
                className="flex flex-col items-center justify-center"
                style={{
                  position: 'absolute',
                  left: '150px',
                  top: '150px',
                  width: '120px',
                  height: '120px',
                  borderRadius: '50%',
                  background: 'rgba(12, 13, 18, 0.94)',
                  border: '2px solid var(--border)',
                  boxShadow: 'inset 0 0 12px rgba(0,0,0,0.85), 0 0 20px rgba(251, 191, 36, 0.25)',
                  padding: '12px',
                  textAlign: 'center',
                  zIndex: 2,
                  pointerEvents: 'none'
                }}
              >
                {hoveredSlot ? (
                  <div style={{ animation: 'fadeIn 0.15s ease-out' }}>
                    <div className="font-pixel" style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: 800, marginBottom: '4px' }}>
                      {hoveredSlot.label}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--ink-muted)', lineHeight: 1.2, wordBreak: 'break-word' }}>
                      {hoveredSlot.desc}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="font-pixel" style={{ fontSize: '9px', color: 'var(--accent)', fontWeight: 800, marginBottom: '3px' }}>
                      HUD STATUS
                    </div>
                    {isAuthenticated && (
                      <div className="font-pixel" style={{ fontSize: '9px', color: 'var(--ink-primary)', marginBottom: '3px' }}>
                        LVL {user?.level || 1}
                      </div>
                    )}
                    <div className="flex items-center justify-center gap-1.5" style={{ fontSize: '10px', color: 'var(--ink-secondary)' }}>
                      <span style={liveDotStyle} />
                      <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)' }}>{isConnected ? 'LIVE' : 'OFFLINE'}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Radial slots (Buttons positioned at center of segments) */}
              {slots.map((slot, index) => {
                const angle = (index + 0.5) * (360 / slots.length);
                const rad = (angle - 90) * Math.PI / 180;
                const x = 210 + 147.5 * Math.cos(rad);
                const y = 210 + 147.5 * Math.sin(rad);
                const isHovered = hoveredSlot?.name === slot.name;

                return (
                  <button
                    key={slot.name}
                    onClick={() => handleNav(slot.path, slot.name)}
                    onMouseEnter={() => setHoveredSlot(slot)}
                    onMouseLeave={() => setHoveredSlot(null)}
                    style={{
                      position: 'absolute',
                      left: `${x - 25}px`,
                      top: `${y - 25}px`,
                      width: '50px',
                      height: '50px',
                      borderRadius: '50%',
                      cursor: 'pointer',
                      fontSize: '1.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'transparent',
                      transform: isHovered ? 'scale(1.2)' : 'scale(1)',
                      transition: 'all 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
                      border: 'none',
                      padding: 0,
                      zIndex: 3,
                      pointerEvents: 'auto'
                    }}
                    title={slot.name}
                  >
                    {slot.icon}
                  </button>
                );
              })}
            </motion.div>
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

  const hour = new Date().getHours();
  let timeClass = 'time-night';
  if (hour >= 6 && hour < 17) {
    timeClass = 'time-day';
  } else if (hour >= 17 && hour < 19) {
    timeClass = 'time-sunset';
  }

  return (
    <div className="app-layout">
      {/* RPG Pixel Backdrop */}
      <div className="rpg-backdrop">
        <div className={`rpg-sky ${timeClass}`}>
          {/* Twinkling Stars */}
          <div className="pixel-star star-1"></div>
          <div className="pixel-star star-2"></div>
          <div className="pixel-star star-3"></div>
          <div className="pixel-star star-4"></div>

          {/* Sun / Moon based on time */}
          {timeClass === 'time-night' ? (
            <div className="pixel-moon"></div>
          ) : (
            <div className="pixel-sun"></div>
          )}

          {/* Floating Hot Air Balloon during day/sunset */}
          {timeClass !== 'time-night' && (
            <div className="pixel-balloon"></div>
          )}

          {/* Floating Clouds */}
          <div className="pixel-cloud cloud-1"></div>
          <div className="pixel-cloud cloud-2"></div>
          <div className="pixel-cloud cloud-3"></div>
        </div>
        
        {/* Horizon Landscape */}
        <div className="rpg-horizon"></div>

        {/* Windmill with rotating sails */}
        <div className="rpg-windmill"></div>
        <div className="rpg-windmill-sails"></div>

        <div className="rpg-farmhouse"></div>
        <div className="rpg-fence"></div>
        
        {/* Ground Pasture with Cattle */}
        <div className="rpg-ground">
          <div className="rpg-sheep"></div>
          <div className="rpg-cow"></div>
          <div className="rpg-cow-2"></div>
        </div>
      </div>

      <Navbar isConnected={isConnected} />
      <CopilotDrawer />

      <main className="app-main animate-fade-up stagger-1" style={{ paddingTop: '80px', position: 'relative', zIndex: 1 }}>
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
          <Route path="*" element={<ProtectedRoute><NotFoundPage /></ProtectedRoute>} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
