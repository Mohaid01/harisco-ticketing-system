import React, { useState } from 'react';

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
}

export const UploadRevisionModal: React.FC<UploadRevisionModalProps> = ({
  document,
  token,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [revision, setRevision] = useState(document.revision);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] ?? null;
    setFile(selectedFile);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a file to upload.');
      return;
    }

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'doc' && ext !== 'docx') {
      setError('Only .doc and .docx files are allowed.');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setError('File size must not exceed 15 MB.');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (revision) formData.append('revision', revision);
      if (note) formData.append('note', note);

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
          <label
            className="docgen-label"
            style={{ fontSize: '0.78rem', textTransform: 'uppercase', display: 'block', marginBottom: '0.3rem' }}
          >
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
          <label
            className="docgen-label"
            style={{ fontSize: '0.78rem', textTransform: 'uppercase', display: 'block', marginBottom: '0.3rem' }}
          >
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
          <label
            className="docgen-label"
            style={{ fontSize: '0.78rem', textTransform: 'uppercase', display: 'block', marginBottom: '0.3rem' }}
          >
            New Revision (editable)
          </label>
          <input
            type="text"
            className="form-input"
            value={revision}
            onChange={(e) => setRevision(e.target.value)}
            placeholder="e.g. Rev 01"
          />
        </div>

        <div style={{ marginBottom: '0.85rem' }}>
          <label
            className="docgen-label"
            style={{ fontSize: '0.78rem', textTransform: 'uppercase', display: 'block', marginBottom: '0.3rem' }}
          >
            File (.doc / .docx, max 15 MB)
          </label>
          <input
            type="file"
            className="form-input"
            accept=".doc,.docx"
            onChange={handleFileChange}
            style={{ padding: '0.4rem' }}
          />
        </div>

        <div style={{ marginBottom: '0.85rem' }}>
          <label
            className="docgen-label"
            style={{ fontSize: '0.78rem', textTransform: 'uppercase', display: 'block', marginBottom: '0.3rem' }}
          >
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
          <button
            type="button"
            className="docgen-btn docgen-btn-secondary"
            onClick={onClose}
            disabled={uploading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="docgen-btn docgen-btn-primary"
            onClick={handleSubmit}
            disabled={uploading || !file}
          >
            {uploading ? 'Uploading...' : 'Upload Revision'}
          </button>
        </div>
      </div>
    </div>
  );
};
