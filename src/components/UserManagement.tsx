import { Briefcase, Building2, KeyRound, Trash2, UserPlus } from 'lucide-react';
import React, { useState } from 'react';

import type { AppUser, UserRole } from '../types';

import { ROLE_LABELS } from '../constants';
import { formatEmployeeCode } from '../utils';
import { ResetUserPasswordModal } from './ResetUserPasswordModal';

interface UserManagementProps {
  users: AppUser[];
  currentUser: AppUser;
  token: string;
  onAddUser: (data: {
    name: string;
    email: string;
    username: string;
    role: UserRole;
    password?: string;
    avatar?: string;
    department?: string;
    designation?: string;
    isDepartmentHead?: boolean;
    loginEnabled?: boolean;
  }) => void;
  onDeleteUser: (userId: string) => void;
  onUpdateUser?: (
    userId: string,
    data: {
      name: string;
      email: string | null;
      department?: string | null;
      designation?: string | null;
      avatar?: string | null;
      isDepartmentHead?: boolean;
      loginEnabled?: boolean;
    }
  ) => void;
}

export const UserManagement: React.FC<UserManagementProps> = ({
  users,
  currentUser,
  token,
  onAddUser,
  onDeleteUser,
  onUpdateUser,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [avatar, setAvatar] = useState('');
  const [role, setRole] = useState<UserRole>('employee');
  const [department, setDepartment] = useState('');
  const [designation, setDesignation] = useState('');
  const [isDepartmentHead, setIsDepartmentHead] = useState(false);
  const [loginEnabled, setLoginEnabled] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [resetPasswordTarget, setResetPasswordTarget] = useState<AppUser | null>(null);

  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [editDesignation, setEditDesignation] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [editIsDepartmentHead, setEditIsDepartmentHead] = useState(false);
  const [editLoginEnabled, setEditLoginEnabled] = useState(true);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please upload an image file.');
        return;
      }
      // Validate file size (e.g. limit to 1MB to avoid database bloat)
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

    const formattedCode = formatEmployeeCode(username.trim());

    if (users.some((u) => u.username?.toLowerCase() === formattedCode.toLowerCase())) {
      setErrorMsg('A user with this employee code already exists.');
      return;
    }

    onAddUser({
      name: name.trim(),
      email: email.trim(),
      username: formattedCode,
      role,
      password: password.trim() || undefined,
      avatar: avatar || undefined,
      department: department.trim() || undefined,
      designation: designation.trim() || undefined,
      isDepartmentHead,
      loginEnabled,
    });

    setName('');
    setEmail('');
    setUsername('');
    setPassword('');
    setAvatar('');
    setRole('employee');
    setDepartment('');
    setDesignation('');
    setIsDepartmentHead(false);
    setLoginEnabled(true);
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
        isDepartmentHead: editIsDepartmentHead,
        loginEnabled: editLoginEnabled,
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
    setEditAvatar(user.avatar || '');
    setEditIsDepartmentHead(!!user.isDepartmentHead);
    setEditLoginEnabled(user.loginEnabled !== 0);
  };

  const getRoleBadgeClass = (r: string) => `role-badge-pill role-badge-${r}`;

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
      <div style={{ marginBottom: '24px' }}>
        <h1 className="page-title">User Management</h1>
        <p className="page-subtitle">Add and delete user accounts. Manage role authorizations.</p>
      </div>

      <div className="user-mgmt-grid">
        {/* Left Column: Add User Form */}
        <div className="panel" style={{ padding: '24px' }}>
          <h2
            className="panel-title"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '20px',
            }}
          >
            <UserPlus size={18} className="status-progress" />
            Add New User
          </h2>

          {errorMsg && (
            <div
              style={{
                backgroundColor: 'rgba(244, 63, 94, 0.15)',
                border: '1px solid rgba(244, 63, 94, 0.3)',
                color: '#f43f5e',
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                marginBottom: '16px',
                fontSize: '0.85rem',
              }}
            >
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="user-name-input" className="form-label">
                Full Name
              </label>
              <input
                id="user-name-input"
                type="text"
                className="form-input"
                placeholder="e.g. Abid Riaz"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="user-username-input" className="form-label">
                Employee Code
              </label>
              <input
                id="user-username-input"
                type="text"
                className="form-input"
                placeholder="e.g. 001"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="user-email-input" className="form-label">
                Email Address (Optional)
              </label>
              <input
                id="user-email-input"
                type="email"
                className="form-input"
                placeholder="e.g. abid@harisco.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="user-department-input" className="form-label">
                Department
              </label>
              <select
                id="user-department-input"
                className="form-input"
                style={{ backgroundColor: 'var(--bg-primary)' }}
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                required
              >
                <option value="" selected disabled>
                  -- Select Department --
                </option>
                <option value="Executive">Executive</option>
                <option value="IT">IT</option>
                <option value="Accounts">Accounts</option>
                <option value="Admin">Admin</option>
                <option value="Staff">Staff</option>
                <option value="Civil">Civil</option>
                <option value="Telecom">Telecom</option>
                <option value="Projects">Projects</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="user-designation-input" className="form-label">
                Designation
              </label>
              <input
                id="user-designation-input"
                type="text"
                className="form-input"
                placeholder="e.g. Senior Engineer"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                required
              />
            </div>

            {/* Picture Upload Field */}
            <div className="form-group">
              <label htmlFor="user-avatar-upload" className="form-label">
                Upload Profile Picture (Optional)
              </label>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                  id="user-avatar-upload"
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
                      gap: '8px',
                      alignItems: 'center',
                    }}
                  >
                    <img
                      src={avatar}
                      alt="Preview"
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '1px solid var(--border-color)',
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{
                        padding: '6px 10px',
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

            <div className="form-group">
              <label htmlFor="user-password-input" className="form-label">
                Password
              </label>
              <input
                id="user-password-input"
                type="password"
                className="form-input"
                placeholder={`Optional (defaults to ${import.meta.env.VITE_DEFAULT_USER_PASSWORD})`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label htmlFor="user-role-select" className="form-label">
                System Role
              </label>
              <select
                id="user-role-select"
                className="form-input"
                style={{ backgroundColor: 'var(--bg-primary)' }}
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
              >
                <option value="employee">Employee</option>
                <option value="it">IT Administrator</option>
                <option value="manager">Manager</option>
                <option value="executive">Executive</option>
              </select>
            </div>

            <div
              className="form-group"
              style={{
                marginBottom: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <label
                className="form-label"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={isDepartmentHead}
                  onChange={(e) => setIsDepartmentHead(e.target.checked)}
                />
                Department Head (can approve leaves/duties)
              </label>

              <label
                className="form-label"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                }}
              >
                <input type="checkbox" checked={loginEnabled} onChange={(e) => setLoginEnabled(e.target.checked)} />
                Enable Login
              </label>
            </div>

            <button id="btn-add-user-submit" type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              Create Account
            </button>
          </form>
        </div>

        {/* Right Column: Users List Grid */}
        <div className="panel" style={{ padding: '24px' }}>
          <h2 className="panel-title" style={{ marginBottom: '20px' }}>
            Active User Roster ({users.length})
          </h2>

          <div className="user-grid">
            {users.map((user) => (
              <div className="user-card" key={user.id}>
                {editingUserId === user.id ? (
                  <div
                    style={{
                      width: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                    }}
                  >
                    <div className="form-group" style={{ marginBottom: '0' }}>
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
                    <div className="form-group" style={{ marginBottom: '0' }}>
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

                    {/* Edit Profile Picture Upload Field */}
                    <div className="form-group" style={{ marginBottom: '0' }}>
                      <label className="form-label" style={inlineLabelStyle}>
                        Upload Profile Picture
                      </label>
                      <div
                        style={{
                          display: 'flex',
                          gap: '8px',
                          alignItems: 'center',
                        }}
                      >
                        <input
                          type="file"
                          accept="image/*"
                          className="form-input"
                          style={{ ...inlineInputStyle, flex: 1 }}
                          onChange={(e) => handleFileChange(e, true)}
                        />
                        {editAvatar && (
                          <div
                            style={{
                              display: 'flex',
                              gap: '4px',
                              alignItems: 'center',
                            }}
                          >
                            <img
                              src={editAvatar}
                              alt="Edit Preview"
                              style={{
                                width: '30px',
                                height: '30px',
                                borderRadius: '50%',
                                objectFit: 'cover',
                                border: '1px solid var(--border-color)',
                              }}
                            />
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{
                                padding: '4px 8px',
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

                    <div className="form-group" style={{ marginBottom: '0' }}>
                      <label
                        className="form-label"
                        style={{
                          ...inlineLabelStyle,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
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
                        <option value="Executive">Executive</option>
                        <option value="IT">IT</option>
                        <option value="Accounts">Accounts</option>
                        <option value="Admin">Admin</option>
                        <option value="Staff">Staff</option>
                        <option value="Civil">Civil</option>
                        <option value="Telecom">Telecom</option>
                        <option value="Projects">Projects</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: '12px' }}>
                      <label
                        className="form-label"
                        style={{
                          ...inlineLabelStyle,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
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
                        placeholder="e.g. Senior Engineer"
                        required
                      />
                    </div>

                    <div
                      className="form-group"
                      style={{
                        marginBottom: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      <label
                        className="form-label"
                        style={{
                          ...inlineLabelStyle,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={editIsDepartmentHead}
                          onChange={(e) => setEditIsDepartmentHead(e.target.checked)}
                        />
                        Department Head
                      </label>

                      <label
                        className="form-label"
                        style={{
                          ...inlineLabelStyle,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={editLoginEnabled}
                          onChange={(e) => setEditLoginEnabled(e.target.checked)}
                        />
                        Enable Login
                      </label>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                      <button
                        className="btn btn-secondary"
                        style={{
                          flex: 1,
                          padding: '6px 10px',
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
                          padding: '6px 10px',
                          fontSize: '0.75rem',
                        }}
                        onClick={() => handleSaveEdit(user.id)}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {user.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.name}
                        className="user-card-avatar"
                        style={{ objectFit: 'cover' }}
                      />
                    ) : (
                      <div
                        className="user-card-avatar"
                        style={{
                          backgroundColor: 'var(--color-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.2rem',
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
                    <span className="user-card-name">{user.name}</span>

                    <span
                      className="user-card-email"
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                        alignItems: 'center',
                        fontSize: '0.78rem',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <span>Code: {formatEmployeeCode(user.username || user.id)}</span>
                      {user.email ? (
                        <span
                          style={{
                            color: 'var(--color-primary-solid)',
                            wordBreak: 'break-all',
                          }}
                        >
                          {user.email}
                        </span>
                      ) : (
                        <span
                          style={{
                            fontStyle: 'italic',
                            color: 'var(--text-muted)',
                          }}
                        >
                          No Email Address
                        </span>
                      )}
                    </span>

                    {(user.designation || user.department) && (
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px',
                          alignItems: 'center',
                          marginBottom: '4px',
                        }}
                      >
                        {user.designation && (
                          <span
                            style={{
                              fontSize: '0.75rem',
                              color: 'var(--text-primary)',
                              fontWeight: 500,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Briefcase size={11} style={{ color: 'var(--text-muted)' }} />
                            {user.designation}
                          </span>
                        )}
                        {user.department && (
                          <span
                            style={{
                              fontSize: '0.72rem',
                              color: 'var(--text-secondary)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Building2 size={11} style={{ color: 'var(--text-muted)' }} />
                            {user.department}
                          </span>
                        )}
                      </div>
                    )}

                    <div style={{ marginBottom: '16px' }}>
                      <span className={getRoleBadgeClass(user.role)}>{ROLE_LABELS[user.role]}</span>
                    </div>

                    <div
                      className="user-card-actions"
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        width: '100%',
                      }}
                    >
                      <button
                        className="btn btn-secondary"
                        style={{
                          width: '100%',
                          padding: '6px 12px',
                          fontSize: '0.8rem',
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
                              padding: '6px 12px',
                              fontSize: '0.8rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                            }}
                            onClick={() => setResetPasswordTarget(user)}
                          >
                            <KeyRound size={12} />
                            Reset Password
                          </button>
                          <button
                            id={`btn-delete-user-${user.id}`}
                            className="btn btn-danger"
                            style={{
                              width: '100%',
                              padding: '6px 12px',
                              fontSize: '0.8rem',
                            }}
                            onClick={() => onDeleteUser(user.id)}
                          >
                            <Trash2 size={12} />
                            Delete User
                          </button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
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
