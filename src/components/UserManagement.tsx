import React, { useState } from "react";
import type { AppUser, UserRole } from "../types";
import { ROLE_LABELS } from "../constants";
import { UserPlus, Trash2 } from "lucide-react";
import { formatEmployeeCode } from "../utils";

interface UserManagementProps {
  users: AppUser[];
  currentUser: AppUser;
  onAddUser: (data: {
    name: string;
    email: string;
    username: string;
    role: UserRole;
    password?: string;
  }) => void;
  onDeleteUser: (userId: string) => void;
  onUpdateUser?: (
    userId: string,
    data: { name: string; email: string | null },
  ) => void;
}

export const UserManagement: React.FC<UserManagementProps> = ({
  users,
  currentUser,
  onAddUser,
  onDeleteUser,
  onUpdateUser,
}) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("employee");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // States for inline user editing
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!name.trim() || !username.trim()) {
      setErrorMsg("Please supply a name and employee code.");
      return;
    }

    const formattedCode = formatEmployeeCode(username.trim());

    // Check if username already exists
    if (
      users.some(
        (u) => u.username?.toLowerCase() === formattedCode.toLowerCase(),
      )
    ) {
      setErrorMsg("A user with this employee code already exists.");
      return;
    }

    onAddUser({
      name: name.trim(),
      email: email.trim(),
      username: formattedCode,
      role,
      password: password.trim() || undefined,
    });

    setName("");
    setEmail("");
    setUsername("");
    setPassword("");
    setRole("employee");
  };

  const handleSaveEdit = (userId: string) => {
    if (!editName.trim()) {
      alert("Name is required.");
      return;
    }
    if (onUpdateUser) {
      onUpdateUser(userId, {
        name: editName.trim(),
        email: editEmail.trim() || null,
      });
    }
    setEditingUserId(null);
  };

  const getRoleBadgeClass = (role: string) => {
    return `role-badge-pill role-badge-${role}`;
  };

  return (
    <div>
      <div style={{ marginBottom: "24px" }}>
        <h1 className="page-title">User Management</h1>
        <p className="page-subtitle">
          Add and delete user accounts. Manage role authorizations.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 2fr",
          gap: "24px",
          alignItems: "start",
        }}
      >
        {/* Left Column: Add User Form */}
        <div className="panel" style={{ padding: "24px" }}>
          <h2
            className="panel-title"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "20px",
            }}
          >
            <UserPlus size={18} className="status-progress" />
            Add New User
          </h2>

          {errorMsg && (
            <div
              style={{
                backgroundColor: "rgba(244, 63, 94, 0.15)",
                border: "1px solid rgba(244, 63, 94, 0.3)",
                color: "#f43f5e",
                padding: "10px 12px",
                borderRadius: "var(--radius-md)",
                marginBottom: "16px",
                fontSize: "0.85rem",
              }}
            >
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="user-name-input" className="form-label">
                Full Name
              </label>
              <input
                id="user-name-input"
                type="text"
                className="form-input"
                placeholder="e.g. Abid Riaz"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="user-username-input" className="form-label">
                Employee Code
              </label>
              <input
                id="user-username-input"
                type="text"
                className="form-input"
                placeholder="e.g. 001"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="user-email-input" className="form-label">
                Email Address (Optional)
              </label>
              <input
                id="user-email-input"
                type="email"
                className="form-input"
                placeholder="e.g. abid@harisco.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="user-password-input" className="form-label">
                Password
              </label>
              <input
                id="user-password-input"
                type="password"
                className="form-input"
                placeholder={`Optional (defaults to ${import.meta.env.DEFAULT_USER_PASSWORD})`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: "24px" }}>
              <label htmlFor="user-role-select" className="form-label">
                System Role
              </label>
              <select
                id="user-role-select"
                className="form-input"
                style={{ backgroundColor: "var(--bg-primary)" }}
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
              >
                <option value="employee">Employee</option>
                <option value="it">IT Administrator</option>
                <option value="manager">Manager</option>
              </select>
            </div>

            <button
              id="btn-add-user-submit"
              type="submit"
              className="btn btn-primary"
              style={{ width: "100%" }}
            >
              Create Account
            </button>
          </form>
        </div>

        {/* Right Column: Users List Grid */}
        <div className="panel" style={{ padding: "24px" }}>
          <h2 className="panel-title" style={{ marginBottom: "20px" }}>
            Active User Roster ({users.length})
          </h2>

          <div className="user-grid">
            {users.map((user) => (
              <div className="user-card" key={user.id}>
                {editingUserId === user.id ? (
                  <div
                    style={{
                      width: "100%",
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                    }}
                  >
                    <div className="form-group" style={{ marginBottom: "8px" }}>
                      <label
                        className="form-label"
                        style={{ fontSize: "0.75rem", marginBottom: "4px" }}
                      >
                        Full Name
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        style={{ fontSize: "0.85rem", padding: "6px 10px" }}
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        required
                      />
                    </div>
                    <div
                      className="form-group"
                      style={{ marginBottom: "12px" }}
                    >
                      <label
                        className="form-label"
                        style={{ fontSize: "0.75rem", marginBottom: "4px" }}
                      >
                        Email Address
                      </label>
                      <input
                        type="email"
                        className="form-input"
                        style={{ fontSize: "0.85rem", padding: "6px 10px" }}
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        placeholder="Optional"
                      />
                    </div>
                    <div style={{ display: "flex", gap: "8px", width: "100%" }}>
                      <button
                        className="btn btn-secondary"
                        style={{
                          flex: 1,
                          padding: "6px 10px",
                          fontSize: "0.75rem",
                        }}
                        onClick={() => setEditingUserId(null)}
                      >
                        Cancel
                      </button>
                      <button
                        className="btn btn-primary"
                        style={{
                          flex: 1,
                          padding: "6px 10px",
                          fontSize: "0.75rem",
                        }}
                        onClick={() => handleSaveEdit(user.id)}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div
                      className="user-card-avatar"
                      style={{
                        backgroundColor: "var(--color-primary)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "1.2rem",
                        fontWeight: 700,
                        color: "white",
                      }}
                    >
                      {user.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)}
                    </div>
                    <span className="user-card-name">{user.name}</span>
                    <span
                      className="user-card-email"
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "2px",
                        alignItems: "center",
                        fontSize: "0.78rem",
                        color: "var(--text-secondary)",
                      }}
                    >
                      <span>
                        Code: {formatEmployeeCode(user.username || user.id)}
                      </span>
                      {user.email ? (
                        <span
                          style={{
                            color: "var(--color-primary-solid)",
                            wordBreak: "break-all",
                          }}
                        >
                          {user.email}
                        </span>
                      ) : (
                        <span
                          style={{
                            fontStyle: "italic",
                            color: "var(--text-muted)",
                          }}
                        >
                          No Email Address
                        </span>
                      )}
                    </span>

                    <div style={{ marginBottom: "16px" }}>
                      <span className={getRoleBadgeClass(user.role)}>
                        {ROLE_LABELS[user.role]}
                      </span>
                    </div>

                    <div
                      className="user-card-actions"
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                        width: "100%",
                      }}
                    >
                      <button
                        className="btn btn-secondary"
                        style={{
                          width: "100%",
                          padding: "6px 12px",
                          fontSize: "0.8rem",
                        }}
                        onClick={() => {
                          setEditingUserId(user.id);
                          setEditName(user.name);
                          setEditEmail(user.email || "");
                        }}
                      >
                        Edit User
                      </button>
                      {user.id !== currentUser.id && (
                        <button
                          id={`btn-delete-user-${user.id}`}
                          className="btn btn-danger"
                          style={{
                            width: "100%",
                            padding: "6px 12px",
                            fontSize: "0.8rem",
                          }}
                          onClick={() => onDeleteUser(user.id)}
                        >
                          <Trash2 size={12} />
                          Delete User
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
