import { X } from 'lucide-react';
import React, { useState } from 'react';

import type { HSECategory } from '../../types';

import { HSE_CATEGORY_OPTIONS } from '../../constants';

interface NewHSETicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { description: string; category: HSECategory; justification?: string }) => void;
}

export const NewHSETicketModal: React.FC<NewHSETicketModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [category, setCategory] = useState<HSECategory>('general_hse');
  const [description, setDescription] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const finalDescription = description.trim();

    if (!finalDescription) {
      setErrorMsg('Description is required.');
      return;
    }

    setErrorMsg(null);
    onSubmit({
      category,
      description: finalDescription,
    });

    setCategory('general_hse');
    setDescription('');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div
          className="panel-header"
          style={{ padding: '1.0625rem 1.275rem', borderBottom: '0.0531rem solid var(--border-color)', margin: 0 }}
        >
          <h2 className="panel-title" style={{ fontSize: '1.15rem' }}>
            Raise HSE Ticket
          </h2>
          <button
            id="btn-hse-modal-close"
            className="btn btn-secondary"
            style={{ width: '1.7rem', height: '1.7rem', padding: 0, borderRadius: '50%' }}
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ padding: '1.275rem' }}>
            {errorMsg && (
              <div
                style={{
                  backgroundColor: 'rgba(244, 63, 94, 0.15)',
                  border: '0.0531rem solid rgba(244, 63, 94, 0.3)',
                  color: '#f43f5e',
                  padding: '0.5313rem 0.7438rem',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '0.85rem',
                  fontSize: '0.85rem',
                }}
              >
                {errorMsg}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="hse-ticket-category-select" className="form-label">
                Category
              </label>
              <select
                id="hse-ticket-category-select"
                className="form-input"
                style={{ backgroundColor: 'var(--bg-primary)' }}
                value={category}
                onChange={(e) => setCategory(e.target.value as HSECategory)}
              >
                {HSE_CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="hse-ticket-description-input" className="form-label">
                Description
              </label>
              <textarea
                id="hse-ticket-description-input"
                className="form-input"
                style={{ minHeight: '5.3125rem', resize: 'vertical' }}
                placeholder="Describe the HSE issue or request..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>
          </div>

          <div
            style={{
              padding: '0.85rem 1.275rem',
              borderTop: '0.0531rem solid var(--border-color)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.6375rem',
            }}
          >
            <button id="btn-hse-modal-cancel" type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button id="btn-hse-modal-submit" type="submit" className="btn btn-primary">
              Log Ticket
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
