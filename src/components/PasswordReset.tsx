import { AlertCircle, CheckCircle2, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import React, { useState } from 'react';

import type { AppUser } from '../types';

import logoFull from '../assets/harisco-full-logo.png';

const MIN_PASSWORD_LENGTH = 8;

interface PasswordToggleProps {
  visible: boolean;
  onMouseDown: () => void;
  onMouseUp: () => void;
}

const PasswordToggle: React.FC<PasswordToggleProps> = ({ visible, onMouseDown, onMouseUp }) => (
  <button
    type="button"
    onMouseDown={onMouseDown}
    onMouseUp={onMouseUp}
    onMouseLeave={onMouseUp}
    style={{
      position: 'absolute',
      right: '12px',
      top: '50%',
      transform: 'translateY(-50%)',
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      color: 'var(--text-muted)',
      display: 'flex',
      alignItems: 'center',
      padding: '4px',
      borderRadius: '4px',
      userSelect: 'none',
    }}
    aria-label={visible ? 'Hide password' : 'Show password'}
  >
    {visible ? <EyeOff size={16} /> : <Eye size={16} />}
  </button>
);

interface PasswordResetProps {
  token: string;
  currentUser: AppUser;
  onResetSuccess: (newToken: string, updatedUser: AppUser) => void;
}

export const PasswordReset: React.FC<PasswordResetProps> = ({ token, currentUser, onResetSuccess }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const passwordsMatch = password.length > 0 && confirmPassword.length > 0 && password === confirmPassword;
  const passwordLongEnough = password.length >= MIN_PASSWORD_LENGTH;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!passwordLongEnough) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to reset password.');
      }

      onResetSuccess(data.token, data.user);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Server error. Please try again.';
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo-container">
          <img src={logoFull} alt="Haris & Co Logo" />
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '6px',
            justifyContent: 'center',
          }}
        >
          <ShieldCheck size={20} style={{ color: 'var(--color-primary)' }} />
          <h2 className="login-title" style={{ margin: 0 }}>
            Set New Password
          </h2>
        </div>

        <p className="login-subtitle" style={{ marginBottom: '24px' }}>
          Welcome, <strong>{currentUser.name}</strong>. For security, please set a new password before continuing.
        </p>

        {error && (
          <div className="login-error" style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="reset-new-password" className="form-label">
              New Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="reset-new-password"
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                style={{ paddingRight: '42px', backgroundColor: 'var(--bg-primary)' }}
                placeholder="Minimum 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
              <PasswordToggle
                visible={showPassword}
                onMouseDown={() => setShowPassword(true)}
                onMouseUp={() => setShowPassword(false)}
              />
            </div>
            {password.length > 0 && (
              <p
                style={{
                  fontSize: '0.75rem',
                  marginTop: '4px',
                  color: passwordLongEnough ? 'var(--status-closed)' : 'var(--status-open)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                {passwordLongEnough ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                {passwordLongEnough ? 'Length requirement met' : `At least ${MIN_PASSWORD_LENGTH} characters required`}
              </p>
            )}
          </div>

          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label htmlFor="reset-confirm-password" className="form-label">
              Confirm Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="reset-confirm-password"
                type={showConfirm ? 'text' : 'password'}
                className="form-input"
                style={{ paddingRight: '42px', backgroundColor: 'var(--bg-primary)' }}
                placeholder="Re-enter your new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
              <PasswordToggle
                visible={showConfirm}
                onMouseDown={() => setShowConfirm(true)}
                onMouseUp={() => setShowConfirm(false)}
              />
            </div>
            {confirmPassword.length > 0 && (
              <p
                style={{
                  fontSize: '0.75rem',
                  marginTop: '4px',
                  color: passwordsMatch ? 'var(--status-closed)' : 'var(--status-open)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                {passwordsMatch ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
              </p>
            )}
          </div>

          <button
            id="btn-reset-password-submit"
            type="submit"
            className="btn btn-primary"
            style={{
              width: '100%',
              height: '42px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '8px',
            }}
            disabled={loading || !passwordLongEnough || !passwordsMatch}
          >
            {loading ? 'Saving...' : 'Set Password & Continue'}
            {!loading && <ShieldCheck size={16} />}
          </button>
        </form>
      </div>
    </div>
  );
};
