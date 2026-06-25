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
        <nav className="app-navbar">
          <div className="flex items-center gap-3">
            <span style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.03em' }}>
              SENTINEL
            </span>
            <span className="badge" style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>
              CIVIC
            </span>
          </div>
          <div style={{ marginLeft: 'auto' }} className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm">
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: isConnected ? 'var(--success)' : 'var(--ink-muted)',
                  display: 'inline-block',
                }}
              />
              <span className="text-secondary">
                {isConnected ? 'Live' : 'Offline'}
              </span>
            </div>
          </div>
        </nav>

        <aside className="app-sidebar">
          <span className="sidebar-section-label">Navigation</span>
          <NavLink to="/" end className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
            <span>🗺️</span> Map
          </NavLink>
          <NavLink to="/dashboard" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
            <span>📊</span> Dashboard
          </NavLink>
          <NavLink to="/leaderboard" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
            <span>🏆</span> Leaderboard
          </NavLink>
          <span className="sidebar-section-label">Actions</span>
          <NavLink to="/report" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
            <span>➕</span> Report Issue
          </NavLink>
        </aside>

        <main className="app-main">
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
