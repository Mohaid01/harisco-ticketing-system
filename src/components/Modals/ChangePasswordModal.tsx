import { Key, X } from 'lucide-react';
import React, { useState } from 'react';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen, onClose, token }) => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const oldPass = oldPassword.trim();
    const newPass = newPassword.trim();
    const confirmPass = confirmPassword.trim();

    if (!oldPass || !newPass || !confirmPass) {
      setErrorMsg('All fields are required.');
      return;
    }

    if (newPass.length < 4) {
      setErrorMsg('New password must be at least 4 characters long.');
      return;
    }

    if (newPass !== confirmPass) {
      setErrorMsg('New passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ oldPassword: oldPass, newPassword: newPass }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to change password.');
      }

      setSuccessMsg('Password updated successfully!');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');

      // Auto close after 1.5 seconds
      setTimeout(() => {
        onClose();
        setSuccessMsg(null);
      }, 1500);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '23.9063rem' }}>
        <div
          className="panel-header"
          style={{ padding: '1.0625rem 1.275rem', borderBottom: '0.0531rem solid var(--border-color)', margin: 0 }}
        >
          <h2
            className="panel-title"
            style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.425rem' }}
          >
            <Key size={18} />
            Reset Password
          </h2>
          <button
            id="btn-password-modal-close"
            className="btn btn-secondary"
            style={{ width: '1.7rem', height: '1.7rem', padding: 0, borderRadius: '50%' }}
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ padding: '1.275rem' }}>
            {errorMsg && (
              <div
                style={{
                  backgroundColor: 'rgba(244, 63, 94, 0.15)',
                  border: '0.0531rem solid rgba(244, 63, 94, 0.3)',
                  color: '#f43f5e',
                  padding: '0.5313rem 0.7438rem',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '0.85rem',
                  fontSize: '0.85rem',
                }}
              >
                {errorMsg}
              </div>
            )}

            {successMsg && (
              <div
                style={{
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  border: '0.0531rem solid rgba(16, 185, 129, 0.3)',
                  color: '#10b981',
                  padding: '0.5313rem 0.7438rem',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '0.85rem',
                  fontSize: '0.85rem',
                }}
              >
                {successMsg}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="old-password-input" className="form-label">
                Current Password
              </label>
              <input
                id="old-password-input"
                type="password"
                className="form-input"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="new-password-input" className="form-label">
                New Password
              </label>
              <input
                id="new-password-input"
                type="password"
                className="form-input"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="confirm-password-input" className="form-label">
                Confirm New Password
              </label>
              <input
                id="confirm-password-input"
                type="password"
                className="form-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <div
            style={{
              padding: '0.85rem 1.275rem',
              borderTop: '0.0531rem solid var(--border-color)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.6375rem',
            }}
          >
            <button
              id="btn-password-modal-cancel"
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button id="btn-password-modal-submit" type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
