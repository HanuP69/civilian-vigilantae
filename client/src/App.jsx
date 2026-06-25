import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { useSSE } from './hooks/useSSE';
import HomePage from './pages/HomePage';
import ReportPage from './pages/ReportPage';
import TicketPage from './pages/TicketPage';
import DashboardPage from './pages/DashboardPage';
import LeaderboardPage from './pages/LeaderboardPage';
import './index.css';

function App() {
  const { isConnected } = useSSE();

  return (
    <BrowserRouter>
      <div className="app-layout">
        <nav className="app-navbar animate-fade-up">
          <div className="flex items-center gap-2">
            <span style={{ fontSize: '1.5rem', fontWeight: 600, letterSpacing: '-0.02em', fontStyle: 'italic', fontFamily: 'var(--font-serif)' }}>
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
            <NavLink to="/report" className={({ isActive }) => `btn btn-primary`}>
              Report Issue
            </NavLink>
            
            <div className="flex items-center gap-2 text-xs" style={{ marginLeft: 'var(--space-4)' }}>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: isConnected ? 'var(--success)' : 'var(--ink-muted)',
                  display: 'inline-block',
                }}
              />
              <span className="text-muted">
                {isConnected ? 'LIVE' : 'OFFLINE'}
              </span>
            </div>
          </div>
        </nav>

        <main className="app-main animate-fade-up stagger-1">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/report" element={<ReportPage />} />
            <Route path="/ticket/:id" element={<TicketPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
