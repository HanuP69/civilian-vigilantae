import { BrowserRouter, Routes, Route, NavLink, Link } from 'react-router-dom';
import { useSSE } from './hooks/useSSE';
import { ToastProvider } from './hooks/useToast.jsx';
import HomePage from './pages/HomePage';
import ReportPage from './pages/ReportPage';
import TicketPage from './pages/TicketPage';
import DashboardPage from './pages/DashboardPage';
import LeaderboardPage from './pages/LeaderboardPage';
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
  const liveDotStyle = {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: isConnected ? 'var(--success)' : 'var(--ink-muted)',
    display: 'inline-block',
  };

  return (
    <nav className="app-navbar animate-fade-up">
      <div className="flex items-center gap-2">
        <span className="font-serif" style={{ fontSize: '1.5rem', fontWeight: 600, letterSpacing: '-0.02em', fontStyle: 'italic' }}>
          Sentinel
        </span>
        <span style={{ fontSize: '0.875rem', fontWeight: 400, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Civic
        </span>
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

function App() {
  const { isConnected } = useSSE();

  return (
    <ToastProvider>
      <BrowserRouter>
        <div className="app-layout">
          <Navbar isConnected={isConnected} />

          <main className="app-main animate-fade-up stagger-1">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/report" element={<ReportPage />} />
              <Route path="/ticket/:id" element={<TicketPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/leaderboard" element={<LeaderboardPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
