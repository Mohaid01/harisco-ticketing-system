import { ArrowLeft, Calendar, CheckCircle2, Send, ShieldAlert, Tag, Undo2, User, XCircleIcon } from 'lucide-react';
import React, { useState } from 'react';

import type { AdminTicket, AdminTicketCategory, AdminTicketStatus, AppUser } from '../types';

import {
  ADMIN_TICKET_CATEGORY_LABELS,
  ADMIN_TICKET_CATEGORY_OPTIONS,
  ADMIN_TICKET_STATUS_LABELS,
  ROLE_LABELS,
} from '../constants';

interface AdminTicketDetailsProps {
  ticket: AdminTicket;
  currentUser: AppUser;
  allUsers: AppUser[];
  onBack: () => void;
  onUpdateStatus: (
    ticketId: string,
    status: AdminTicketStatus,
    actionMessage: string,
    executiveId?: string,
    executiveName?: string
  ) => void;
  onRevertStatus: (ticketId: string) => void;
  onAddComment: (ticketId: string, content: string) => void;
  onEditTicket?: (ticketId: string, data: { description: string; category: AdminTicketCategory }) => void;
  onDeleteTicket?: (ticketId: string) => void;
}

export const AdminTicketDetails: React.FC<AdminTicketDetailsProps> = ({
  ticket,
  currentUser,
  allUsers,
  onBack,
  onUpdateStatus,
  onRevertStatus,
  onAddComment,
  onEditTicket,
  onDeleteTicket,
}) => {
  const [commentText, setCommentText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editDescription, setEditDescription] = useState(ticket.description);
  const [editCategory, setEditCategory] = useState(ticket.category);
  const [selectedExecutiveId, setSelectedExecutiveId] = useState<string>('');
  const [selectedExecutiveName, setSelectedExecutiveName] = useState<string>('');

  const handleSubmitComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    onAddComment(ticket.id, commentText);
    setCommentText('');
  };

  const executives = allUsers.filter((u) => u.role === 'executive' && u.is_active !== 0);

  const getStatusBadge = (status: AdminTicketStatus) => {
    switch (status) {
      case 'awaiting_admin_manager':
        return (
          <span
            className="badge"
            style={{
              backgroundColor: 'rgba(245, 158, 11, 0.12)',
              color: '#f59e0b',
            }}
          >
            Awaiting Admin Manager
          </span>
        );
      case 'awaiting_materials':
        return (
          <span
            className="badge"
            style={{
              backgroundColor: 'rgba(168, 85, 247, 0.12)',
              color: '#a855f7',
            }}
          >
            Awaiting Materials
          </span>
        );
      case 'awaiting_technician':
        return (
          <span
            className="badge"
            style={{
              backgroundColor: 'rgba(6, 182, 212, 0.12)',
              color: '#06b6d4',
            }}
          >
            Awaiting Technician
          </span>
        );
      case 'awaiting_executive':
        return (
          <span
            className="badge"
            style={{
              backgroundColor: 'rgba(236, 72, 153, 0.12)',
              color: '#ec4899',
            }}
          >
            Awaiting Executive
          </span>
        );
      case 'resolved':
        return (
          <span
            className="badge"
            style={{
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              color: '#10b981',
            }}
          >
            Resolved
          </span>
        );
      case 'rejected':
        return (
          <span
            className="badge"
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              color: '#ef4444',
            }}
          >
            Rejected
          </span>
        );
    }
  };

  const getRoleLabel = (role: string) => {
    return ROLE_LABELS[role as keyof typeof ROLE_LABELS] || role;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const canManagerAction = currentUser.role === 'manager';

  const handleSaveEdit = () => {
    if (onEditTicket) {
      onEditTicket(ticket.id, {
        description: editDescription,
        category: editCategory,
      });
    }
    setIsEditing(false);
  };

  const handleDeleteClick = () => {
    if (onDeleteTicket) {
      const msg = [
        'WARNING: You are about to permanently delete admin ticket ',
        ticket.id,
        '.\n\nAre you sure you want to proceed?',
      ].join('');
      const confirmed = window.confirm(msg);
      if (confirmed) {
        onDeleteTicket(ticket.id);
      }
    }
  };

  return (
    <div>
      {/* Detail Header / Back navigation */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <button
          id="btn-admin-details-back"
          className="btn btn-secondary"
          style={{
            width: '42px',
            height: '42px',
            padding: 0,
            borderRadius: '50%',
          }}
          onClick={onBack}
          aria-label="Back to admin ticket queue"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '4px',
            }}
          >
            <span
              style={{
                fontSize: '0.82rem',
                fontFamily: 'var(--font-mono)',
                color: 'var(--color-primary-solid)',
                fontWeight: 'bold',
              }}
            >
              {ticket.id}
            </span>
            {getStatusBadge(ticket.status)}
          </div>
          <h1 className="page-title" style={{ fontSize: '1.4rem', marginBottom: 0 }}>
            {ADMIN_TICKET_CATEGORY_LABELS[ticket.category]}
          </h1>
        </div>
      </div>

      {/* Two columns details grid */}
      <div className="details-layout">
        {/* Left Column: Description, Comments */}
        <div>
          <div className="panel" style={{ padding: '24px', marginBottom: '24px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px',
                borderBottom: '1px solid var(--border-color)',
                paddingBottom: '6px',
              }}
            >
              <h2 className="panel-title" style={{ fontSize: '0.95rem', margin: 0 }}>
                Ticket Content
              </h2>
              {canManagerAction && !isEditing && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  {ticket.status !== 'resolved' && (
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                      onClick={() => setIsEditing(true)}
                    >
                      Edit Ticket
                    </button>
                  )}
                  <button
                    id="btn-delete-admin-ticket"
                    className="btn btn-danger"
                    style={{
                      padding: '4px 8px',
                      fontSize: '0.75rem',
                      backgroundColor: '#dc2626',
                      color: 'white',
                      border: 'none',
                    }}
                    onClick={handleDeleteClick}
                  >
                    Delete Ticket
                  </button>
                </div>
              )}
            </div>

            {isEditing ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  marginBottom: '24px',
                }}
              >
                <div>
                  <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '4px' }}>
                    Category
                  </label>
                  <select
                    className="form-input"
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value as AdminTicketCategory)}
                  >
                    {ADMIN_TICKET_CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '4px' }}>
                    Description
                  </label>
                  <textarea
                    className="form-input"
                    style={{ minHeight: '100px' }}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                  />
                </div>
                <div
                  style={{
                    display: 'flex',
                    gap: '8px',
                    justifyContent: 'flex-end',
                  }}
                >
                  <button className="btn btn-secondary" onClick={() => setIsEditing(false)}>
                    Cancel
                  </button>
                  <button className="btn btn-primary" onClick={handleSaveEdit}>
                    Save Changes
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h3
                  style={{
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    margin: '0 0 8px 0',
                  }}
                >
                  Problem Details
                </h3>
                <div className="desc-card">{ticket.description}</div>
              </>
            )}

            {/* Comments Thread */}
            <div className="comments-container">
              <h2 className="panel-title" style={{ fontSize: '0.95rem', marginBottom: '16px' }}>
                Conversation Threads ({ticket.comments.length})
              </h2>

              <div className="comments-timeline">
                {ticket.comments.map((comment) => (
                  <div className="comment-card" key={comment.id}>
                    <div
                      className="comment-avatar"
                      style={{
                        backgroundColor: 'var(--color-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        color: 'white',
                      }}
                    >
                      {comment.authorName
                        .split(' ')
                        .map((n: string) => n[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2)}
                    </div>
                    <div className="comment-body">
                      <div className="comment-header">
                        <div>
                          <span className="comment-author-name">{comment.authorName}</span>
                          <span
                            className={`role-badge-pill role-badge-${comment.authorRole}`}
                            style={{
                              fontSize: '0.6rem',
                              padding: '1px 6px',
                              marginLeft: '6px',
                            }}
                          >
                            {getRoleLabel(comment.authorRole)}
                          </span>
                        </div>
                        <span className="comment-date">{formatDate(comment.createdAt)}</span>
                      </div>
                      <div className="comment-text">{comment.content}</div>
                    </div>
                  </div>
                ))}
                {ticket.comments.length === 0 && (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '24px 0',
                      color: 'var(--text-muted)',
                      fontSize: '0.85rem',
                    }}
                  >
                    No messages recorded. Post a comment below.
                  </div>
                )}
              </div>

              {/* Add Comment */}
              {currentUser.role !== 'executive' && (
                <div
                  style={{
                    display: 'flex',
                    gap: '14px',
                    alignItems: 'flex-start',
                  }}
                >
                  <div
                    className="comment-avatar"
                    style={{
                      backgroundColor: 'var(--color-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      color: 'white',
                    }}
                  >
                    {currentUser.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2)}
                  </div>
                  <form
                    onSubmit={handleSubmitComment}
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                    }}
                  >
                    <textarea
                      id="add-admin-comment-textarea"
                      className="form-input"
                      style={{ minHeight: '80px', resize: 'vertical' }}
                      placeholder="Enter an update or note..."
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      onKeyDown={(e) => {
                        // Check for Ctrl + Enter or Cmd + Enter (for Mac users)
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                          e.preventDefault(); // Prevents a newline from being added
                          handleSubmitComment(e); // Submits the form
                        }
                      }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        id="btn-submit-admin-comment"
                        type="submit"
                        className="btn btn-primary"
                        style={{ padding: '8px 16px' }}
                      >
                        <Send size={12} />
                        Post Update
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>

          {/* Ticket Activity log timeline */}
          <div className="panel" style={{ padding: '24px' }}>
            <h2 className="panel-title" style={{ fontSize: '0.95rem', marginBottom: '20px' }}>
              Workflow Activity Timeline
            </h2>
            <div className="timeline">
              {ticket.activityLogs.map((log) => (
                <div className="timeline-item" key={log.id}>
                  <div className="timeline-icon-box">
                    <Calendar size={16} />
                  </div>
                  <div className="timeline-details">
                    <div className="timeline-header">
                      <span className="timeline-action">{log.action}</span>
                      <span className="timeline-time">{formatDate(log.timestamp)}</span>
                    </div>
                    <div className="timeline-actor">
                      Performed by: <strong>{log.performedByName}</strong>
                      <span
                        className={`role-badge-pill role-badge-${log.performedByRole}`}
                        style={{
                          fontSize: '0.58rem',
                          padding: '1px 5px',
                          marginLeft: '6px',
                        }}
                      >
                        {getRoleLabel(log.performedByRole)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Workflow Action buttons and details metadata */}
        <div>
          {/* Action Decision Control Box */}
          <div className="panel" style={{ padding: '20px', marginBottom: '24px' }}>
            <h2 className="panel-title" style={{ fontSize: '0.95rem', marginBottom: '16px' }}>
              Approval Decisions
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {canManagerAction && ticket.status !== 'awaiting_admin_manager' && (
                <button
                  id="btn-admin-revert-status"
                  className="btn btn-secondary"
                  style={{
                    width: '100%',
                    backgroundColor: '#f59e0b',
                    color: 'white',
                    border: 'none',
                  }}
                  onClick={() => onRevertStatus(ticket.id)}
                >
                  <Undo2 size={16} />
                  Revert to{' '}
                  {ticket.previousStatus
                    ? ADMIN_TICKET_STATUS_LABELS[ticket.previousStatus as AdminTicketStatus]
                    : 'Open'}
                </button>
              )}

              {canManagerAction && ticket.status !== 'resolved' && ticket.status !== 'rejected' && (
                <>
                  {ticket.status === 'awaiting_admin_manager' && (
                    <>
                      <button
                        id="btn-admin-mgr-to-technician"
                        className="btn btn-success"
                        style={{
                          width: '100%',
                          backgroundColor: '#06b6d4',
                          color: 'white',
                          border: 'none',
                        }}
                        onClick={() => onUpdateStatus(ticket.id, 'awaiting_technician', 'Forwarded to Technician')}
                      >
                        <ShieldAlert size={16} />
                        Forward to Technician
                      </button>

                      <button
                        id="btn-admin-mgr-to-materials"
                        className="btn btn-success"
                        style={{
                          width: '100%',
                          backgroundColor: '#a855f7',
                          color: 'white',
                          border: 'none',
                        }}
                        onClick={() =>
                          onUpdateStatus(ticket.id, 'awaiting_materials', 'Forwarded to Materials Procurement')
                        }
                      >
                        <ShieldAlert size={16} />
                        Acquire Materials
                      </button>

                      <button
                        id="btn-admin-escalate-executive"
                        className="btn btn-success"
                        style={{
                          width: '100%',
                          backgroundColor: '#ec4899',
                          color: 'white',
                          border: 'none',
                        }}
                        onClick={() => onUpdateStatus(ticket.id, 'awaiting_executive', 'Escalated to Executive')}
                      >
                        <ShieldAlert size={16} />
                        Escalate to Executive
                      </button>
                    </>
                  )}

                  {ticket.status === 'awaiting_executive' && (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      <label
                        className="form-label"
                        style={{
                          fontSize: '0.8rem',
                          marginBottom: 0,
                        }}
                      >
                        Select Executive
                      </label>
                      <select
                        className="form-input"
                        style={{
                          backgroundColor: 'var(--bg-primary)',
                          height: '38px',
                        }}
                        value={selectedExecutiveId}
                        onChange={(e) => {
                          const selected = executives.find((u) => u.id === e.target.value);
                          setSelectedExecutiveId(e.target.value);
                          setSelectedExecutiveName(selected?.name || '');
                        }}
                      >
                        <option value="" disabled>
                          -- Select Executive --
                        </option>
                        {executives.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name}
                          </option>
                        ))}
                      </select>
                      <button
                        id="btn-executive-approve"
                        className="btn btn-success"
                        style={{
                          width: '100%',
                          backgroundColor: '#a855f7',
                          color: 'white',
                          border: 'none',
                        }}
                        disabled={!selectedExecutiveId}
                        onClick={() => {
                          if (!selectedExecutiveId || !selectedExecutiveName) {
                            alert('Please select an executive.');
                            return;
                          }
                          onUpdateStatus(
                            ticket.id,
                            'awaiting_materials',
                            `Approved by Executive - Moved to Materials`,
                            selectedExecutiveId,
                            selectedExecutiveName
                          );
                          setSelectedExecutiveId('');
                          setSelectedExecutiveName('');
                        }}
                      >
                        <ShieldAlert size={16} />
                        Approved by Executive
                      </button>
                      <button
                        id="btn-executive-reject"
                        className="btn btn-success"
                        style={{
                          width: '100%',
                          backgroundColor: '#ef4444',
                          color: 'white',
                          border: 'none',
                        }}
                        disabled={!selectedExecutiveId}
                        onClick={() => {
                          if (!selectedExecutiveId || !selectedExecutiveName) {
                            alert('Please select an executive.');
                            return;
                          }
                          onUpdateStatus(
                            ticket.id,
                            'rejected',
                            `Rejected by Executive - ${selectedExecutiveName}`,
                            selectedExecutiveId,
                            selectedExecutiveName
                          );
                          setSelectedExecutiveId('');
                          setSelectedExecutiveName('');
                        }}
                      >
                        <XCircleIcon size={16} />
                        Rejected by Executive
                      </button>
                    </div>
                  )}

                  {ticket.status === 'awaiting_materials' && (
                    <button
                      id="btn-admin-mgr-to-technician"
                      className="btn btn-success"
                      style={{
                        width: '100%',
                        backgroundColor: '#06b6d4',
                        color: 'white',
                        border: 'none',
                      }}
                      onClick={() => onUpdateStatus(ticket.id, 'awaiting_technician', 'Forwarded to Technician')}
                    >
                      <ShieldAlert size={16} />
                      Forward to Technician
                    </button>
                  )}

                  {ticket.status === 'awaiting_technician' && (
                    <button
                      id="btn-admin-resolve"
                      className="btn btn-success"
                      style={{ width: '100%' }}
                      onClick={() => onUpdateStatus(ticket.id, 'resolved', 'Marked as Resolved by Admin Manager')}
                    >
                      <CheckCircle2 size={16} />
                      Mark As Resolved
                    </button>
                  )}
                </>
              )}

              {(ticket.status === 'resolved' || ticket.status === 'rejected') && (
                <div
                  style={{
                    padding: '12px',
                    textAlign: 'center',
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  {ticket.status === 'rejected' && (
                    <XCircleIcon
                      size={20}
                      style={{
                        color: 'red',
                        marginBottom: '4px',
                      }}
                    />
                  )}

                  {ticket.status === 'resolved' && (
                    <CheckCircle2
                      size={20}
                      style={{
                        color: '#10b981',
                        marginBottom: '4px',
                      }}
                    />
                  )}

                  <p
                    style={{
                      fontSize: '0.78rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    This ticket is {ticket.status}. No further workflow transitions are possible.
                  </p>
                </div>
              )}

              {!canManagerAction && ticket.status !== 'resolved' && ticket.status !== 'rejected' && (
                <div
                  style={{
                    padding: '12px',
                    textAlign: 'center',
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <ShieldAlert
                    size={20}
                    style={{
                      color: 'var(--text-muted)',
                      marginBottom: '4px',
                    }}
                  />
                  <p
                    style={{
                      fontSize: '0.78rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    Only Admin Manager can transition ticket statuses.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Ticket Information Panel */}
          <div className="panel" style={{ padding: '20px' }}>
            <h2 className="panel-title" style={{ fontSize: '0.95rem', marginBottom: '16px' }}>
              Ticket Details
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Category */}
              <div>
                <span className="form-label" style={{ fontSize: '0.72rem', textTransform: 'uppercase' }}>
                  Category
                </span>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginTop: '4px',
                  }}
                >
                  <Tag size={16} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>
                    {ADMIN_TICKET_CATEGORY_LABELS[ticket.category]}
                  </span>
                </div>
              </div>

              {/* Reporter details */}
              <div>
                <span className="form-label" style={{ fontSize: '0.72rem', textTransform: 'uppercase' }}>
                  Raised By
                </span>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginTop: '4px',
                  }}
                >
                  <User size={16} style={{ color: 'var(--text-muted)' }} />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{ticket.reporterName}</span>
                    {ticket.reporterEmail && (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        {ticket.reporterEmail}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Date Created */}
              <div>
                <span className="form-label" style={{ fontSize: '0.72rem', textTransform: 'uppercase' }}>
                  Date Created
                </span>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginTop: '4px',
                  }}
                >
                  <Calendar size={16} style={{ color: 'var(--text-muted)' }} />
                  <span
                    style={{
                      fontSize: '0.82rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {formatDate(ticket.createdAt)}
                  </span>
                </div>
              </div>

              {/* Date Updated */}
              <div>
                <span className="form-label" style={{ fontSize: '0.72rem', textTransform: 'uppercase' }}>
                  Last Activity
                </span>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginTop: '4px',
                  }}
                >
                  <Calendar size={16} style={{ color: 'var(--text-muted)' }} />
                  <span
                    style={{
                      fontSize: '0.82rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {formatDate(ticket.updatedAt)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
