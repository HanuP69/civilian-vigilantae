import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/AuthContext';
import { useToast } from '../hooks/useToast.jsx';
import InteractiveCommunity from '../components/agent/InteractiveCommunity';

function RegisterPage() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { register } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!displayName || !email || !password) {
      toast('Please fill out all required fields', 'error');
      return;
    }

    if (password !== confirmPassword) {
      toast('Passwords do not match', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await register(email, password, displayName);
      setIsSuccess(true);
      toast('Civic Hero Account created! Welcome aboard!', 'success');
      setTimeout(() => {
        navigate('/');
      }, 1500);
    } catch (err) {
      toast(err.message || 'Registration failed', 'error');
      setSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 200px)' }}>
      <div className="card" style={{ width: '100%', maxWidth: '420px', padding: 'var(--space-6) var(--space-7)', position: 'relative' }}>
        <InteractiveCommunity isPasswordFocused={isPasswordFocused} isSuccess={isSuccess} />
        
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
          <span className="font-mono text-xs" style={{ color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            New Recruit Registration
          </span>
          <h2 style={{ fontSize: '1.75rem', marginTop: 'var(--space-2)' }}>Join Sentinel Civic</h2>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted font-mono" style={{ textTransform: 'uppercase' }}>Hero Username</label>
            <input
              type="text"
              placeholder="e.g. Commander_Amit"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={submitting || isSuccess}
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
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
                borderRadius: 'var(--radius-md)',
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
                borderRadius: 'var(--radius-md)',
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
            <label className="text-xs text-muted font-mono" style={{ textTransform: 'uppercase' }}>Confirm Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onFocus={() => setIsPasswordFocused(true)}
              onBlur={() => setIsPasswordFocused(false)}
              disabled={submitting || isSuccess}
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
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
              borderRadius: 'var(--radius-md)',
              width: '100%',
              justifyContent: 'center',
              fontWeight: 600,
              marginTop: 'var(--space-2)'
            }}
          >
            {isSuccess ? 'Hero Registered!' : submitting ? 'Registering...' : 'Initialize Hero'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 'var(--space-6)', fontSize: '0.85rem' }}>
          <span className="text-muted">Already registered? </span>
          <Link to="/login" style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>
            Login here
          </Link>
        </div>
      </div>
    </div>
  );
}

export default RegisterPage;
