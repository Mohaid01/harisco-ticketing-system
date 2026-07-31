import React, { useState, useEffect, useMemo } from "react";
import type { AppUser, AttendanceLog } from "../types";
import { formatEmployeeCode, formatHours } from "../utils";
import {
  RefreshCw,
  Search,
  Clock,
  Calendar,
  Users,
  List,
  Filter,
  CheckCircle,
  XCircle,
  AlertCircle,
  Briefcase,
  Building,
  TrendingUp,
  FileText,
  ArrowLeft,
  ChevronRight,
  Trash2,
  CalendarOff,
  X,
  Plus,
} from "lucide-react";

interface AttendanceProps {
  currentUser: AppUser;
  allUsers: AppUser[];
  mode?: "hq" | "factory";
}

type ViewMode = "summary" | "individual";

const PUNCH_STATUS = {
  CHECK_IN: "Check-In",
  CHECK_OUT: "Check-Out",
  IGNORED: "Ignored",
} as const;

// Shift Constants (9:30 AM to 6:00 PM, Saturday 10:00 AM to 4:00 PM)
const SHIFTS = {
  GENERAL: "General Shift (09:30 AM - 06:00 PM)",
} as const;

const SHIFT_START = { weekday: { h: 9, m: 30 }, saturday: { h: 10, m: 0 } };

const hasShiftStartedPKT = (): boolean => {
  const now = new Date();
  const pktNow = new Date(now.getTime() + 5 * 60 * 60 * 1000);
  const dayOfWeek = pktNow.getUTCDay(); // 0=Sun, 6=Sat
  const currentH = pktNow.getUTCHours();
  const currentM = pktNow.getUTCMinutes();
  const start = dayOfWeek === 6 ? SHIFT_START.saturday : SHIFT_START.weekday;
  return currentH > start.h || (currentH === start.h && currentM >= start.m);
};

const isTodaySundayPKT = (): boolean => {
  const now = new Date();
  const pktNow = new Date(now.getTime() + 5 * 60 * 60 * 1000);
  return pktNow.getUTCDay() === 0;
};

export const Attendance: React.FC<AttendanceProps> = ({
  currentUser,
  allUsers,
  mode = "hq",
}) => {
  const isFactory = mode === "factory";

  const canViewAll = isFactory
    ? currentUser.role === "factory_it" ||
      currentUser.role === "factory_manager" ||
      currentUser.role === "it"
    : currentUser.role === "it" ||
      currentUser.role === "manager" ||
      currentUser.role === "executive";
  const canViewDepartment = currentUser.isDepartmentHead;
  const canWrite = isFactory
    ? currentUser.role === "factory_it" ||
      currentUser.role === "factory_manager"
    : currentUser.role === "it" || currentUser.role === "manager";

  const apiBase = isFactory ? "/api/factory/attendance" : "/api/attendance";

  // State Management
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<ViewMode>(
    canViewAll ? "summary" : "individual",
  );

  // Live tick to force recalculation of dynamic ongoing hours
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 60000); // update every minute
    return () => clearInterval(timer);
  }, []);

  const currentYearMonth = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
  })
    .format(new Date())
    .slice(0, 7); // yyyy-mm

  const [selectedMonth, setSelectedMonth] = useState<string>(currentYearMonth);

  // Selection & Filtering
  const [selectedUserId, setSelectedUserId] = useState<string>(currentUser.id);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterDepartment, setFilterDepartment] = useState<string>("All");
  const [filterShift, setFilterShift] = useState<string>("All");
  const [filterTodayStatus, setFilterTodayStatus] = useState<string>("All");

  // Holidays
  const [holidays, setHolidays] = useState<{ date: string; name: string }[]>(
    [],
  );
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayName, setHolidayName] = useState("");

  // Fetch Attendance Logs from Biometric API
  const fetchLogs = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    try {
      const token = localStorage.getItem("harisco_token");
      const res = await fetch(`${apiBase}`, {
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

  const fetchHolidays = async () => {
    try {
      const token = localStorage.getItem("harisco_token");
      const res = await fetch("/api/holidays", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setHolidays(await res.json());
    } catch (err) {
      console.error("Failed to fetch holidays:", err);
    }
  };

  const handleAddHoliday = async () => {
    if (!holidayDate || !holidayName.trim()) {
      alert("Please provide both a date and a name.");
      return;
    }
    const token = localStorage.getItem("harisco_token");
    const res = await fetch("/api/holidays", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ date: holidayDate, name: holidayName.trim() }),
    });
    if (res.ok) {
      setHolidayDate("");
      setHolidayName("");
      fetchHolidays();
    } else {
      const d = await res.json();
      alert(d.error || "Failed to add holiday.");
    }
  };

  const handleDeleteHoliday = async (date: string) => {
    if (!window.confirm(`Remove holiday on ${date}?`)) return;
    const token = localStorage.getItem("harisco_token");
    await fetch(`/api/holidays/${date}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchHolidays();
  };

  const handleDeletePunchOut = async (logId: number, dateStr: string) => {
    if (
      !window.confirm(
        `Are you sure you want to delete the punch out (second punch) for ${dateStr}?`,
      )
    ) {
      return;
    }
    try {
      const token = localStorage.getItem("harisco_token");
      const res = await fetch(`${apiBase}/${logId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setLogs((prev) => prev.filter((log) => log.id !== logId));
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete punch out.");
      }
    } catch {
      alert("Network error. Could not delete punch out.");
    }
  };

  const handleDeletePunchIn = async (logId: number, dateStr: string) => {
    if (
      !window.confirm(
        `Are you sure you want to delete the punch in (first punch) for ${dateStr}?`,
      )
    ) {
      return;
    }
    try {
      const token = localStorage.getItem("harisco_token");
      const res = await fetch(`${apiBase}/${logId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setLogs((prev) => prev.filter((log) => log.id !== logId));
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete punch in.");
      }
    } catch {
      alert("Network error. Could not delete punch in.");
    }
  };

  useEffect(() => {
    fetchLogs();
    fetchHolidays();

    const token = localStorage.getItem("harisco_token");
    if (!token) return;

    // Set up SSE Stream for Live Updates
    const eventSource = new EventSource(`${apiBase}/stream?token=${token}`);

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

    return () => {
      eventSource.close();
    };
  }, []);

  // Helper to parse dates correctly and convert device UTC to PKT (+5 hours)
  const parseLogPKT = (
    log: AttendanceLog,
  ): { date: string; time: string; timestamp: string } => {
    // 1. Prioritize ioTime (Already PKT: YYYY-MM-DD-THH:MM:SSZ)
    if (log.ioTime) {
      // Standardize "-T" to just "T" and split the date portion from the time portion
      const replacementCharacter = mode === "hq" ? "-T" : " ";
      const parts = log.ioTime.replace(replacementCharacter, "T").split("T");

      if (parts.length === 2) {
        const dateParts = parts[0].split("-");
        const timeParts = parts[1].replace("Z", "").split(":");

        // Ensure we have exactly [year, month, day] and [hour, minute, second]
        if (dateParts.length === 3 && timeParts.length === 3) {
          const yyyy = dateParts[0];
          // Force string conversion to safely call padStart in TypeScript
          const MM = String(dateParts[1]).padStart(2, "0");
          const dd = String(dateParts[2]).padStart(2, "0");
          const hh = String(timeParts[0]).padStart(2, "0");
          const mm = String(timeParts[1]).padStart(2, "0");
          const ss = String(timeParts[2]).padStart(2, "0");

          const dateStr = `${yyyy}-${MM}-${dd}`;
          const timeStr = `${hh}:${mm}:${ss}`;

          return {
            date: dateStr,
            time: timeStr,
            timestamp: `${dateStr} ${timeStr}`,
          };
        }
      }
    }

    // 2. Fallback to timestamp (UTC: YYYY-MM-DD HH:MM:SS)
    const ts = log.timestamp;
    if (!ts) return { date: "", time: "--", timestamp: "" };

    const utcDate = new Date(ts.replace(" ", "T") + "Z");
    if (isNaN(utcDate.getTime())) {
      const parts = ts.split(" ");
      return { date: parts[0], time: parts[1] || "--", timestamp: ts };
    }

    // Convert UTC to PKT (UTC+5)
    const pktDate = new Date(utcDate.getTime() + 5 * 60 * 60 * 1000);
    const yyyy = pktDate.getUTCFullYear();
    const MM = String(pktDate.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(pktDate.getUTCDate()).padStart(2, "0");
    const hh = String(pktDate.getUTCHours()).padStart(2, "0");
    const mm = String(pktDate.getUTCMinutes()).padStart(2, "0");
    const ss = String(pktDate.getUTCSeconds()).padStart(2, "0");

    const dateStr = `${yyyy}-${MM}-${dd}`;
    const timeStr = `${hh}:${mm}:${ss}`;

    return { date: dateStr, time: timeStr, timestamp: `${dateStr} ${timeStr}` };
  };

  const parseLogDate = (log: AttendanceLog): string => {
    return parseLogPKT(log).date;
  };

  // Determine user department
  const getUserDepartment = (user: AppUser): string => {
    return user.department || "Operations";
  };

  // Compute stats for all employees
  const employeeSummaries = useMemo(() => {
    const todayStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Karachi",
    }).format(new Date());

    const [sYear, sMonth] = selectedMonth.split("-").map(Number);
    const daysInMonth = new Date(sYear, sMonth, 0).getDate();
    const shiftStarted = hasShiftStartedPKT();

    return allUsers
      .filter((user) => user.department !== "Executive")
      .map((user) => {
        const uId = user.id;
        const formattedCode = formatEmployeeCode(user.username || user.id);

        const userLogs = logs.filter(
          (log) =>
            log.userId === uId ||
            log.userId === user.username ||
            formatEmployeeCode(log.userId) === formattedCode,
        );

        const todayPunches = userLogs.filter(
          (log) => parseLogDate(log) === todayStr,
        );
        let todayStatus:
          | "Clocked In"
          | "Clocked Out"
          | "Absent"
          | "On Leave"
          | "Site Duty"
          | "Pending" = "Pending";
        let isLateToday = false;

        if (todayPunches.length > 0) {
          const sortedPunches = [...todayPunches].sort((a, b) => {
            const tA = parseLogPKT(a).timestamp;
            const tB = parseLogPKT(b).timestamp;
            return tA.localeCompare(tB);
          });

          const firstCheckIn = sortedPunches.find(
            (p) => p.status === PUNCH_STATUS.CHECK_IN,
          );
          if (firstCheckIn) {
            const timeStr = parseLogPKT(firstCheckIn).time;
            const parts = timeStr.split(":");
            if (parts.length >= 2) {
              const hour = parseInt(parts[0], 10);
              const min = parseInt(parts[1], 10);
              const pktNow = new Date(
                new Date().getTime() + 5 * 60 * 60 * 1000,
              );
              const isSaturday = pktNow.getUTCDay() === 6;

              isLateToday = isSaturday
                ? hour > 10 || (hour === 10 && min >= 30)
                : hour >= 10;
            }
          }

          const lastPunch = sortedPunches[sortedPunches.length - 1];
          const lastStatus = (lastPunch.status || "")
            .toLowerCase()
            .replace(/[^a-z]/g, "");

          if (lastPunch.status === "Site Duty") {
            todayStatus = "Site Duty";
          } else if (lastPunch.status === "On Leave") {
            todayStatus = "On Leave";
          } else if (lastStatus.includes("in")) {
            todayStatus = "Clocked In";
          } else if (lastStatus.includes("out")) {
            todayStatus = "Clocked Out";
          } else {
            todayStatus = "Clocked In";
          }
        } else {
          todayStatus = shiftStarted ? "Absent" : "Pending";
        }

        let daysPresent = 0;
        let daysAbsent = 0;
        let totalHours = 0;
        let totalWorkDays = 0;
        let daysNotAvailable = 0;

        for (let day = 1; day <= daysInMonth; day++) {
          const tempDate = new Date(Date.UTC(sYear, sMonth - 1, day));
          const dateStr = `${sYear}-${String(sMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isWeekend = tempDate.getUTCDay() === 0;
          const isHoliday = holidays.find((h) => h.date === dateStr);

          totalWorkDays++;
          const dayPunches = userLogs.filter(
            (log) => parseLogDate(log) === dateStr,
          );

          const sorted = [...dayPunches].sort((a, b) => {
            const tA = parseLogPKT(a).timestamp;
            const tB = parseLogPKT(b).timestamp;
            return tA.localeCompare(tB);
          });

          const firstPunch = sorted[0];

          if (
            firstPunch &&
            (firstPunch.status === "Site Duty" ||
              firstPunch.status === "On Leave")
          ) {
            daysNotAvailable++;
            daysPresent++;
            continue;
          }

          if (isWeekend || isHoliday) {
            daysPresent++;
            continue;
          }

          if (sorted.length > 0) {
            daysPresent++;
            const firstStr = parseLogPKT(sorted[0]).timestamp;
            const fDate = new Date(firstStr.replace(" ", "T"));

            if (sorted.length > 1) {
              const lastStr = parseLogPKT(sorted[sorted.length - 1]).timestamp;
              const lDate = new Date(lastStr.replace(" ", "T"));
              if (!isNaN(fDate.getTime()) && !isNaN(lDate.getTime())) {
                totalHours +=
                  (lDate.getTime() - fDate.getTime()) / (1000 * 60 * 60);
              }
            } else if (dateStr === todayStr) {
              const currDate = new Date();
              if (!isNaN(fDate.getTime())) {
                totalHours += Math.max(
                  0,
                  (currDate.getTime() - fDate.getTime()) / (1000 * 60 * 60),
                );
              }
            }
          } else {
            if (dateStr <= todayStr) {
              daysAbsent++;
            }
          }
        }

        return {
          ...user,
          formattedCode,
          department: getUserDepartment(user),
          shift: SHIFTS.GENERAL,
          todayStatus,
          isLateToday,
          daysPresent,
          daysNotAvailable,
          daysAbsent,
          totalHours,
          totalWorkDays,
        };
      });
  }, [allUsers, logs, selectedMonth, holidays]);

  // Filter summaries based on Search & Dropdowns
  const filteredSummaries = useMemo(() => {
    return employeeSummaries
      .filter((emp) => {
        const matchesSearch =
          emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          emp.formattedCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
          emp.id.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesDept =
          filterDepartment === "All" || emp.department === filterDepartment;
        const matchesShift = filterShift === "All" || emp.shift === filterShift;

        let matchesTodayStatus = true;
        if (filterTodayStatus === "Late Arrival") {
          matchesTodayStatus = emp.isLateToday;
        } else if (filterTodayStatus === "Present") {
          matchesTodayStatus =
            emp.todayStatus === "Clocked In" ||
            emp.todayStatus === "Clocked Out" ||
            emp.todayStatus === "Site Duty";
        } else if (filterTodayStatus !== "All") {
          matchesTodayStatus = emp.todayStatus === filterTodayStatus;
        }

        return (
          matchesSearch && matchesDept && matchesShift && matchesTodayStatus
        );
      })
      .sort((a, b) =>
        a.formattedCode.localeCompare(b.formattedCode, undefined, {
          numeric: true,
        }),
      );
  }, [
    employeeSummaries,
    searchQuery,
    filterDepartment,
    filterShift,
    filterTodayStatus,
  ]);

  // Compute today's daily stats across ALL employees (not filtered)
  const todayStats = useMemo(() => {
    const todayStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Karachi",
    }).format(new Date());
    const pktNow = new Date(new Date().getTime() + 5 * 60 * 60 * 1000);
    const isSaturday = pktNow.getUTCDay() === 6;

    let present = 0;
    let absent = 0;
    let late = 0;

    for (const emp of employeeSummaries) {
      const isPresent =
        emp.todayStatus === "Clocked In" ||
        emp.todayStatus === "Clocked Out" ||
        emp.todayStatus === "Site Duty";
      if (isPresent) {
        present++;
        const formattedCode = emp.formattedCode;
        const todayPunches = logs.filter(
          (log) =>
            (log.userId === emp.id ||
              log.userId === emp.username ||
              formatEmployeeCode(log.userId) === formattedCode) &&
            parseLogDate(log) === todayStr &&
            log.status === PUNCH_STATUS.CHECK_IN,
        );
        if (todayPunches.length > 0) {
          const sorted = [...todayPunches].sort((a, b) =>
            parseLogPKT(a).timestamp.localeCompare(parseLogPKT(b).timestamp),
          );
          const firstInTime = parseLogPKT(sorted[0]).time;
          const parts = firstInTime.split(":");
          if (parts.length >= 2) {
            const hour = parseInt(parts[0], 10);
            const min = parseInt(parts[1], 10);
            const isLate = isSaturday
              ? hour > 10 || (hour === 10 && min >= 30)
              : hour >= 10;
            if (isLate) late++;
          }
        }
      } else if (emp.todayStatus === "Absent") {
        absent++;
      }
      // "Pending" is not counted as absent
    }

    return { present, absent, late };
  }, [employeeSummaries, logs]);

  // Get departments list for filters
  const departmentsList = useMemo(() => {
    const depts = new Set<string>();
    allUsers.forEach((u) => depts.add(getUserDepartment(u)));
    return Array.from(depts);
  }, [allUsers]);

  // Find currently selected employee for Detailed Individual view
  const selectedEmployee = useMemo(() => {
    return (
      employeeSummaries.find((emp) => emp.id === selectedUserId) ||
      employeeSummaries[0]
    );
  }, [employeeSummaries, selectedUserId]);

  // Generate punch logs for the selected month for the Calendar view
  const selectedEmployeePunchLogs = useMemo(() => {
    if (!selectedEmployee) return [];

    const uId = selectedEmployee.id;
    const formattedCode = selectedEmployee.formattedCode;
    const userLogs = logs.filter(
      (log) =>
        log.userId === uId ||
        log.userId === selectedEmployee.username ||
        formatEmployeeCode(log.userId) === formattedCode,
    );

    const list = [];

    // Parse selectedMonth (yyyy-mm)
    const [sYear, sMonth] = selectedMonth.split("-").map(Number);
    const daysInMonth = new Date(sYear, sMonth, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const tempDate = new Date(Date.UTC(sYear, sMonth - 1, day));
      const dateStr = `${sYear}-${String(sMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const isWeekend = tempDate.getUTCDay() === 0; // Only Sunday is off

      const isHoliday = holidays.find((h) => h.date === dateStr);

      const dayPunches = userLogs.filter(
        (log) => parseLogDate(log) === dateStr,
      );

      if (isWeekend || isHoliday) {
        list.push({
          date: dateStr,
          firstIn: "--",
          lastOut: "--",
          hours: 0,
          status: (isHoliday ? "Holiday" : "Weekend") as any,
        });
      } else if (dayPunches.length > 0) {
        const sorted = [...dayPunches].sort((a, b) => {
          const tA = parseLogPKT(a).timestamp;
          const tB = parseLogPKT(b).timestamp;
          return tA.localeCompare(tB);
        });

        const first = sorted[0];
        const last = sorted.length > 1 ? sorted[sorted.length - 1] : null;

        const firstInTime = parseLogPKT(first).time;
        const lastOutTime = last ? parseLogPKT(last).time : "--";

        let hours = 0;
        let status: "Present" | "Late Arrival" | "Site Duty" | "On Leave" =
          "Present";

        // Dynamic hours calculation based on exact punch times
        const firstStr = parseLogPKT(first).timestamp;
        const fDate = new Date(firstStr.replace(" ", "T"));

        if (last) {
          const lastStr = parseLogPKT(last).timestamp;
          const lDate = new Date(lastStr.replace(" ", "T"));
          if (!isNaN(fDate.getTime()) && !isNaN(lDate.getTime())) {
            hours = (lDate.getTime() - fDate.getTime()) / (1000 * 60 * 60);
          }
        } else {
          // If only one punch and it's today, calculate hours from firstIn to now
          const todayStr = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Karachi",
          }).format(new Date());
          if (dateStr === todayStr && !isNaN(fDate.getTime())) {
            const currDate = new Date();
            hours = Math.max(
              0,
              (currDate.getTime() - fDate.getTime()) / (1000 * 60 * 60),
            );
          }
        }

        // Late arrival check
        const timeParts = firstInTime.split(":");
        if (timeParts.length >= 2) {
          const hour = parseInt(timeParts[0], 10);
          const min = parseInt(timeParts[1], 10);
          const isSaturday = tempDate.getUTCDay() === 6;

          if (isSaturday) {
            // Saturday shift starts at 10:00 AM (grace period until 10:29 AM)
            if (hour > 10 || (hour === 10 && min >= 30)) {
              status = "Late Arrival";
            }
          } else {
            // Regular shift starts at 09:30 AM (grace period until 09:59 AM)
            // Any punch in at 10:00 AM or later is late.
            if (hour >= 10) {
              status = "Late Arrival";
            }
          }
        }

        let finalFirstIn = firstInTime;
        let finalLastOut = lastOutTime;

        if (first.status === "Site Duty" || first.status === "On Leave") {
          status = first.status;
          finalFirstIn = "N/A";
          finalLastOut = "N/A";
          if (first.status === "On Leave") {
            hours = 0;
          }
        }

        const checkOutPunch = sorted.find(
          (p) => p.status === PUNCH_STATUS.CHECK_OUT,
        );

        const checkInPunch = sorted.find(
          (p) => p.status === PUNCH_STATUS.CHECK_IN,
        );

        list.push({
          date: dateStr,
          firstIn: finalFirstIn,
          firstInId: checkInPunch ? checkInPunch.id : undefined,
          lastOut: finalLastOut,
          lastOutId: checkOutPunch ? checkOutPunch.id : undefined,
          hours: Math.round(hours * 100) / 100,
          status,
        });
      } else {
        list.push({
          date: dateStr,
          firstIn: "--",
          lastOut: "--",
          hours: 0,
          status: "No Data" as const,
        });
      }
    }
    return list;
  }, [selectedEmployee, logs, selectedMonth, tick]);

  // Today's specific shift progress calculations
  const todayShiftProgress = useMemo(() => {
    if (!selectedEmployeePunchLogs.length)
      return { hours: 0, firstIn: "--", lastOut: "--" };

    const todayStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Karachi",
    }).format(new Date());

    const todayLog = selectedEmployeePunchLogs.find((r) => r.date === todayStr);

    return {
      firstIn: todayLog ? todayLog.firstIn : "--",
      lastOut: todayLog ? todayLog.lastOut : "--",
      hours: todayLog ? todayLog.hours : 0,
      status: todayLog ? todayLog.status : "No Data",
    };
  }, [selectedEmployeePunchLogs, tick]);

  const individualStats = useMemo(() => {
    let present = 0;
    let absent = 0;
    let totalHours = 0;
    let workDaysCounted = 0;

    const todayStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Karachi",
    }).format(new Date());

    const shiftStarted = hasShiftStartedPKT();

    selectedEmployeePunchLogs.forEach((log) => {
      if (log.date > todayStr) return;

      if (log.status !== "Weekend" && log.status !== "Holiday") {
        // Only include today in the total count if the shift has started or the employee already has a punch
        if (log.date === todayStr && !shiftStarted && log.firstIn === "--")
          return;
        if (log.firstIn !== "--") {
          present++;
          if (log.status !== "On Leave") {
            totalHours += log.hours;
          }
        } else {
          absent++;
        }
      } else {
        present++;
      }
      workDaysCounted++;
    });

    return {
      present,
      absent,
      totalHours,
      workDaysCounted,
    };
  }, [selectedEmployeePunchLogs]);

  // Render Status Badge
  const getTodayStatusBadge = (status: string) => {
    switch (status) {
      case "Clocked In":
        return (
          <span className="badge badge-closed">
            <CheckCircle size={12} /> Clocked In
          </span>
        );
      case "Clocked Out":
        return (
          <span
            className="badge badge-type"
            style={{
              borderColor: "var(--border-color)",
              color: "var(--text-secondary)",
            }}
          >
            <Clock size={12} /> Clocked Out
          </span>
        );
      case "On Leave":
        return (
          <span className="badge badge-m-app">
            <Calendar size={12} /> On Leave
          </span>
        );
      case "Site Duty":
        return (
          <span className="badge badge-handover">
            <Calendar size={12} /> Site Duty
          </span>
        );
      case "Pending":
        return (
          <span
            className="badge badge-type"
            style={{
              borderColor: "rgba(251,191,36,0.3)",
              color: "#fbbf24",
              backgroundColor: "rgba(251,191,36,0.08)",
            }}
          >
            <Clock size={12} /> Pending
          </span>
        );
      default:
        return (
          <span className="badge badge-it-app">
            <XCircle size={12} /> Absent
          </span>
        );
    }
  };

  const getLogStatusBadge = (status: string) => {
    switch (status) {
      case "Present":
        return <span className="badge badge-closed">Present</span>;
      case "Late Arrival":
        return <span className="badge badge-it-app">Late Arrival</span>;
      case "Half Day":
        return <span className="badge badge-m-app">Half Day</span>;
      case "On Leave":
        return <span className="badge badge-handover">On Leave</span>;
      case "Site Duty":
        return <span className="badge badge-handover">Site Duty</span>;
      case "Weekend":
        return <span className="badge badge-type">Weekend</span>;
      case "Holiday":
        return (
          <span
            className="badge badge-type"
            style={{
              borderColor: "var(--color-primary)",
              color: "var(--color-primary)",
            }}
          >
            Holiday
          </span>
        );
      case "No Data":
        return (
          <span
            className="badge badge-type"
            style={{
              color: "var(--text-muted)",
              borderColor: "var(--border-color)",
            }}
          >
            No Data
          </span>
        );
      default:
        return (
          <span
            className="badge badge-danger"
            style={{
              backgroundColor: "rgba(244, 63, 94, 0.1)",
              color: "#f43f5e",
              borderColor: "rgba(244, 63, 94, 0.2)",
            }}
          >
            Absent
          </span>
        );
    }
  };

  const handleAddManualPunch = async (
    date: string,
    type: "Check-In" | "Check-Out",
  ) => {
    if (!canWrite) return;

    const dateHoliday = holidays.find((h) => h.date === date);
    if (dateHoliday) {
      alert(
        `Cannot add manual punch on a gazetted holiday (${dateHoliday.name}).`,
      );
      return;
    }

    const time = window.prompt(
      `Enter time for manual ${type} on ${date} (24-hour format HH:MM):`,
      type === "Check-In" ? "09:30" : "18:00",
    );
    if (!time) return;

    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(time)) {
      alert("Invalid time format. Please use HH:MM (e.g., 09:30, 18:00)");
      return;
    }

    try {
      const token = localStorage.getItem("harisco_token");
      const res = await fetch(`${apiBase}/manual`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: selectedEmployee?.id,
          date,
          time,
          status: type,
        }),
      });

      if (res.ok) {
        fetchLogs(true);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to add manual punch.");
      }
    } catch (err) {
      console.error(err);
      alert("Error adding manual punch.");
    }
  };

  const handleMarkDayStatus = async (
    date: string,
    status: "Site Duty" | "On Leave",
  ) => {
    if (currentUser.role !== "manager") return;

    if (
      !window.confirm(`Are you sure you want to mark ${date} as ${status}?`)
    ) {
      return;
    }

    try {
      const token = localStorage.getItem("harisco_token");

      const isSaturday = new Date(date).getDay() === 6;
      const checkInTime = isSaturday ? "10:00" : "09:30";
      const checkOutTime = isSaturday ? "16:00" : "18:00";

      // Insert check-in punch
      const resIn = await fetch("/api/attendance/manual", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: selectedEmployee?.id,
          date,
          time: checkInTime,
          status,
        }),
      });

      // Insert check-out punch
      const resOut = await fetch("/api/attendance/manual", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: selectedEmployee?.id,
          date,
          time: checkOutTime,
          status,
        }),
      });

      if (resIn.ok && resOut.ok) {
        fetchLogs(true);
      } else {
        alert("Failed to mark day completely.");
      }
    } catch (err) {
      console.error(err);
      alert("Error marking day status.");
    }
  };

  // Add this helper function to handle CSV export in your React component
  const exportToCSV = (summaries: any[]) => {
    const [sYear, sMonth] = selectedMonth.split("-").map(Number);
    const currentYear = sYear;
    const currentMonth = new Date(sYear, sMonth - 1).toLocaleString("default", {
      month: "long",
    });
    const daysInMonth = new Date(sYear, sMonth, 0).getDate();

    let countSunday = 0;
    let countSaturday = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const tempDate = new Date(Date.UTC(sYear, sMonth - 1, day));
      const dayOfWeek = tempDate.getUTCDay();
      if (dayOfWeek === 0) countSunday++;
      else if (dayOfWeek === 6) countSaturday++;
    }
    const countWeekdays = daysInMonth - countSunday - countSaturday;
    const expectedHours = countWeekdays * 8 + countSaturday * 6;

    const fmt = (val: string) => `"${val.replace(/"/g, '""')}"`;

    const employeePunchMaps = new Map<
      string,
      Map<string, { in: string; out: string }>
    >();

    for (const emp of summaries) {
      const userLogs = logs.filter(
        (log) =>
          log.userId === emp.id ||
          log.userId === emp.username ||
          formatEmployeeCode(log.userId) ===
            (emp.formattedCode || formatEmployeeCode(emp.username || emp.id)),
      );

      const dateMap = new Map<string, { in: string; out: string }>();

      for (let day = 1; day <= daysInMonth; day++) {
        const sDay = String(day).padStart(2, "0");
        const dateStr = `${sYear}-${String(sMonth).padStart(2, "0")}-${sDay}`;

        const dayPunches = userLogs.filter(
          (log) => parseLogDate(log) === dateStr,
        );

        if (dayPunches.length === 0) {
          dateMap.set(dateStr, { in: "-", out: "-" });
          continue;
        }

        const sorted = [...dayPunches].sort((a, b) => {
          const tA = parseLogPKT(a).timestamp;
          const tB = parseLogPKT(b).timestamp;
          return tA.localeCompare(tB);
        });

        const firstIn = parseLogPKT(sorted[0]).time.substring(0, 5);
        const lastOut =
          sorted.length > 1
            ? parseLogPKT(sorted[sorted.length - 1]).time.substring(0, 5)
            : "-";

        dateMap.set(dateStr, { in: firstIn, out: lastOut });
      }

      employeePunchMaps.set(emp.id, dateMap);
    }

    const headers = ["S No", "ID", "Name"];
    for (let day = 1; day <= daysInMonth; day++) {
      headers.push(`${day}`);
    }
    headers.push(
      "Total Working Hours",
      "Actual Working Hours",
      "Difference",
      "Days Present",
      "Leaves",
      "Absents",
    );

    const rows = summaries.map((emp: any, index: number) => {
      const row: string[] = [
        fmt(String(index + 1)),
        fmt(emp.formattedCode || ""),
        fmt(emp.name || ""),
      ];

      const dateMap = employeePunchMaps.get(emp.id);

      for (let day = 1; day <= daysInMonth; day++) {
        const sDay = String(day).padStart(2, "0");
        const dateStr = `${sYear}-${String(sMonth).padStart(2, "0")}-${sDay}`;
        const punches = dateMap?.get(dateStr) || { in: "-", out: "-" };

        const tempDate = new Date(Date.UTC(sYear, sMonth - 1, day));
        const dayOfWeek = tempDate.getUTCDay();
        const isSunday = dayOfWeek === 0;
        const isSaturday = dayOfWeek === 6;
        const isHoliday = holidays.some((h) => h.date === dateStr);

        let expectedDayHours = 0;
        if (!isSunday && !isHoliday) {
          expectedDayHours = isSaturday ? 6 : 8;
        }

        let actualDayHours = 0;
        if (punches.in !== "-" && punches.out !== "-") {
          const [inH, inM] = punches.in.split(":").map(Number);
          const [outH, outM] = punches.out.split(":").map(Number);
          const inTotal = inH * 60 + inM;
          const outTotal = outH * 60 + outM;
          actualDayHours = Math.max(0, (outTotal - inTotal) / 60);
        }

        const otHours =
          actualDayHours > expectedDayHours
            ? actualDayHours - expectedDayHours
            : 0;
        const otText = otHours > 0 ? `${otHours.toFixed(1)}h` : "0";

        const cell = `In: ${punches.in}\nOut: ${punches.out}\nOT: ${otText}`;
        row.push(fmt(cell));
      }

      const rawHours = typeof emp.totalHours === "number" ? emp.totalHours : 0;
      const formattedHours = formatHours(rawHours);
      const difference = rawHours - expectedHours;

      row.push(
        fmt(String(expectedHours)),
        fmt(formattedHours),
        fmt(difference.toFixed(2)),
        fmt(String(emp.daysPresent ?? 0)),
        fmt(String(emp.daysNotAvailable ?? 0)),
        fmt(String(emp.daysAbsent ?? 0)),
      );

      return row;
    });

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `HarisCo - HQ Attendance - ${currentMonth} ${currentYear}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header Panel */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div>
          <h1 className="page-title">Attendance</h1>
          <p className="page-subtitle">
            {canViewAll || canViewDepartment
              ? `Monitor biometric records, review ${!canViewAll && canViewDepartment ? `${currentUser.department} department's` : `department-wise`} statistics, and inspect employee breakdowns.`
              : "Review your clock-in timings, total hours worked, and monthly attendance overview."}
          </p>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          {canViewAll || canViewDepartment ? (
            <div className="btn-group">
              <button
                className={`btn ${viewMode === "summary" ? "btn-primary" : "btn-secondary"}`}
                style={{
                  padding: "6px 14px",
                  fontSize: "0.8rem",
                  border: "none",
                  borderRadius: "var(--radius-sm)",
                }}
                onClick={() => setViewMode("summary")}
              >
                <List size={14} />
                All Employees Summary
              </button>
              <button
                className={`btn ${viewMode === "individual" ? "btn-primary" : "btn-secondary"}`}
                style={{
                  padding: "6px 14px",
                  fontSize: "0.8rem",
                  border: "none",
                  borderRadius: "var(--radius-sm)",
                }}
                onClick={() => setViewMode("individual")}
              >
                <Users size={14} />
                Detailed Individual View
              </button>
            </div>
          ) : (
            <></>
          )}
          <div className="btn-group">
            {canWrite ? (
              <button
                className="btn btn-secondary"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 14px",
                }}
                onClick={() => setShowHolidayModal(true)}
              >
                <CalendarOff size={14} />
                Holidays
              </button>
            ) : (
              <></>
            )}
            <button
              className="btn btn-secondary"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 14px",
              }}
              onClick={() => fetchLogs(true)}
              disabled={refreshing}
            >
              <RefreshCw size={14} className={refreshing ? "spin" : ""} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div
          style={{ display: "flex", justifyContent: "center", padding: "80px" }}
        >
          <div
            style={{
              width: "36px",
              height: "36px",
              border: "3px solid var(--border-color)",
              borderTopColor: "var(--color-primary)",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
            }}
          />
        </div>
      ) : (
        <>
          {/* ─────────────────── ALL EMPLOYEES SUMMARY VIEW ─────────────────── */}
          {(() => {
            const todayDateStr = new Intl.DateTimeFormat("en-CA", {
              timeZone: "Asia/Karachi",
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            }).format(new Date());
            const todayHoliday = holidays.find((h) => h.date === todayDateStr);
            if (
              viewMode === "summary" &&
              (canViewAll || canViewDepartment) &&
              (isTodaySundayPKT() || todayHoliday)
            ) {
              const isSunday = isTodaySundayPKT();
              return (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "80px 40px",
                    gap: "16px",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      width: "72px",
                      height: "72px",
                      borderRadius: "50%",
                      background: "rgba(99,102,241,0.12)",
                      border: "1px solid rgba(99,102,241,0.2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "2rem",
                    }}
                  >
                    🏖️
                  </div>
                  <h2
                    style={{
                      fontSize: "1.4rem",
                      fontWeight: 700,
                      color: "var(--text-primary)",
                      margin: 0,
                    }}
                  >
                    {isSunday
                      ? "It's the Weekend!"
                      : `Gazetted Holiday — ${todayHoliday?.name}`}
                  </h2>
                  <p
                    style={{
                      fontSize: "0.95rem",
                      color: "var(--text-secondary)",
                      maxWidth: "380px",
                      margin: 0,
                      lineHeight: 1.6,
                    }}
                  >
                    {isSunday
                      ? "Today is Sunday — a well-deserved day off. Attendance tracking resumes on Monday."
                      : "No attendance tracking for today. Enjoy your holiday!"}
                  </p>
                </div>
              );
            }
            return <></>;
          })()}
          {viewMode === "summary" &&
          (canViewAll || canViewDepartment) &&
          !isTodaySundayPKT() &&
          !holidays.find(
            (h) =>
              h.date ===
              new Intl.DateTimeFormat("en-CA", {
                timeZone: "Asia/Karachi",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
              }).format(new Date()),
          ) ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "20px",
              }}
            >
              {/* Search & Filter Bar */}
              <div className="panel" style={{ padding: "16px 20px" }}>
                <div
                  style={{
                    display: "flex",
                    gap: "16px",
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      position: "relative",
                      flex: 1,
                      minWidth: "260px",
                    }}
                  >
                    <input
                      type="text"
                      className="form-input"
                      style={{ paddingLeft: "38px", width: "100%" }}
                      placeholder="Search employee by Name, Code, or ID..."
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

                  {/* Department Filter */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <Filter size={14} style={{ color: "var(--text-muted)" }} />
                    <select
                      className="form-input"
                      style={{
                        width: "160px",
                        backgroundColor: "var(--bg-primary)",
                      }}
                      value={filterDepartment}
                      onChange={(e) => setFilterDepartment(e.target.value)}
                    >
                      <option value="All">All Departments</option>
                      {departmentsList.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Shift Filter */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <Briefcase
                      size={14}
                      style={{ color: "var(--text-muted)" }}
                    />
                    <select
                      className="form-input"
                      style={{
                        width: "160px",
                        backgroundColor: "var(--bg-primary)",
                      }}
                      value={filterShift}
                      onChange={(e) => setFilterShift(e.target.value)}
                    >
                      <option value="All">All Shifts</option>
                      <option value={SHIFTS.GENERAL}>General Shift</option>
                    </select>
                  </div>

                  {/* Today's Status Filter */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <Clock size={14} style={{ color: "var(--text-muted)" }} />
                    <select
                      className="form-input"
                      style={{
                        width: "160px",
                        backgroundColor: "var(--bg-primary)",
                      }}
                      value={filterTodayStatus}
                      onChange={(e) => setFilterTodayStatus(e.target.value)}
                    >
                      <option value="All">All Statuses</option>
                      <option value="Present">Present</option>
                      <option value="Late Arrival">Late Arrival</option>
                      <option value="Absent">Absent</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Master Table Grid */}
              <div className="panel" style={{ padding: "20px" }}>
                <div className="panel-header">
                  <h2 className="panel-title">
                    <Building
                      size={18}
                      style={{ color: "var(--color-primary)" }}
                    />
                    All-Employee Attendance Table ({filteredSummaries.length})
                  </h2>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      className="btn btn-secondary"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "6px 12px",
                        fontSize: "0.75rem",
                      }}
                      onClick={() => exportToCSV(filteredSummaries)}
                      title="Export attendance summary to CSV"
                    >
                      <FileText size={14} />
                      Export CSV
                    </button>
                  </div>
                </div>

                {/* Today's Stats Row */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "12px",
                    marginBottom: "20px",
                  }}
                >
                  <div
                    onClick={() => setFilterTodayStatus("Present")}
                    style={{
                      padding: "14px 18px",
                      borderRadius: "var(--radius-md)",
                      background: "rgba(34, 197, 94, 0.08)",
                      border:
                        filterTodayStatus === "Present"
                          ? "2px solid #22c55e"
                          : "1px solid rgba(34, 197, 94, 0.2)",
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <CheckCircle
                      size={20}
                      style={{ color: "#22c55e", flexShrink: 0 }}
                    />
                    <div>
                      <div
                        style={{
                          fontSize: "1.4rem",
                          fontWeight: 700,
                          color: "#22c55e",
                          lineHeight: 1,
                        }}
                      >
                        {todayStats.present}
                      </div>
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--text-secondary)",
                          marginTop: "2px",
                        }}
                      >
                        Present Today
                      </div>
                    </div>
                  </div>

                  <div
                    onClick={() => setFilterTodayStatus("Absent")}
                    style={{
                      padding: "14px 18px",
                      borderRadius: "var(--radius-md)",
                      background: "rgba(244, 63, 94, 0.08)",
                      border:
                        filterTodayStatus === "Absent"
                          ? "2px solid #f43f5e"
                          : "1px solid rgba(244, 63, 94, 0.2)",
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <XCircle
                      size={20}
                      style={{ color: "#f43f5e", flexShrink: 0 }}
                    />
                    <div>
                      <div
                        style={{
                          fontSize: "1.4rem",
                          fontWeight: 700,
                          color: "#f43f5e",
                          lineHeight: 1,
                        }}
                      >
                        {todayStats.absent}
                      </div>
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--text-secondary)",
                          marginTop: "2px",
                        }}
                      >
                        Absent Today
                      </div>
                    </div>
                  </div>

                  <div
                    onClick={() => setFilterTodayStatus("Late Arrival")}
                    style={{
                      padding: "14px 18px",
                      borderRadius: "var(--radius-md)",
                      background: "rgba(251, 191, 36, 0.08)",
                      border:
                        filterTodayStatus === "Late Arrival"
                          ? "2px solid #fbbf24"
                          : "1px solid rgba(251, 191, 36, 0.2)",
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <AlertCircle
                      size={20}
                      style={{ color: "#fbbf24", flexShrink: 0 }}
                    />
                    <div>
                      <div
                        style={{
                          fontSize: "1.4rem",
                          fontWeight: 700,
                          color: "#fbbf24",
                          lineHeight: 1,
                        }}
                      >
                        {todayStats.late}
                      </div>
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--text-secondary)",
                          marginTop: "2px",
                        }}
                      >
                        Late Arrivals
                      </div>
                    </div>
                  </div>
                </div>

                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Employee ID</th>
                        <th>Name</th>
                        <th>Department</th>
                        <th>Shift</th>
                        <th>Today's Status</th>
                        <th>Days Present</th>
                        <th>Days N/A</th>
                        <th>Days Absent</th>
                        <th>Total Hours (Month)</th>
                        <th style={{ width: "120px", textAlign: "center" }}>
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSummaries.map((emp) => (
                        <tr
                          key={emp.id}
                          onClick={() => {
                            setSelectedUserId(emp.id);
                            setViewMode("individual");
                          }}
                        >
                          <td style={{ fontWeight: 700, color: "white" }}>
                            {emp.formattedCode}
                          </td>
                          <td>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "10px",
                              }}
                            >
                              {emp.avatar ? (
                                <img
                                  src={emp.avatar}
                                  alt={emp.name}
                                  style={{
                                    width: "32px",
                                    height: "32px",
                                    borderRadius: "50%",
                                    objectFit: "cover",
                                    border: "1px solid var(--border-color)",
                                  }}
                                />
                              ) : (
                                <div
                                  style={{
                                    width: "32px",
                                    height: "32px",
                                    borderRadius: "50%",
                                    backgroundColor:
                                      "var(--color-primary-glow)",
                                    border: "1px solid var(--border-color)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontWeight: 600,
                                    fontSize: "0.8rem",
                                    color: "white",
                                  }}
                                >
                                  {emp.name
                                    .split(" ")
                                    .map((n) => n[0])
                                    .join("")
                                    .toUpperCase()
                                    .slice(0, 2)}
                                </div>
                              )}
                              <span style={{ fontWeight: 500 }}>
                                {emp.name}
                              </span>
                            </div>
                          </td>
                          <td>
                            <span
                              style={{
                                fontSize: "0.85rem",
                                color: "var(--text-secondary)",
                              }}
                            >
                              {emp.department}
                            </span>
                          </td>
                          <td
                            style={{
                              fontSize: "0.82rem",
                              color: "var(--text-muted)",
                            }}
                          >
                            {emp.shift.split(" (")[0]}
                          </td>
                          <td>{getTodayStatusBadge(emp.todayStatus)}</td>
                          <td style={{ fontWeight: 600 }}>
                            <span
                              style={{
                                color:
                                  emp.daysPresent > 0
                                    ? "#5ef4a6 "
                                    : "var(--text-secondary)",
                              }}
                            >
                              {emp.daysPresent}
                            </span>
                            / {emp.totalWorkDays}
                          </td>
                          <td style={{ fontWeight: 600 }}>
                            {emp.daysNotAvailable} / {emp.totalWorkDays}
                          </td>
                          <td>
                            <span
                              style={{
                                color:
                                  emp.daysAbsent > 0
                                    ? "#f43f5e"
                                    : "var(--text-secondary)",
                              }}
                            >
                              {emp.daysAbsent}
                            </span>{" "}
                            / {emp.totalWorkDays}
                          </td>
                          <td>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                              }}
                            >
                              <Clock
                                size={13}
                                style={{ color: "var(--text-muted)" }}
                              />
                              <span>{formatHours(emp.totalHours)}</span>
                            </div>
                          </td>
                          <td
                            style={{ textAlign: "center" }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              className="btn btn-secondary"
                              style={{
                                padding: "4px 10px",
                                fontSize: "0.75rem",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                              onClick={() => {
                                setSelectedUserId(emp.id);
                                setViewMode("individual");
                              }}
                            >
                              View Detailed Logs
                              <ChevronRight size={12} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {filteredSummaries.length === 0 && (
                        <tr>
                          <td
                            colSpan={9}
                            style={{
                              textAlign: "center",
                              padding: "40px",
                              color: "var(--text-secondary)",
                            }}
                          >
                            No employees match the search and filter criteria.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <></>
          )}

          {/* ─────────────────── DETAILED INDIVIDUAL VIEW ─────────────────── */}
          {viewMode === "individual" && selectedEmployee && (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "24px" }}
            >
              {/* Back Navigation Bar for Managers/Admins/Executives */}
              {(canViewAll || canViewDepartment) && (
                <div className="btn-selector-grp">
                  <button
                    className="btn btn-secondary"
                    style={{
                      padding: "6px 12px",
                      fontSize: "0.8rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                    onClick={() => setViewMode("summary")}
                  >
                    <ArrowLeft size={14} />
                    Back to All Employees Summary
                  </button>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.85rem",
                        color: "var(--text-secondary)",
                      }}
                    >
                      Select Employee:
                    </span>
                    <select
                      className="form-input"
                      style={{
                        width: "220px",
                        backgroundColor: "var(--bg-secondary)",
                      }}
                      value={selectedUserId}
                      onChange={(e) => setSelectedUserId(e.target.value)}
                    >
                      {employeeSummaries.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.formattedCode} - {emp.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Employee Detail Header Banner */}
              <div
                className="panel"
                style={{
                  padding: "24px",
                  background:
                    "linear-gradient(135deg, var(--bg-secondary) 0%, rgba(14, 82, 155, 0.08) 100%)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "16px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "16px",
                    }}
                  >
                    {selectedEmployee.avatar ? (
                      <img
                        src={selectedEmployee.avatar}
                        alt={selectedEmployee.name}
                        style={{
                          width: "72px",
                          height: "72px",
                          borderRadius: "50%",
                          objectFit: "cover",
                          boxShadow: "var(--shadow-sm)",
                          border: "1px solid var(--border-color)",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "72px",
                          height: "72px",
                          borderRadius: "50%",
                          backgroundColor: "var(--color-primary)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "1.8rem",
                          fontWeight: 700,
                          color: "white",
                          boxShadow: "var(--shadow-sm)",
                        }}
                      >
                        {selectedEmployee.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)}
                      </div>
                    )}
                    <div>
                      <h2
                        style={{
                          fontSize: "1.25rem",
                          color: "white",
                          fontWeight: 600,
                          marginBottom: "2px",
                        }}
                      >
                        {selectedEmployee.name}
                      </h2>
                      <div
                        style={{
                          display: "flex",
                          gap: "16px",
                          color: "var(--text-secondary)",
                          fontSize: "0.85rem",
                          flexWrap: "wrap",
                        }}
                      >
                        <span>
                          Code:{" "}
                          <strong style={{ color: "white" }}>
                            {selectedEmployee.formattedCode}
                          </strong>
                        </span>
                        {selectedEmployee.email && (
                          <span>
                            Email:{" "}
                            <strong style={{ color: "white" }}>
                              {selectedEmployee.email}
                            </strong>
                          </span>
                        )}
                        <span>
                          Department:{" "}
                          <strong style={{ color: "white" }}>
                            {selectedEmployee.department}
                          </strong>
                        </span>
                        {selectedEmployee.designation && (
                          <span>
                            Designation:{" "}
                            <strong style={{ color: "white" }}>
                              {selectedEmployee.designation}
                            </strong>
                          </span>
                        )}
                        <span>
                          Role:{" "}
                          <strong
                            style={{
                              color: "white",
                              textTransform: "capitalize",
                            }}
                          >
                            {selectedEmployee.isDepartmentHead
                              ? "Department Head"
                              : selectedEmployee.role}
                          </strong>
                        </span>
                        <span>
                          Shift:{" "}
                          <strong style={{ color: "white" }}>
                            {new Date().getDay() === 6
                              ? "Saturday Shift (10:00 AM - 04:00 PM)"
                              : selectedEmployee.shift}
                          </strong>
                        </span>
                      </div>
                    </div>
                  </div>
                  <div>
                    {selectedEmployee.todayStatus === "Clocked In" ? (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "flex-end",
                          gap: "6px",
                        }}
                      >
                        <span
                          className="badge badge-closed"
                          style={{ padding: "8px 16px", fontSize: "0.85rem" }}
                        >
                          <CheckCircle size={14} /> Clocked In
                        </span>
                        <span
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--text-muted)",
                          }}
                        >
                          Live Session Active
                        </span>
                      </div>
                    ) : (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "flex-end",
                          gap: "6px",
                        }}
                      >
                        <span
                          className="badge badge-type"
                          style={{
                            padding: "8px 16px",
                            fontSize: "0.85rem",
                            borderColor: "var(--border-color)",
                            color: "var(--text-secondary)",
                          }}
                        >
                          <Clock size={14} /> Clocked Out
                        </span>
                        <span
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--text-muted)",
                          }}
                        >
                          No Active Punch Session
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Monthly Calendar View (Top) */}
              <div className="panel" style={{ padding: "20px" }}>
                {/* Header Section - Added flexWrap and gap for mobile layout */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "16px",
                    flexWrap: "wrap",
                    gap: "12px",
                  }}
                >
                  <h3
                    className="panel-title"
                    style={{
                      margin: 0,
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <Calendar
                      size={16}
                      style={{ color: "var(--color-primary)" }}
                    />
                    Monthly Attendance Calendar
                  </h3>
                  <select
                    className="form-input"
                    style={{
                      padding: "6px 12px",
                      fontSize: "0.85rem",
                      width: "150px",
                    }}
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                  >
                    {Array.from({ length: 12 }).map((_, i) => {
                      const d = new Date();
                      d.setMonth(d.getMonth() - i);
                      const yyyy = d.getFullYear();
                      const mm = String(d.getMonth() + 1).padStart(2, "0");
                      const val = `${yyyy}-${mm}`;
                      const label = d.toLocaleDateString("en-US", {
                        month: "long",
                        year: "numeric",
                      });
                      return (
                        <option key={val} value={val}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Scrollable wrapper container for mobile views */}
                <div
                  style={{
                    overflowX: "auto",
                    width: "100%",
                    WebkitOverflowScrolling: "touch",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(7, 1fr)",
                      gap: "8px",
                      marginTop: "12px",
                      minWidth: "750px", // Prevents columns from shrinking below readable limits
                    }}
                  >
                    {/* Calendar Header */}
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                      (d) => (
                        <div
                          key={d}
                          style={{
                            textAlign: "center",
                            fontWeight: 600,
                            fontSize: "0.8rem",
                            color: "var(--text-secondary)",
                            paddingBottom: "8px",
                          }}
                        >
                          {d}
                        </div>
                      ),
                    )}

                    {/* Pad initial blank days */}
                    {(() => {
                      const [sYear, sMonth] = selectedMonth
                        .split("-")
                        .map(Number);
                      const firstDayObj = new Date(
                        Date.UTC(sYear, sMonth - 1, 1),
                      );
                      let startDay = firstDayObj.getUTCDay(); // 0 = Sunday
                      if (startDay === 0) startDay = 7;

                      const paddingDays = [];
                      for (let i = 1; i < startDay; i++) {
                        paddingDays.push(
                          <div
                            key={`pad-${i}`}
                            style={{
                              minHeight: "80px",
                              borderRadius: "8px",
                              backgroundColor: "var(--bg-secondary)",
                              opacity: 0.3,
                            }}
                          />,
                        );
                      }
                      return paddingDays;
                    })()}

                    {/* Calendar Days */}
                    {selectedEmployeePunchLogs.map((log) => {
                      const dayNum = parseInt(log.date.split("-")[2], 10);
                      const isOffDay =
                        log.status === "Weekend" || log.status === "Holiday";
                      const todayStr = new Intl.DateTimeFormat("en-CA", {
                        timeZone: "Asia/Karachi",
                      }).format(new Date());
                      const isPastOrToday = log.date <= todayStr;

                      return (
                        <div
                          key={log.date}
                          style={{
                            minHeight: "85px",
                            padding: "8px",
                            borderRadius: "8px",
                            backgroundColor: isOffDay
                              ? "rgba(255,255,255,0.02)"
                              : "var(--bg-secondary)",
                            border: "1px solid var(--border-color)",
                            display: "flex",
                            flexDirection: "column",
                            gap: "4px",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <span
                              style={{
                                fontSize: "0.85rem",
                                fontWeight: 600,
                                color: isOffDay ? "var(--text-muted)" : "white",
                              }}
                            >
                              {dayNum}
                            </span>
                            <div
                              style={{
                                transform: "scale(0.85)",
                                transformOrigin: "right top",
                              }}
                            >
                              {getLogStatusBadge(log.status)}
                            </div>
                          </div>

                          {log.status !== "Weekend" &&
                            log.status !== "Holiday" && (
                              <div
                                style={{
                                  marginTop: "auto",
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "2px",
                                  fontSize: "0.7rem",
                                  color: "var(--text-secondary)",
                                }}
                              >
                                {log.firstIn === "--" &&
                                log.lastOut === "--" &&
                                isPastOrToday &&
                                currentUser.role === "manager" ? (
                                  <div
                                    style={{
                                      display: "flex",
                                      gap: "4px",
                                      marginBottom: "4px",
                                    }}
                                  >
                                    <button
                                      className="btn btn-secondary"
                                      style={{
                                        padding: "2px 4px",
                                        fontSize: "0.6rem",
                                        flex: 1,
                                        backgroundColor: "var(--bg-primary)",
                                      }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleMarkDayStatus(
                                          log.date,
                                          "Site Duty",
                                        );
                                      }}
                                      title="Mark Site Duty"
                                    >
                                      Site Duty
                                    </button>
                                    <button
                                      className="btn btn-secondary"
                                      style={{
                                        padding: "2px 4px",
                                        fontSize: "0.6rem",
                                        flex: 1,
                                        backgroundColor: "var(--bg-primary)",
                                      }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleMarkDayStatus(
                                          log.date,
                                          "On Leave",
                                        );
                                      }}
                                      title="Mark On Leave"
                                    >
                                      Leave
                                    </button>
                                  </div>
                                ) : (
                                  <></>
                                )}
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                  }}
                                >
                                  <span>In:</span>
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "4px",
                                    }}
                                  >
                                    <span
                                      style={{
                                        color: "white",
                                        fontWeight: 500,
                                      }}
                                    >
                                      {log.firstIn === "--"
                                        ? "-"
                                        : log.firstIn.substring(0, 5)}
                                    </span>
                                    {canWrite &&
                                    log.firstIn === "--" &&
                                    isPastOrToday ? (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleAddManualPunch(
                                            log.date,
                                            "Check-In",
                                          );
                                        }}
                                        style={{
                                          background: "none",
                                          border: "none",
                                          color: "var(--color-primary)",
                                          cursor: "pointer",
                                          padding: "2px",
                                          display: "flex",
                                          fontWeight: "bold",
                                        }}
                                        title="Add Punch In"
                                      >
                                        +
                                      </button>
                                    ) : (
                                      <></>
                                    )}
                                    {currentUser.role === "manager" &&
                                    !log.lastOutId &&
                                    log.firstInId ? (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeletePunchIn(
                                            log.firstInId!,
                                            log.date,
                                          );
                                        }}
                                        style={{
                                          background: "none",
                                          border: "none",
                                          color: "#f43f5e",
                                          cursor: "pointer",
                                          padding: "2px",
                                          display: "inline-flex",
                                          alignItems: "center",
                                        }}
                                        title="Delete Punch In"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    ) : (
                                      <></>
                                    )}
                                  </div>
                                </div>
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                  }}
                                >
                                  <span>Out:</span>
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "4px",
                                    }}
                                  >
                                    <span
                                      style={{
                                        color: "white",
                                        fontWeight: 500,
                                      }}
                                    >
                                      {log.lastOut === "--"
                                        ? "-"
                                        : log.lastOut.substring(0, 5)}
                                    </span>
                                    {canWrite &&
                                    log.firstIn !== "--" &&
                                    log.lastOut === "--" &&
                                    isPastOrToday ? (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleAddManualPunch(
                                            log.date,
                                            "Check-Out",
                                          );
                                        }}
                                        style={{
                                          background: "none",
                                          border: "none",
                                          color: "var(--color-primary)",
                                          cursor: "pointer",
                                          padding: "2px",
                                          display: "flex",
                                          fontWeight: "bold",
                                        }}
                                        title="Add Punch Out"
                                      >
                                        +
                                      </button>
                                    ) : (
                                      <></>
                                    )}
                                    {currentUser.role === "manager" &&
                                    log.lastOutId ? (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeletePunchOut(
                                            log.lastOutId!,
                                            log.date,
                                          );
                                        }}
                                        style={{
                                          background: "none",
                                          border: "none",
                                          color: "#f43f5e",
                                          cursor: "pointer",
                                          padding: "2px",
                                          display: "inline-flex",
                                          alignItems: "center",
                                        }}
                                        title="Delete Punch Out"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    ) : (
                                      <></>
                                    )}
                                  </div>
                                </div>
                                {log.hours > 0 ? (
                                  <div
                                    style={{
                                      display: "flex",
                                      justifyContent: "flex-end",
                                      marginTop: "2px",
                                    }}
                                  >
                                    <span
                                      style={{
                                        color: "var(--color-primary)",
                                        fontWeight: 600,
                                      }}
                                    >
                                      {formatHours(log.hours)}
                                    </span>
                                  </div>
                                ) : (
                                  <></>
                                )}
                              </div>
                            )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Today's Shift Progress & KPI Cards split */}
              <div className="attendance-two-col">
                {/* Shift Progress Panel (Left) */}
                <div className="panel" style={{ padding: "20px" }}>
                  <h3 className="panel-title" style={{ marginBottom: "16px" }}>
                    <Clock
                      size={16}
                      style={{ color: "var(--color-primary)" }}
                    />
                    Today's Shift Progress
                  </h3>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "20px",
                      marginTop: "10px",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: "6px",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "0.85rem",
                            color: "var(--text-secondary)",
                          }}
                        >
                          Shift Hours worked
                        </span>
                        <strong style={{ fontSize: "0.85rem" }}>
                          {formatHours(todayShiftProgress.hours)} /{" "}
                          {new Date().getDay() === 6 ? "6h 0m" : "8h 0m"}
                        </strong>
                      </div>
                      <div
                        style={{
                          width: "100%",
                          height: "6px",
                          backgroundColor: "var(--bg-primary)",
                          borderRadius: "3px",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.min((todayShiftProgress.hours / (new Date().getDay() === 6 ? 6.0 : 8.0)) * 100, 100)}%`,
                            height: "100%",
                            backgroundColor: "var(--color-primary)",
                            borderRadius: "3px",
                            transition: "width 0.3s ease",
                          }}
                        />
                      </div>
                    </div>

                    <div
                      style={{
                        borderTop: "1px solid var(--border-color)",
                        paddingTop: "16px",
                      }}
                    >
                      <span
                        style={{
                          display: "block",
                          fontSize: "0.75rem",
                          textTransform: "uppercase",
                          color: "var(--text-muted)",
                          marginBottom: "10px",
                          letterSpacing: "0.03em",
                        }}
                      >
                        Clock Timestamps
                      </span>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "10px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "0.82rem",
                              color: "var(--text-secondary)",
                            }}
                          >
                            First In:
                          </span>
                          <strong
                            style={{
                              fontSize: "0.82rem",
                              color:
                                todayShiftProgress.firstIn !== "--"
                                  ? "var(--status-closed)"
                                  : "var(--text-secondary)",
                            }}
                          >
                            {todayShiftProgress.firstIn}
                          </strong>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "0.82rem",
                              color: "var(--text-secondary)",
                            }}
                          >
                            Last Out:
                          </span>
                          <strong
                            style={{
                              fontSize: "0.82rem",
                              color:
                                todayShiftProgress.lastOut !== "--"
                                  ? "var(--color-primary)"
                                  : "var(--text-secondary)",
                            }}
                          >
                            {todayShiftProgress.lastOut}
                          </strong>
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        backgroundColor: "rgba(14, 82, 155, 0.04)",
                        border: "1px solid var(--border-color)",
                        borderRadius: "var(--radius-md)",
                        padding: "12px",
                        display: "flex",
                        gap: "10px",
                        alignItems: "flex-start",
                      }}
                    >
                      <AlertCircle
                        size={15}
                        style={{
                          color: "var(--color-primary-solid)",
                          flexShrink: 0,
                          marginTop: "2px",
                        }}
                      />
                      <span
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--text-secondary)",
                          lineHeight: "1.4",
                        }}
                      >
                        Times are parsed directly from biometric punch entries
                        synced with the centralized gateway.
                      </span>
                    </div>
                  </div>
                </div>

                {/* KPI Cards Grid (Right side, 2x2 layout) */}
                <div
                  className="dashboard-grid"
                  style={{
                    gridTemplateColumns: "repeat(2, 1fr)",
                    height: "100%",
                  }}
                >
                  {/* KPI 1: Days Present */}
                  <div className="stat-card done">
                    <div className="stat-header">
                      <span className="stat-label">Days Present</span>
                      <div
                        className="stat-icon"
                        style={{
                          backgroundColor: "var(--status-closed-bg)",
                          color: "var(--status-closed)",
                        }}
                      >
                        <CheckCircle size={16} />
                      </div>
                    </div>
                    <span className="stat-value">
                      {individualStats.present} /{" "}
                      {individualStats.workDaysCounted}
                    </span>
                    <span className="stat-desc">
                      For selected month up to today
                    </span>
                  </div>

                  {/* KPI 2: Days Absent */}
                  <div
                    className="stat-card it-app"
                    style={{
                      borderLeft:
                        individualStats.absent > 0
                          ? "4px solid #f43f5e"
                          : "1px solid var(--border-color)",
                    }}
                  >
                    <div className="stat-header">
                      <span className="stat-label">Days Absent</span>
                      <div
                        className="stat-icon"
                        style={{
                          backgroundColor: "rgba(244, 63, 94, 0.12)",
                          color: "#f43f5e",
                        }}
                      >
                        <XCircle size={16} />
                      </div>
                    </div>
                    <span
                      className="stat-value"
                      style={{
                        color: individualStats.absent > 0 ? "#f43f5e" : "white",
                      }}
                    >
                      {individualStats.absent}
                    </span>
                    <span className="stat-desc">Unexcused Absences</span>
                  </div>

                  {/* KPI 3: Hours Clocked */}
                  <div className="stat-card prog">
                    <div className="stat-header">
                      <span className="stat-label">Hours Clocked</span>
                      <div
                        className="stat-icon"
                        style={{
                          backgroundColor: "var(--status-progress-bg)",
                          color: "var(--color-primary)",
                        }}
                      >
                        <TrendingUp size={16} />
                      </div>
                    </div>
                    <span className="stat-value">
                      {formatHours(individualStats.totalHours)}
                    </span>
                    <span className="stat-desc">
                      For selected month up to today
                    </span>
                  </div>

                  {/* KPI 4: Leave Balance */}
                  <div className="stat-card handover">
                    <div
                      className="stat-header"
                      style={{ marginBottom: "12px" }}
                    >
                      <span className="stat-label">Leave Balance</span>
                      <div
                        className="stat-icon"
                        style={{
                          backgroundColor: "var(--status-handover-bg)",
                          color: "var(--status-handover)",
                        }}
                      >
                        <FileText size={16} />
                      </div>
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr 1fr",
                        gap: "8px",
                        width: "100%",
                        marginTop: "6px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "1.1rem",
                            fontWeight: 700,
                            color: "var(--text-primary)",
                          }}
                        >
                          {selectedEmployee.casualLeaves ?? 12}
                        </span>
                        <span
                          style={{
                            fontSize: "0.65rem",
                            color: "var(--text-secondary)",
                            textTransform: "uppercase",
                          }}
                        >
                          Casual
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "1.1rem",
                            fontWeight: 700,
                            color: "var(--color-primary)",
                          }}
                        >
                          {selectedEmployee.annualLeaves ?? 14}
                        </span>
                        <span
                          style={{
                            fontSize: "0.65rem",
                            color: "var(--text-secondary)",
                            textTransform: "uppercase",
                          }}
                        >
                          Annual
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "1.1rem",
                            fontWeight: 700,
                            color: "var(--status-handover)",
                          }}
                        >
                          {selectedEmployee.medicalLeaves ?? 8}
                        </span>
                        <span
                          style={{
                            fontSize: "0.65rem",
                            color: "var(--text-secondary)",
                            textTransform: "uppercase",
                          }}
                        >
                          Medical
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {showHolidayModal ? (
        <div
          className="modal-overlay"
          onClick={() => setShowHolidayModal(false)}
        >
          <div
            className="modal-content"
            style={{ maxWidth: "520px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="panel-header"
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid var(--border-color)",
                margin: 0,
              }}
            >
              <h2
                className="panel-title"
                style={{
                  fontSize: "1.1rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <CalendarOff
                  size={18}
                  style={{ color: "var(--color-primary)" }}
                />
                Gazetted Holidays
              </h2>
              <button
                className="btn btn-secondary"
                style={{
                  width: "32px",
                  height: "32px",
                  padding: 0,
                  borderRadius: "50%",
                }}
                onClick={() => setShowHolidayModal(false)}
              >
                <X size={16} />
              </button>
            </div>
            <div
              style={{
                padding: "20px 24px",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              <div
                style={{ display: "flex", gap: "8px", alignItems: "center" }}
              >
                <input
                  type="date"
                  className="form-input"
                  style={{
                    width: "160px",
                    flex: "0 0 auto",
                    colorScheme: "dark",
                  }}
                  value={holidayDate}
                  onChange={(e) => setHolidayDate(e.target.value)}
                />
                <input
                  type="text"
                  className="form-input"
                  style={{ flex: 1, minWidth: 0 }}
                  placeholder="Holiday name (e.g. Eid ul Fitr)"
                  value={holidayName}
                  onChange={(e) => setHolidayName(e.target.value)}
                />
                <button
                  className="btn btn-primary"
                  style={{
                    flex: "0 0 auto",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    whiteSpace: "nowrap",
                  }}
                  onClick={handleAddHoliday}
                >
                  <Plus size={14} /> Add
                </button>
              </div>
              <div style={{ marginTop: "8px" }}>
                {holidays.length === 0 ? (
                  <p
                    style={{
                      color: "var(--text-secondary)",
                      textAlign: "center",
                      padding: "24px",
                    }}
                  >
                    No holidays added yet.
                  </p>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Name</th>
                        <th style={{ width: "60px" }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {holidays.map((h) => (
                        <tr key={h.date}>
                          <td style={{ fontVariantNumeric: "tabular-nums" }}>
                            {h.date}
                          </td>
                          <td>{h.name}</td>
                          <td>
                            <button
                              className="btn btn-danger"
                              style={{
                                padding: "2px 8px",
                                fontSize: "0.75rem",
                              }}
                              onClick={() => handleDeleteHoliday(h.date)}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <></>
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
