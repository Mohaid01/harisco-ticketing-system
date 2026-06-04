import React, { useState } from 'react';
import { TICKET_TYPE_OPTIONS } from '../constants';
import type { TicketType } from '../types';
import { X } from 'lucide-react';

interface NewTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    description: string;
    justification: string;
    type: TicketType;
  }) => void;
}

export const NewTicketModal: React.FC<NewTicketModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<TicketType>('hardware');
  const [justification, setJustification] = useState('');
  const [description, setDescription] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !description.trim() || !justification.trim()) {
      setErrorMsg('All fields are required. Please describe the problem and fill in the justification.');
      return;
    }

    setErrorMsg(null);
    onSubmit({
      title,
      type,
      justification,
      description,
    });

    // Reset Form
    setTitle('');
    setType('hardware');
    setJustification('');
    setDescription('');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="panel-header" style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', margin: 0 }}>
          <h2 className="panel-title" style={{ fontSize: '1.15rem' }}>Raise Support Ticket</h2>
          <button
            id="btn-modal-close"
            className="btn btn-secondary"
            style={{ width: '32px', height: '32px', padding: 0, borderRadius: '50%' }}
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ padding: '24px' }}>
            {errorMsg && (
              <div style={{ backgroundColor: 'rgba(244, 63, 94, 0.15)', border: '1px solid rgba(244, 63, 94, 0.3)', color: '#f43f5e', padding: '10px 14px', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: '0.85rem' }}>
                {errorMsg}
              </div>
            )}

            {/* Title */}
            <div className="form-group">
              <label htmlFor="ticket-title-input" className="form-label">Title / Short Summary</label>
              <input
                id="ticket-title-input"
                type="text"
                className="form-input"
                placeholder="e.g. Keyboard keys jammed on labeling terminal #3"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            {/* Type Category */}
            <div className="form-group">
              <label htmlFor="ticket-type-select" className="form-label">Issue Category</label>
              <select
                id="ticket-type-select"
                className="form-input"
                style={{ backgroundColor: 'var(--bg-primary)' }}
                value={type}
                onChange={(e) => setType(e.target.value as TicketType)}
              >
                {TICKET_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Justification */}
            <div className="form-group">
              <label htmlFor="ticket-justification-input" className="form-label">Justification / Importance</label>
              <textarea
                id="ticket-justification-input"
                className="form-input"
                style={{ minHeight: '70px', resize: 'vertical' }}
                placeholder="Why is this installation, upgrade, or issue fixing required?"
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                required
              />
            </div>

            {/* Description */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="ticket-description-input" className="form-label">Details / Troubleshooting Specifics</label>
              <textarea
                id="ticket-description-input"
                className="form-input"
                style={{ minHeight: '100px', resize: 'vertical' }}
                placeholder="Describe specific symptoms or details about this request..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button
              id="btn-modal-cancel"
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              id="btn-modal-submit"
              type="submit"
              className="btn btn-primary"
            >
              Log Ticket
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
