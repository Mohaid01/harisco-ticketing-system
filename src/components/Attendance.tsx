import React, { useState, useEffect } from "react";
import type { AppUser, AttendanceLog } from "../types";
import { formatEmployeeCode } from "../utils";
import { RefreshCw, Search, Clock, Calendar } from "lucide-react";

interface AttendanceProps {
  currentUser: AppUser;
}

export const Attendance: React.FC<AttendanceProps> = ({ currentUser }) => {
  const getTodayPKT = () => {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date());
  };

  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>(getTodayPKT());
  const [toDate, setToDate] = useState<string>(getTodayPKT());

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

    const token = localStorage.getItem("harisco_token");
    if (!token) return;

    // Connect to Server-Sent Events for instant live updates
    const eventSource = new EventSource(`/api/attendance/stream?token=${token}`);
    
    eventSource.onmessage = (event) => {
      try {
        const newLog = JSON.parse(event.data);
        setLogs((prevLogs) => {
          // Avoid duplicates if the same log comes twice
          if (prevLogs.some(log => log.id === newLog.id)) return prevLogs;
          return [newLog, ...prevLogs];
        });
      } catch (err) {
        console.error("Failed to parse live attendance log", err);
      }
    };

    eventSource.onerror = (err) => {
      console.error("SSE Connection Error:", err);
      // EventSource automatically tries to reconnect
    };

    return () => {
      eventSource.close();
    };
  }, []);

  // Filter logs based on user role, date, and search query
  const filteredLogs = logs.filter((log) => {
    // RBAC: employees only see their own attendance logs
    if (currentUser.role === "employee") {
      const formattedUserCode = formatEmployeeCode(currentUser.username || currentUser.id).toLowerCase();
      const formattedLogCode = formatEmployeeCode(log.userId).toLowerCase();
      if (formattedUserCode !== formattedLogCode) {
        return false;
      }
    }

    // Date filtering (log.timestamp format is YYYY-MM-DD HH:MM:SS)
    const logDateStr = log.timestamp ? log.timestamp.split(" ")[0] : (log.ioTime ? log.ioTime.split(" ")[0] : "");
    if (fromDate && logDateStr < fromDate) return false;
    if (toDate && logDateStr > toDate) return false;

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
        {/* Search & Filter controls */}
        <div style={{ display: "flex", gap: "16px", marginBottom: "20px", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: "1 1 300px" }}>
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: "40px", width: "100%" }}
              placeholder="Search logs by name, employee code, or status..."
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
          <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Calendar size={16} style={{ color: "var(--text-muted)" }} />
              <input 
                type="date" 
                className="form-input" 
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                style={{ width: "140px" }}
              />
            </div>
            <span style={{ color: "var(--text-muted)" }}>to</span>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input 
                type="date" 
                className="form-input" 
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                style={{ width: "140px" }}
              />
            </div>
          </div>
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
                  <th>Punch Status</th>
                  <th>Method</th>
                  <th>Attendance Time</th>
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
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <Clock size={14} style={{ color: "var(--text-muted)" }} />
                          <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                            {log.timestamp
                              ? new Date(log.timestamp.replace(" ", "T") + "Z").toLocaleString("en-US", {
                                  timeZone: "Asia/Karachi",
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "N/A"}
                          </span>
                        </div>
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
