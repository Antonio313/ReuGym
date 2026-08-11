import { useAuth } from '@/context/AuthContext';
import { PasswordForm } from '@/components/auth/PasswordForm';

export default function SetPassword() {
  const { completePasswordReset } = useAuth();

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
          SET A PASSWORD
        </h1>
        <p className="font-body" style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)' }}>
          Choose a new password to continue. You won't be able to use the app until this is set.
        </p>
      </div>

      <PasswordForm
        onSubmit={completePasswordReset}
        submitLabel="Set Password"
        loadingLabel="Saving…"
      />
    </div>
  );
}
