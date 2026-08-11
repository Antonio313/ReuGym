import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

const MIN_LENGTH = 8;

export default function SignUp() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmEmailSent, setConfirmEmailSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setError(null);
    if (password.length < MIN_LENGTH) {
      setError(`Password must be at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords don’t match.');
      return;
    }
    setLoading(true);
    try {
      const result = await signUp(email, password);
      if (result.status === 'confirm_email') {
        setConfirmEmailSent(true);
      } else {
        navigate('/');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      setError(msg === 'ALREADY_EXISTS' ? 'ALREADY_EXISTS' : 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex flex-col justify-center min-h-dvh px-6 gap-8 mx-auto"
      style={{ maxWidth: 'var(--max-content-width)', background: 'var(--color-bg)' }}
    >
      <div>
        <h1
          className="font-display mb-2"
          style={{ fontSize: 'clamp(2.5rem, 12vw, 4rem)', color: 'var(--color-text)', letterSpacing: '0.03em' }}
        >
          REUGYM
        </h1>
        <p className="font-body" style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}>
          {confirmEmailSent ? 'Almost there' : 'Create your account'}
        </p>
      </div>

      {confirmEmailSent ? (
        <p className="font-body" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}>
          Check your email for a confirmation link before signing in.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <p
              className="font-body mb-1 uppercase tracking-widest"
              style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}
            >
              Email
            </p>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(null); }}
              placeholder="you@example.com"
              className="w-full px-4 py-3 font-body"
              style={{
                background: 'var(--color-surface)',
                border: 'var(--border-thin)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-text)',
                fontSize: 'var(--text-body)',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <p
              className="font-body mb-1 uppercase tracking-widest"
              style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}
            >
              Password
            </p>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(null); }}
              placeholder="••••••••"
              className="w-full px-4 py-3 font-body"
              style={{
                background: 'var(--color-surface)',
                border: 'var(--border-thin)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-text)',
                fontSize: 'var(--text-body)',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <p
              className="font-body mb-1 uppercase tracking-widest"
              style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}
            >
              Confirm password
            </p>
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setError(null); }}
              placeholder="••••••••"
              className="w-full px-4 py-3 font-body"
              style={{
                background: 'var(--color-surface)',
                border: 'var(--border-thin)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-text)',
                fontSize: 'var(--text-body)',
                outline: 'none',
              }}
            />
          </div>

          {error === 'ALREADY_EXISTS' && (
            <p className="font-body" style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}>
              Email already registered.{' '}
              <Link to="/signin" style={{ color: 'var(--color-accent)' }}>Sign in →</Link>
            </p>
          )}
          {error && error !== 'ALREADY_EXISTS' && (
            <p className="font-body" style={{ fontSize: 'var(--text-meta)', color: 'var(--color-regression)' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !email.trim() || !password}
            className="w-full py-4 font-display uppercase tracking-wide"
            style={{
              fontSize: 'var(--text-h2)',
              background: loading || !email.trim() || !password ? 'var(--color-surface-2)' : 'var(--color-accent)',
              color: loading || !email.trim() || !password ? 'var(--color-text-muted)' : '#fff',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              letterSpacing: '0.05em',
            }}
          >
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>
      )}

      <p className="font-body text-center" style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}>
        Already have an account?{' '}
        <Link to="/signin" style={{ color: 'var(--color-accent)' }}>Sign in</Link>
      </p>
    </div>
  );
}
