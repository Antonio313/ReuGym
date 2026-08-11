import { useState } from 'react';

const MIN_LENGTH = 8;

type Props = {
  onSubmit: (password: string) => Promise<void>;
  submitLabel: string;
  loadingLabel: string;
};

export function PasswordForm({ onSubmit, submitLabel, loadingLabel }: Props) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      await onSubmit(password);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    background: 'var(--color-surface)',
    border: 'var(--border-thin)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--color-text)',
    fontSize: 'var(--text-body)',
    outline: 'none',
  } as const;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <p
          className="font-body mb-1 uppercase tracking-widest"
          style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}
        >
          New password
        </p>
        <input
          type="password"
          autoComplete="new-password"
          autoFocus
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(null); }}
          placeholder="••••••••"
          className="w-full px-4 py-3 font-body"
          style={inputStyle}
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
          style={inputStyle}
        />
      </div>

      {error && (
        <p className="font-body" style={{ fontSize: 'var(--text-meta)', color: 'var(--color-regression)' }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || !password || !confirmPassword}
        className="w-full py-4 font-display uppercase tracking-wide"
        style={{
          fontSize: 'var(--text-h2)',
          background: loading || !password || !confirmPassword ? 'var(--color-surface-2)' : 'var(--color-accent)',
          color: loading || !password || !confirmPassword ? 'var(--color-text-muted)' : '#fff',
          borderRadius: 'var(--radius-md)',
          border: 'none',
          letterSpacing: '0.05em',
        }}
      >
        {loading ? loadingLabel : submitLabel}
      </button>
    </form>
  );
}
