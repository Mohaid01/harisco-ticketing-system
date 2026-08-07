import {
  ArrowUpDown,
  CheckSquare,
  Clock,
  Filter,
  Plus,
  Search,
  Settings,
  ShieldAlert,
  XCircleIcon,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';

import type { AdminTicket, AdminTicketCategory, AdminTicketStatus, AppUser } from '../types';

import { ADMIN_TICKET_CATEGORY_LABELS, ADMIN_TICKET_CATEGORY_OPTIONS, ADMIN_TICKET_STATUS_OPTIONS } from '../constants';
import { LoadingSpinner } from './LoadingSpinner';

interface AdminTicketListProps {
  tickets: AdminTicket[];
  currentUser: AppUser;
  onSelectTicket: (ticketId: string) => void;
  onCreateTicketClick: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  loading?: boolean;
}

type SortByOptionAdmin = 'newest' | 'oldest' | 'status';

export const AdminTicketList: React.FC<AdminTicketListProps> = ({
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
  const [sortBy, setSortBy] = useState<SortByOptionAdmin>('newest');

  const filteredTickets = useMemo(() => {
    return tickets
      .filter((ticket) => {
        const matchesSearch =
          ticket.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          ticket.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          ticket.reporterName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          ADMIN_TICKET_CATEGORY_LABELS[ticket.category].toLowerCase().includes(searchQuery.toLowerCase());

        const matchesCategory = categoryFilter === 'all' || ticket.category === categoryFilter;

        const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;

        return matchesSearch && matchesCategory && matchesStatus;
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
  }, [tickets, searchQuery, categoryFilter, statusFilter, sortBy]);

  const awaitingAdminManager = filteredTickets.filter((t) => t.status === 'awaiting_admin_manager').length;
  const awaitingMaterials = filteredTickets.filter((t) => t.status === 'awaiting_materials').length;
  const awaitingTechnician = filteredTickets.filter((t) => t.status === 'awaiting_technician').length;
  const resolved = filteredTickets.filter((t) => t.status === 'resolved').length;
  const rejected = filteredTickets.filter((t) => t.status === 'rejected').length;

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

  const getCategoryLabel = (category: AdminTicketCategory) => {
    return ADMIN_TICKET_CATEGORY_LABELS[category];
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
          <h1 className="page-title">Admin Tickets Queue</h1>
          <p className="page-subtitle">
            {currentUser.role === 'manager'
              ? 'Manage and transition admin department tickets.'
              : 'View and manage your raised admin requests.'}
          </p>
        </div>
        {(currentUser.role === 'manager' ||
          currentUser.role === 'employee' ||
          currentUser.role === 'it' ||
          currentUser.role === 'executive') && (
          <button id="btn-raise-admin-ticket-list" className="btn btn-primary" onClick={onCreateTicketClick}>
            <Plus size={16} />
            Raise Admin Ticket
          </button>
        )}
      </div>

      {/* Metric Cards */}
      <div className="dashboard-grid">
        <div
          className="stat-card"
          style={{
            backgroundColor: 'rgba(245, 158, 11, 0.08)',
            borderLeft: '4px solid #f59e0b',
          }}
        >
          <div className="stat-header">
            <span className="stat-label">Awaiting Admin Manager</span>
            <div className="stat-icon">
              <Clock size={16} />
            </div>
          </div>
          <span className="stat-value">{awaitingAdminManager}</span>
          <span className="stat-desc">Pending admin manager review</span>
        </div>

        <div
          className="stat-card"
          style={{
            backgroundColor: 'rgba(168, 85, 247, 0.08)',
            borderLeft: '4px solid #a855f7',
          }}
        >
          <div className="stat-header">
            <span className="stat-label">Awaiting Materials</span>
            <div className="stat-icon">
              <Settings size={16} />
            </div>
          </div>
          <span className="stat-value">{awaitingMaterials}</span>
          <span className="stat-desc">Pending materials procurement</span>
        </div>

        <div
          className="stat-card"
          style={{
            backgroundColor: 'rgba(6, 182, 212, 0.08)',
            borderLeft: '4px solid #06b6d4',
          }}
        >
          <div className="stat-header">
            <span className="stat-label">Awaiting Technician</span>
            <div className="stat-icon">
              <ShieldAlert size={16} />
            </div>
          </div>
          <span className="stat-value">{awaitingTechnician}</span>
          <span className="stat-desc">Pending technician action</span>
        </div>

        <div
          className="stat-card"
          style={{
            backgroundColor: 'rgba(16, 185, 129, 0.08)',
            borderLeft: '4px solid #10b981',
          }}
        >
          <div className="stat-header">
            <span className="stat-label">Resolved</span>
            <div className="stat-icon">
              <CheckSquare size={16} />
            </div>
          </div>
          <span className="stat-value">{resolved}</span>
          <span className="stat-desc">Completed tickets</span>
        </div>

        <div
          className="stat-card"
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            borderLeft: '4px solid #ef4444',
          }}
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
      </div>

      {/* Filter and Search Bar */}
      <div className="panel" style={{ padding: '16px 20px', marginBottom: '24px' }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '16px',
            alignItems: 'center',
          }}
        >
          {/* Search bar input */}
          <div style={{ position: 'relative', flex: '1 1 220px' }}>
            <input
              id="search-admin-tickets-input"
              type="text"
              placeholder="Search ID, category, description..."
              className="form-input"
              style={{
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

          {/* Category Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={14} style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Category:</span>
            <select
              id="filter-admin-category-select"
              className="form-input"
              style={{
                width: '180px',
                height: '38px',
                padding: '6px 12px',
                backgroundColor: 'var(--bg-primary)',
              }}
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">All Categories</option>
              {ADMIN_TICKET_CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Status:</span>
            <select
              id="filter-admin-status-select"
              className="form-input"
              style={{
                width: '180px',
                height: '38px',
                padding: '6px 12px',
                backgroundColor: 'var(--bg-primary)',
              }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              {ADMIN_TICKET_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Sort bar selection */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginLeft: 'auto',
            }}
          >
            <ArrowUpDown size={14} style={{ color: 'var(--text-muted)' }} />
            <select
              id="sort-admin-tickets-select"
              className="form-input"
              style={{
                width: '130px',
                height: '38px',
                padding: '6px 12px',
                backgroundColor: 'var(--bg-primary)',
              }}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortByOptionAdmin)}
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="status">By Status</option>
            </select>
          </div>
        </div>
      </div>

      {/* Ticket List Table */}
      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Ticket ID</th>
                <th>Description</th>
                <th>Category</th>
                <th>Raised By</th>
                <th>Status</th>
                <th>Created At</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <LoadingSpinner type="table" rows={6} /> : filteredTickets.map((ticket) => (
                <tr key={ticket.id} onClick={() => onSelectTicket(ticket.id)}>
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
                    <span className="badge badge-type">{getCategoryLabel(ticket.category)}</span>
                  </td>
                  <td style={{ fontSize: '0.85rem' }}>{ticket.reporterName}</td>
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
              ))}
              {filteredTickets.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      textAlign: 'center',
                      padding: '48px',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    No admin tickets found matching the search criteria.
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
