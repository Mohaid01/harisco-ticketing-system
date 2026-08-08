import React from 'react';

import type { AggregatedLog } from '../../types';

interface ActivityLogItemProps {
  log: AggregatedLog;
  onSelectTicket: (ticketId: string) => void;
  getLogIcon: (action: string) => React.ReactNode;
  formatDate: (dateString: string) => string;
  getRoleLabel: (role: string) => string;
}

export const ActivityLogItem: React.FC<ActivityLogItemProps> = ({ log, onSelectTicket, getLogIcon, formatDate, getRoleLabel }) => {
  return (
    <div className="timeline-item timeline-item-clickable" onClick={() => onSelectTicket(log.ticketId)}>
      <div className="timeline-icon-box">{getLogIcon(log.action)}</div>
      <div className="timeline-details">
        <div className="timeline-header">
          <span className="timeline-action">
            {log.action} for <span className="timeline-ticket-id">{log.ticketId}</span>
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
};
