import React, { useState, useEffect } from "react";
import type { AppUser, LeaveApplication, LeaveCategory, LeaveStatus } from "../types";
import { formatEmployeeCode } from "../utils";
import { Calendar, CheckCircle, Clock, XCircle, Plus } from "lucide-react";

interface LeaveManagementProps {
  currentUser: AppUser;
  token: string;
}

export const LeaveManagement: React.FC<LeaveManagementProps> = ({
  currentUser,
  token,
}) => {
  const [leaves, setLeaves] = useState<LeaveApplication[]>([]);
  const [loading, setLoading] = useState(true);

  const [showApplyModal, setShowApplyModal] = useState(false);
  const [category, setCategory] = useState<LeaveCategory>("casual");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  const isAdminOrManager = currentUser.role === "it" || currentUser.role === "manager";

  const fetchLeaves = async () => {
    try {
      const res = await fetch("/api/leaves", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLeaves(data);
      }
    } catch (e) {
      console.error("Failed to fetch leaves:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, [token]);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || !startDate || !endDate || !reason) {
      alert("All fields are required.");
      return;
    }

    try {
      const res = await fetch("/api/leaves", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ category, startDate, endDate, reason }),
      });

      if (res.ok) {
        setShowApplyModal(false);
        setCategory("casual");
        setStartDate("");
        setEndDate("");
        setReason("");
        fetchLeaves();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to submit leave.");
      }
    } catch (e) {
      console.error("Leave submission error:", e);
      alert("Network error. Could not submit.");
    }
  };

  const handleUpdateStatus = async (id: string, status: LeaveStatus) => {
    if (!window.confirm(`Are you sure you want to mark this request as ${status}?`)) return;

    try {
      const res = await fetch(`/api/leaves/${id}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        fetchLeaves();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to update status.");
      }
    } catch (e) {
      console.error("Status update error:", e);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <span className="badge badge-closed">
            <CheckCircle size={12} /> Approved
          </span>
        );
      case "rejected":
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

  if (currentUser.role === "employee") {
    return (
      <div className="panel" style={{ padding: "30px", textAlign: "center" }}>
        <h2 className="panel-title" style={{ justifyContent: "center", marginBottom: "16px", fontSize: "1.4rem" }}>
          Leave Management
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>
          Leave application and management features are currently disabled for employee accounts.
        </p>
      </div>
    );
  }

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
          <h1 className="page-title">Leave Management</h1>
          <p className="page-subtitle">
            {isAdminOrManager
              ? "Review and approve employee leave requests."
              : "Apply for leaves and track your application status."}
          </p>
        </div>
        <button
          className="btn btn-primary"
          style={{ display: "flex", alignItems: "center", gap: "8px" }}
          onClick={() => setShowApplyModal(true)}
        >
          <Plus size={16} /> Apply for Leave
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "40px" }}>Loading...</div>
      ) : (
        <div className="panel" style={{ padding: "20px" }}>
          <h2 className="panel-title" style={{ marginBottom: "16px" }}>
            <Calendar size={18} style={{ color: "var(--color-primary)" }} />
            {isAdminOrManager ? "All Leave Requests" : "Your Leave History"}
          </h2>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  {isAdminOrManager && <th>Employee</th>}
                  <th>Category</th>
                  <th>Duration</th>
                  <th>Reason</th>
                  <th>Applied On</th>
                  <th>Status</th>
                  {isAdminOrManager && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {leaves.map((leave) => (
                  <tr key={leave.id}>
                    {isAdminOrManager && (
                      <td style={{ fontWeight: 600 }}>
                        {leave.userName} <br />
                        <span
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--text-secondary)",
                            fontWeight: "normal",
                          }}
                        >
                          {formatEmployeeCode(leave.userId)}
                        </span>
                      </td>
                    )}
                    <td style={{ textTransform: "capitalize" }}>
                      {leave.category}
                    </td>
                    <td>
                      {leave.startDate} to {leave.endDate}
                    </td>
                    <td style={{ maxWidth: "250px" }}>{leave.reason}</td>
                    <td style={{ color: "var(--text-secondary)" }}>
                      {new Date(leave.appliedAt).toLocaleDateString()}
                    </td>
                    <td>{getStatusBadge(leave.status)}</td>
                    {isAdminOrManager && (
                      <td>
                        {leave.status === "pending" ? (
                          <div
                            style={{ display: "flex", gap: "8px" }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              className="btn btn-primary"
                              style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                              onClick={() =>
                                handleUpdateStatus(leave.id, "approved")
                              }
                            >
                              Approve
                            </button>
                            <button
                              className="btn btn-danger"
                              style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                              onClick={() =>
                                handleUpdateStatus(leave.id, "rejected")
                              }
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span
                            style={{
                              fontSize: "0.75rem",
                              color: "var(--text-muted)",
                            }}
                          >
                            Processed
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {leaves.length === 0 && (
                  <tr>
                    <td
                      colSpan={isAdminOrManager ? 7 : 5}
                      style={{ textAlign: "center", padding: "40px" }}
                    >
                      No leave applications found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Apply Leave Modal */}
      {showApplyModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: "500px" }}>
            <div className="modal-header">
              <h2>Apply for Leave</h2>
              <button
                className="btn btn-secondary"
                style={{ padding: "4px 8px" }}
                onClick={() => setShowApplyModal(false)}
              >
                Close
              </button>
            </div>
            <form onSubmit={handleApply}>
              <div className="form-group">
                <label className="form-label">Leave Category</label>
                <select
                  className="form-input"
                  style={{ backgroundColor: "var(--bg-primary)" }}
                  value={category}
                  onChange={(e) =>
                    setCategory(e.target.value as LeaveCategory)
                  }
                  required
                >
                  <option value="casual">Casual Leave</option>
                  <option value="annual">Annual Leave</option>
                  <option value="medical">Medical Leave</option>
                </select>
              </div>

              <div style={{ display: "flex", gap: "16px" }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Start Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">End Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Reason</label>
                <textarea
                  className="form-input"
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Please provide a brief reason for your leave..."
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: "100%", marginTop: "10px" }}
              >
                Submit Application
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
