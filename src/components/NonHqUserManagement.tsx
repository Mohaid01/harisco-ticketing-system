import { Briefcase, Building2, KeyRound, Trash2, UserPlus } from 'lucide-react';
import React, { useState } from 'react';

import type { AppUser } from '../types';

import { formatEmployeeCode } from '../utils';
import { ResetUserPasswordModal } from './Modals/ResetUserPasswordModal';
import { UserCarousel } from './UserCarousel';

interface NonHqUserManagementProps {
  users: AppUser[];
  currentUser: AppUser;
  token: string;
  onAddUser: (data: {
    name: string;
    email: string;
    username: string;
    password?: string;
    avatar?: string;
    department?: string;
    designation?: string;
    active: boolean;
  }) => void;
  onDeleteUser: (userId: string) => void;
  onOffboardUser?: (userId: string, reason: string, offboardDate: string) => void;
  onUpdateUser?: (
    userId: string,
    data: {
      name: string;
      email: string | null;
      department?: string | null;
      designation?: string | null;
      avatar?: string | null;
      active?: boolean;
    }
  ) => void;
  loading?: boolean;
}

export const NonHqUserManagement: React.FC<NonHqUserManagementProps> = ({
  users,
  currentUser,
  token,
  onAddUser,
  onDeleteUser,
  onOffboardUser,
  onUpdateUser,
  loading = false,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [avatar, setAvatar] = useState('');
  const [department, setDepartment] = useState('');
  const [designation, setDesignation] = useState('');
  const [active, setActive] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [resetPasswordTarget, setResetPasswordTarget] = useState<AppUser | null>(null);

  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [editDesignation, setEditDesignation] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [editAvatar, setEditAvatar] = useState('');

  const todayStr = new Date().toISOString().split('T')[0];

  const [offboardingUserId, setOffboardingUserId] = useState<string | null>(null);
  const [offboardReason, setOffboardReason] = useState('');
  const [offboardDate, setOffboardDate] = useState(todayStr);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please upload an image file.');
        return;
      }
      if (file.size > 1024 * 1024) {
        alert('Image size must be less than 1MB.');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        if (isEdit) {
          setEditAvatar(reader.result as string);
        } else {
          setAvatar(reader.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!name.trim() || !username.trim()) {
      setErrorMsg('Please supply a name and employee code.');
      return;
    }

    if (!password.trim()) {
      setErrorMsg('Please supply a password.');
      return;
    }

    const formattedCode = formatEmployeeCode(username.trim());

    if (users.some((u) => u.username?.toLowerCase() === formattedCode.toLowerCase())) {
      setErrorMsg('A user with this employee code already exists.');
      return;
    }

    onAddUser({
      name: name.trim(),
      email: email.trim(),
      username: formattedCode,
      password: password.trim() || undefined,
      avatar: avatar || undefined,
      department: department.trim() || undefined,
      designation: designation.trim() || undefined,
      active,
    });

    setName('');
    setEmail('');
    setUsername('');
    setPassword('');
    setAvatar('');
    setDepartment('');
    setDesignation('');
    setActive(true);
  };

  const handleSaveEdit = (userId: string) => {
    if (!editName.trim()) {
      alert('Name is required.');
      return;
    }
    if (onUpdateUser) {
      onUpdateUser(userId, {
        name: editName.trim(),
        email: editEmail.trim() || null,
        department: editDepartment.trim() || null,
        designation: editDesignation.trim() || null,
        avatar: editAvatar || null,
        active: editActive,
      });
    }
    setEditingUserId(null);
  };

  const startEdit = (user: AppUser) => {
    setEditingUserId(user.id);
    setEditName(user.name);
    setEditEmail(user.email || '');
    setEditDepartment(user.department || '');
    setEditDesignation(user.designation || '');
    setEditActive(user.is_active !== 0);
  };

  const handleFileChangeEdit = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please upload an image file.');
        return;
      }
      if (file.size > 1024 * 1024) {
        alert('Image size must be less than 1MB.');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setEditAvatar(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const getRoleBadgeClass = (r: string) => `role-badge-pill role-badge-${r.replace('factory_', '').replace('non_hq_', '')}`;

  const inlineInputStyle: React.CSSProperties = {
    fontSize: '0.85rem',
    padding: '6px 10px',
  };
  const inlineLabelStyle: React.CSSProperties = {
    fontSize: '0.75rem',
    marginBottom: '4px',
  };

  return (
    <div>
      <div style={{ marginBottom: '1.275rem' }}>
        <h1 className="page-title">Non HQ User Management</h1>
        <p className="page-subtitle">Add and manage non HQ user accounts. Manage role authorizations.</p>
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
            Add Non HQ User
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
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="non-hq-user-name-input" className="form-label">
                  Full Name
                </label>
                <input
                  id="non-hq-user-name-input"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Non HQ Worker Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="non-hq-user-username-input" className="form-label">
                  Employee Code
                </label>
                <input
                  id="non-hq-user-username-input"
                  type="text"
                  className="form-input"
                  placeholder="e.g. 001"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="non-hq-user-email-input" className="form-label">
                  Email Address (Optional)
                </label>
                <input
                  id="non-hq-user-email-input"
                  type="email"
                  className="form-input"
                  placeholder="e.g. nonhq@harisco.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="non-hq-user-password-input" className="form-label">
                  Password (Optional)
                </label>
                <input
                  id="non-hq-user-password-input"
                  type="password"
                  className="form-input"
                  placeholder="Leave blank to use default"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="non-hq-user-department-input" className="form-label">
                  Department
                </label>
                <select
                  id="non-hq-user-department-input"
                  className="form-input"
                  style={{ backgroundColor: 'var(--bg-primary)' }}
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  required
                >
                  <option value="" disabled>
                    -- Select Department --
                  </option>
                  <option value="Non HQ">Non HQ</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="non-hq-user-designation-input" className="form-label">
                  Designation
                </label>
                <input
                  id="non-hq-user-designation-input"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Site Supervisor"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Picture Upload Field */}
            <div className="form-group">
              <label htmlFor="non-hq-user-avatar-upload" className="form-label">
                Upload Profile Picture (Optional)
              </label>
              <div style={{ display: 'flex', gap: '0.5313rem', alignItems: 'center' }}>
                <input
                  id="non-hq-user-avatar-upload"
                  type="file"
                  accept="image/*"
                  className="form-input"
                  style={{ flex: 1 }}
                  onChange={(e) => handleFileChange(e, false)}
                />
                {avatar && (
                  <div
                    style={{
                      display: 'flex',
                      gap: '0.425rem',
                      alignItems: 'center',
                    }}
                  >
                    <img
                      src={avatar}
                      alt="Preview"
                      style={{
                        width: '2.0188rem',
                        height: '2.0188rem',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '0.0531rem solid var(--border-color)',
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{
                        padding: '0.3188rem 0.5313rem',
                        fontSize: '0.75rem',
                        minWidth: 'unset',
                      }}
                      onClick={() => setAvatar('')}
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div
              className="form-group"
              style={{
                marginBottom: '1.275rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5313rem',
              }}
            >
              <label
                className="form-label"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.425rem',
                  cursor: 'pointer',
                }}
              >
                <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
                Active Non HQ User
              </label>
            </div>

            <button
              id="btn-add-non-hq-user-submit"
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%' }}
            >
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
            Active Non HQ Users ({users.length})
          </h2>

          <UserCarousel loading={loading}>
            {users.map((user) => (
              <div className={`user-card${user.is_active === 0 ? ' user-card--offboarded' : ''}`} key={user.id}>
                {user.is_active === 0 && user.offboarded_at && (
                  <div className="user-card-badge">Offboarded {user.offboarded_at}</div>
                )}
                {editingUserId === user.id ? (
                  <div
                    style={{
                      width: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5313rem',
                    }}
                  >
                    <div className="form-row" style={{ marginBottom: '0' }}>
                      <div className="form-group">
                        <label className="form-label" style={inlineLabelStyle}>
                          Full Name
                        </label>
                        <input
                          type="text"
                          className="form-input"
                          style={inlineInputStyle}
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={inlineLabelStyle}>
                          Email Address
                        </label>
                        <input
                          type="email"
                          className="form-input"
                          style={inlineInputStyle}
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          placeholder="Optional"
                        />
                      </div>
                    </div>

                    {/* Edit Profile Picture Upload Field */}
                    <div className="form-group" style={{ marginBottom: '0' }}>
                      <label className="form-label" style={inlineLabelStyle}>
                        Upload Profile Picture
                      </label>
                      <div
                        style={{
                          display: 'flex',
                          gap: '0.425rem',
                          alignItems: 'center',
                        }}
                      >
                        <input
                          type="file"
                          accept="image/*"
                          className="form-input"
                          style={{ ...inlineInputStyle, flex: 1 }}
                          onChange={handleFileChangeEdit}
                        />
                        {editAvatar && (
                          <div
                            style={{
                              display: 'flex',
                              gap: '0.2125rem',
                              alignItems: 'center',
                            }}
                          >
                            <img
                              src={editAvatar}
                              alt="Edit Preview"
                              style={{
                                width: '1.5938rem',
                                height: '1.5938rem',
                                borderRadius: '50%',
                                objectFit: 'cover',
                                border: '0.0531rem solid var(--border-color)',
                              }}
                            />
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{
                                padding: '0.2125rem 0.425rem',
                                fontSize: '0.75rem',
                                minWidth: 'unset',
                              }}
                              onClick={() => setEditAvatar('')}
                            >
                              Clear
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="form-row" style={{ marginBottom: '0' }}>
                      <div className="form-group">
                        <label
                          className="form-label"
                          style={{
                            ...inlineLabelStyle,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.2125rem',
                          }}
                        >
                          <Building2 size={12} /> Department
                        </label>
                        <select
                          className="form-input"
                          style={{
                            ...inlineInputStyle,
                            backgroundColor: 'var(--bg-primary)',
                          }}
                          value={editDepartment}
                          onChange={(e) => setEditDepartment(e.target.value)}
                          required
                        >
                          <option value="" selected disabled>
                            -- Select Department --
                          </option>
                          <option value="Non HQ">Non HQ</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label
                          className="form-label"
                          style={{
                            ...inlineLabelStyle,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.2125rem',
                          }}
                        >
                          <Briefcase size={12} /> Designation
                        </label>
                        <input
                          type="text"
                          className="form-input"
                          style={inlineInputStyle}
                          value={editDesignation}
                          onChange={(e) => setEditDesignation(e.target.value)}
                          placeholder="e.g. Site Supervisor"
                          required
                        />
                      </div>
                    </div>

                    <div
                      className="form-group"
                      style={{
                        marginBottom: '0',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5313rem',
                      }}
                    >
                      <input
                        id={`non-hq-edit-active-${editingUserId}`}
                        type="checkbox"
                        checked={editActive}
                        onChange={(e) => setEditActive(e.target.checked)}
                      />
                      <label htmlFor={`non-hq-edit-active-${editingUserId}`} className="form-label">
                        Active Non HQ User
                      </label>
                    </div>

                    <div style={{ display: 'flex', gap: '0.425rem', width: '100%' }}>
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
                      alignItems: 'center',
                      textAlign: 'center',
                      gap: '1.7rem',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5313rem' }}>
                      {user.avatar ? (
                        <img
                          src={user.avatar}
                          alt={user.name}
                          style={{
                            width: '6.375rem',
                            height: '6.375rem',
                            borderRadius: '50%',
                            objectFit: 'cover',
                            border: '0.1594rem solid var(--border-color)',
                            display: 'block',
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: '6.375rem',
                            height: '6.375rem',
                            borderRadius: '50%',
                            backgroundColor: 'var(--color-primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '2.5rem',
                            fontWeight: 700,
                            color: 'white',
                          }}
                        >
                          {user.name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .toUpperCase()
                            .slice(0, 2)}
                        </div>
                      )}
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
                          {user.name}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {formatEmployeeCode(user.username || user.id)}
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
                      {user.email ? (
                        <span
                          style={{ color: 'var(--color-primary-solid)', fontSize: '0.9rem', wordBreak: 'break-all' }}
                        >
                          {user.email}
                        </span>
                      ) : (
                        <span style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                          No Email Address
                        </span>
                      )}
                      {user.designation && (
                        <span
                          style={{
                            fontSize: '0.9rem',
                            color: 'var(--text-primary)',
                            fontWeight: 500,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.425rem',
                          }}
                        >
                          <Briefcase size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {user.designation}
                          </span>
                        </span>
                      )}
                      {user.department && (
                        <span
                          style={{
                            fontSize: '0.9rem',
                            color: 'var(--text-secondary)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.425rem',
                          }}
                        >
                          <Building2 size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {user.department}
                          </span>
                        </span>
                      )}

                      <div style={{ marginTop: '0.2125rem', display: 'flex', justifyContent: 'center' }}>
                        <span className={getRoleBadgeClass(user.role)} style={{ fontSize: '0.85rem' }}>
                          Non HQ
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
                          Offboarded
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
                              {offboardingUserId === user.id ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.425rem' }}>
                                  <textarea
                                    className="form-input"
                                    rows={2}
                                    placeholder="Reason for offboarding..."
                                    value={offboardReason}
                                    onChange={(e) => setOffboardReason(e.target.value)}
                                    style={{ fontSize: '0.8rem', padding: '0.425rem' }}
                                  />
                                  <input
                                    type="date"
                                    className="form-input"
                                    value={offboardDate}
                                    max={todayStr}
                                    onChange={(e) => setOffboardDate(e.target.value)}
                                    style={{ fontSize: '0.8rem', padding: '0.425rem' }}
                                  />
                                  <div style={{ display: 'flex', gap: '0.425rem' }}>
                                    <button
                                      className="btn btn-primary"
                                      style={{ flex: 1, padding: '0.3188rem', fontSize: '0.75rem' }}
                                      onClick={() => {
                                        if (!offboardReason.trim()) {
                                          alert('Please provide a reason.');
                                          return;
                                        }
                                        onOffboardUser?.(user.id, offboardReason.trim(), offboardDate);
                                        setOffboardingUserId(null);
                                        setOffboardReason('');
                                        setOffboardDate(todayStr);
                                      }}
                                    >
                                      Confirm
                                    </button>
                                    <button
                                      className="btn btn-secondary"
                                      style={{ flex: 1, padding: '0.3188rem', fontSize: '0.75rem' }}
                                      onClick={() => {
                                        setOffboardingUserId(null);
                                        setOffboardReason('');
                                        setOffboardDate(todayStr);
                                      }}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <button
                                    className="btn btn-danger"
                                    style={{
                                      width: '100%',
                                      padding: '0.3188rem 0.6375rem',
                                      fontSize: '0.8rem',
                                    }}
                                    onClick={() => {
                                      setOffboardingUserId(user.id);
                                      setOffboardReason('');
                                      setOffboardDate(todayStr);
                                    }}
                                  >
                                    Offboard Employee
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
          apiPath="/api/non-hq/users"
        />
      )}
    </div>
  );
};
