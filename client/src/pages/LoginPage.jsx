import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/AuthContext';
import { useToast } from '../hooks/useToast.jsx';
import InteractiveCommunity from '../components/agent/InteractiveCommunity';
import { auth, googleProvider } from '../firebase';
import { signInWithPopup } from 'firebase/auth';
import { PinIcon, RobotIcon, TrophyMiniIcon, TargetIcon } from '../components/ui/PixelIcons';

const FEATURES = [
  { icon: <PinIcon width={20} height={20} />, text: 'Live issue map with real-time SSE updates' },
  { icon: <RobotIcon width={20} height={20} />, text: 'Agentic AI pipeline classifies & prioritizes reports' },
  { icon: <TrophyMiniIcon width={20} height={20} />, text: 'Earn XP & climb the Hero League leaderboard' },
  { icon: <TargetIcon width={20} height={20} />, text: 'City-wide SLA dashboard & ward health analytics' },
];

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { login, register } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) { toast('Please enter both email and password', 'error'); return; }
    setSubmitting(true);
    try {
      await login(email, password);
      setIsSuccess(true);
      toast('Welcome back, Agent!', 'success');
      setTimeout(() => navigate('/'), 1500);
    } catch (err) {
      toast(err.message || 'Login failed', 'error');
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setSubmitting(true);
    toast('Opening Google Authentication...', 'info');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const gEmail = user.email;
      const displayName = user.displayName || 'Google User';
      if (!gEmail) throw new Error('Google Auth did not provide an email address');
      toast('Google Auth verified. Synchronizing session...', 'info');
      const pass = `google-auth-${gEmail.replace(/[^a-zA-Z0-9]/g, '')}`;
      try { await register(gEmail, pass, displayName); } catch { await login(gEmail, pass); }
      setIsSuccess(true);
      toast(`Successfully logged in as ${displayName}!`, 'success');
      setTimeout(() => navigate('/'), 1500);
    } catch (err) {
      console.error(err);
      if (err.message && (err.message.includes('identity-toolkit-api') || err.message.includes('disabled') || err.message.includes('operation-not-allowed'))) {
        toast('Google Identity API disabled. Activating demo mode...', 'warning');
        setTimeout(async () => {
          try {
            const uniqueId = Math.floor(Math.random() * 1000000);
            const fallbackEmail = `google.hero.${uniqueId}@gmail.com`;
            const pass = `google-auth-fallback-${uniqueId}`;
            await register(fallbackEmail, pass, 'Google Hero');
            setIsSuccess(true);
            toast('Successfully logged in (Demo Mode)!', 'success');
            setTimeout(() => navigate('/'), 1500);
          } catch (fallbackErr) {
            toast('Demo auth failed: ' + fallbackErr.message, 'error');
            setSubmitting(false);
          }
        }, 1500);
      } else {
        toast(err.message || 'Google Auth failed', 'error');
        setSubmitting(false);
      }
    }
  };

  return (
    <div className="auth-layout" role="main">
      <div className="card rpg-panel rpg-panel-sandstone auth-tablet">
        {/* Left: Storytelling panel */}
        <div className="auth-story-side" aria-hidden="true">
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <span className="story-banner-tag">CITIZEN VIGILANTAE</span>
        </div>
        <h1 className="auth-story-headline">
          Your city has<br />
          <em>issues.</em><br />
          Let's fix them.
        </h1>
        <p className="auth-story-body">
          Citizen Vigilantae is a hyperlocal intelligence platform where citizens report,
          verify, and track community problems — powered by agentic AI that works
          24/7 to route, prioritize, and resolve issues before they escalate.
        </p>
        <div className="auth-feature-list" role="list">
          {FEATURES.map((f, i) => (
            <div key={i} className="auth-feature-item" role="listitem">
              <div className="auth-feature-icon" aria-hidden="true">{f.icon}</div>
              <span>{f.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right: Auth form */}
      <div className="card pixel-border auth-parchment-form">
        <InteractiveCommunity isPasswordFocused={isPasswordFocused} isSuccess={isSuccess} />

        <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
          <span className="font-mono text-xs text-accent" style={{ textTransform: 'uppercase', letterSpacing: '0.12em' }}>
            Tactical Command Auth
          </span>
          <h2 style={{ fontSize: '1.6rem', marginTop: 'var(--space-2)', fontStyle: 'italic' }}>
            Vigilante Access
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
          <div className="flex flex-col gap-1">
            <label htmlFor="login-email" className="text-xs text-muted font-mono" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Email address
            </label>
            <input
              id="login-email"
              type="email"
              placeholder="hero@lucknow.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting || isSuccess}
              autoComplete="email"
              style={{ borderRadius: 0, padding: '8px 12px' }}
              required
              aria-required="true"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="login-password" className="text-xs text-muted font-mono" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Password
            </label>
            <input
              id="login-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setIsPasswordFocused(true)}
              onBlur={() => setIsPasswordFocused(false)}
              disabled={submitting || isSuccess}
              autoComplete="current-password"
              style={{ borderRadius: 0, padding: '8px 12px' }}
              required
              aria-required="true"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting || isSuccess}
            style={{ padding: '10px 20px', borderRadius: 0, width: '100%', justifyContent: 'center', fontWeight: 700, marginTop: 'var(--space-1)', fontSize: '0.9rem' }}
            aria-label={isSuccess ? 'Access granted, redirecting' : submitting ? 'Authenticating, please wait' : 'Sign in to Citizen Vigilantae'}
          >
            {isSuccess ? '✓ Access Granted' : submitting ? 'Authenticating…' : 'Enter Console'}
          </button>
        </form>

        <div className="flex items-center gap-4" style={{ margin: 'var(--space-4) 0' }} role="separator">
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <span className="text-xs text-muted font-mono">OR</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        <button
          type="button"
          className="btn btn-secondary flex items-center justify-center gap-2"
          onClick={handleGoogleLogin}
          disabled={submitting || isSuccess}
          style={{ padding: '12px 20px', borderRadius: 0, width: '100%', fontWeight: 600 }}
          aria-label="Continue with Google account"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        <p style={{ textAlign: 'center', marginTop: 'var(--space-6)', fontSize: '0.875rem' }}>
          <span className="text-muted">New recruit? </span>
          <Link to="/register" style={{ color: 'var(--accent)', fontWeight: 600 }}>
            Register here
          </Link>
        </p>
      </div>
    </div>
  </div>
  );
}

export default LoginPage;