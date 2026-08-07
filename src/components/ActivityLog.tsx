import { Calendar, Play, Plus, ShieldCheck, Tag, UserCheck } from 'lucide-react';
import React, { useMemo } from 'react';

import type { AppUser, Ticket } from '../types';

import { ROLE_LABELS, TICKET_TYPE_LABELS } from '../constants';
import { LoadingSpinner } from './LoadingSpinner';
import './ActivityLog.css';

interface ActivityLogProps {
  tickets: Ticket[];
  currentUser: AppUser;
  onSelectTicket: (ticketId: string) => void;
  loading?: boolean;
}

interface AggregatedLog {
  id: string;
  action: string;
  timestamp: string;
  performedByName: string;
  performedByRole: string;
  ticketId: string;
  ticketTitle: string;
}

const getRoleLabel = (role: string) => ROLE_LABELS[role as keyof typeof ROLE_LABELS] || role;

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

const aggregateLogs = (tickets: Ticket[], currentUser: AppUser): AggregatedLog[] => {
  const visibleTickets = tickets.filter((t) => {
    if (currentUser.role === 'employee') {
      return t.reporterId === currentUser.id;
    }
    return true;
  });

  const logs = visibleTickets.flatMap((ticket) =>
    ticket.activityLogs.map((log) => ({
      ...log,
      ticketId: ticket.id,
      ticketTitle: TICKET_TYPE_LABELS[ticket.type],
    }))
  );

  return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
};

interface ActivityLogItemProps {
  log: AggregatedLog;
  onSelectTicket: (ticketId: string) => void;
}

const ActivityLogItem: React.FC<ActivityLogItemProps> = React.memo(({ log, onSelectTicket }) => {
  return (
    <div className="timeline-item" style={{ cursor: 'pointer' }} onClick={() => onSelectTicket(log.ticketId)}>
      <div className="timeline-icon-box">{getLogIcon(log.action)}</div>
      <div className="timeline-details">
        <div className="timeline-header">
          <span className="timeline-action">
            {log.action} for <span style={{ color: 'var(--color-primary-solid)', fontWeight: 'bold' }}>{log.ticketId}</span>
          </span>
          <span className="timeline-time">{formatDate(log.timestamp)}</span>
        </div>
        <div className="timeline-meta">
          <div className="timeline-actor">
            Performed by: <strong>{log.performedByName}</strong>
            <span className={`role-badge-pill role-badge-${log.performedByRole}`}>{getRoleLabel(log.performedByRole)}</span>
          </div>
          <div className="timeline-ticket-title" title={log.ticketTitle}>
            &quot;{log.ticketTitle}&quot;
          </div>
        </div>
      </div>
    </div>
  );
});

ActivityLogItem.displayName = 'ActivityLogItem';

export const ActivityLog: React.FC<ActivityLogProps> = ({ tickets, currentUser, onSelectTicket, loading = false }) => {
  const visibleLogs = useMemo(() => aggregateLogs(tickets, currentUser), [tickets, currentUser]);

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
          {loading ? (
            <LoadingSpinner type="list" rows={5} />
          ) : (
            <>
              {visibleLogs.map((log) => (
                <ActivityLogItem key={log.id} log={log} onSelectTicket={onSelectTicket} />
              ))}
              {visibleLogs.length === 0 && (
                <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-secondary)' }}>
                  No system activity has been logged yet.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
