import { Check, Search, ShieldCheck } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

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
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');

  const isIT = currentUser.role === 'it';

  // Offboarded users can no longer log in, so they should not be grantable access
  const activeUsers = useMemo(() => users.filter((u) => u.is_active !== 0), [users]);

  useEffect(() => {
    const fetchOverrides = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/screen-overrides/${screenName}/users`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        let allowedIds: Set<string> = new Set();
        if (res.ok) {
          const data = await res.json();
          const list: ScreenOverrideUser[] = Array.isArray(data) ? data : (data.users ?? []);
          allowedIds = new Set(list.map((u) => u.user_id));
        }
        setAllowedUsers(activeUsers.map((u) => ({ ...u, checked: allowedIds.has(u.id) })));
      } catch {
        setAllowedUsers(activeUsers.map((u) => ({ ...u, checked: false })));
      } finally {
        setLoading(false);
      }
    };
    fetchOverrides();
  }, [screenName, activeUsers, token]);

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allowedUsers;
    return allowedUsers.filter(
      (u) =>
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.role?.toLowerCase().includes(q) ||
        u.username?.toLowerCase().includes(q)
    );
  }, [allowedUsers, query]);

  const toggleUser = (userId: string) => {
    setAllowedUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, checked: !u.checked } : u)));
  };

  const saveOverrides = async () => {
    const selectedIds = allowedUsers.filter((u) => u.checked).map((u) => u.id);
    setSaving(true);
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
    } finally {
      setSaving(false);
    }
  };

  if (!isIT) {
    return (
      <p style={{ color: 'var(--text-secondary, #8a94a6)', fontSize: '0.85rem' }}>
        Only IT administrators can manage {screenLabel} access.
      </p>
    );
  }

  if (loading) {
    return <p style={{ color: 'var(--text-secondary, #8a94a6)', fontSize: '0.85rem' }}>Loading users...</p>;
  }

  const grantedCount = allowedUsers.filter((u) => u.checked).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      <p
        style={{
          fontSize: '0.75rem',
          color: 'var(--text-secondary, #8a94a6)',
          fontFamily: 'var(--font-mono)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
        }}
      >
        Tick a user to grant them {screenLabel} access. IT administrators always retain access, and no other user can
        open this screen until you save a list.
      </p>

      <div
        style={{
          display: 'flex',
          gap: '0.6rem',
          alignItems: 'center',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
        }}
      >
        <div
          style={{
            position: 'relative',
            flex: '1 1 220px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: '0.6rem',
              color: 'var(--text-secondary, #8a94a6)',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, email, code or role"
            className="cv-input"
            style={{ paddingLeft: '2rem' }}
          />
        </div>

        <button
          type="button"
          onClick={saveOverrides}
          disabled={saving}
          className="cv-btn cv-btn-primary"
          style={{ opacity: saving ? 0.6 : 1 }}
        >
          {saving ? <Check size={14} /> : <ShieldCheck size={14} />}
          <span className="cv-btn-text">{saving ? 'Saving' : `Save (${grantedCount})`}</span>
        </button>
      </div>

      <div
        style={{
          maxHeight: '340px',
          overflowY: 'auto',
          border: '0.0531rem solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--bg-secondary)',
        }}
      >
        {filteredUsers.length === 0 ? (
          <p className="cv-empty-text">No users match your search.</p>
        ) : (
          filteredUsers.map((user) => (
            <label
              key={user.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                padding: '0.5rem 0.75rem',
                borderBottom: '0.0531rem solid var(--border-color)',
                background: user.checked ? 'rgba(14, 82, 155, 0.12)' : 'transparent',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={user.checked}
                onChange={() => toggleUser(user.id)}
                style={{ cursor: 'pointer', flexShrink: 0 }}
              />
              <span
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                {user.name}
                {user.id === currentUser.id && (
                  <span style={{ fontSize: '0.6rem', color: 'var(--color-primary)', letterSpacing: '0.15em' }}>
                    YOU
                  </span>
                )}
              </span>
              <span
                style={{
                  fontSize: '0.7rem',
                  color: 'var(--text-secondary, #8a94a6)',
                  marginLeft: 'auto',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {user.role} &middot; {user.email || user.username}
              </span>
            </label>
          ))
        )}
      </div>
    </div>
  );
};

export default ScreenAccessManager;
