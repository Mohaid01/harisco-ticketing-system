import React, { useState, useEffect, useMemo } from "react";
import type { AppUser, AttendanceLog } from "../types";
import { formatEmployeeCode } from "../utils";
import { RefreshCw, Search, Clock, Calendar, Trash2, Users, List } from "lucide-react";

interface AttendanceProps {
  currentUser: AppUser;
}

type ViewMode = "logs" | "summary";

interface UserSummary {
  userId: string;
  name: string;
  totalCheckIns: number;
  totalCheckOuts: number;
  totalIgnored: number;
  lastSeen: string | null;
}

const PUNCH_STATUS = {
  CHECK_IN: "Check-In",
  CHECK_OUT: "Check-Out",
  IGNORED: "Ignored",
} as const;

const STATUS_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  [PUNCH_STATUS.CHECK_IN]: {
    color: "var(--status-closed)",
    bg: "var(--status-closed-bg)",
    border: "var(--status-closed-border)",
  },
  [PUNCH_STATUS.CHECK_OUT]: {
    color: "var(--status-it-approval)",
    bg: "var(--status-it-approval-bg)",
    border: "var(--status-it-approval-border)",
  },
  [PUNCH_STATUS.IGNORED]: {
    color: "var(--text-secondary)",
    bg: "rgba(148, 163, 184, 0.12)",
    border: "rgba(148, 163, 184, 0.35)",
  },
};

export const Attendance: React.FC<AttendanceProps> = ({ currentUser }) => {
  const isAdminRole = currentUser.role === "it" || currentUser.role === "manager";

  const getTodayPKT = () =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date());

  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>(getTodayPKT());
  const [toDate, setToDate] = useState<string>(getTodayPKT());
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("logs");
  const [summarySearch, setSummarySearch] = useState<string>("");

  const deleteLog = async (id: number) => {
    if (!window.confirm("Delete this attendance log? This action cannot be undone.")) return;
    setDeletingId(id);
    try {
      const token = localStorage.getItem("harisco_token");
      const res = await fetch(`/api/attendance/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setLogs((prev) => prev.filter((log) => log.id !== id));
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete log.");
      }
    } catch (err) {
      console.error("Failed to delete attendance log:", err);
      alert("Failed to delete log.");
    } finally {
      setDeletingId(null);
    }
  };

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

    const eventSource = new EventSource(`/api/attendance/stream?token=${token}`);

    eventSource.onmessage = (event) => {
      try {
        const newLog = JSON.parse(event.data);
        setLogs((prevLogs) => {
          if (prevLogs.some((log) => log.id === newLog.id)) return prevLogs;
          return [newLog, ...prevLogs];
        });
      } catch (err) {
        console.error("Failed to parse live attendance log", err);
      }
    };

    eventSource.onerror = () => {};

    return () => {
      eventSource.close();
    };
  }, []);

  const filteredLogs = logs.filter((log) => {
    if (currentUser.role === "employee") {
      const formattedUserCode = formatEmployeeCode(currentUser.username || currentUser.id).toLowerCase();
      const formattedLogCode = formatEmployeeCode(log.userId).toLowerCase();
      if (formattedUserCode !== formattedLogCode) return false;
    }

    const logDateStr = log.timestamp
      ? log.timestamp.split(" ")[0]
      : log.ioTime
      ? log.ioTime.split(" ")[0]
      : "";
    if (fromDate && logDateStr < fromDate) return false;
    if (toDate && logDateStr > toDate) return false;

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

  const userSummaries = useMemo<UserSummary[]>(() => {
    const map = new Map<string, UserSummary>();

    for (const log of logs) {
      if (!map.has(log.userId)) {
        map.set(log.userId, {
          userId: log.userId,
          name: log.name,
          totalCheckIns: 0,
          totalCheckOuts: 0,
          totalIgnored: 0,
          lastSeen: null,
        });
      }
      const entry = map.get(log.userId)!;
      if (log.status === PUNCH_STATUS.CHECK_IN) entry.totalCheckIns++;
      else if (log.status === PUNCH_STATUS.CHECK_OUT) entry.totalCheckOuts++;
      else entry.totalIgnored++;

      const ts = log.timestamp || log.ioTime;
      if (ts && (!entry.lastSeen || ts > entry.lastSeen)) entry.lastSeen = ts;
    }

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [logs]);

  const filteredSummaries = useMemo(() => {
    const q = summarySearch.toLowerCase();
    if (!q) return userSummaries;
    return userSummaries.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        formatEmployeeCode(s.userId).toLowerCase().includes(q)
    );
  }, [userSummaries, summarySearch]);

  const formatTs = (ts: string | null) => {
    if (!ts) return "N/A";
    return new Date(ts.replace(" ", "T") + "Z").toLocaleString("en-US", {
      timeZone: "Asia/Karachi",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const statusBadge = (status: string) => {
    const s = STATUS_STYLES[status] ?? STATUS_STYLES[PUNCH_STATUS.IGNORED];
    return (
      <span
        className="badge"
        style={{
          backgroundColor: s.bg,
          color: s.color,
          borderColor: s.border,
          borderWidth: "1px",
          borderStyle: "solid",
        }}
      >
        {status}
      </span>
    );
  };

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
        <div style={{ display: "flex", gap: "10px" }}>
          {isAdminRole && (
            <>
              <button
                className={`btn ${viewMode === "logs" ? "btn-primary" : "btn-secondary"}`}
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
                onClick={() => setViewMode("logs")}
              >
                <List size={15} />
                All Logs
              </button>
              <button
                className={`btn ${viewMode === "summary" ? "btn-primary" : "btn-secondary"}`}
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
                onClick={() => setViewMode("summary")}
              >
                <Users size={15} />
                By Employee
              </button>
            </>
          )}
          <button
            className="btn btn-secondary"
            style={{ display: "flex", alignItems: "center", gap: "8px" }}
            onClick={() => fetchLogs(true)}
            disabled={refreshing}
          >
            <RefreshCw size={16} className={refreshing ? "spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── LOGS VIEW ────────────────────────────────── */}
      {viewMode === "logs" && (
        <div className="panel" style={{ padding: "24px" }}>
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
              />
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
                    {currentUser.role === "it" && <th style={{ width: "60px" }} />}
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => (
                    <tr key={log.id} style={{ cursor: "default" }}>
                      <td style={{ fontWeight: "bold" }}>{formatEmployeeCode(log.userId)}</td>
                      <td style={{ color: "white", fontWeight: 500 }}>{log.name}</td>
                      <td>{statusBadge(log.status)}</td>
                      <td><span className="badge badge-type">{log.method}</span></td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <Clock size={14} style={{ color: "var(--text-muted)" }} />
                          <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                            {formatTs(log.timestamp ?? null)}
                          </span>
                        </div>
                      </td>
                      {currentUser.role === "it" && (
                        <td style={{ textAlign: "center" }}>
                          <button
                            className="btn btn-danger"
                            style={{ padding: "5px 9px", minWidth: "unset" }}
                            disabled={deletingId === log.id}
                            onClick={() => deleteLog(log.id)}
                            title="Delete log"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {filteredLogs.length === 0 && (
                    <tr>
                      <td colSpan={currentUser.role === "it" ? 6 : 5} style={{ textAlign: "center", padding: "40px", color: "var(--text-secondary)" }}>
                        No biometric attendance records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── SUMMARY VIEW (IT / Manager only) ─────────── */}
      {viewMode === "summary" && isAdminRole && (
        <div className="panel" style={{ padding: "24px" }}>
          <div style={{ display: "flex", gap: "8px", marginBottom: "4px", alignItems: "center" }}>
            <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
              Showing totals for all time. Use the Logs view to filter by date.
            </span>
          </div>

          <div style={{ position: "relative", marginBottom: "20px", marginTop: "12px" }}>
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: "40px" }}
              placeholder="Search employees..."
              value={summarySearch}
              onChange={(e) => setSummarySearch(e.target.value)}
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
              />
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee Code</th>
                    <th>Name</th>
                    <th>Check-Ins</th>
                    <th>Check-Outs</th>
                    <th>Ignored</th>
                    <th>Last Seen</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSummaries.map((s) => (
                    <tr key={s.userId} style={{ cursor: "default" }}>
                      <td style={{ fontWeight: "bold" }}>{formatEmployeeCode(s.userId)}</td>
                      <td style={{ color: "white", fontWeight: 500 }}>{s.name}</td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            backgroundColor: "var(--status-closed-bg)",
                            color: "var(--status-closed)",
                            borderColor: "var(--status-closed-border)",
                            borderWidth: "1px",
                            borderStyle: "solid",
                          }}
                        >
                          {s.totalCheckIns}
                        </span>
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            backgroundColor: "var(--status-it-approval-bg)",
                            color: "var(--status-it-approval)",
                            borderColor: "var(--status-it-approval-border)",
                            borderWidth: "1px",
                            borderStyle: "solid",
                          }}
                        >
                          {s.totalCheckOuts}
                        </span>
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            backgroundColor: "rgba(148, 163, 184, 0.12)",
                            color: "var(--text-secondary)",
                            borderColor: "rgba(148, 163, 184, 0.35)",
                            borderWidth: "1px",
                            borderStyle: "solid",
                          }}
                        >
                          {s.totalIgnored}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <Clock size={14} style={{ color: "var(--text-muted)" }} />
                          <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                            {formatTs(s.lastSeen)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredSummaries.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: "40px", color: "var(--text-secondary)" }}>
                        No employee attendance data found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

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
