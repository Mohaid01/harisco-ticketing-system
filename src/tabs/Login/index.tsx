import { AlertCircle, ArrowRight, Lock } from 'lucide-react';
import React, { useState } from 'react';

import type { AppUser } from '../../types';

import logoFull from '../../assets/harisco-full-logo.png';
import { EMPLOYEE_ID_PREFIX } from '../../constants';
import './Login.css';

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
          <div className="login-error">
            <AlertCircle size={16} className="login-error-icon" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="login-username" className="form-label">
              Employee ID
            </label>
            <div className="login-input-group">
              <span className="login-input-prefix">
                {EMPLOYEE_ID_PREFIX}
              </span>
              <input
                id="login-username"
                type="text"
                className="form-input login-input-with-prefix"
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

          <div className="form-group">
            <label htmlFor="login-password" className="form-label">
              Password
            </label>
            <div className="login-input-group">
              <input
                id="login-password"
                type="password"
                className="form-input login-input-with-icon"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <Lock size={16} className="login-input-icon" />
            </div>
          </div>

          <button
            id="btn-login-submit"
            type="submit"
            className="btn btn-primary login-submit-btn"
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
