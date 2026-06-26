import { useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Link, useNavigate } from 'react-router-dom';
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

function Navbar({ isConnected }) {
  const { isAuthenticated, user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredSlot, setHoveredSlot] = useState(null);
  const navigate = useNavigate();

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
    { name: 'Map', path: '/', icon: '🗺️', label: 'MAP REALM', desc: 'Browse live anomalies' },
    { name: 'Ledger', path: '/dashboard', icon: '📊', label: 'OPERATIONS', desc: 'SLA threat forecasts' },
    { name: 'Leaders', path: '/leaderboard', icon: '🏆', label: 'CHAMPIONS', desc: 'Hero XP rankings' },
    { 
      name: 'Profile', 
      path: isAuthenticated ? '/profile' : '/login', 
      icon: '👤', 
      label: 'CHARACTER', 
      desc: isAuthenticated ? 'Equipment & Quests' : 'Authenticate console' 
    },
    { name: 'Report', path: '/report', icon: '⚔️', label: 'REPORT ISSUE', desc: 'Log new anomaly' },
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

  const coords = [
    { x: 100, y: 0 },    // Right
    { x: 50, y: 86.6 },  // Bottom-Right
    { x: -50, y: 86.6 }, // Bottom-Left
    { x: -100, y: 0 },   // Left
    { x: -50, y: -86.6 },// Top-Left
    { x: 50, y: -86.6 }, // Top-Right
  ];

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
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        {/* Floating Brand Plaque (Top-Left) */}
        <div 
          className="rpg-panel" 
          style={{ 
            padding: '6px 12px', 
            borderRadius: 0,
            boxShadow: '4px 4px 0 rgba(0,0,0,0.6)',
            pointerEvents: 'auto'
          }}
        >
          <span className="font-serif" style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--accent)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '6px' }}>
            ⚔️ Sentinel Civic
          </span>
        </div>

        {/* Floating Backpack Trigger Button (Top-Right) */}
        <button
          onClick={toggleOpen}
          className="rpg-panel flex items-center justify-center animate-fade-up"
          style={{
            width: '46px',
            height: '46px',
            borderRadius: 0,
            cursor: 'pointer',
            boxShadow: '4px 4px 0 rgba(0,0,0,0.6)',
            fontSize: '1.25rem',
            outline: 'none',
            border: 'none',
            padding: 0,
            pointerEvents: 'auto'
          }}
          aria-label={isOpen ? "Close Navigation" : "Open Navigation Menu"}
        >
          {isOpen ? '✕' : '🎒'}
        </button>
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
              className="rpg-panel"
              initial={{ scale: 0.9, rotate: -15 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0.9, rotate: 15 }}
              transition={{ type: 'spring', stiffness: 150, damping: 16 }}
              style={{
                width: '320px',
                height: '320px',
                borderRadius: 0,
                position: 'relative',
                boxShadow: '12px 12px 0 rgba(0,0,0,0.7)',
                overflow: 'visible'
              }}
            >
              {/* Outer decorative ring */}
              <div style={{
                position: 'absolute',
                inset: '20px',
                border: '2px dashed oklch(0.35 0.03 50)',
                borderRadius: '50%',
                pointerEvents: 'none'
              }} />

              {/* Center Display HUD (100px x 100px) */}
              <div 
                className="rpg-panel flex flex-col items-center justify-center"
                style={{
                  position: 'absolute',
                  left: '110px',
                  top: '110px',
                  width: '100px',
                  height: '100px',
                  borderRadius: 0,
                  background: 'oklch(0.12 0.01 50)',
                  boxShadow: 'inset 2px 2px 4px rgba(0,0,0,0.5)',
                  padding: '4px',
                  textAlign: 'center'
                }}
              >
                {hoveredSlot ? (
                  <div style={{ animation: 'fadeIn 0.15s ease-out' }}>
                    <div className="font-pixel" style={{ fontSize: '0.45rem', color: 'var(--accent)', fontWeight: 800, marginBottom: '4px' }}>
                      {hoveredSlot.label}
                    </div>
                    <div style={{ fontSize: '0.55rem', color: 'var(--ink-muted)', lineHeight: 1.2 }}>
                      {hoveredSlot.desc}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="font-pixel" style={{ fontSize: '0.45rem', color: 'var(--accent)', fontWeight: 800, marginBottom: '2px' }}>
                      HUD STATUS
                    </div>
                    {isAuthenticated && (
                      <div className="font-pixel" style={{ fontSize: '0.4rem', color: 'var(--ink-primary)', marginBottom: '2px' }}>
                        LVL {user?.level || 1}
                      </div>
                    )}
                    <div className="flex items-center justify-center gap-1.5" style={{ fontSize: '0.55rem', color: 'var(--ink-secondary)' }}>
                      <span style={liveDotStyle} />
                      <span style={{ fontSize: '0.5rem', fontFamily: 'var(--font-mono)' }}>{isConnected ? 'LIVE' : 'OFFLINE'}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Radial slots (Buttons positioned at degrees) */}
              {slots.map((slot, index) => {
                const coord = coords[index];
                const isHovered = hoveredSlot?.name === slot.name;

                return (
                  <button
                    key={slot.name}
                    onClick={() => handleNav(slot.path, slot.name)}
                    onMouseEnter={() => setHoveredSlot(slot)}
                    onMouseLeave={() => setHoveredSlot(null)}
                    className="rpg-panel flex items-center justify-center"
                    style={{
                      position: 'absolute',
                      left: `${160 + coord.x - 25}px`,
                      top: `${160 + coord.y - 25}px`,
                      width: '50px',
                      height: '50px',
                      borderRadius: 0,
                      cursor: 'pointer',
                      fontSize: '1.25rem',
                      boxShadow: isHovered ? '0 0 8px var(--accent)' : '3px 3px 0 rgba(0,0,0,0.5)',
                      transform: isHovered ? 'scale(1.15)' : 'scale(1)',
                      transition: 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.15s ease',
                      border: 'none',
                      padding: 0
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
    </>
  );
}

function AppContent() {
  const { isConnected } = useSSE();

  return (
    <div className="app-layout">
      <Navbar isConnected={isConnected} />

      <main className="app-main animate-fade-up stagger-1" style={{ paddingTop: '80px' }}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/report" element={<ReportPage />} />
          <Route path="/ticket/:id" element={<TicketPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="*" element={<NotFoundPage />} />
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
