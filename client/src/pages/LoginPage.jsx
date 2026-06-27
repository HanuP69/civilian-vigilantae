import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/AuthContext';
import { useToast } from '../hooks/useToast.jsx';
import InteractiveCommunity from '../components/agent/InteractiveCommunity';
import { auth, googleProvider } from '../firebase';
import { signInWithPopup } from 'firebase/auth';

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
    if (!email || !password) {
      toast('Please enter both email and password', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await login(email, password);
      setIsSuccess(true);
      toast('Welcome back, Agent!', 'success');
      setTimeout(() => {
        navigate('/');
      }, 1500);
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

      if (!gEmail) {
        throw new Error('Google Auth did not provide an email address');
      }

      toast('Google Auth verified. Synchronizing session...', 'info');
      const pass = `google-auth-${gEmail.replace(/[^a-zA-Z0-9]/g, '')}`;
      try {
        await register(gEmail, pass, displayName);
      } catch {
        await login(gEmail, pass);
      }
      setIsSuccess(true);
      toast(`Successfully logged in as ${displayName}!`, 'success');
      setTimeout(() => {
        navigate('/');
      }, 1500);
    } catch (err) {
      console.error(err);
      toast(err.message || 'Google Auth failed', 'error');
      setSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 200px)' }}>
      <div className="card rpg-panel" style={{ width: '100%', maxWidth: '420px', padding: 'var(--space-6) var(--space-7)', position: 'relative', borderRadius: 0 }}>
        <InteractiveCommunity isPasswordFocused={isPasswordFocused} isSuccess={isSuccess} />
        
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
          <span className="font-mono text-xs" style={{ color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Tactical Command Auth
          </span>
          <h2 style={{ fontSize: '1.75rem', marginTop: 'var(--space-2)' }}>Sentinel Access</h2>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted font-mono" style={{ textTransform: 'uppercase' }}>Email address</label>
            <input
              type="email"
              placeholder="e.g. hero@lucknow.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting || isSuccess}
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 0,
                padding: '12px 14px',
                color: 'var(--ink-primary)',
                outline: 'none',
                fontFamily: 'var(--font-sans)',
                fontSize: '0.9rem'
              }}
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted font-mono" style={{ textTransform: 'uppercase' }}>Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setIsPasswordFocused(true)}
              onBlur={() => setIsPasswordFocused(false)}
              disabled={submitting || isSuccess}
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 0,
                padding: '12px 14px',
                color: 'var(--ink-primary)',
                outline: 'none',
                fontFamily: 'var(--font-sans)',
                fontSize: '0.9rem'
              }}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting || isSuccess}
            style={{
              padding: '12px 20px',
              borderRadius: 0,
              width: '100%',
              justifyContent: 'center',
              fontWeight: 600,
              marginTop: 'var(--space-2)'
            }}
          >
            {isSuccess ? 'Access Granted' : submitting ? 'Authenticating...' : 'Enter Console'}
          </button>
        </form>

        <div className="flex items-center gap-4" style={{ margin: 'var(--space-4) 0' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <span className="text-xs text-muted font-mono">OR</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        <button
          type="button"
          className="btn btn-secondary flex items-center justify-center gap-2"
          onClick={handleGoogleLogin}
          disabled={submitting || isSuccess}
          style={{
            padding: '12px 20px',
            borderRadius: 0,
            width: '100%',
            fontWeight: 600,
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid var(--border)',
            color: 'var(--ink-secondary)',
            fontSize: '0.9rem'
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ marginRight: '6px' }}>
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        <div style={{ textAlign: 'center', marginTop: 'var(--space-6)', fontSize: '0.85rem' }}>
          <span className="text-muted">New recruit? </span>
          <Link to="/register" style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>
            Register here
          </Link>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
