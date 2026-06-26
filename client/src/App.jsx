import { BrowserRouter, Routes, Route, NavLink, Link } from 'react-router-dom';
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
  const { isAuthenticated, user } = useAuth();
  
  const liveDotStyle = {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: isConnected ? 'var(--success)' : 'var(--ink-muted)',
    display: 'inline-block',
  };

  return (
    <nav className="app-navbar animate-fade-up">
      <div className="flex items-center gap-3">
        <div>
          <span className="font-serif" style={{ fontSize: '1.5rem', fontWeight: 600, letterSpacing: '-0.02em', fontStyle: 'italic' }}>
            Sentinel Civic
          </span>
          <div className="text-xs text-muted" style={{ marginTop: '2px' }}>AI for local civic action</div>
        </div>
      </div>

      <div className="nav-links">
        <NavLink to="/" end className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          Map
        </NavLink>
        <NavLink to="/dashboard" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          Dashboard
        </NavLink>
        <NavLink to="/leaderboard" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          Leaderboard
        </NavLink>
        
        {isAuthenticated ? (
          <NavLink to="/profile" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>👤 Profile</span>
            <span style={{ fontSize: '0.72rem', background: 'var(--accent)', color: '#000', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>Lvl {user?.level || 1}</span>
          </NavLink>
        ) : (
          <NavLink to="/login" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            Sign In
          </NavLink>
        )}

        <NavLink to="/report" className={({ isActive }) => `btn ${isActive ? 'btn-primary' : 'btn-primary'}`}>
          Report Issue
        </NavLink>

        <div
          className="flex items-center gap-2 text-xs"
          style={{ marginLeft: 'var(--space-4)' }}
          role="status"
          aria-live="polite"
          aria-label={`Connection status: ${isConnected ? 'live' : 'offline'}`}
        >
          <span style={liveDotStyle} aria-hidden="true" />
          <span className="text-muted">{isConnected ? 'LIVE' : 'OFFLINE'}</span>
        </div>
      </div>
    </nav>
  );
}

function AppContent() {
  const { isConnected } = useSSE();

  return (
    <div className="app-layout">
      <Navbar isConnected={isConnected} />

      <main className="app-main animate-fade-up stagger-1">
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
