import { Calendar, Download, X } from 'lucide-react';
import React, { useState } from 'react';

import type { AppUser, LeaveApplication } from '../../types';

import { formatEmployeeCode } from '../../utils';
import { LeaveStatusBadge } from './LeaveStatusBadge';

interface LeaveDetailsModalProps {
  leave: LeaveApplication | null;
  currentUser: AppUser;
  canManageLeaves: boolean;
  onClose: () => void;
  onUpdateStatus: (id: string, status: 'approved' | 'rejected') => void;
}

export const LeaveDetailsModal: React.FC<LeaveDetailsModalProps> = ({
  leave,
  currentUser,
  canManageLeaves,
  onClose,
  onUpdateStatus,
}) => {
  const [showFullscreenImage, setShowFullscreenImage] = useState(false);

  if (!leave) return null;

  const isPendingApproval =
    canManageLeaves && leave.status === 'pending' && leave.userId !== currentUser.id;

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div
          className="modal-content"
          style={{
            maxWidth: '34rem',
            width: '92%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="modal-header-bar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calendar size={18} style={{ color: 'var(--color-primary)' }} />
              <h2 className="panel-title modal-title-sm">Leave Application Details</h2>
            </div>
            <button className="btn btn-secondary modal-close-btn-sm" onClick={onClose}>
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div
            className="modal-body"
            style={{
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            {/* Metadata Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '0.85rem',
                background: 'var(--bg-tertiary)',
                padding: '0.85rem 1rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)',
              }}
            >
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>
                  Applicant
                </span>
                <strong style={{ fontSize: '0.9rem' }}>{leave.userName}</strong>
                {leave.userCode && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>
                    {formatEmployeeCode(leave.userCode)}
                  </span>
                )}
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>
                  Status
                </span>
                <div style={{ marginTop: '0.2rem' }}>
                  <LeaveStatusBadge status={leave.status} />
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>
                  Category
                </span>
                <strong style={{ fontSize: '0.85rem', textTransform: 'capitalize' }}>
                  {leave.category} Leave
                </strong>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>
                  Applied On
                </span>
                <span style={{ fontSize: '0.85rem' }}>
                  {new Date(leave.appliedAt).toLocaleDateString()}
                </span>
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>
                  Duration
                </span>
                <strong style={{ fontSize: '0.85rem', color: 'var(--color-primary)' }}>
                  {leave.startDate} &nbsp;to&nbsp; {leave.endDate}
                </strong>
              </div>
            </div>

            {/* Reason Box */}
            <div>
              <label className="form-label" style={{ marginBottom: '0.35rem' }}>
                Reason for Leave
              </label>
              <div
                style={{
                  background: 'var(--bg-primary)',
                  padding: '0.75rem 0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.85rem',
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                  color: 'var(--text-primary)',
                }}
              >
                {leave.reason}
              </div>
            </div>

            {/* Attachment Preview */}
            {leave.attachment ? (
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.4rem',
                  }}
                >
                  <label className="form-label" style={{ margin: 0 }}>
                    Medical Certificate / Attachment
                  </label>
                  <a
                    href={leave.attachment}
                    download={`medical-certificate-${leave.id}.jpg`}
                    className="btn btn-secondary leave-btn-xs"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      textDecoration: 'none',
                    }}
                  >
                    <Download size={13} /> Download
                  </a>
                </div>

                <div
                  style={{
                    background: 'var(--bg-primary)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    padding: '0.75rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <img
                    src={leave.attachment}
                    alt="Medical Certificate"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '16rem',
                      objectFit: 'contain',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      border: '1px solid var(--border-color)',
                    }}
                    onClick={() => setShowFullscreenImage(true)}
                    title="Click to view full size on screen"
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Click image to open in full size
                  </span>
                </div>
              </div>
            ) : leave.category === 'medical' ? (
              <div
                style={{
                  fontSize: '0.8rem',
                  color: 'var(--text-muted)',
                  fontStyle: 'italic',
                  padding: '0.5rem 0',
                }}
              >
                No medical document attached for this application.
              </div>
            ) : null}
          </div>

          {/* Footer */}
          <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              {isPendingApproval && (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn btn-primary leave-btn-xs"
                    style={{ padding: '0.4rem 0.85rem' }}
                    onClick={() => {
                      onUpdateStatus(leave.id, 'approved');
                      onClose();
                    }}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger leave-btn-xs"
                    style={{ padding: '0.4rem 0.85rem' }}
                    onClick={() => {
                      onUpdateStatus(leave.id, 'rejected');
                      onClose();
                    }}
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Fullscreen Image Lightbox Overlay */}
      {showFullscreenImage && leave.attachment && (
        <div
          className="modal-overlay"
          style={{
            zIndex: 1100,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={() => setShowFullscreenImage(false)}
        >
          <div
            style={{
              position: 'relative',
              maxWidth: '90vw',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="btn btn-secondary modal-close-btn-sm"
              style={{
                position: 'absolute',
                top: '-2.5rem',
                right: 0,
                color: '#fff',
                background: 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                borderRadius: '50%',
                width: '2rem',
                height: '2rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
              onClick={() => setShowFullscreenImage(false)}
              aria-label="Close full size view"
            >
              <X size={18} />
            </button>
            <img
              src={leave.attachment}
              alt="Medical Certificate Full View"
              style={{
                maxWidth: '90vw',
                maxHeight: '85vh',
                objectFit: 'contain',
                borderRadius: 'var(--radius-sm)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
              }}
            />
          </div>
        </div>
      )}
    </>
  );
};
