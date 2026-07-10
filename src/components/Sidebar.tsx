import React from "react";
import logoFull from "../assets/harisco-full-logo.png";
import type { AppUser, ActiveTab } from "../types";
import { ROLE_LABELS } from "../constants";
import {
  LayoutDashboard,
  Ticket,
  Users,
  Activity,
  LogOut,
  Key,
  UserCheck,
  Calendar,
  MapPin,
} from "lucide-react";
import { formatEmployeeCode } from "../utils";

interface SidebarProps {
  currentUser: AppUser;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onLogout: () => void;
  onChangePasswordClick: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentUser,
  activeTab,
  setActiveTab,
  onLogout,
  onChangePasswordClick,
}) => {
  // Define menu items
  const menuItems = [
    {
      id: "dashboard" as ActiveTab,
      label: "Dashboard",
      icon: LayoutDashboard,
      roles: ["it", "employee", "manager"],
    },
    {
      id: "tickets" as ActiveTab,
      label: "Tickets",
      icon: Ticket,
      roles: ["it", "employee", "manager"],
    },
    {
      id: "users" as ActiveTab,
      label: "User Management",
      icon: Users,
      roles: ["it"],
    },
    {
      id: "attendance" as ActiveTab,
      label: "Attendance",
      icon: UserCheck,
      roles: ["it", "employee", "manager"],
    },
    {
      id: "leaves" as ActiveTab,
      label: "Leave Management",
      icon: Calendar,
      roles: ["it", "employee", "manager"],
    },
    {
      id: "site_duties" as ActiveTab,
      label: "Site Duties",
      icon: MapPin,
      roles: ["it", "employee", "manager"],
    },
    {
      id: "activity_log" as ActiveTab,
      label: "Activity Logs",
      icon: Activity,
      roles: ["it", "employee", "manager"],
    },
  ];

  // Filter items by current user role
  const visibleItems = menuItems.filter((item) =>
    item.roles.includes(currentUser.role),
  );

  const getRoleBadgeClass = (role: string) => {
    return `role-badge-pill role-badge-${role}`;
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo-container">
          <img src={logoFull} alt="Harisco Logo" className="logo-full" />
        </div>
        <span className="sidebar-tagline">IT Support Operations</span>
      </div>

      <nav style={{ flex: 1 }}>
        <ul className="sidebar-menu">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const isDisabled = item.id === "leaves" && currentUser.role === "employee";
            return (
              <li key={item.id}>
                <button
                  id={`sidebar-tab-${item.id}`}
                  className={`sidebar-item ${isActive ? "active" : ""}`}
                  onClick={() => !isDisabled && setActiveTab(item.id)}
                  disabled={isDisabled}
                  style={isDisabled ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
                >
                  <Icon size={18} />
                  <span>{item.label} {isDisabled && "(Disabled)"}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div
        className="sidebar-footer"
        style={{ display: "flex", flexDirection: "column", gap: "12px" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {currentUser.avatar ? (
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                objectFit: "cover",
                border: "1px solid var(--border-color)",
                flexShrink: 0,
              }}
            />
          ) : (
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                backgroundColor: "var(--color-primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.85rem",
                fontWeight: 700,
                color: "white",
                flexShrink: 0,
              }}
            >
              {currentUser.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2)}
            </div>
          )}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              flex: 1,
            }}
          >
            <span
              style={{
                fontSize: "0.88rem",
                fontWeight: 600,
                color: "white",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {currentUser.name}
            </span>
            <span
              style={{
                fontSize: "0.75rem",
                color: "var(--text-secondary)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              Employee Code:{" "}
              {formatEmployeeCode(currentUser.username || currentUser.id)}
            </span>
            <div>
              <span className={getRoleBadgeClass(currentUser.role)}>
                {ROLE_LABELS[currentUser.role]}
              </span>
            </div>
          </div>
        </div>
        <button
          id="btn-sidebar-reset-password"
          className="btn btn-secondary"
          style={{
            width: "100%",
            padding: "6px 12px",
            fontSize: "0.8rem",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "6px",
            backgroundColor: "rgba(255, 255, 255, 0.05)",
            border: "1px solid var(--border-color)",
            color: "white",
          }}
          onClick={onChangePasswordClick}
        >
          <Key size={14} />
          Reset Password
        </button>
        <button
          id="btn-sidebar-logout"
          className="btn btn-danger"
          style={{
            width: "100%",
            padding: "6px 12px",
            fontSize: "0.8rem",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "6px",
          }}
          onClick={onLogout}
        >
          <LogOut size={14} />
          Sign Out
        </button>
      </div>
    </aside>
  );
};
