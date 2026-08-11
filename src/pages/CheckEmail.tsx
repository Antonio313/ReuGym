import { useLocation, Link } from 'react-router-dom';

export default function CheckEmail() {
  const location = useLocation();
  const email = (location.state as { email?: string } | null)?.email;

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
          Almost there
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="font-display" style={{ fontSize: 'var(--text-h1)', color: 'var(--color-text)' }}>
          Check your email
        </h2>
        <p className="font-body" style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)', lineHeight: 1.5 }}>
          {email ? (
            <>
              We sent a confirmation link to{' '}
              <span className="font-mono" style={{ color: 'var(--color-text)' }}>{email}</span>. Click it to verify
              your account — you'll be signed in automatically.
            </>
          ) : (
            "We sent a confirmation link to your email. Click it to verify your account — you'll be signed in automatically."
          )}
        </p>
        <p className="font-body" style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}>
          Didn't get it? Check your spam folder, or wait a minute and sign up again with the same email to resend it.
        </p>
      </div>

      <p className="font-body text-center" style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}>
        <Link to="/signin" style={{ color: 'var(--color-accent)' }}>Back to sign in</Link>
      </p>
    </div>
  );
}
