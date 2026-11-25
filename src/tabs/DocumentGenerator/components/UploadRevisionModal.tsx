import React, { useState } from 'react';

import type { AppUser } from '../../../types';

import { REVISION_OPTIONS } from '../constants';

interface UploadRevisionModalProps {
  document: {
    id: string;
    document_id: string;
    revision: string;
    title: string;
  };
  token: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultPreparedByName?: string;
  allUsers?: AppUser[];
}

const SearchableUserSelect: React.FC<{
  label: string;
  value: string;
  users: AppUser[];
  onChange: (value: string) => void;
}> = ({ label, value, users, onChange }) => {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const filtered = users.filter(
    (u) =>
      !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      (u.designation || '').toLowerCase().includes(search.toLowerCase())
  );

  const selectUser = (u: AppUser) => {
    onChange(`${u.name} (${u.designation || ''})`);
    setSearch('');
    setOpen(false);
  };

  return (
    <div style={{ marginBottom: '0.85rem' }}>
      <label
        className="docgen-label"
        style={{ fontSize: '0.78rem', textTransform: 'uppercase', display: 'block', marginBottom: '0.3rem' }}
      >
        {label}
      </label>
      <div style={{ position: 'relative', width: '100%' }}>
        <input
          type="text"
          className="form-input"
          value={search || value}
          onChange={(e) => {
            setSearch(e.target.value);
            setOpen(true);
            onChange(e.target.value);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={`Select ${label.toLowerCase()}`}
        />
        {open && (
          <div
            className="inv-assignee-dropdown"
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              zIndex: 10,
              maxHeight: '12rem',
              overflowY: 'auto',
            }}
          >
            {filtered.length === 0 ? (
              <div className="inv-assignee-empty">No matching users available.</div>
            ) : (
              filtered.map((u) => (
                <div
                  key={u.id}
                  className={`inv-assignee-item ${value && value.includes(u.name) ? 'inv-assignee-item-active' : ''}`}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    selectUser(u);
                  }}
                >
                  {u.name} ({u.designation || ''})
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export const UploadRevisionModal: React.FC<UploadRevisionModalProps> = ({
  document,
  token,
  isOpen,
  onClose,
  onSuccess,
  defaultPreparedByName,
  allUsers,
}) => {
  const currentRev = document.revision || 'Rev 00';
  const defaultRev = currentRev.startsWith('Rev 0')
    ? `Rev 0${parseInt(currentRev.replace('Rev 0', ''), 10) + 1}`
    : 'Rev 01';

  const todayIso = new Date().toISOString().split('T')[0];

  const [revision, setRevision] = useState(defaultRev);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState('');
  const [preparedByName, setPreparedByName] = useState(defaultPreparedByName || '');
  const [checkedByName, setCheckedByName] = useState('');
  const [approvedByName, setApprovedByName] = useState('');
  const [preparedByDate, setPreparedByDate] = useState(todayIso);
  const [checkedByDate, setCheckedByDate] = useState(todayIso);
  const [approvedByDate, setApprovedByDate] = useState(todayIso);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] ?? null;
    setFile(selectedFile);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (file) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext !== 'docx') {
        setError('Only .docx files are allowed.');
        return;
      }

      if (file.size > 15 * 1024 * 1024) {
        setError('File size must not exceed 15 MB.');
        return;
      }
    }

    if (!preparedByName.trim()) {
      setError('Prepared By is required.');
      return;
    }
    if (checkedByName.trim() && !checkedByDate) {
      setError('Checked Date is required when Checked By is provided.');
      return;
    }
    if (approvedByName.trim() && !approvedByDate) {
      setError('Approved Date is required when Approved By is provided.');
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      if (file) formData.append('file', file);
      if (revision) formData.append('revision', revision);
      if (note) formData.append('note', note);
      formData.append('prepared_by_name', preparedByName.trim());
      formData.append('checked_by_name', checkedByName.trim());
      formData.append('approved_by_name', approvedByName.trim());
      formData.append('prepared_by_date', preparedByDate);
      formData.append('checked_by_date', checkedByName.trim() ? checkedByDate : '');
      formData.append('approved_by_date', approvedByName.trim() ? approvedByDate : '');

      const res = await fetch(`/api/document-generator/documents/${document.id}/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to upload revision.');
      }

      await res.json();
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload revision.');
    } finally {
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  const labelStyle: React.CSSProperties = {
    fontSize: '0.78rem',
    textTransform: 'uppercase',
    display: 'block',
    marginBottom: '0.3rem',
  };

  return (
    <div
      className="docgen-modal-backdrop"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        className="docgen-modal-box"
        style={{
          backgroundColor: 'var(--bg-primary)',
          borderRadius: 'var(--radius-md)',
          padding: '1.5rem',
          width: '420px',
          maxWidth: '90vw',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            Upload New Revision
          </h4>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.25rem',
              cursor: 'pointer',
              color: 'var(--text-muted)',
            }}
          >
            &times;
          </button>
        </div>

        <div style={{ marginBottom: '0.85rem' }}>
          <label className="docgen-label" style={labelStyle}>
            Document ID
          </label>
          <input
            type="text"
            className="form-input"
            value={document.document_id}
            readOnly
            style={{ backgroundColor: 'var(--bg-primary)' }}
          />
        </div>

        <div style={{ marginBottom: '0.85rem' }}>
          <label className="docgen-label" style={labelStyle}>
            Current Revision
          </label>
          <input
            type="text"
            className="form-input"
            value={document.revision}
            readOnly
            style={{ backgroundColor: 'var(--bg-primary)' }}
          />
        </div>

        <div style={{ marginBottom: '0.85rem' }}>
          <label className="docgen-label" style={labelStyle}>
            New Revision
          </label>
          <select className="form-input" value={revision} onChange={(e) => setRevision(e.target.value)}>
            {REVISION_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '0.85rem' }}>
          <label className="docgen-label" style={labelStyle}>
            File (.docx, max 15 MB) (optional)
          </label>
          <input
            type="file"
            className="form-input"
            accept=".docx"
            onChange={handleFileChange}
            style={{ padding: '0.4rem' }}
          />
        </div>

        <div style={{ marginBottom: '0.85rem' }}>
          <label className="docgen-label" style={labelStyle}>
            Change Note (optional)
          </label>
          <textarea
            className="form-input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Describe what changed in this revision..."
          />
        </div>

        <SearchableUserSelect
          label="Prepared By"
          value={preparedByName}
          users={allUsers || []}
          onChange={setPreparedByName}
        />

        <div style={{ marginBottom: '0.85rem' }}>
          <label className="docgen-label" style={labelStyle}>
            Prepared Date
          </label>
          <input
            type="date"
            className="form-input"
            value={preparedByDate}
            onChange={(e) => setPreparedByDate(e.target.value)}
          />
        </div>

        <SearchableUserSelect
          label="Checked By"
          value={checkedByName}
          users={allUsers || []}
          onChange={setCheckedByName}
        />

        <div style={{ marginBottom: '0.85rem' }}>
          <label className="docgen-label" style={labelStyle}>
            Checked Date
          </label>
          <input
            type="date"
            className="form-input"
            value={checkedByDate}
            onChange={(e) => setCheckedByDate(e.target.value)}
          />
        </div>

        <SearchableUserSelect
          label="Approved By"
          value={approvedByName}
          users={allUsers || []}
          onChange={setApprovedByName}
        />

        <div style={{ marginBottom: '0.85rem' }}>
          <label className="docgen-label" style={labelStyle}>
            Approved Date
          </label>
          <input
            type="date"
            className="form-input"
            value={approvedByDate}
            onChange={(e) => setApprovedByDate(e.target.value)}
          />
        </div>

        {error && (
          <div
            style={{
              marginBottom: '0.85rem',
              padding: '0.5rem',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              color: '#ef4444',
              fontSize: '0.78rem',
              borderRadius: 'var(--radius-sm)',
              border: '0.0531rem solid rgba(239, 68, 68, 0.2)',
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem' }}>
          <button type="button" className="docgen-btn docgen-btn-secondary" onClick={onClose} disabled={uploading}>
            Cancel
          </button>
          <button type="submit" className="docgen-btn docgen-btn-primary" onClick={handleSubmit} disabled={uploading}>
            {uploading ? 'Uploading...' : 'Upload Revision'}
          </button>
        </div>
      </div>
    </div>
  );
};
