import React, { useState } from "react";
import logoFull from "../assets/harisco-full-logo.png";
import { User, Lock, ArrowRight, AlertCircle } from "lucide-react";
import type { AppUser } from "../types";

interface LoginProps {
  onLoginSuccess: (token: string, user: AppUser) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Login failed. Please check your credentials.",
        );
      }

      onLoginSuccess(data.token, data.user);
    } catch (err: any) {
      setError(err.message || "Server error. Please try again.");
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
        <p className="login-subtitle">
          Sign in to raise issues regarding IT equipment.
        </p>

        {error && (
          <div
            className="login-error"
            style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}
          >
            <AlertCircle
              size={16}
              style={{ flexShrink: 0, marginTop: "2px" }}
            />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="login-username" className="form-label">
              Username
            </label>
            <div style={{ position: "relative" }}>
              <input
                id="login-username"
                type="text"
                className="form-input"
                style={{
                  paddingLeft: "38px",
                  backgroundColor: "var(--bg-primary)",
                }}
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
              <User
                size={16}
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-muted)",
                }}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: "24px" }}>
            <label htmlFor="login-password" className="form-label">
              Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                id="login-password"
                type="password"
                className="form-input"
                style={{
                  paddingLeft: "38px",
                  backgroundColor: "var(--bg-primary)",
                }}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <Lock
                size={16}
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-muted)",
                }}
              />
            </div>
          </div>

          <button
            id="btn-login-submit"
            type="submit"
            className="btn btn-primary"
            style={{
              width: "100%",
              height: "42px",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: "8px",
            }}
            disabled={loading}
          >
            {loading ? "Authenticating..." : "Sign In"}
            {!loading && <ArrowRight size={16} />}
          </button>
        </form>
      </div>
    </div>
  );
};
