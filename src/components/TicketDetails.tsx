import {
  ArrowLeft,
  Award,
  Calendar,
  CheckCircle2,
  FileText,
  Send,
  ShieldAlert,
  Tag,
  User,
  UserCheck,
} from 'lucide-react';
import React, { useState } from 'react';

import type { AppUser, Ticket, TicketStatus, TicketType } from '../types';

import { ROLE_LABELS, TICKET_TYPE_LABELS, TICKET_TYPE_OPTIONS } from '../constants';

interface TicketDetailsProps {
  ticket: Ticket;
  currentUser: AppUser;
  itUsers: AppUser[];
  onBack: () => void;
  onUpdateStatus: (ticketId: string, status: TicketStatus, actionMessage: string, quotation?: number) => void;
  onAssignTicket: (ticketId: string, assigneeId: string, assigneeName: string) => void;
  onAddComment: (ticketId: string, content: string) => void;
  onEditTicket?: (ticketId: string, data: { description: string; type: TicketType; justification: string }) => void;
  onDeleteTicket?: (ticketId: string) => void;
}

export const TicketDetails: React.FC<TicketDetailsProps> = ({
  ticket,
  currentUser,
  itUsers,
  onBack,
  onUpdateStatus,
  onAssignTicket,
  onAddComment,
  onEditTicket,
  onDeleteTicket,
}) => {
  const [commentText, setCommentText] = useState('');
  const [quotationAmount, setQuotationAmount] = useState<string>('');

  const [isEditing, setIsEditing] = useState(false);
  const [editDescription, setEditDescription] = useState(ticket.description);
  const [editJustification, setEditJustification] = useState(ticket.justification);
  const [editType, setEditType] = useState(ticket.type);

  // Submit comment
  const handleSubmitComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    onAddComment(ticket.id, commentText);
    setCommentText('');
  };

  const getStatusBadge = (status: TicketStatus) => {
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
            Open / Unassigned
          </span>
        );
      case 'awaiting_it_approval':
        return <span className="badge badge-it-app">Awaiting IT</span>;
      case 'awaiting_manager_approval':
        return <span className="badge badge-m-app">Awaiting Manager</span>;
      case 'awaiting_handover':
        return <span className="badge badge-handover">Handover Ready</span>;
      case 'closed':
        return <span className="badge badge-closed">Closed</span>;
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

  // RBAC Action checks
  const isAssignedEngineer = currentUser.role === 'it' && ticket.assigneeId === currentUser.id;
  const canItApprove = isAssignedEngineer && ticket.status === 'awaiting_it_approval';

  const canManagerApprove = currentUser.role === 'manager' && ticket.status === 'awaiting_manager_approval';

  const canItClose = isAssignedEngineer && ticket.status === 'awaiting_it_approval';

  const handleItResolve = () => {
    onUpdateStatus(ticket.id, 'closed', 'Resolved by IT in-house');
  };

  const handleItEscalateWithQuotation = () => {
    if (!quotationAmount) {
      alert('Please provide a quotation amount before escalating.');
      return;
    }
    onUpdateStatus(
      ticket.id,
      'awaiting_manager_approval',
      `Approved by IT - Escalated to Manager with Quotation: Rs ${quotationAmount}`,
      Number(quotationAmount)
    );
  };

  const handleManagerApprove = () => {
    onUpdateStatus(ticket.id, 'awaiting_it_approval', 'Approved by Manager - Awaiting IT Closure');
  };

  const handleSaveEdit = () => {
    if (onEditTicket) {
      onEditTicket(ticket.id, {
        description: editDescription,
        type: editType,
        justification: editJustification,
      });
    }
    setIsEditing(false);
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
          id="btn-details-back"
          className="btn btn-secondary"
          style={{
            width: '42px',
            height: '42px',
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
            {TICKET_TYPE_LABELS[ticket.type]}
          </h1>
        </div>
      </div>

      {/* Two columns details grid */}
      <div className="details-layout">
        {/* Left Column: Description, Justification, Comments */}
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
              {currentUser.role === 'it' && !isEditing && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  {ticket.status !== 'closed' && (
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                      onClick={() => setIsEditing(true)}
                    >
                      Edit Ticket
                    </button>
                  )}
                  <button
                    id="btn-delete-ticket"
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
                    Category Type
                  </label>
                  <select
                    className="form-input"
                    value={editType}
                    onChange={(e) => setEditType(e.target.value as TicketType)}
                  >
                    {TICKET_TYPE_OPTIONS.map((opt) => (
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
                {editType === 'upgrade' && (
                  <div>
                    <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '4px' }}>
                      Justification
                    </label>
                    <textarea
                      className="form-input"
                      style={{ minHeight: '80px' }}
                      value={editJustification}
                      onChange={(e) => setEditJustification(e.target.value)}
                    />
                  </div>
                )}
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
                {/* Conditional Details Based on Ticket Type */}
                {(ticket.type === 'hardware' || ticket.type === 'software') && (
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

                {ticket.type === 'maintenance' && (
                  <>
                    <h3
                      style={{
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        margin: '0 0 8px 0',
                      }}
                    >
                      Software List
                    </h3>
                    <div className="desc-card">
                      <ul style={{ paddingLeft: '20px', margin: 0 }}>
                        {ticket.description.split('\n').map((software, index) => (
                          <li key={index} style={{ marginBottom: '4px' }}>
                            {software}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}

                {ticket.type === 'upgrade' && (
                  <>
                    <h3
                      style={{
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        margin: '0 0 8px 0',
                      }}
                    >
                      What to Upgrade
                    </h3>
                    <div className="desc-card" style={{ marginBottom: '20px' }}>
                      <ul style={{ paddingLeft: '20px', margin: 0 }}>
                        {ticket.description.split('\n').map((item, index) => (
                          <li key={index} style={{ marginBottom: '4px' }}>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="justification-card">
                      <span className="justification-title">
                        <FileText size={14} />
                        Justifications
                      </span>
                      <p
                        style={{
                          color: 'var(--text-primary)',
                          fontSize: '0.9rem',
                          marginTop: '8px',
                        }}
                      >
                        {ticket.justification}
                      </p>
                    </div>
                  </>
                )}
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
                      .map((n: string) => n[0])
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
                      id="add-comment-textarea"
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
                        id="btn-submit-comment"
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

            {/* Workflow actions triggers */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {canItApprove && (
                <>
                  <button
                    id="btn-it-resolve"
                    className="btn btn-success"
                    style={{ width: '100%' }}
                    onClick={handleItResolve}
                  >
                    <CheckCircle2 size={16} />
                    Mark as Resolved
                  </button>

                  {ticket.quotation === undefined ||
                    (ticket.quotation === null && (
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          marginTop: '12px',
                          borderTop: '1px solid var(--border-color)',
                          paddingTop: '12px',
                        }}
                      >
                        <label
                          htmlFor="quotation-input"
                          className="form-label"
                          style={{ fontSize: '0.8rem', marginBottom: 0 }}
                        >
                          Quotation Amount (Rs)
                        </label>
                        <input
                          id="quotation-input"
                          type="number"
                          className="form-input"
                          placeholder="Enter amount"
                          value={quotationAmount}
                          onChange={(e) => setQuotationAmount(e.target.value)}
                        />
                        <button
                          id="btn-it-escalate"
                          className="btn btn-success"
                          style={{ width: '100%' }}
                          onClick={handleItEscalateWithQuotation}
                        >
                          <CheckCircle2 size={16} />
                          Submit Quotation & Escalate
                        </button>
                      </div>
                    ))}
                </>
              )}

              {canManagerApprove && (
                <button
                  id="btn-manager-approve"
                  className="btn btn-success"
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--status-manager-approval)',
                    color: 'white',
                    border: 'none',
                  }}
                  onClick={handleManagerApprove}
                >
                  <Award size={16} />
                  Manager Approve Ticket
                </button>
              )}

              {!canItApprove && !canManagerApprove && !canItClose && (
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
                    {ticket.status === 'closed'
                      ? 'This ticket is closed. No further workflow transitions are possible.'
                      : 'No actions currently required for your role.'}
                  </p>
                </div>
              )}
            </div>

            {/* Assignee modification dropdown for IT users only */}
            {currentUser.role === 'it' && ticket.status !== 'closed' && (
              <div
                style={{
                  marginTop: '20px',
                  paddingTop: '16px',
                  borderTop: '1px solid var(--border-color)',
                }}
              >
                <label
                  htmlFor="assignee-select-details"
                  className="form-label"
                  style={{
                    fontSize: '0.78rem',
                    textTransform: 'uppercase',
                    marginBottom: '6px',
                  }}
                >
                  Assign Support Engineer
                </label>
                <select
                  id="assignee-select-details"
                  className="form-input"
                  style={{ backgroundColor: 'var(--bg-primary)' }}
                  value={ticket.assigneeId || ''}
                  onChange={(e) => {
                    const sel = itUsers.find((u) => u.id === e.target.value);
                    if (sel) {
                      onAssignTicket(ticket.id, sel.id, sel.name);
                    }
                  }}
                >
                  <option value="" disabled>
                    -- Select IT Assignee --
                  </option>
                  {itUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Ticket Information Panel */}
          <div className="panel" style={{ padding: '20px' }}>
            <h2 className="panel-title" style={{ fontSize: '0.95rem', marginBottom: '16px' }}>
              Ticket Details
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Type Category */}
              <div>
                <span className="form-label" style={{ fontSize: '0.72rem', textTransform: 'uppercase' }}>
                  Category Type
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
                  <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{TICKET_TYPE_LABELS[ticket.type]}</span>
                </div>
              </div>

              {/* Quotation */}
              {ticket.quotation !== undefined && ticket.quotation !== null && (
                <div>
                  <span className="form-label" style={{ fontSize: '0.72rem', textTransform: 'uppercase' }}>
                    Quotation Amount
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
                    <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>Rs {ticket.quotation}</span>
                  </div>
                </div>
              )}

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

              {/* Support Assignee details */}
              <div>
                <span className="form-label" style={{ fontSize: '0.72rem', textTransform: 'uppercase' }}>
                  Assigned Engineer
                </span>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginTop: '4px',
                  }}
                >
                  <UserCheck size={16} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>
                    {ticket.assigneeName || 'Not Assigned Yet'}
                  </span>
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
