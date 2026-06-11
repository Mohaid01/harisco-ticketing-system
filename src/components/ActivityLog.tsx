import React, { useMemo } from 'react';
import type { Ticket, AppUser } from '../types';
import { ROLE_LABELS, TICKET_TYPE_LABELS } from '../constants';
import { Calendar, Tag, ShieldCheck, UserCheck, Play, Plus } from 'lucide-react';

interface ActivityLogProps {
  tickets: Ticket[];
  currentUser: AppUser;
  onSelectTicket: (ticketId: string) => void;
}

export const ActivityLog: React.FC<ActivityLogProps> = ({
  tickets,
  currentUser,
  onSelectTicket,
}) => {
  // Aggregate and sort activity logs across all tickets visible to the current user
  const visibleLogs = useMemo(() => {
    // Filter tickets by RBAC permission first
    const visibleTickets = tickets.filter((t) => {
      if (currentUser.role === 'employee') {
        return t.reporterId === currentUser.id;
      }
      return true; // IT and Manager see all tickets
    });

    // Extract activity logs from visible tickets
    const logs = visibleTickets.flatMap((ticket) =>
      ticket.activityLogs.map((log) => ({
        ...log,
        ticketId: ticket.id,
        ticketTitle: TICKET_TYPE_LABELS[ticket.type],
      }))
    );

    // Sort logs chronologically (newest first)
    return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [tickets, currentUser]);

  const getRoleLabel = (role: string) => {
    return ROLE_LABELS[role as keyof typeof ROLE_LABELS] || role;
  };

  const getLogIcon = (action: string) => {
    const act = action.toLowerCase();
    if (act.includes('raised') || act.includes('created')) {
      return <Plus size={16} style={{ color: 'var(--color-primary-solid)' }} />;
    }
    if (act.includes('escalated') || act.includes('it review')) {
      return <Tag size={16} style={{ color: 'var(--status-it-approval)' }} />;
    }
    if (act.includes('manager')) {
      return <ShieldCheck size={16} style={{ color: 'var(--status-manager-approval)' }} />;
    }
    if (act.includes('handover')) {
      return <Play size={16} style={{ color: 'var(--status-handover)' }} />;
    }
    if (act.includes('closed') || act.includes('accepted')) {
      return <UserCheck size={16} style={{ color: 'var(--status-closed)' }} />;
    }
    return <Calendar size={16} />;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 className="page-title">Activity Logs</h1>
        <p className="page-subtitle">
          {currentUser.role === 'employee'
            ? 'Chronological feed of your ticket updates.'
            : 'Global chronological feed of operational logs.'}
        </p>
      </div>

      <div className="panel" style={{ padding: '24px' }}>
        <div className="timeline">
          {visibleLogs.map((log) => (
            <div className="timeline-item" key={log.id} style={{ cursor: 'pointer' }} onClick={() => onSelectTicket(log.ticketId)}>
              <div className="timeline-icon-box">
                {getLogIcon(log.action)}
              </div>
              <div className="timeline-details" style={{ transition: 'background-color var(--transition-fast)' }}>
                <div className="timeline-header">
                  <span className="timeline-action">
                    {log.action} for{' '}
                    <span style={{ color: 'var(--color-primary-solid)', fontWeight: 'bold' }}>
                      {log.ticketId}
                    </span>
                  </span>
                  <span className="timeline-time">{formatDate(log.timestamp)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                  <div className="timeline-actor">
                    Performed by: <strong>{log.performedByName}</strong>
                    <span className={`role-badge-pill role-badge-${log.performedByRole}`} style={{ fontSize: '0.58rem', padding: '1px 5px', marginLeft: '6px' }}>
                      {getRoleLabel(log.performedByRole)}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    "{log.ticketTitle}"
                  </span>
                </div>
              </div>
            </div>
          ))}

          {visibleLogs.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-secondary)' }}>
              No system activity has been logged yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
