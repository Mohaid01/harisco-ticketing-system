import {
  ArrowUpDown,
  ChartNoAxesCombined,
  CheckSquare,
  Clock,
  Filter,
  Plus,
  Search,
  Settings,
  XCircleIcon,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';

import type { AppUser, HSETicket, HSEStatus } from '../types';

import { HSE_CATEGORY_LABELS, HSE_CATEGORY_OPTIONS, HSE_STATUS_OPTIONS } from '../constants';
import { LoadingSpinner } from './LoadingSpinner';

interface HSETicketListProps {
  tickets: HSETicket[];
  currentUser: AppUser;
  onSelectTicket: (ticketId: string) => void;
  onCreateTicketClick: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  loading?: boolean;
}

type SortByOptionHSE = 'newest' | 'oldest' | 'status';

const inputFieldStyle: React.CSSProperties = {
  flex: '1',
  width: '100%',
  height: '38px',
  padding: '6px 12px',
  backgroundColor: 'var(--bg-primary)',
  boxSizing: 'border-box',
};

export const HSETicketList: React.FC<HSETicketListProps> = ({
  tickets,
  currentUser,
  onSelectTicket,
  onCreateTicketClick,
  searchQuery,
  setSearchQuery,
  loading = false,
}) => {
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortByOptionHSE>('newest');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const hseUserNames = useMemo(
    () =>
      currentUser.department === 'HSE'
        ? tickets.map((t) => t.assigneeName).filter(Boolean)
        : [],
    [tickets, currentUser.department]
  );

  const filteredTickets = useMemo(() => {
    return tickets
      .filter((ticket) => {
        const matchesSearch =
          ticket.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          ticket.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          ticket.reporterName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          HSE_CATEGORY_LABELS[ticket.category].toLowerCase().includes(searchQuery.toLowerCase());

        const matchesCategory = categoryFilter === 'all' || ticket.category === categoryFilter;

        const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;

        const ticketTime = new Date(ticket.createdAt).getTime();
        const start = startDate ? new Date(`${startDate}T00:00:00`).getTime() : null;
        const end = endDate ? new Date(`${endDate}T23:59:59`).getTime() : null;

        const matchesStartDate = !start || ticketTime >= start;
        const matchesEndDate = !end || ticketTime <= end;

        return matchesSearch && matchesCategory && matchesStatus && matchesStartDate && matchesEndDate;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        if (sortBy === 'oldest') {
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        if (sortBy === 'status') {
          return a.status.localeCompare(b.status);
        }
        return 0;
      });
  }, [tickets, searchQuery, categoryFilter, statusFilter, sortBy, startDate, endDate]);

  const open = tickets.filter((t) => t.status === 'open').length;
  const escalated = tickets.filter((t) => t.status === 'escalated').length;
  const inProgress = tickets.filter((t) => t.status === 'in_progress').length;
  const rejected = tickets.filter((t) => t.status === 'rejected').length;
  const closed = tickets.filter((t) => t.status === 'closed').length;

  const getStatusBadge = (status: HSEStatus) => {
    switch (status) {
      case 'open':
        return (
          <span
            className="badge"
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
            className="badge"
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

  const getCategoryLabel = (category: string): string => {
    return HSE_CATEGORY_LABELS[category as keyof typeof HSE_CATEGORY_LABELS] || category;
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
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.275rem',
        }}
      >
        <div>
          <h1 className="page-title">HSE Tickets Queue</h1>
          <p className="page-subtitle">
            {currentUser.department === 'HSE'
              ? 'View and manage all HSE tickets.'
              : 'View and manage your raised HSE issues.'}
          </p>
        </div>
        {(currentUser.department !== 'Staff' || currentUser.role === 'executive') && (
          <button id="btn-raise-hse-ticket-list" className="btn btn-primary" onClick={onCreateTicketClick}>
            <Plus size={16} />
            Raise Ticket
          </button>
        )}
      </div>

      <div className="dashboard-grid">
        <div
          className="stat-card prog"
          onClick={() => setStatusFilter('open')}
          style={{ borderLeft: '0.2125rem solid #0e529b' }}
        >
          <div className="stat-header">
            <span className="stat-label">Open</span>
            <div className="stat-icon">
              <Clock size={16} />
            </div>
          </div>
          <span className="stat-value">{open}</span>
          <span className="stat-desc">Awaiting action</span>
        </div>

        <div
          className="stat-card it-app"
          onClick={() => setStatusFilter('escalated')}
          style={{ borderLeft: '0.2125rem solid #f59e0b' }}
        >
          <div className="stat-header">
            <span className="stat-label">Escalated</span>
            <div className="stat-icon">
              <Settings size={16} />
            </div>
          </div>
          <span className="stat-value">{escalated}</span>
          <span className="stat-desc">Awaiting executive review</span>
        </div>

        <div
          className="stat-card handover"
          onClick={() => setStatusFilter('in_progress')}
          style={{ borderLeft: '0.2125rem solid #06b6d4' }}
        >
          <div className="stat-header">
            <span className="stat-label">In Progress</span>
            <div className="stat-icon">
              <Clock size={16} />
            </div>
          </div>
          <span className="stat-value">{inProgress}</span>
          <span className="stat-desc">Assigned and active</span>
        </div>

        <div
          className="stat-card done"
          onClick={() => setStatusFilter('rejected')}
          style={{ borderLeft: '0.2125rem solid #ef4444' }}
        >
          <div className="stat-header">
            <span className="stat-label">Rejected</span>
            <div className="stat-icon">
              <XCircleIcon size={16} />
            </div>
          </div>
          <span className="stat-value">{rejected}</span>
          <span className="stat-desc">Rejected tickets</span>
        </div>

        <div
          className="stat-card done"
          onClick={() => setStatusFilter('closed')}
          style={{ borderLeft: '0.2125rem solid #10b981' }}
        >
          <div className="stat-header">
            <span className="stat-label">Closed</span>
            <div className="stat-icon">
              <CheckSquare size={16} />
            </div>
          </div>
          <span className="stat-value">{closed}</span>
          <span className="stat-desc">Completed tickets</span>
        </div>
      </div>

      <div className="panel" style={{ padding: '0.85rem 1.0625rem', marginBottom: '1.275rem' }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px 16px',
            width: '100%',
            alignItems: 'center',
          }}
        >
          <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '220px' }}>
            <input
              id="search-hse-tickets-input"
              type="text"
              placeholder="Search ID, category, description..."
              className="form-input"
              style={{
                width: '100%',
                paddingLeft: '36px',
                height: '38px',
                backgroundColor: 'var(--bg-primary)',
              }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: '0.6375rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <Filter size={14} style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Date:</span>
            <input
              type="date"
              className="form-input"
              style={{
                height: '38px',
                padding: '4px 7px',
                backgroundColor: 'var(--bg-primary)',
                color: '#ffffff',
                colorScheme: 'dark',
                width: '135px',
              }}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>To:</span>
            <input
              type="date"
              className="form-input"
              style={{
                height: '38px',
                padding: '4px 7px',
                backgroundColor: 'var(--bg-primary)',
                color: '#ffffff',
                colorScheme: 'dark',
                width: '135px',
              }}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
            {(startDate || endDate) && (
              <button
                className="btn btn-secondary"
                style={{ padding: '6px 10px', fontSize: '0.75rem', height: '38px', whiteSpace: 'nowrap' }}
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
              >
                Clear
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '0 0 auto' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Type:</span>
            <select
              id="filter-hse-category-select"
              className="form-input"
              style={{ ...inputFieldStyle, height: '38px' }}
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">All Categories</option>
              {HSE_CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '0 0 auto' }}>
            <ChartNoAxesCombined size={14} style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Status:</span>
            <select
              id="filter-hse-status-select"
              className="form-input"
              style={{ ...inputFieldStyle, height: '38px' }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              {HSE_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '0 0 auto' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Assignee:</span>
            <select
              id="filter-hse-assignee-select"
              className="form-input"
              style={{ ...inputFieldStyle, height: '38px' }}
              value="all"
              onChange={() => {}}
              disabled={currentUser.department !== 'HSE'}
            >
              <option value="all">All Assignees</option>
              {hseUserNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '0 0 auto' }}>
            <ArrowUpDown size={14} style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Sort:</span>
            <select
              id="sort-hse-tickets-select"
              className="form-input"
              style={{ ...inputFieldStyle, height: '38px' }}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortByOptionHSE)}
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="status">By Status</option>
            </select>
          </div>
        </div>
      </div>

      <span className="stat-desc" style={{ textAlign: 'right' }}>
        Showing {filteredTickets.length} of {tickets.length} tickets
      </span>

      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Ticket ID</th>
                <th>Category</th>
                <th>Raised By</th>
                <th>Assignee</th>
                <th>Status</th>
                <th>Created At</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <LoadingSpinner type="table" rows={6} />
              ) : (
                filteredTickets.map((ticket) => (
                  <tr
                    key={ticket.id}
                    onClick={() => {
                      onSelectTicket(ticket.id);
                    }}
                  >
                    <td style={{ fontWeight: 'bold', width: '9rem' }}>{ticket.id}</td>
                    <td>
                      <span className="badge badge-type">{getCategoryLabel(ticket.category)}</span>
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>{ticket.reporterName}</td>
                    <td style={{ fontSize: '0.85rem' }}>
                      {ticket.assigneeName ? (
                        <span style={{ color: 'var(--text-primary)' }}>{ticket.assigneeName}</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Unassigned</span>
                      )}
                    </td>
                    <td>{getStatusBadge(ticket.status)}</td>
                    <td
                      style={{
                        fontSize: '0.78rem',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {formatDate(ticket.createdAt)}
                    </td>
                  </tr>
                ))
              )}
              {filteredTickets.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      textAlign: 'center',
                      padding: '2.55rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    No HSE tickets found matching the search criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
