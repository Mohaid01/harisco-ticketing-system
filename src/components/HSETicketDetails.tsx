import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Send,
  ShieldAlert,
  Tag,
  User,
  UserCheck,
} from 'lucide-react';
import React, { useState } from 'react';

import type { AppUser, HSEStatus, HSETicket } from '../types';

import { HSE_CATEGORY_LABELS, ROLE_LABELS } from '../constants';

interface HSETicketDetailsProps {
  ticket: HSETicket;
  currentUser: AppUser;
  hseUsers: AppUser[];
  onBack: () => void;
  onUpdateStatus: (ticketId: string, status: HSEStatus, actionMessage: string, executiveId?: string, executiveName?: string) => void;
  onAssignTicket: (ticketId: string, assigneeId: string, assigneeName: string) => void;
  onAddComment: (ticketId: string, content: string) => void;
  onDeleteTicket?: (ticketId: string) => void;
}

export const HSETicketDetails: React.FC<HSETicketDetailsProps> = ({
  ticket,
  currentUser,
  hseUsers,
  onBack,
  onUpdateStatus,
  onAssignTicket,
  onAddComment,
  onDeleteTicket,
}) => {
  const [commentText, setCommentText] = useState('');

  const isHSEUser = currentUser.department === 'HSE';
  const isExecutive = currentUser.role === 'executive';

  const getStatusBadge = (status: HSEStatus) => {
    switch (status) {
      case 'open':
        return (
          <span
            className="badge badge-progress"
            style={{
              backgroundColor: 'rgba(14, 82, 155, 0.12)',
              color: '#0e529b',
            }}
          >
            Open
          </span>
        );
      case 'escalated':
        return (
          <span
            className="badge"
            style={{
              backgroundColor: 'rgba(245, 158, 11, 0.12)',
              color: '#f59e0b',
            }}
          >
            Escalated
          </span>
        );
      case 'in_progress':
        return (
          <span
            className="badge"
            style={{
              backgroundColor: 'rgba(6, 182, 212, 0.12)',
              color: '#06b6d4',
            }}
          >
            In Progress
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
      case 'closed':
        return (
          <span
            className="badge badge-closed"
            style={{
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              color: '#10b981',
            }}
          >
            Closed
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

  const canAssignOrEscalate = isHSEUser && ticket.status === 'open';
  const canApproveOrReject = (isHSEUser || isExecutive) && ticket.status === 'escalated';
  const canClose =
    ticket.assigneeId === currentUser.id && ticket.status === 'in_progress';

  const handleEscalate = () => {
    onUpdateStatus(ticket.id, 'escalated', 'Escalated to HSE Executive for review');
  };

  const handleApprove = () => {
    onUpdateStatus(ticket.id, 'in_progress', 'Approved by HSE Executive');
  };

  const handleReject = () => {
    onUpdateStatus(ticket.id, 'rejected', 'Rejected by HSE Executive');
  };

  const handleClose = () => {
    onUpdateStatus(ticket.id, 'closed', 'Closed by HSE Handler');
  };

  const handleDeleteClick = () => {
    if (onDeleteTicket) {
      const confirmMessage = [
        'WARNING: You are about to permanently delete ticket ',
        ticket.id,
        '.\n\nAre you sure you want to proceed?',
      ].join('');

      const confirmed = window.confirm(confirmMessage);
      if (confirmed) {
        onDeleteTicket(ticket.id);
      }
    }
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.85rem',
          marginBottom: '1.275rem',
        }}
      >
        <button
          id="btn-details-back"
          className="btn btn-secondary"
          style={{
            width: '2.2312rem',
            height: '2.2312rem',
            padding: 0,
            borderRadius: '50%',
          }}
          onClick={onBack}
          aria-label="Back to ticket queue"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.425rem',
              marginBottom: '0.2125rem',
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
            {HSE_CATEGORY_LABELS[ticket.category]}
          </h1>
        </div>
      </div>

      <div className="details-layout">
        <div>
          <div className="panel" style={{ padding: '1.275rem', marginBottom: '1.275rem' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.6375rem',
                borderBottom: '0.0531rem solid var(--border-color)',
                paddingBottom: '0.3188rem',
              }}
            >
              <h2 className="panel-title" style={{ fontSize: '0.95rem', margin: 0 }}>
                Ticket Content
              </h2>
              {isHSEUser && ticket.status !== 'closed' && onDeleteTicket && (
                <button
                  id="btn-delete-ticket"
                  className="btn btn-danger"
                  style={{
                    padding: '0.2125rem 0.425rem',
                    fontSize: '0.75rem',
                    backgroundColor: '#dc2626',
                    color: 'white',
                    border: 'none',
                  }}
                  onClick={handleDeleteClick}
                >
                  Delete Ticket
                </button>
              )}
            </div>

            <h3
              style={{
                fontSize: '0.85rem',
                fontWeight: 600,
                margin: '0 0 0.425rem 0',
              }}
            >
              Issue Details
            </h3>
            <div className="desc-card">{ticket.description}</div>

            {ticket.justification && (
              <>
                <h3
                  style={{
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    margin: '1rem 0 0.425rem 0',
                  }}
                >
                  Justification
                </h3>
                <div className="desc-card">{ticket.justification}</div>
              </>
            )}

            <div className="comments-container">
              <h2 className="panel-title" style={{ fontSize: '0.95rem', marginBottom: '0.85rem' }}>
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
                              padding: '0.0531rem 0.3188rem',
                              marginLeft: '0.3188rem',
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
                      padding: '1.275rem 0',
                      color: 'var(--text-muted)',
                      fontSize: '0.85rem',
                    }}
                  >
                    No messages recorded. Post a comment below.
                  </div>
                )}
              </div>

              {currentUser.role !== 'executive' && (
                <div
                  style={{
                    display: 'flex',
                    gap: '0.7438rem',
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
                      .map((n: string) => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2)}
                  </div>
                  <form
                    onSubmit={(e: React.FormEvent) => {
                      e.preventDefault();
                      if (!commentText.trim()) return;
                      onAddComment(ticket.id, commentText);
                      setCommentText('');
                    }}
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5313rem',
                    }}
                  >
                    <textarea
                      id="add-comment-textarea"
                      className="form-input"
                      style={{ minHeight: '4.25rem', resize: 'vertical' }}
                      placeholder="Enter an update or note..."
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                          e.preventDefault();
                          if (!commentText.trim()) return;
                          onAddComment(ticket.id, commentText);
                          setCommentText('');
                        }
                      }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        id="btn-submit-comment"
                        type="submit"
                        className="btn btn-primary"
                        style={{ padding: '0.425rem 0.85rem' }}
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

          <div className="panel" style={{ padding: '1.275rem' }}>
            <h2 className="panel-title" style={{ fontSize: '0.95rem', marginBottom: '1.0625rem' }}>
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
                          padding: '0.0531rem 0.2656rem',
                          marginLeft: '0.3188rem',
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

        <div>
          <div className="panel" style={{ padding: '1.0625rem', marginBottom: '1.275rem' }}>
            <h2 className="panel-title" style={{ fontSize: '0.95rem', marginBottom: '0.85rem' }}>
              Approval Decisions
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6375rem' }}>
              {canAssignOrEscalate && (
                <>
                  {hseUsers.length > 0 && (
                    <div
                      style={{
                        marginBottom: '0.6375rem',
                        paddingTop: '0.6375rem',
                        borderTop: '0.0531rem solid var(--border-color)',
                      }}
                    >
                      <label
                        htmlFor="assignee-select-hse-details"
                        className="form-label"
                        style={{
                          fontSize: '0.78rem',
                          textTransform: 'uppercase',
                          marginBottom: '0.3188rem',
                        }}
                      >
                        Assign To
                      </label>
                      <select
                        id="assignee-select-hse-details"
                        className="form-input"
                        style={{ backgroundColor: 'var(--bg-primary)' }}
                        value=""
                        onChange={(e) => {
                          const sel = hseUsers.find((u) => u.id === e.target.value);
                          if (sel) {
                            onAssignTicket(ticket.id, sel.id, sel.name);
                          }
                        }}
                      >
                        <option value="" disabled>
                          -- Select HSE Handler --
                        </option>
                        {hseUsers.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <button
                    id="btn-hse-escalate"
                    className="btn btn-warning"
                    style={{ width: '100%' }}
                    onClick={handleEscalate}
                  >
                    <ShieldAlert size={16} />
                    Escalate to Executive
                  </button>
                </>
              )}

              {canApproveOrReject && (
                <>
                  <button
                    id="btn-hse-approve"
                    className="btn btn-success"
                    style={{ width: '100%' }}
                    onClick={handleApprove}
                  >
                    <CheckCircle2 size={16} />
                    Approve
                  </button>
                  <button
                    id="btn-hse-reject"
                    className="btn btn-danger"
                    style={{ width: '100%' }}
                    onClick={handleReject}
                  >
                    <ShieldAlert size={16} />
                    Reject
                  </button>
                </>
              )}

              {canClose && (
                <button
                  id="btn-hse-close"
                  className="btn btn-success"
                  style={{ width: '100%' }}
                  onClick={handleClose}
                >
                  <CheckCircle2 size={16} />
                  Close Ticket
                </button>
              )}

              {!canAssignOrEscalate && !canApproveOrReject && !canClose && (
                <div
                  style={{
                    padding: '0.6375rem',
                    textAlign: 'center',
                    backgroundColor: 'var(--bg-primary)',
                    border: '0.0531rem solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <ShieldAlert
                    size={20}
                    style={{
                      color: 'var(--text-muted)',
                      marginBottom: '0.2125rem',
                    }}
                  />
                  <p
                    style={{
                      fontSize: '0.78rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {ticket.status === 'closed' || ticket.status === 'rejected'
                      ? 'This ticket is closed/rejected. No further actions are possible.'
                      : 'No actions currently required for your role.'}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="panel" style={{ padding: '1.0625rem' }}>
            <h2 className="panel-title" style={{ fontSize: '0.95rem', marginBottom: '0.85rem' }}>
              Ticket Information
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <span className="form-label" style={{ fontSize: '0.72rem', textTransform: 'uppercase' }}>
                  Category
                </span>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.425rem',
                    marginTop: '0.2125rem',
                  }}
                >
                  <Tag size={16} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>
                    {HSE_CATEGORY_LABELS[ticket.category]}
                  </span>
                </div>
              </div>

              <div>
                <span className="form-label" style={{ fontSize: '0.72rem', textTransform: 'uppercase' }}>
                  Raised By
                </span>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.425rem',
                    marginTop: '0.2125rem',
                  }}
                >
                  <User size={16} style={{ color: 'var(--text-muted)' }} />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{ticket.reporterName}</span>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {ticket.reporterEmail}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <span className="form-label" style={{ fontSize: '0.72rem', textTransform: 'uppercase' }}>
                  Assigned To
                </span>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.425rem',
                    marginTop: '0.2125rem',
                  }}
                >
                  <UserCheck size={16} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>
                    {ticket.assigneeName || 'Not Assigned Yet'}
                  </span>
                </div>
              </div>

              {ticket.executiveName && (
                <div>
                  <span className="form-label" style={{ fontSize: '0.72rem', textTransform: 'uppercase' }}>
                    Reviewed By
                  </span>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.425rem',
                      marginTop: '0.2125rem',
                    }}
                  >
                    <User size={16} style={{ color: 'var(--text-muted)' }} />
                    <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>
                      {ticket.executiveName}
                    </span>
                  </div>
                </div>
              )}

              <div>
                <span className="form-label" style={{ fontSize: '0.72rem', textTransform: 'uppercase' }}>
                  Date Created
                </span>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.425rem',
                    marginTop: '0.2125rem',
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

              <div>
                <span className="form-label" style={{ fontSize: '0.72rem', textTransform: 'uppercase' }}>
                  Last Activity
                </span>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.425rem',
                    marginTop: '0.2125rem',
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
