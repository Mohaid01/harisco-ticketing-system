import { X } from 'lucide-react';
import React, { useState } from 'react';
import type { NoticeType } from '../types';

interface CreateNoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    type: NoticeType;
    en: { title: string; content: string };
    ur: { title: string; content: string };
    expiresAt?: string;
  }) => void;
}

export const CreateNoticeModal: React.FC<CreateNoticeModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [type, setType] = useState<NoticeType>('general');
  const [enTitle, setEnTitle] = useState('');
  const [enContent, setEnContent] = useState('');
  const [urTitle, setUrTitle] = useState('');
  const [urContent, setUrContent] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const finalEnTitle = enTitle.trim();
    const finalEnContent = enContent.trim();
    const finalUrTitle = urTitle.trim();
    const finalUrContent = urContent.trim();

    if (!finalEnTitle || !finalEnContent) {
      setErrorMsg('English Title and Content are required.');
      return;
    }

    if (!finalUrTitle || !finalUrContent) {
      setErrorMsg('Urdu Title and Content are required.');
      return;
    }

    setErrorMsg(null);
    onSubmit({
      type,
      en: { title: finalEnTitle, content: finalEnContent },
      ur: { title: finalUrTitle, content: finalUrContent },
      expiresAt: expiresAt ?? undefined,
    });

    // Reset Form
    setType('general');
    setEnTitle('');
    setEnContent('');
    setUrTitle('');
    setUrContent('');
    setExpiresAt('');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        <div
          className="panel-header"
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-color)',
            margin: 0,
          }}
        >
          <h2 className="panel-title" style={{ fontSize: '1.15rem' }}>
            Create New Announcement
          </h2>
          <button
            id="btn-create-notice-close"
            className="btn btn-secondary"
            style={{
              width: '32px',
              height: '32px',
              padding: 0,
              borderRadius: '50%',
            }}
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ padding: '24px', maxHeight: '70vh', overflowY: 'auto' }}>
            {errorMsg && (
              <div
                style={{
                  backgroundColor: 'rgba(244, 63, 94, 0.15)',
                  border: '1px solid rgba(244, 63, 94, 0.3)',
                  color: '#f43f5e',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '16px',
                  fontSize: '0.85rem',
                }}
              >
                {errorMsg}
              </div>
            )}

            {/* Notice Category & Expiry Row */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '16px',
                marginBottom: '16px',
              }}
            >
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="notice-type-select" className="form-label">
                  Category
                </label>
                <select
                  id="notice-type-select"
                  className="form-input"
                  style={{ backgroundColor: 'var(--bg-primary)' }}
                  value={type}
                  onChange={(e) => setType(e.target.value as NoticeType)}
                >
                  <option value="general">General Info</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="outage">Outage / Urgent</option>
                  <option value="policy">Policy Update</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="notice-expiry-input" className="form-label">
                  Expiry Date (Optional)
                </label>
                <input
                  id="notice-expiry-input"
                  type="date"
                  className="form-input"
                  style={{ backgroundColor: 'var(--bg-primary)' }}
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </div>
            </div>

            <hr
              style={{
                border: '0',
                borderTop: '1px dashed var(--border-color)',
                margin: '20px 0',
              }}
            />

            {/* English Fields */}
            <h3
              style={{
                fontSize: '0.95rem',
                fontWeight: 600,
                marginBottom: '12px',
                color: 'var(--text-secondary)',
              }}
            >
              English Version
            </h3>

            <div className="form-group">
              <label htmlFor="notice-en-title" className="form-label">
                Notice Title (EN)
              </label>
              <input
                id="notice-en-title"
                type="text"
                className="form-input"
                placeholder="Enter summary headline..."
                value={enTitle}
                onChange={(e) => setEnTitle(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="notice-en-content" className="form-label">
                Detailed Content (EN)
              </label>
              <textarea
                id="notice-en-content"
                className="form-input"
                style={{ minHeight: '90px', resize: 'vertical' }}
                placeholder="Provide full description in English..."
                value={enContent}
                onChange={(e) => setEnContent(e.target.value)}
                required
              />
            </div>

            <hr
              style={{
                border: '0',
                borderTop: '1px dashed var(--border-color)',
                margin: '20px 0',
              }}
            />

            {/* Urdu Fields */}
            <h3
              style={{
                fontSize: '0.95rem',
                fontWeight: 600,
                marginBottom: '12px',
                color: 'var(--text-secondary)',
              }}
            >
              Urdu Version (اردو)
            </h3>

            <div className="form-group" dir="rtl">
              <label htmlFor="notice-ur-title" className="form-label" style={{ textAlign: 'right', display: 'block' }}>
                اعلان کا عنوان (UR)
              </label>
              <input
                id="notice-ur-title"
                type="text"
                className="form-input"
                style={{ textAlign: 'right' }}
                placeholder="یہاں عنوان لکھیں..."
                value={urTitle}
                onChange={(e) => setUrTitle(e.target.value)}
                required
              />
            </div>

            <div className="form-group" dir="rtl" style={{ marginBottom: 0 }}>
              <label
                htmlFor="notice-ur-content"
                className="form-label"
                style={{ textAlign: 'right', display: 'block' }}
              >
                تفصیلات (UR)
              </label>
              <textarea
                id="notice-ur-content"
                className="form-input"
                style={{
                  minHeight: '90px',
                  resize: 'vertical',
                  textAlign: 'right',
                }}
                placeholder="تفصیلات یہاں درج کریں..."
                value={urContent}
                onChange={(e) => setUrContent(e.target.value)}
                required
              />
            </div>
          </div>

          <div
            style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
            }}
          >
            <button id="btn-create-notice-cancel" type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button id="btn-create-notice-submit" type="submit" className="btn btn-primary">
              Post Notice
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
