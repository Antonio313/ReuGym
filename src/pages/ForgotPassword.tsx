import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

export default function ForgotPassword() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await resetPassword(email);
      setSent(true);
    } catch {
      setError('Something went wrong. Try again.');
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
          style={{ fontSize: 'clamp(2rem, 10vw, 3rem)', color: 'var(--color-text)', letterSpacing: '0.03em' }}
        >
          RESET PASSWORD
        </h1>
        <p className="font-body" style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}>
          {sent
            ? 'Check your email for a link to set a new password.'
            : "We'll email you a link to set a new password."}
        </p>
      </div>

      {!sent && (
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

          {error && (
            <p className="font-body" style={{ fontSize: 'var(--text-meta)', color: 'var(--color-regression)' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !email.trim()}
            className="w-full py-4 font-display uppercase tracking-wide"
            style={{
              fontSize: 'var(--text-h2)',
              background: loading || !email.trim() ? 'var(--color-surface-2)' : 'var(--color-accent)',
              color: loading || !email.trim() ? 'var(--color-text-muted)' : '#fff',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              letterSpacing: '0.05em',
            }}
          >
            {loading ? 'Sending…' : 'Send Reset Link'}
          </button>
        </form>
      )}

      <p className="font-body text-center" style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}>
        <Link to="/signin" style={{ color: 'var(--color-accent)' }}>← Back to sign in</Link>
      </p>
    </div>
  );
}
