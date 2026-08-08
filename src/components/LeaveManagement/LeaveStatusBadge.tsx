import { CheckCircle, Clock, XCircle } from 'lucide-react';
import React from 'react';

interface LeaveStatusBadgeProps {
  status: string;
}

export const LeaveStatusBadge: React.FC<LeaveStatusBadgeProps> = ({ status }) => {
  switch (status) {
    case 'approved':
      return (
        <span className="badge badge-closed">
          <CheckCircle size={12} /> Approved
        </span>
      );
    case 'rejected':
      return (
        <span className="badge badge-danger">
          <XCircle size={12} /> Rejected
        </span>
      );
    default:
      return (
        <span className="badge badge-m-app">
          <Clock size={12} /> Pending
        </span>
      );
  }
};
