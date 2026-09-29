import { Save, ShieldCheck } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import type { AppUser, ScreenOverrideUser } from '../types';

interface ScreenAccessManagerProps {
  screenName: string;
  screenLabel: string;
  users: AppUser[];
  currentUser: AppUser;
  token: string;
}

interface LocalOverrideUser extends AppUser {
  checked: boolean;
}

export const ScreenAccessManager: React.FC<ScreenAccessManagerProps> = ({
  screenName,
  screenLabel,
  users,
  currentUser,
  token,
}) => {
  const [allowedUsers, setAllowedUsers] = useState<LocalOverrideUser[]>([]);
  const [loading, setLoading] = useState(true);

  const isIT = currentUser.role === 'it';

  useEffect(() => {
    const fetchOverrides = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/screen-overrides/${screenName}/users`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const list: ScreenOverrideUser[] = Array.isArray(data) ? data : data.users || [];
          const allowedIds: Set<string> = new Set(list.map((u: ScreenOverrideUser) => u.user_id));
          setAllowedUsers(users.map((u) => ({ ...u, checked: allowedIds.has(u.id) })));
        } else {
          setAllowedUsers(users.map((u) => ({ ...u, checked: false })));
        }
      } catch {
        setAllowedUsers(users.map((u) => ({ ...u, checked: false })));
      } finally {
        setLoading(false);
      }
    };
    fetchOverrides();
  }, [screenName, users, token]);

  const toggleUser = (userId: string) => {
    setAllowedUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, checked: !u.checked } : u)));
  };

  const saveOverrides = async () => {
    const selectedIds = allowedUsers.filter((u) => u.checked).map((u) => u.id);
    try {
      const res = await fetch(`/api/screen-overrides/${screenName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userIds: selectedIds }),
      });
      if (res.ok) {
        const result = await res.json();
        alert(`${screenLabel} access updated. ${result.count} user(s) granted.`);
      } else {
        const err = await res.json();
        alert(`Failed to update: ${err.error || 'Unknown error'}`);
      }
    } catch {
      alert('Failed to update screen access.');
    }
  };

  if (!isIT) {
    return (
      <div className="panel" style={{ marginTop: '1.5rem' }}>
        <p style={{ color: 'var(--text-secondary, #8a94a6)' }}>
          Only IT administrators can manage {screenLabel} access.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="panel" style={{ marginTop: '1.5rem' }}>
        Loading...
      </div>
    );
  }

  return (
    <div className="panel" style={{ marginTop: '1.5rem' }}>
      <div className="panel-header" style={{ marginBottom: '1rem' }}>
        <span className="panel-title">
          <ShieldCheck className="w-4 h-4" />
          {screenLabel} Access Control
        </span>
        <button
          onClick={saveOverrides}
          className="btn btn-primary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <Save className="w-4 h-4" />
          Save Changes
        </button>
      </div>

      <div style={{ marginTop: '0.7rem' }}>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #8a94a6)', marginBottom: '0.5rem' }}>
          Toggle which users can access the {screenLabel} screen. Currently{' '}
          {allowedUsers.filter((u) => u.checked).length} user(s) have access.
        </p>
        <div
          style={{
            maxHeight: '300px',
            overflowY: 'auto',
            border: '0.0531rem solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          {allowedUsers.map((user) => (
            <div
              key={user.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 0.75rem',
                borderBottom: '0.0531rem solid var(--border-color)',
                background: user.checked ? 'rgba(14, 82, 155, 0.1)' : 'transparent',
              }}
            >
              <input
                type="checkbox"
                checked={user.checked}
                onChange={() => toggleUser(user.id)}
                style={{ cursor: 'pointer' }}
              />
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{user.name}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary, #8a94a6)' }}>
                  {user.role} &middot; {user.email || 'No email'}
                </span>
              </div>
              {user.id === currentUser.id && (
                <span style={{ fontSize: '0.65rem', color: 'var(--color-primary)', textTransform: 'uppercase' }}>
                  You
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
