import React, { useState, useMemo } from "react";
import type { Ticket, AppUser, TicketStatus, TicketType } from "../types";
import {
  TICKET_TYPE_LABELS,
  TICKET_TYPE_OPTIONS,
  STATUS_OPTIONS,
} from "../constants";
import { Search, Plus, Filter, ArrowUpDown } from "lucide-react";

interface TicketListProps {
  tickets: Ticket[];
  currentUser: AppUser;
  onSelectTicket: (ticketId: string) => void;
  onCreateTicketClick: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

type SortByOption = "newest" | "oldest" | "status";

export const TicketList: React.FC<TicketListProps> = ({
  tickets,
  currentUser,
  onSelectTicket,
  onCreateTicketClick,
  searchQuery,
  setSearchQuery,
}) => {
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortByOption>("newest");

  // Filter based on user role + dropdown filters + search query
  const filteredTickets = useMemo(() => {
    return tickets
      .filter((ticket) => {
        // RBAC: Employee only sees own tickets, IT and Managers see all
        if (
          currentUser.role === "employee" &&
          ticket.reporterId !== currentUser.id
        ) {
          return false;
        }

        // Search text filter
        const matchesSearch =
          ticket.description
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          ticket.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          ticket.reporterName
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          TICKET_TYPE_LABELS[ticket.type]
            .toLowerCase()
            .includes(searchQuery.toLowerCase());

        // Dropdown type filter
        const matchesType = typeFilter === "all" || ticket.type === typeFilter;

        // Dropdown status filter
        const matchesStatus =
          statusFilter === "all" || ticket.status === statusFilter;

        return matchesSearch && matchesType && matchesStatus;
      })
      .sort((a, b) => {
        if (sortBy === "newest") {
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        }
        if (sortBy === "oldest") {
          return (
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        }
        if (sortBy === "status") {
          return a.status.localeCompare(b.status);
        }
        return 0;
      });
  }, [tickets, currentUser, searchQuery, typeFilter, statusFilter, sortBy]);

  const getStatusBadge = (status: TicketStatus) => {
    switch (status) {
      case "open":
        return (
          <span
            className="badge badge-progress"
            style={{
              backgroundColor: "rgba(14, 82, 155, 0.12)",
              color: "#0e529b",
            }}
          >
            Open
          </span>
        );
      case "awaiting_it_approval":
        return <span className="badge badge-it-app">IT Apprv</span>;
      case "awaiting_manager_approval":
        return <span className="badge badge-m-app">Mgr Apprv</span>;
      case "awaiting_handover":
        return <span className="badge badge-handover">Handover Ready</span>;
      case "closed":
        return <span className="badge badge-closed">Closed</span>;
    }
  };

  const getTicketTypeLabel = (type: TicketType) => {
    return TICKET_TYPE_LABELS[type];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
        }}
      >
        <div>
          <h1 className="page-title">Support Tickets Queue</h1>
          <p className="page-subtitle">
            {currentUser.role === "employee"
              ? "View and manage your raised issues."
              : "Review and transition team tickets."}
          </p>
        </div>
        <button
          id="btn-raise-ticket-list"
          className="btn btn-primary"
          onClick={onCreateTicketClick}
        >
          <Plus size={16} />
          Raise Issue Ticket
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div
        className="panel"
        style={{ padding: "16px 20px", marginBottom: "24px" }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "16px",
            alignItems: "center",
          }}
        >
          {/* Search bar input */}
          <div style={{ position: "relative", flex: "1 1 220px" }}>
            <input
              id="search-tickets-input"
              type="text"
              placeholder="Search ID, category, description..."
              className="form-input"
              style={{
                paddingLeft: "36px",
                height: "38px",
                backgroundColor: "var(--bg-primary)",
              }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Search
              size={16}
              style={{
                position: "absolute",
                left: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-muted)",
              }}
            />
          </div>

          {/* Ticket Type Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Filter size={14} style={{ color: "var(--text-muted)" }} />
            <span
              style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}
            >
              Type:
            </span>
            <select
              id="filter-type-select"
              className="form-input"
              style={{
                width: "150px",
                height: "38px",
                padding: "6px 12px",
                backgroundColor: "var(--bg-primary)",
              }}
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
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}
            >
              Status:
            </span>
            <select
              id="filter-status-select"
              className="form-input"
              style={{
                width: "180px",
                height: "38px",
                padding: "6px 12px",
                backgroundColor: "var(--bg-primary)",
              }}
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

          {/* Sort bar selection */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginLeft: "auto",
            }}
          >
            <ArrowUpDown size={14} style={{ color: "var(--text-muted)" }} />
            <select
              id="sort-tickets-select"
              className="form-input"
              style={{
                width: "130px",
                height: "38px",
                padding: "6px 12px",
                backgroundColor: "var(--bg-primary)",
              }}
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

      {/* Ticket List Table */}
      <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
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
              {filteredTickets.map((ticket) => (
                <tr key={ticket.id} onClick={() => onSelectTicket(ticket.id)}>
                  <td style={{ fontWeight: "bold", width: "90px" }}>
                    {ticket.id}
                  </td>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span
                        style={{
                          fontWeight: 600,
                          color: "white",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          maxWidth: "340px",
                        }}
                      >
                        {ticket.description}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className="badge badge-type">
                      {getTicketTypeLabel(ticket.type)}
                    </span>
                  </td>
                  <td style={{ fontSize: "0.85rem" }}>{ticket.reporterName}</td>
                  <td style={{ fontSize: "0.85rem" }}>
                    {ticket.assigneeName ? (
                      <span style={{ color: "var(--text-primary)" }}>
                        {ticket.assigneeName}
                      </span>
                    ) : (
                      <span
                        style={{
                          color: "var(--text-muted)",
                          fontStyle: "italic",
                        }}
                      >
                        Unassigned
                      </span>
                    )}
                  </td>
                  <td>{getStatusBadge(ticket.status)}</td>
                  <td
                    style={{
                      fontSize: "0.78rem",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {formatDate(ticket.createdAt)}
                  </td>
                </tr>
              ))}
              {filteredTickets.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    style={{
                      textAlign: "center",
                      padding: "48px",
                      color: "var(--text-secondary)",
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
