import { AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react';
import React, { useState } from 'react';

import type { AppUser } from '../../types';

import logoFull from '../../assets/harisco-full-logo.png';
import '../../index.css';
import './PasswordReset.css';
import { PasswordToggle } from './PasswordToggle';

const MIN_PASSWORD_LENGTH = 8;

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

        <div className="password-reset-header">
          <ShieldCheck size={20} className="password-reset-header-icon" />
          <h2 className="login-title password-reset-title">Set New Password</h2>
        </div>

        <p className="login-subtitle password-reset-subtitle">
          Welcome, <strong>{currentUser.name}</strong>. For security, please set a new password before continuing.
        </p>

        {error && (
          <div className="login-error">
            <AlertCircle size={16} className="login-error-icon" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="reset-new-password" className="form-label">
              New Password
            </label>
            <div className="password-wrapper">
              <input
                id="reset-new-password"
                type={showPassword ? 'text' : 'password'}
                className="form-input password-input"
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
              <p className={`password-hint ${passwordLongEnough ? 'password-hint-success' : 'password-hint-error'}`}>
                {passwordLongEnough ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                {passwordLongEnough ? 'Length requirement met' : `At least ${MIN_PASSWORD_LENGTH} characters required`}
              </p>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="reset-confirm-password" className="form-label">
              Confirm Password
            </label>
            <div className="password-wrapper">
              <input
                id="reset-confirm-password"
                type={showConfirm ? 'text' : 'password'}
                className="form-input password-input"
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
              <p className={`password-hint ${passwordsMatch ? 'password-hint-success' : 'password-hint-error'}`}>
                {passwordsMatch ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
              </p>
            )}
          </div>

          <button
            id="btn-reset-password-submit"
            type="submit"
            className="btn btn-primary reset-submit-btn"
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
