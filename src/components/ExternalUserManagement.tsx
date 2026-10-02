import { KeyRound, Trash2, UserPlus } from 'lucide-react';
import React, { useState } from 'react';

import type { AppUser } from '../types';

import { ResetUserPasswordModal } from './Modals/ResetUserPasswordModal';
import { UserCarousel } from './UserCarousel';

interface ExternalUserManagementProps {
  users: AppUser[];
  currentUser: AppUser;
  token: string;
  onAddUser: (data: { username: string; password: string }) => void;
  onDeleteUser: (userId: string) => void;
  onUpdateUser?: (userId: string, data: { username: string; password?: string }) => void;
  loading?: boolean;
}

export const ExternalUserManagement: React.FC<ExternalUserManagementProps> = ({
  users,
  currentUser,
  token,
  onAddUser,
  onDeleteUser,
  onUpdateUser,
  loading = false,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [resetPasswordTarget, setResetPasswordTarget] = useState<AppUser | null>(null);

  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!username.trim() || !password.trim()) {
      setErrorMsg('Please supply a username and password.');
      return;
    }

    if (users.some((u) => u.username?.toLowerCase() === username.trim().toLowerCase())) {
      setErrorMsg('A user with this username already exists.');
      return;
    }

    onAddUser({
      username: username.trim(),
      password: password.trim(),
    });

    setUsername('');
    setPassword('');
  };

  const handleSaveEdit = (userId: string) => {
    if (!editUsername.trim()) {
      alert('Username is required.');
      return;
    }
    if (onUpdateUser) {
      onUpdateUser(userId, {
        username: editUsername.trim(),
        password: editPassword.trim() || undefined,
      });
    }
    setEditingUserId(null);
  };

  const startEdit = (user: AppUser) => {
    setEditingUserId(user.id);
    setEditUsername(user.username || '');
    setEditPassword('');
  };

  return (
    <div>
      <div style={{ marginBottom: '1.275rem' }}>
        <h1 className="page-title">External User Management</h1>
        <p className="page-subtitle">Add and manage external user accounts.</p>
      </div>

      <div className="user-mgmt-grid">
        {/* Left Column: Add User Form */}
        <div className="panel" style={{ padding: '1.275rem' }}>
          <h2
            className="panel-title"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.425rem',
              marginBottom: '1.0625rem',
            }}
          >
            <UserPlus size={18} className="status-progress" />
            Add External User
          </h2>

          {errorMsg && (
            <div
              style={{
                backgroundColor: 'rgba(244, 63, 94, 0.15)',
                border: '0.0531rem solid rgba(244, 63, 94, 0.3)',
                color: '#f43f5e',
                padding: '0.5313rem 0.6375rem',
                borderRadius: 'var(--radius-md)',
                marginBottom: '0.85rem',
                fontSize: '0.85rem',
              }}
            >
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="external-username-input" className="form-label">
                Username
              </label>
              <input
                id="external-username-input"
                type="text"
                className="form-input"
                placeholder="e.g. external_user"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <div className="form-group" style={{ marginTop: '1.0625rem' }}>
              <label htmlFor="external-password-input" className="form-label">
                Password
              </label>
              <input
                id="external-password-input"
                type="password"
                className="form-input"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button id="btn-add-external-user-submit" type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1.5938rem' }}>
              Create Account
            </button>
          </form>
        </div>

        {/* Right Column: Users List Grid */}
        <div
          className="panel"
          style={{ padding: '1.275rem', display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}
        >
          <h2 className="panel-title" style={{ marginBottom: '1.0625rem', flexShrink: 0 }}>
            Active External Users ({users.length})
          </h2>

          <UserCarousel loading={loading}>
            {users.map((user) => (
              <div className={`user-card${user.is_active === 0 ? ' user-card--offboarded' : ''}`} key={user.id}>
                {editingUserId === user.id ? (
                  <div
                    style={{
                      width: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5313rem',
                    }}
                  >
                    <div className="form-group" style={{ marginBottom: '0' }}>
                      <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>
                        Username
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        style={{ fontSize: '0.85rem', padding: '6px 10px' }}
                        value={editUsername}
                        onChange={(e) => setEditUsername(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: '0' }}>
                      <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>
                        New Password (leave blank to keep current)
                      </label>
                      <input
                        type="password"
                        className="form-input"
                        style={{ fontSize: '0.85rem', padding: '6px 10px' }}
                        value={editPassword}
                        onChange={(e) => setEditPassword(e.target.value)}
                        placeholder="Optional"
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '0.425rem', width: '100%', marginTop: '0.6375rem' }}>
                      <button
                        className="btn btn-secondary"
                        style={{
                          flex: 1,
                          padding: '0.3188rem 0.5313rem',
                          fontSize: '0.75rem',
                        }}
                        onClick={() => setEditingUserId(null)}
                      >
                        Cancel
                      </button>
                      <button
                        className="btn btn-primary"
                        style={{
                          flex: 1,
                          padding: '0.3188rem 0.5313rem',
                          fontSize: '0.75rem',
                        }}
                        onClick={() => handleSaveEdit(user.id)}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      height: '100%',
                      justifyContent: 'space-between',
                      gap: '1.7rem',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5313rem' }}>
                      <div
                        style={{
                          width: '6.375rem',
                          height: '6.375rem',
                          borderRadius: '50%',
                          backgroundColor: 'var(--color-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '2.4rem',
                          fontWeight: 700,
                          color: 'white',
                        }}
                      >
                        {user.username
                          ?.slice(0, 2)
                          .toUpperCase()}
                      </div>
                      <div
                        style={{
                          width: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.1594rem',
                          textAlign: 'center',
                        }}
                      >
                        <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'white', lineHeight: 1.3 }}>
                          {user.username}
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.425rem',
                        textAlign: 'left',
                      }}
                    >
                      <div style={{ marginTop: '0.2125rem', display: 'flex', justifyContent: 'center' }}>
                        <span className="role-badge-pill role-badge-external" style={{ fontSize: '0.82rem' }}>
                          External
                        </span>
                      </div>
                    </div>

                    <div
                      className="user-card-actions"
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5313rem',
                        width: '100%',
                      }}
                    >
                      {user.is_active === 0 ? (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                          Inactive
                        </span>
                      ) : (
                        <>
                          <button
                            className="btn btn-secondary"
                            style={{
                              width: '100%',
                              padding: '0.5313rem 0.85rem',
                              fontSize: '0.85rem',
                            }}
                            onClick={() => startEdit(user)}
                          >
                            Edit User
                          </button>
                          {user.id !== currentUser.id && (
                            <>
                              <button
                                id={`btn-reset-password-${user.id}`}
                                className="btn btn-secondary"
                                style={{
                                  width: '100%',
                                  padding: '0.5313rem 0.85rem',
                                  fontSize: '0.85rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '0.3188rem',
                                }}
                                onClick={() => setResetPasswordTarget(user)}
                              >
                                <KeyRound size={14} />
                                Reset Password
                              </button>
                              <button
                                id={['btn-delete-user-', user.id].join('')}
                                className="btn btn-danger"
                                style={{
                                  width: '100%',
                                  padding: '0.3188rem 0.6375rem',
                                  fontSize: '0.8rem',
                                }}
                                onClick={() => onDeleteUser(user.id)}
                              >
                                <Trash2 size={12} />
                                Delete User
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </UserCarousel>
        </div>
      </div>

      {resetPasswordTarget && (
        <ResetUserPasswordModal
          targetUser={resetPasswordTarget}
          token={token}
          onClose={() => setResetPasswordTarget(null)}
        />
      )}
    </div>
  );
};