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
  const [loginMode, setLoginMode] = useState<'employee_id' | 'username'>('employee_id');
  const [employeeCode, setEmployeeCode] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      let loginUsername: string;
      if (loginMode === 'employee_id') {
        loginUsername = `${EMPLOYEE_ID_PREFIX}${employeeCode}`;
      } else {
        loginUsername = username.trim();
      }

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: loginUsername,
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
      const errMsg = (err as Error).message || 'Unknown error.';
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleEmployeeCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '');
    setEmployeeCode(val);
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUsername(e.target.value);
  };

  const switchMode = (mode: 'employee_id' | 'username') => {
    setLoginMode(mode);
    setError(null);
    setEmployeeCode('');
    setUsername('');
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo-container">
          <img src={logoFull} alt="Haris & Co Logo" />
        </div>

        <h2 className="login-title">Ticketing System</h2>
        <p className="login-subtitle">Sign in to raise issues regarding IT equipment.</p>

        {/* Login Mode Toggle */}
        <div className="login-mode-toggle">
          <button
            type="button"
            className={`login-mode-btn ${loginMode === 'employee_id' ? 'active' : ''}`}
            onClick={() => switchMode('employee_id')}
          >
            Employee ID
          </button>
          <button
            type="button"
            className={`login-mode-btn ${loginMode === 'username' ? 'active' : ''}`}
            onClick={() => switchMode('username')}
          >
            Username
          </button>
        </div>

        {error && (
          <div className="login-error">
            <AlertCircle size={16} className="login-error-icon" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="login-username" className="form-label">
              {loginMode === 'employee_id' ? 'Employee ID' : 'Username'}
            </label>
            {loginMode === 'employee_id' ? (
              <div className="login-input-group">
                <span className="login-input-prefix">{EMPLOYEE_ID_PREFIX}</span>
                <input
                  id="login-username"
                  type="text"
                  className="form-input login-input-with-prefix"
                  placeholder="12345"
                  maxLength={5}
                  value={employeeCode}
                  onChange={handleEmployeeCodeChange}
                  required
                />
              </div>
            ) : (
              <div className="login-input-group">
                <input
                  id="login-username"
                  type="text"
                  className="form-input login-input-with-icon"
                  placeholder="your_username"
                  value={username}
                  onChange={handleUsernameChange}
                  required
                />
                <Lock size={16} className="login-input-icon" />
              </div>
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
                placeholder="••••••••"
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
