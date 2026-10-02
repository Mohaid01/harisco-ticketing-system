import { AlertCircle, ArrowRight, Lock, User } from 'lucide-react';
import React, { useState } from 'react';

import type { AppUser } from '../../types';

import logoFull from '../../assets/harisco-full-logo.png';
import { EMPLOYEE_ID_PREFIX } from '../../constants';
import './Login.css';

interface LoginProps {
  onLoginSuccess: (token: string, user: AppUser) => void;
}

type LoginMode = 'employee_id' | 'username';

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [loginMode, setLoginMode] = useState<LoginMode>('employee_id');
  const [codeOrUsername, setCodeOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const finalUsername =
      loginMode === 'employee_id' ? `${EMPLOYEE_ID_PREFIX}${codeOrUsername}` : codeOrUsername;

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: finalUsername,
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (loginMode === 'employee_id') {
      const val = e.target.value.replace(/\D/g, '').slice(0, 5);
      setCodeOrUsername(val);
    } else {
      setCodeOrUsername(e.target.value);
    }
  };

  const handleModeChange = (mode: LoginMode) => {
    setLoginMode(mode);
    setCodeOrUsername('');
    setError(null);
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
          <div className="login-error">
            <AlertCircle size={16} className="login-error-icon" />
            <span>{error}</span>
          </div>
        )}

        <div className="login-mode-toggle">
          <button
            type="button"
            className={`login-mode-btn ${loginMode === 'employee_id' ? 'active' : ''}`}
            onClick={() => handleModeChange('employee_id')}
          >
            Employee ID
          </button>
          <button
            type="button"
            className={`login-mode-btn ${loginMode === 'username' ? 'active' : ''}`}
            onClick={() => handleModeChange('username')}
          >
            Username
          </button>
        </div>

        <form onSubmit={handleLogin}>
          <div className="form-group">
            {loginMode === 'employee_id' ? (
              <>
                <label htmlFor="login-username" className="form-label">
                  Employee ID
                </label>
                <div className="login-input-group">
                  <span className="login-input-prefix">{EMPLOYEE_ID_PREFIX}</span>
                  <input
                    id="login-username"
                    type="text"
                    className="form-input login-input-with-prefix"
                    placeholder="12345"
                    maxLength={5}
                    value={codeOrUsername}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </>
            ) : (
              <>
                <label htmlFor="login-username-ext" className="form-label">
                  Username
                </label>
                <div className="login-input-group">
                  <User size={16} className="login-input-icon" />
                  <input
                    id="login-username-ext"
                    type="text"
                    className="form-input login-input-with-icon"
                    placeholder="e.g. external_user"
                    value={codeOrUsername}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </>
            )}
          </div>

          <div className="form-group" style={{ marginTop: '1.0625rem' }}>
            <label htmlFor="login-password" className="form-label">
              Password
            </label>
            <div className="login-input-group">
              <input
                id="login-password"
                type="password"
                className="form-input login-input-with-icon"
                placeholder="&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <Lock size={16} className="login-input-icon" />
            </div>
          </div>

          <button id="btn-login-submit" type="submit" className="btn btn-primary login-submit-btn" disabled={loading}>
            {loading ? 'Authenticating...' : 'Sign In'}
            {!loading && <ArrowRight size={16} />}
          </button>
        </form>
      </div>
    </div>
  );
};
