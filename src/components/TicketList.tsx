import {
  ArrowUpDown,
  CheckSquare,
  Clock,
  Filter,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  UserCheck,
  ChartNoAxesCombined,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';

import type { AppUser, Ticket, TicketStatus, TicketType } from '../types';

import { STATUS_OPTIONS, TICKET_TYPE_LABELS, TICKET_TYPE_OPTIONS } from '../constants';
import { LoadingSpinner } from './LoadingSpinner';

interface TicketListProps {
  tickets: Ticket[];
  users: AppUser[];
  currentUser: AppUser;
  onSelectTicket: (ticketId: string) => void;
  onCreateTicketClick: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  loading?: boolean;
}

type SortByOption = 'newest' | 'oldest' | 'status';

const inputFieldStyle: React.CSSProperties = {
  flex: '1',
  width: '100%',
  height: '38px',
  padding: '6px 12px',
  backgroundColor: 'var(--bg-primary)',
  boxSizing: 'border-box',
};

export const TicketList: React.FC<TicketListProps> = ({
  tickets,
  users,
  currentUser,
  onSelectTicket,
  onCreateTicketClick,
  searchQuery,
  setSearchQuery,
  loading = false,
}) => {
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortByOption>('newest');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  //  Add date filter
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Get IT users for assignee filter
  const itUserNames = useMemo(() => users.filter((user) => user.role === 'it').map((user) => user.name), [users]);

  // Filter based on user role + dropdown filters + search query
  const filteredTickets = useMemo(() => {
    return tickets
      .filter((ticket) => {
        // RBAC: Employee only sees own tickets, IT, Managers and Executives see all
        // Search text filter
        const matchesSearch =
          ticket.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          ticket.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          ticket.reporterName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          TICKET_TYPE_LABELS[ticket.type].toLowerCase().includes(searchQuery.toLowerCase());

        // Dropdown type filter
        const matchesType = typeFilter === 'all' || ticket.type === typeFilter;

        // Dropdown status filter
        const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;

        // Dropdown assignee filter
        const matchesAssignee = assigneeFilter === 'all' || ticket.assigneeName === assigneeFilter;

        return matchesSearch && matchesType && matchesStatus && matchesAssignee;
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
  }, [tickets, searchQuery, typeFilter, statusFilter, assigneeFilter, sortBy]);

  // Calculate statistics from the ROLE-filtered tickets (or all tickets? Let's use role-filtered for Employee, all for IT/Manager to make it feel specific)
  const awaitingIt = tickets.filter((t) => t.status === 'awaiting_it_approval').length;
  const awaitingManager = tickets.filter((t) => t.status === 'awaiting_manager_approval').length;
  const open = tickets.filter((t) => t.status === 'open').length;
  const awaitingHandover = tickets.filter((t) => t.status === 'awaiting_handover').length;
  const closed = tickets.filter((t) => t.status === 'closed').length;

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
            Open
          </span>
        );
      case 'awaiting_it_approval':
        return <span className="badge badge-it-app">In Progress</span>;
      case 'awaiting_manager_approval':
        return <span className="badge badge-m-app">Mgr Apprv</span>;
      case 'awaiting_handover':
        return <span className="badge badge-handover">Handover Ready</span>;
      case 'closed':
        return <span className="badge badge-closed">Closed</span>;
    }
  };

  const getTicketTypeLabel = (type: TicketType) => {
    return TICKET_TYPE_LABELS[type];
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
          marginBottom: '24px',
        }}
      >
        <div>
          <h1 className="page-title">Support Tickets Queue</h1>
          <p className="page-subtitle">
            {currentUser.isDepartmentHead
              ? 'View and manage tickets for your department.'
              : currentUser.role === 'employee'
                ? 'View and manage your raised issues.'
                : 'Review and transition team tickets.'}
          </p>
        </div>
        <button id="btn-raise-ticket-list" className="btn btn-primary" onClick={onCreateTicketClick}>
          <Plus size={16} />
          Raise Ticket
        </button>
      </div>

      {/* Metric Cards */}
      <div className="dashboard-grid">
        <div
          className="stat-card it-app"
          onClick={() => {
            setStatusFilter('awaiting_it_approval');
          }}
        >
          <div className="stat-header">
            <span className="stat-label">Awaiting IT</span>
            <div className="stat-icon">
              <Clock size={16} />
            </div>
          </div>
          <span className="stat-value">{awaitingIt}</span>
          <span className="stat-desc">Pending initial IT review</span>
        </div>

        <div
          className="stat-card m-app"
          onClick={() => {
            setStatusFilter('awaiting_manager_approval');
          }}
        >
          <div className="stat-header">
            <span className="stat-label">Awaiting Manager</span>
            <div className="stat-icon">
              <ShieldCheck size={16} />
            </div>
          </div>
          <span className="stat-value">{awaitingManager}</span>
          <span className="stat-desc">Pending manager signoff</span>
        </div>

        <div
          className="stat-card prog"
          onClick={() => {
            setStatusFilter('open');
          }}
        >
          <div className="stat-header">
            <span className="stat-label">Open Tickets</span>
            <div className="stat-icon">
              <Settings size={16} />
            </div>
          </div>
          <span className="stat-value">{open}</span>
          <span className="stat-desc">Pending assignment or action</span>
        </div>

        <div
          className="stat-card handover"
          onClick={() => {
            setStatusFilter('awaiting_handover');
          }}
        >
          <div className="stat-header">
            <span className="stat-label">Handover</span>
            <div className="stat-icon">
              <UserCheck size={16} />
            </div>
          </div>
          <span className="stat-value">{awaitingHandover}</span>
          <span className="stat-desc">Awaiting employee acceptance</span>
        </div>

        <div
          className="stat-card done"
          onClick={() => {
            setStatusFilter('closed');
          }}
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

      {/* Filter and Search Bar */}
      <div className="panel" style={{ padding: '16px 20px', marginBottom: '24px' }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px 16px',
            width: '100%',
            alignItems: 'center',
          }}
        >
          {/* Search bar input - Expands to fill available space */}
          <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '220px' }}>
            <input
              id="search-tickets-input"
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
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
          </div>

          {/* Date Range Filter Group */}
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

          {/* Ticket Type Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '0 0 auto' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Type:</span>
            <select
              id="filter-type-select"
              className="form-input"
              style={{ ...inputFieldStyle, height: '38px' }}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="all">All Types</option>
              {TICKET_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '0 0 auto' }}>
            <ChartNoAxesCombined size={14} style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Status:</span>
            <select
              id="filter-status-select"
              className="form-input"
              style={{ ...inputFieldStyle, height: '38px' }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Assignee Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '0 0 auto' }}>
            <UserCheck size={14} style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Assignee:</span>
            <select
              id="filter-assignee-select"
              className="form-input"
              style={{ ...inputFieldStyle, height: '38px' }}
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
            >
              <option value="all">All Assignees</option>
              {itUserNames.map((itUserName) => (
                <option key={itUserName} value={itUserName}>
                  {itUserName}
                </option>
              ))}
            </select>
          </div>

          {/* Sort Selection */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '0 0 auto' }}>
            <ArrowUpDown size={14} style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Sort:</span>
            <select
              id="sort-tickets-select"
              className="form-input"
              style={{ ...inputFieldStyle, height: '38px' }}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortByOption)}
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="status">By Status</option>
            </select>
          </div>
        </div>
      </div>

      {/* showing tickets count */}
      <span className="stat-desc" style={{ textAlign: 'right' }}>
        Showing {filteredTickets.length} of {tickets.length} tickets
      </span>

      {/* Ticket List Table */}
      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Ticket ID</th>
                <th>Description</th>
                <th>Category Type</th>
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
                    <td style={{ fontWeight: 'bold', width: '90px' }}>{ticket.id}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span
                          style={{
                            fontWeight: 600,
                            color: 'white',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: '340px',
                          }}
                        >
                          {ticket.description}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-type">{getTicketTypeLabel(ticket.type)}</span>
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>{ticket.reporterName}</td>
                    <td style={{ fontSize: '0.85rem' }}>
                      {ticket.assigneeName ? (
                        <span style={{ color: 'var(--text-primary)' }}>{ticket.assigneeName}</span>
                      ) : (
                        <span
                          style={{
                            color: 'var(--text-muted)',
                            fontStyle: 'italic',
                          }}
                        >
                          Unassigned
                        </span>
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
                    colSpan={7}
                    style={{
                      textAlign: 'center',
                      padding: '48px',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    No tickets found matching the search criteria.
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
