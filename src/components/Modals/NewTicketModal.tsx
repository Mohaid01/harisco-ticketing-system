import { X } from 'lucide-react';
import React, { useState } from 'react';

import type { TicketType } from '../../types';

import { TICKET_TYPE_OPTIONS } from '../../constants';

interface NewTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { description: string; justification: string; type: TicketType }) => void;
}

export const NewTicketModal: React.FC<NewTicketModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [type, setType] = useState<TicketType>('hardware');
  const [justification, setJustification] = useState('');
  const [description, setDescription] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const finalDescription = description.trim();
    let finalJustification = justification.trim();

    if (
      type === 'hardware' ||
      type === 'software' ||
      type === 'email' ||
      type === 'others' ||
      type === 'installation'
    ) {
      if (!finalDescription) {
        setErrorMsg('Details are required.');
        return;
      }
      finalJustification = 'N/A - Standard Issue';
    } else if (type === 'maintenance') {
      if (!finalDescription) {
        setErrorMsg('Software List is required.');
        return;
      }
      finalJustification = 'N/A - Software Installation';
    } else if (type === 'upgrade') {
      if (!finalDescription || !finalJustification) {
        setErrorMsg('What to Upgrade list and Justifications are required.');
        return;
      }
    }

    setErrorMsg(null);
    onSubmit({
      type,
      justification: finalJustification,
      description: finalDescription,
    });

    // Reset Form
    setType('hardware');
    setJustification('');
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
            Raise Support Ticket
          </h2>
          <button
            id="btn-modal-close"
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

            {/* Type Category */}
            <div className="form-group">
              <label htmlFor="ticket-type-select" className="form-label">
                Issue Category
              </label>
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

            {/* Conditional Fields Based on Type */}
            {(type === 'hardware' || type === 'software') && (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="ticket-description-input" className="form-label">
                  Details / Troubleshooting Specifics
                </label>
                <textarea
                  id="ticket-description-input"
                  className="form-input"
                  style={{ minHeight: '5.3125rem', resize: 'vertical' }}
                  placeholder="Describe specific symptoms or details about this request..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                />
              </div>
            )}
            {type === 'email' && (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="ticket-description-input" className="form-label">
                  Email Issue Description
                </label>
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
            )}

            {type === 'maintenance' && (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="ticket-description-input" className="form-label">
                  Details
                </label>
                <textarea
                  id="ticket-description-input"
                  className="form-input"
                  style={{ minHeight: '100px', resize: 'vertical' }}
                  placeholder="Enter one software per line..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                />
              </div>
            )}

            {type === 'installation' && (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="ticket-description-input" className="form-label">
                  Software List
                </label>
                <textarea
                  id="ticket-description-input"
                  className="form-input"
                  style={{ minHeight: '5.3125rem', resize: 'vertical' }}
                  placeholder="Enter one software per line..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                />
              </div>
            )}

            {type === 'upgrade' && (
              <>
                <div className="form-group">
                  <label htmlFor="ticket-description-input" className="form-label">
                    What to Upgrade (List)
                  </label>
                  <textarea
                    id="ticket-description-input"
                    className="form-input"
                    style={{ minHeight: '5.3125rem', resize: 'vertical' }}
                    placeholder="Enter items to upgrade, one per line..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="ticket-justification-input" className="form-label">
                    Justifications
                  </label>
                  <textarea
                    id="ticket-justification-input"
                    className="form-input"
                    style={{ minHeight: '3.7188rem', resize: 'vertical' }}
                    placeholder="Why is this system upgrade required?"
                    value={justification}
                    onChange={(e) => setJustification(e.target.value)}
                    required
                  />
                </div>
              </>
            )}
            {type === 'others' && (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="ticket-description-input" className="form-label">
                  Other Issue Description
                </label>
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
            )}
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
            <button id="btn-modal-cancel" type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button id="btn-modal-submit" type="submit" className="btn btn-primary">
              Log Ticket
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
