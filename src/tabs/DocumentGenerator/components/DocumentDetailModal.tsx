import React, { useEffect, useState } from 'react';

import type { GeneratedDocumentRecord } from '../types';

interface DocumentVersion {
  id: string;
  document_id: string;
  revision: string;
  file_name: string;
  file_path: string;
  file_size: number;
  uploaded_by: string;
  uploaded_at: string;
  note: string | null;
}

interface DocumentDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: GeneratedDocumentRecord | null;
  token: string;
}

export const DocumentDetailModal: React.FC<DocumentDetailModalProps> = ({
  isOpen,
  onClose,
  document,
  token,
}) => {
  const [versions, setVersions] = useState<DocumentVersion[]>([]);

  useEffect(() => {
    if (!isOpen || !document) return;
    const loadVersions = async () => {
      try {
        const res = await fetch(
          `/api/document-generator/documents/${document.id}/versions`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.ok) {
          const data = await res.json();
          setVersions(data.versions || []);
        } else {
          setVersions([]);
        }
      } catch {
        setVersions([]);
      }
    };
    loadVersions();
  }, [isOpen, document, token]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

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
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="docgen-modal-box"
        style={{
          backgroundColor: 'var(--bg-primary)',
          borderRadius: 'var(--radius-md)',
          width: '600px',
          maxWidth: '90vw',
          maxHeight: '85vh',
          overflowY: 'auto',
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
          padding: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h4 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            Document Details
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

        <div style={{ marginBottom: '1rem' }}>
          <p style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
            Document ID
          </p>
          <p style={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#38bdf8', margin: 0 }}>
            {document?.document_id}
          </p>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <p style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
            Document Title
          </p>
          <p style={{ fontSize: '1rem', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
            {document?.title}
          </p>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <p style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
            Revision
          </p>
          <p style={{ fontSize: '1rem', fontWeight: 600, margin: 0, color: 'var(--text-secondary)' }}>
            {document?.revision}
          </p>
          {versions.length > 0 && (
            <div style={{ marginTop: '0.4rem' }}>
              <p style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                Revision History Record
              </p>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '0.0531rem solid var(--border-color)' }}>
                    <th style={{ padding: '0.4rem', color: 'var(--text-muted)', fontWeight: 600 }}>Revision</th>
                    <th style={{ padding: '0.4rem', color: 'var(--text-muted)', fontWeight: 600 }}>Change Note</th>
                    <th style={{ padding: '0.4rem', color: 'var(--text-muted)', fontWeight: 600 }}>Uploaded At</th>
                  </tr>
                </thead>
                <tbody>
                  {versions.map((v) => (
                    <tr key={v.id} style={{ borderBottom: '0.0531rem solid var(--border-color)' }}>
                      <td style={{ padding: '0.4rem', fontWeight: 600 }}>{v.revision}</td>
                      <td style={{ padding: '0.4rem', color: 'var(--text-secondary)' }}>{v.note || '-'}</td>
                      <td style={{ padding: '0.4rem', color: 'var(--text-secondary)' }}>{new Date(v.uploaded_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <p style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
            Entity / Department / Type
          </p>
          <p style={{ fontSize: '0.9rem', margin: 0, color: 'var(--text-secondary)' }}>
            {document?.entity_code} / {document?.department_code} / {document?.doc_type_code}
          </p>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <p style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
            Document Date
          </p>
          <p style={{ fontSize: '0.9rem', margin: 0, color: 'var(--text-secondary)' }}>
            {document?.doc_date || '-'}
          </p>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <h5 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
            Sign-Off &amp; Approval Matrix
          </h5>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <tbody>
              <tr>
                <td style={{ padding: '0.4rem', width: '35%', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Prepared By
                </td>
                <td style={{ padding: '0.4rem', color: 'var(--text-secondary)' }}>{document?.prepared_by_name || '-'}</td>
                <td style={{ padding: '0.4rem', textAlign: 'right', color: 'var(--text-secondary)' }}>
                  {document?.prepared_by_date || '-'}
                </td>
              </tr>
              <tr style={{ borderTop: '0.0531rem solid var(--border-color)' }}>
                <td style={{ padding: '0.4rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Checked / Reviewed By
                </td>
                <td style={{ padding: '0.4rem', color: 'var(--text-secondary)' }}>{document?.checked_by_name || '-'}</td>
                <td style={{ padding: '0.4rem', textAlign: 'right', color: 'var(--text-secondary)' }}>
                  {document?.checked_by_date || '-'}
                </td>
              </tr>
              <tr style={{ borderTop: '0.0531rem solid var(--border-color)' }}>
                <td style={{ padding: '0.4rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Approved By
                </td>
                <td style={{ padding: '0.4rem', color: 'var(--text-secondary)' }}>{document?.approved_by_name || '-'}</td>
                <td style={{ padding: '0.4rem', textAlign: 'right', color: 'var(--text-secondary)' }}>
                  {document?.approved_by_date || '-'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button
            type="button"
            className="docgen-btn docgen-btn-secondary"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
