import React, { useState, useEffect } from "react";
import type { AppUser, AttendanceLog } from "../types";
import { formatEmployeeCode } from "../utils";
import { RefreshCw, Search, Clock } from "lucide-react";

interface AttendanceProps {
  currentUser: AppUser;
}

export const Attendance: React.FC<AttendanceProps> = ({ currentUser }) => {
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");

  const fetchLogs = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    try {
      const token = localStorage.getItem("harisco_token");
      const res = await fetch("/api/attendance", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (err) {
      console.error("Failed to fetch attendance logs:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  // Filter logs based on user role and search query
  const filteredLogs = logs.filter((log) => {
    // RBAC: employees only see their own attendance logs
    if (currentUser.role === "employee") {
      const formattedUserCode = formatEmployeeCode(currentUser.username || currentUser.id).toLowerCase();
      const formattedLogCode = formatEmployeeCode(log.userId).toLowerCase();
      if (formattedUserCode !== formattedLogCode) {
        return false;
      }
    }

    // Search query matching name, ID, status or method
    const q = searchQuery.toLowerCase();
    if (!q) return true;

    return (
      log.name.toLowerCase().includes(q) ||
      log.userId.toLowerCase().includes(q) ||
      log.status.toLowerCase().includes(q) ||
      log.method.toLowerCase().includes(q) ||
      formatEmployeeCode(log.userId).toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1 className="page-title">Biometric Attendance</h1>
          <p className="page-subtitle">
            {currentUser.role === "employee"
              ? "View your biometric check-in and check-out history."
              : "Monitor employee punch-ins/outs recorded by the biometric device."}
          </p>
        </div>
        <button
          className="btn btn-secondary"
          style={{ display: "flex", alignItems: "center", gap: "8px" }}
          onClick={() => fetchLogs(true)}
          disabled={refreshing}
        >
          <RefreshCw size={16} className={refreshing ? "spin" : ""} />
          Refresh Logs
        </button>
      </div>

      <div className="panel" style={{ padding: "24px" }}>
        {/* Search controls */}
        <div style={{ position: "relative", marginBottom: "20px" }}>
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: "40px" }}
            placeholder="Search logs by name, employee code, or check-in status..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Search
            size={18}
            style={{
              position: "absolute",
              left: "12px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-muted)",
            }}
          />
        </div>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "48px" }}>
            <div
              style={{
                width: "32px",
                height: "32px",
                border: "3px solid var(--border-color)",
                borderTopColor: "var(--color-primary)",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
              }}
            ></div>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee Code</th>
                  <th>Name</th>
                  <th>Log Time</th>
                  <th>Punch Status</th>
                  <th>Method</th>
                  <th>Sync Time</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log, index) => {
                  const isCheckIn = log.status.toLowerCase().includes("in");
                  const badgeColor = isCheckIn ? "var(--status-closed)" : "var(--status-it-approval)";
                  const badgeBg = isCheckIn ? "var(--status-closed-bg)" : "var(--status-it-approval-bg)";
                  const badgeBorder = isCheckIn ? "var(--status-closed-border)" : "var(--status-it-approval-border)";

                  return (
                    <tr key={index} style={{ cursor: "default" }}>
                      <td style={{ fontWeight: "bold" }}>
                        {formatEmployeeCode(log.userId)}
                      </td>
                      <td style={{ color: "white", fontWeight: 500 }}>
                        {log.name}
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <Clock size={14} style={{ color: "var(--text-muted)" }} />
                          <span>{log.ioTime ? new Date(log.ioTime.replace(" ", "T") + "Z").toLocaleString("en-US", { timeZone: "Asia/Karachi", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "N/A"}</span>
                        </div>
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            backgroundColor: badgeBg,
                            color: badgeColor,
                            borderColor: badgeBorder,
                            borderWidth: "1px",
                            borderStyle: "solid",
                          }}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-type">{log.method}</span>
                      </td>
                      <td style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                        {log.timestamp
                          ? new Date(log.timestamp.replace(" ", "T") + "Z").toLocaleString("en-US", {
                              timeZone: "Asia/Karachi",
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "N/A"}
                      </td>
                    </tr>
                  );
                })}
                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "40px", color: "var(--text-secondary)" }}>
                      No biometric attendance records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
};
