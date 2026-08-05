import { AlertCircle, ArrowRight, Lock } from 'lucide-react';
import React, { useState } from 'react';
import logoFull from '../assets/harisco-full-logo.png';
import { EMPLOYEE_ID_PREFIX } from '../constants';
import type { AppUser } from '../types';

interface LoginProps {
  onLoginSuccess: (token: string, user: AppUser) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [employeeCode, setEmployeeCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: `${EMPLOYEE_ID_PREFIX}${employeeCode}`,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed. Please check your credentials.');
      }

      onLoginSuccess(data.token, data.user);
    } catch (err) {
      console.error(err);
      const errMsg = (err as Error).message || 'Unkown error.';
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

        <h2 className="login-title">Ticketing System</h2>
        <p className="login-subtitle">Sign in to raise issues regarding IT equipment.</p>

        {error && (
          <div className="login-error" style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="login-username" className="form-label">
              Employee ID
            </label>
            <div style={{ position: 'relative', display: 'flex' }}>
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 12px',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRight: 'none',
                  borderRadius: '8px 0 0 8px',
                  color: 'var(--text-muted)',
                  fontWeight: 600,
                  fontSize: '14px',
                  userSelect: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                {EMPLOYEE_ID_PREFIX}
              </span>
              <input
                id="login-username"
                type="text"
                className="form-input"
                style={{
                  borderRadius: '0 8px 8px 0',
                  backgroundColor: 'var(--bg-primary)',
                  flex: 1,
                }}
                placeholder="12345"
                maxLength={5}
                value={employeeCode}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  setEmployeeCode(val);
                }}
                required
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label htmlFor="login-password" className="form-label">
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="login-password"
                type="password"
                className="form-input"
                style={{
                  paddingLeft: '38px',
                  backgroundColor: 'var(--bg-primary)',
                }}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <Lock
                size={16}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
            </div>
          </div>

          <button
            id="btn-login-submit"
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
            disabled={loading}
          >
            {loading ? 'Authenticating...' : 'Sign In'}
            {!loading && <ArrowRight size={16} />}
          </button>
        </form>
      </div>
    </div>
  );
};
