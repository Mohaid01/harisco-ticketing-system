import React from "react";
import type { Ticket, AppUser, TicketStatus, TicketType } from "../types";
import { TICKET_TYPE_LABELS } from "../constants";
import {
  Clock,
  CheckSquare,
  Settings,
  ShieldCheck,
  UserCheck,
} from "lucide-react";

interface DashboardProps {
  tickets: Ticket[];
  currentUser: AppUser;
  onSelectTicket: (ticketId: string) => void;
  onCreateTicketClick: () => void;
  onViewAllTickets: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  tickets,
  currentUser,
  onSelectTicket,
  onCreateTicketClick,
  onViewAllTickets,
}) => {
  // Filter tickets by role permissions
  const roleTickets = tickets.filter((t) => {
    if (currentUser.role === "employee") {
      return t.reporterId === currentUser.id;
    }
    return true; // IT, Manager, and Executive see all tickets
  });

  // Calculate statistics from the ROLE-filtered tickets (or all tickets? Let's use role-filtered for Employee, all for IT/Manager to make it feel specific)
  const awaitingIt = roleTickets.filter(
    (t) => t.status === "awaiting_it_approval",
  ).length;
  const awaitingManager = roleTickets.filter(
    (t) => t.status === "awaiting_manager_approval",
  ).length;
  const open = roleTickets.filter((t) => t.status === "open").length;
  const awaitingHandover = roleTickets.filter(
    (t) => t.status === "awaiting_handover",
  ).length;
  const closed = roleTickets.filter((t) => t.status === "closed").length;

  // Recent active tickets (up to 4, sorted by updated date)
  const recentTickets = [...roleTickets]
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
    .slice(0, 4);

  const getStatusBadge = (status: TicketStatus) => {
    switch (status) {
      case "awaiting_it_approval":
        return <span className="badge badge-it-app">Awaiting IT</span>;
      case "awaiting_manager_approval":
        return <span className="badge badge-m-app">Awaiting Manager</span>;
      case "open":
        return (
          <span
            className="badge badge-progress"
            style={{
              backgroundColor: "rgba(14, 82, 155, 0.12)",
              color: "#0e529b",
            }}
          >
            Open / Unassigned
          </span>
        );
      case "awaiting_handover":
        return <span className="badge badge-handover">Handover Ready</span>;
      case "closed":
        return <span className="badge badge-closed">Closed</span>;
    }
  };

  const getTicketTypeLabel = (type: TicketType) => {
    return TICKET_TYPE_LABELS[type];
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
          <h1 className="page-title">Operations Dashboard</h1>
          <p className="page-subtitle">
            Welcome back, <strong>{currentUser.name}</strong>. Here is your
            ticketing queue overview.
          </p>
        </div>
        <button
          id="btn-raise-ticket-dash"
          className="btn btn-primary"
          onClick={onCreateTicketClick}
        >
          Raise Issue Ticket
        </button>
      </div>

      {/* Metric Cards */}
      <div className="dashboard-grid">
        <div className="stat-card it-app">
          <div className="stat-header">
            <span className="stat-label">Awaiting IT</span>
            <div className="stat-icon">
              <Clock size={16} />
            </div>
          </div>
          <span className="stat-value">{awaitingIt}</span>
          <span className="stat-desc">Pending initial IT review</span>
        </div>

        <div className="stat-card m-app">
          <div className="stat-header">
            <span className="stat-label">Awaiting Manager</span>
            <div className="stat-icon">
              <ShieldCheck size={16} />
            </div>
          </div>
          <span className="stat-value">{awaitingManager}</span>
          <span className="stat-desc">Pending manager signoff</span>
        </div>

        <div className="stat-card prog">
          <div className="stat-header">
            <span className="stat-label">Open Tickets</span>
            <div className="stat-icon">
              <Settings size={16} />
            </div>
          </div>
          <span className="stat-value">{open}</span>
          <span className="stat-desc">Pending assignment or action</span>
        </div>

        <div className="stat-card handover">
          <div className="stat-header">
            <span className="stat-label">Handover</span>
            <div className="stat-icon">
              <UserCheck size={16} />
            </div>
          </div>
          <span className="stat-value">{awaitingHandover}</span>
          <span className="stat-desc">Awaiting employee acceptance</span>
        </div>

        <div className="stat-card done">
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

      {/* Two Columns Grid */}
      <div className="dashboard-two-col">
        {/* Left Column: Recent tickets */}
        <div className="panel" style={{ minHeight: "340px" }}>
          <div className="panel-header">
            <h2 className="panel-title">
              {currentUser.role === "employee"
                ? "My Active Tickets"
                : "Active System Tickets"}
            </h2>
            <button
              id="btn-view-all-dash"
              className="btn btn-secondary"
              style={{ fontSize: "0.8rem", padding: "6px 12px" }}
              onClick={onViewAllTickets}
            >
              View Full List
            </button>
          </div>

          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ticket ID</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Updated At</th>
                </tr>
              </thead>
              <tbody>
                {recentTickets.map((ticket) => (
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
                            maxWidth: "300px",
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
                    <td>{getStatusBadge(ticket.status)}</td>
                    <td
                      style={{
                        fontSize: "0.78rem",
                        color: "var(--text-muted)",
                      }}
                    >
                      {new Date(ticket.updatedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                  </tr>
                ))}
                {recentTickets.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      style={{
                        textAlign: "center",
                        padding: "40px",
                        color: "var(--text-secondary)",
                      }}
                    >
                      No active tickets matching the current queue view.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Workflow status reference card */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div
            className="panel"
            style={{ backgroundColor: "rgba(14, 82, 155, 0.05)" }}
          >
            <h2
              className="panel-title"
              style={{
                color: "var(--color-primary-solid)",
                marginBottom: "12px",
              }}
            >
              Ticketing Approvals Flow
            </h2>
            <ol
              style={{
                paddingLeft: "16px",
                fontSize: "0.82rem",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                color: "var(--text-secondary)",
              }}
            >
              <li>
                <strong style={{ color: "white" }}>Raise:</strong> Employee
                raises ticket (Hardware, Software, Maintenance, Upgrade).
              </li>
              <li>
                <strong style={{ color: "white" }}>IT Review:</strong> IT
                reviews ticket and chooses to resolve in-house or submit
                quotation.
              </li>
              <li>
                <strong style={{ color: "white" }}>Manager Signoff:</strong>{" "}
                Manager approves escalated tickets to initiate execution work.
              </li>
              <li>
                <strong style={{ color: "white" }}>Handover:</strong> IT
                resolves issue, triggering employee handover acceptance
                checklist.
              </li>
              <li>
                <strong style={{ color: "white" }}>Closure:</strong> Employee
                accepts handover, then IT closes the ticket.
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};
