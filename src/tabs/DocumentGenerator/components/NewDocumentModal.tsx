import React, { useEffect } from 'react';

import type { AppUser } from '../../../types';

import { ControlledDocumentForm } from './ControlledDocumentForm';
import { CorporateSchemeSelector } from './CorporateSchemeSelector';
import { SignOffSection } from './SignOffSection';

interface NewDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  allUsers: AppUser[];
  entityCode: string;
  setEntityCode: (val: string) => void;
  departmentCode: string;
  setDepartmentCode: (val: string) => void;
  docTypeCode: string;
  setDocTypeCode: (val: string) => void;
  revision: string;
  setRevision: (val: string) => void;
  previewId: string;
  previewLoading: boolean;
  signOff: any;
  setSignOff: (val: any) => void;
  controlledData: any;
  setControlledData: (val: any) => void;
  isSubmitting: boolean;
  onSaveDraft: () => void;
  onDownload: () => void;
}

export const NewDocumentModal: React.FC<NewDocumentModalProps> = ({
  isOpen,
  onClose,
  allUsers,
  entityCode,
  setEntityCode,
  departmentCode,
  setDepartmentCode,
  docTypeCode,
  setDocTypeCode,
  revision,
  setRevision,
  previewId,
  previewLoading,
  signOff,
  setSignOff,
  controlledData,
  setControlledData,
  isSubmitting,
  onSaveDraft,
  onDownload,
}) => {
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
          width: '95vw',
          maxWidth: '1200px',
          maxHeight: '95vh',
          overflowY: 'auto',
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h4 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            New Document
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

        <CorporateSchemeSelector
          entityCode={entityCode}
          setEntityCode={setEntityCode}
          departmentCode={departmentCode}
          setDepartmentCode={setDepartmentCode}
          docTypeCode={docTypeCode}
          setDocTypeCode={setDocTypeCode}
          revision={revision}
          setRevision={setRevision}
          previewId={previewId}
          previewLoading={previewLoading}
        />

        <ControlledDocumentForm data={controlledData} onChange={setControlledData} />

        <SignOffSection signOff={signOff} setSignOff={setSignOff} allUsers={allUsers} />

        <div
          className="docgen-actions"
          style={{
            marginTop: '1.5rem',
            paddingTop: '1rem',
            borderTop: '0.0531rem solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Target Document ID:{' '}
              <strong style={{ fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>
                {previewId || 'HC-01-COR-LE-0001'}
              </strong>{' '}
              ({revision})
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.65rem' }}>
            <button
              type="button"
              className="docgen-btn docgen-btn-secondary"
              onClick={onSaveDraft}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : 'Save Draft'}
            </button>
            <button
              type="button"
              className="docgen-btn docgen-btn-primary"
              onClick={onDownload}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Generating...' : 'Download'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
