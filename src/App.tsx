import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  ActiveTab,
  AdminTicket,
  AdminTicketCategory,
  AdminTicketStatus,
  AppUser,
  Notice,
  Ticket,
  TicketStatus,
  TicketType,
  UserRole,
} from './types';

import { AdminTicketDetails } from './components/AdminTicketDetails';
import { AdminTicketList } from './components/AdminTicketList';
import { Attendance } from './components/Attendance';
import { FactoryUserManagement } from './components/FactoryUserManagement';
import { ChangePasswordModal } from './components/Modals/ChangePasswordModal';
import { CreateNoticeModal } from './components/Modals/CreateNoticeModal';
import { EditNoticeModal } from './components/Modals/EditNoticeModal';
import { NewAdminTicketModal } from './components/Modals/NewAdminTicketModal';
import { NewTicketModal } from './components/Modals/NewTicketModal';
import { PasswordReset } from './components/PasswordReset';
import { Header } from './components/Sidebar';
import { TicketDetails } from './components/TicketDetails';
import { TicketList } from './components/TicketList';
import { UserManagement } from './components/UserManagement';
import { ADMIN_TICKET_STATUS_LABELS, APP_TITLE, STATUS_LABELS } from './constants';
import { ActivityLog } from './tabs/ActivityLogs';
import { LeaveManagement } from './tabs/LeaveManagement';
import { Login } from './tabs/Login';
import { NoticeBoard } from './tabs/Noticeboard';
import { SiteDutyManagement } from './tabs/SiteDutyManagement';

function canUserAccessTab(tab: ActiveTab, role: UserRole, department: string | undefined): boolean {
  switch (tab) {
    case 'noticeboard':
      return ['it', 'employee', 'manager', 'executive'].includes(role);
    case 'tickets':
      return ['it', 'employee', 'manager', 'executive'].includes(role);
    case 'admin_tickets':
      return ['it', 'executive', 'manager', 'employee'].includes(role);
    case 'users':
      return role === 'it';
    case 'activity_log':
      return ['it', 'manager', 'executive'].includes(role) && department !== 'Staff';
    case 'attendance':
      return ['it', 'employee', 'manager', 'executive'].includes(role);
    case 'leaves':
      return ['it', 'employee', 'manager', 'executive'].includes(role);
    case 'site_duties':
      return ['it', 'employee', 'manager', 'executive'].includes(role) && department !== 'Staff';
    case 'factory_users':
      return role === 'it' || role === 'factory_it';
    case 'factory_attendance':
      return ['it', 'manager', 'factory_it', 'factory_manager', 'factory_employee'].includes(role);
    default:
      return false;
  }
}

function getSafeFallbackTab(role: UserRole): ActiveTab {
  if (role === 'it' || role === 'manager' || role === 'executive') return 'noticeboard';
  if (role === 'employee') return 'noticeboard';
  if (role === 'factory_it' || role === 'factory_manager' || role === 'factory_employee') return 'factory_attendance';
  return 'noticeboard';
}

function pathToTab(pathname: string): {
  tab: ActiveTab;
  ticketId: string | null;
  attendanceUserId?: string;
  attendanceView?: 'summary' | 'individual';
} {
  const trimmed = pathname.replace(/\/+$/, '');
  const parts = trimmed.split('/').filter(Boolean);

  const tabMap: Record<string, ActiveTab> = {
    noticeboard: 'noticeboard',
    tickets: 'tickets',
    'admin-tickets': 'admin_tickets',
    users: 'users',
    'activity-log': 'activity_log',
    attendance: 'attendance',
    leaves: 'leaves',
    'site-duties': 'site_duties',
    'factory-users': 'factory_users',
    'factory-attendance': 'factory_attendance',
  };

  if (parts.length === 0) return { tab: 'noticeboard', ticketId: null };

  const base = parts[0];
  const ticketId = (base === 'tickets' || base === 'admin-tickets') && parts[1] ? parts[1] : null;

  if (base === 'tickets' || base === 'admin-tickets') {
    return { tab: tabMap[base] || 'noticeboard', ticketId };
  }

  if (base === 'attendance' || base === 'factory-attendance') {
    const urlParams = new URLSearchParams(window.location.search);
    const attendanceView = urlParams.get('view') as 'summary' | 'individual' | null;
    const attendanceUserId = urlParams.get('userId') || undefined;
    return {
      tab: tabMap[base] || 'noticeboard',
      ticketId: null,
      attendanceUserId,
      attendanceView: attendanceView || undefined,
    };
  }

  return { tab: tabMap[base] || 'noticeboard', ticketId: null };
}

function tabToPath(
  tab: ActiveTab,
  ticketId?: string | null,
  attendanceView?: 'summary' | 'individual',
  attendanceUserId?: string
): string {
  const base = `/${tab.replace('_', '-')}`;
  if ((tab === 'tickets' || tab === 'admin_tickets') && ticketId) {
    return `${base}/${ticketId}`;
  }
  if (tab === 'attendance' || tab === 'factory_attendance') {
    const params = new URLSearchParams();
    if (attendanceView && attendanceView !== 'summary') params.set('view', attendanceView);
    if (attendanceUserId) params.set('userId', attendanceUserId);
    const query = params.toString();
    return query ? `${base}?${query}` : base;
  }
  return base;
}

function App() {
  const getInitialTab = (): {
    tab: ActiveTab;
    ticketId: string | null;
    attendanceUserId?: string;
    attendanceView?: 'summary' | 'individual';
  } => {
    if (typeof window !== 'undefined') {
      return pathToTab(window.location.pathname);
    }
    return { tab: 'noticeboard', ticketId: null };
  };

  const initialTab = getInitialTab();

  const [token, setToken] = useState<string | null>(localStorage.getItem('harisco_token'));
  const [notices, setNotices] = useState<Notice[]>([]);
  const [isCreateNoticeOpen, setIsCreateNoticeOpen] = useState(false);
  const [selectedNoticeId, setSelectedNoticeId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [factoryUsers, setFactoryUsers] = useState<AppUser[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>(initialTab.tab);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(initialTab.ticketId);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [adminTickets, setAdminTickets] = useState<AdminTicket[]>([]);
  const [adminSearchQuery, setAdminSearchQuery] = useState<string>('');
  const [selectedAdminTicketId, setSelectedAdminTicketId] = useState<string | null>(initialTab.ticketId);
  const [isCreateAdminModalOpen, setIsCreateAdminModalOpen] = useState<boolean>(false);
  const [attendanceViewMode, setAttendanceViewMode] = useState<'summary' | 'individual'>(
    initialTab.attendanceView || 'summary'
  );
  const [attendanceSelectedUserId, setAttendanceSelectedUserId] = useState<string | undefined>(
    initialTab.attendanceUserId
  );
  const attendanceSelectedUserIdRef = useRef(attendanceSelectedUserId);
  useEffect(() => {
    attendanceSelectedUserIdRef.current = attendanceSelectedUserId;
  });

  const handleAttendanceViewModeChange = (mode: 'summary' | 'individual', userId?: string) => {
    if (mode === 'individual') {
      const targetUserId = userId || attendanceSelectedUserIdRef.current || currentUser!.id;
      navigateToAttendanceIndividual(targetUserId);
    } else {
      navigateToAttendanceSummary();
    }
  };

  const handleAttendanceSelectedUserIdChange = (userId: string) => {
    setAttendanceSelectedUserId(userId);
    if (attendanceViewMode === 'individual') {
      const path = tabToPath(activeTab, undefined, 'individual', userId);
      window.history.replaceState({}, '', path);
    }
  };

  const syncUrl = useCallback(
    (
      tab: ActiveTab,
      ticketId?: string | null,
      attendanceView?: 'summary' | 'individual',
      attendanceUserId?: string
    ) => {
      const path = tabToPath(tab, ticketId, attendanceView, attendanceUserId);
      window.history.replaceState({}, '', path);
    },
    []
  );

  interface RouteState {
    tab: ActiveTab;
    ticketId?: string | null;
    attendanceView?: 'summary' | 'individual';
    attendanceUserId?: string;
  }

  const navigateToTab = ({ tab, ticketId, attendanceView, attendanceUserId }: RouteState): void => {
    const path = tabToPath(tab, ticketId, attendanceView, attendanceUserId);
    window.history.pushState({}, '', path);
    setActiveTab(tab);
    setSelectedTicketId(tab === 'tickets' ? ticketId || null : null);
    setSelectedAdminTicketId(tab === 'admin_tickets' ? ticketId || null : null);
    if (tab === 'attendance' || tab === 'factory_attendance') {
      setAttendanceViewMode(attendanceView || 'summary');
      setAttendanceSelectedUserId(attendanceUserId);
    }
  };

  const navigateToTicket = (tab: ActiveTab, ticketId: string) => {
    const path = tabToPath(tab, ticketId);
    window.history.pushState({}, '', path);
    setActiveTab(tab);
    setSelectedTicketId(tab === 'tickets' ? ticketId : null);
    setSelectedAdminTicketId(tab === 'admin_tickets' ? ticketId : null);
  };

  const navigateBackToList = () => {
    const path = tabToPath(activeTab);
    window.history.pushState({}, '', path);
    setSelectedTicketId(null);
    setSelectedAdminTicketId(null);
    if (activeTab === 'attendance' || activeTab === 'factory_attendance') {
      setAttendanceViewMode('summary');
      setAttendanceSelectedUserId(undefined);
    }
  };

  const enforceAccessControl = useCallback(() => {
    if (!currentUser) return;
    const { tab } = pathToTab(window.location.pathname);
    if (!canUserAccessTab(tab, currentUser.role, currentUser.department ?? undefined)) {
      const fallback = getSafeFallbackTab(currentUser.role);
      syncUrl(fallback);
      setActiveTab(fallback);
      setSelectedTicketId(null);
      setSelectedAdminTicketId(null);
      setAttendanceViewMode('summary');
      setAttendanceSelectedUserId(undefined);
    }
  }, [currentUser, syncUrl]);

  useEffect(() => {
    if (currentUser && !loading) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      enforceAccessControl();
    }
  }, [currentUser, loading, enforceAccessControl]);

  const navigateToAttendanceIndividual = (userId: string) => {
    const path = tabToPath(activeTab, undefined, 'individual', userId);
    window.history.pushState({}, '', path);
    setAttendanceViewMode('individual');
    setAttendanceSelectedUserId(userId);
  };

  const navigateToAttendanceSummary = () => {
    const path = tabToPath(activeTab);
    window.history.pushState({}, '', path);
    setAttendanceViewMode('summary');
    setAttendanceSelectedUserId(undefined);
  };

  // Sync URL with active tab for browser navigation
  useEffect(() => {
    const handlePopState = () => {
      const { tab, ticketId, attendanceUserId, attendanceView } = pathToTab(window.location.pathname);
      if (!currentUser || canUserAccessTab(tab, currentUser.role, currentUser.department ?? undefined)) {
        setActiveTab(tab);
        setSelectedTicketId(tab === 'tickets' ? ticketId : null);
        setSelectedAdminTicketId(tab === 'admin_tickets' ? ticketId : null);
        if (tab === 'attendance' || tab === 'factory_attendance') {
          setAttendanceViewMode(attendanceView || 'summary');
          setAttendanceSelectedUserId(attendanceUserId);
        }
      } else {
        const fallback = getSafeFallbackTab(currentUser!.role);
        const path = tabToPath(fallback);
        window.history.replaceState({}, '', path);
        setActiveTab(fallback);
        setSelectedTicketId(null);
        setSelectedAdminTicketId(null);
        setAttendanceViewMode('summary');
        setAttendanceSelectedUserId(undefined);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentUser]);

  // Load session and data
  useEffect(() => {
    const fetchSessionAndData = async () => {
      if (!token) {
        setNotices([]);
        setCurrentUser(null);
        setTickets([]);
        setUsers([]);
        setFactoryUsers([]);
        setAdminTickets([]);
        setLoading(false);
        return;
      }

      try {
        const authRes = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!authRes.ok) {
          throw new Error('Session expired');
        }

        const authData = await authRes.json();
        const user: AppUser = authData.user;
        setCurrentUser(user);

        if (user.needsPasswordReset === 1) {
          setLoading(false);
          return;
        }

        if (user.role.includes('factory')) {
          navigateToTab({ tab: 'factory_attendance' });
        }

        // Fetch Notices
        const noticesRes = await fetch('/api/notices', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (noticesRes.ok) {
          const noticesData = await noticesRes.json();
          setNotices(noticesData);
        }

        // Fetch tickets
        const ticketsRes = await fetch('/api/tickets', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (ticketsRes.ok) {
          const ticketsData = await ticketsRes.json();
          setTickets(ticketsData);
        }

        // Fetch admin tickets
        const adminTicketsRes = await fetch('/api/admin-tickets', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (adminTicketsRes.ok) {
          const adminTicketsData = await adminTicketsRes.json();
          setAdminTickets(adminTicketsData);
        }

        // Fetch users
        const usersRes = await fetch('/api/users', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (usersRes.ok) {
          const usersData = await usersRes.json();
          setUsers(usersData);
        }

        const factoryUsersRes = await fetch('/api/factory/users', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (factoryUsersRes.ok) {
          const factoryUsersData = await factoryUsersRes.json();
          setFactoryUsers(factoryUsersData);
        }
      } catch (err) {
        console.error('Session verification failed:', err);
        localStorage.removeItem('harisco_token');
        setToken(null);
        setCurrentUser(null);
      } finally {
        setLoading(false);
      }
    };

    fetchSessionAndData();
  }, [token]);

  // SSE-based real-time updates for tickets
  useEffect(() => {
    if (!token) return;

    const eventSource = new EventSource(`/api/tickets/stream?token=${token}`);

    eventSource.onopen = () => {
      console.log('[SSE] Ticket stream connected');
    };

    eventSource.onerror = (err) => {
      console.error('[SSE] Ticket stream error:', err);
    };

    eventSource.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type !== 'ticket_update') return;

        setTickets((prev) => {
          switch (msg.action) {
            case 'created':
              return [msg.data, ...prev];
            case 'status_changed':
            case 'updated': {
              const idx = prev.findIndex((t) => t.id === msg.data.id);
              if (idx === -1) return prev;
              const updated = [...prev];
              updated[idx] = { ...updated[idx], ...msg.data };
              return updated;
            }
            case 'commented': {
              const idx = prev.findIndex((t) => t.id === msg.data.ticketId);
              if (idx === -1) return prev;
              const updated = [...prev];
              updated[idx] = {
                ...updated[idx],
                comments: [...updated[idx].comments, msg.data.comment],
              };
              return updated;
            }
            case 'deleted':
              return prev.filter((t) => t.id !== msg.data.ticketId);
            default:
              return prev;
          }
        });
      } catch {
        // ignore malformed messages
      }
    };

    return () => eventSource.close();
  }, [token]);

  // SSE-based real-time updates for admin tickets
  useEffect(() => {
    if (!token) return;

    const eventSource = new EventSource(`/api/admin-tickets/stream?token=${token}`);

    eventSource.onopen = () => {
      console.log('[SSE] Admin ticket stream connected');
    };

    eventSource.onerror = (err) => {
      console.error('[SSE] Admin ticket stream error:', err);
    };

    eventSource.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type !== 'admin_ticket_update') return;

        setAdminTickets((prev) => {
          switch (msg.action) {
            case 'created':
              return [msg.data, ...prev];
            case 'status_changed':
            case 'updated': {
              const idx = prev.findIndex((t) => t.id === (msg.data.id || msg.data.ticketId));
              if (idx === -1) return prev;
              const updated = [...prev];
              updated[idx] = { ...updated[idx], ...msg.data };
              return updated;
            }
            case 'commented': {
              const idx = prev.findIndex((t) => t.id === msg.data.ticketId);
              if (idx === -1) return prev;
              const updated = [...prev];
              updated[idx] = {
                ...updated[idx],
                comments: [...updated[idx].comments, msg.data.comment],
                updatedAt: msg.data.comment.createdAt,
              };
              return updated;
            }
            case 'deleted':
              return prev.filter((t) => t.id !== msg.data.ticketId);
            default:
              return prev;
          }
        });
      } catch {
        // ignore malformed messages
      }
    };

    return () => eventSource.close();
  }, [token]);

  // Synchronize document title for SEO
  useEffect(() => {
    if (selectedAdminTicketId) {
      const ticket = adminTickets.find((t) => t.id === selectedAdminTicketId);
      if (ticket) {
        document.title = `${ticket.id} | ${APP_TITLE}`;
        return;
      }
    }

    if (selectedTicketId) {
      const ticket = tickets.find((t) => t.id === selectedTicketId);
      if (ticket) {
        document.title = `${ticket.id} | ${APP_TITLE}`;
        return;
      }
    }

    const tabName = activeTab
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    const adjustedTabName = activeTab === 'noticeboard' ? 'Dashboard' : tabName;
    document.title = `${adjustedTabName} | ${APP_TITLE}`;
  }, [activeTab, selectedTicketId, selectedAdminTicketId, tickets, adminTickets]);

  // Find active ticket if viewing details
  const currentTicket = selectedTicketId ? tickets.find((t) => t.id === selectedTicketId) || null : null;

  const currentAdminTicket = selectedAdminTicketId
    ? adminTickets.find((t) => t.id === selectedAdminTicketId) || null
    : null;

  // Filter IT users for assignees dropdown
  const itUsers = users.filter((u) => u.role === 'it' && u.is_active !== 0);

  const handleLoginSuccess = (newToken: string, user: AppUser) => {
    localStorage.setItem('harisco_token', newToken);
    setToken(newToken);
    setCurrentUser(user);
    navigateToTab({ tab: 'noticeboard' });
  };

  const handlePasswordResetSuccess = (newToken: string, updatedUser: AppUser) => {
    localStorage.setItem('harisco_token', newToken);
    setToken(newToken);
    setCurrentUser(updatedUser);
    navigateToTab({ tab: 'noticeboard' });
  };

  // Handle Logout
  const handleLogout = () => {
    localStorage.removeItem('harisco_token');
    setToken(null);
    setCurrentUser(null);
    setTickets([]);
    setUsers([]);
    setFactoryUsers([]);
    setAdminTickets([]);
    setSelectedTicketId(null);
    setSelectedAdminTicketId(null);
    navigateToTab({ tab: 'noticeboard' });
  };

  // Noticeboard-releveant API calls

  const fetchNotices = async () => {
    if (!token || !currentUser) return;
    try {
      const response = await fetch('/api/notices', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch notices');
      const data = await response.json();
      setNotices(data);
    } catch (error) {
      console.error('Notice fetch error:', error);
    }
  };

  // Create a notice
  const handleCreateNotice = async (noticeData: Omit<Notice, 'id' | 'createdAt' | 'authorName' | 'authorRole'>) => {
    if (!token || !currentUser) return;

    const payload = {
      ...noticeData,
      authorName: currentUser.name,
      authorRole: currentUser.role,
      createdAt: new Date().toISOString(),
    };

    try {
      const response = await fetch('/api/notices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        fetchNotices();
        setIsCreateNoticeOpen(false);
      }
    } catch (error) {
      console.error('Failed to post notice:', error);
    }
  };

  // Update a notice
  const handleEditNotice = async (
    noticeId: string,
    noticeData: Omit<Notice, 'id' | 'createdAt' | 'authorName' | 'authorRole'>
  ) => {
    if (!token || !currentUser) return;
    const payload = {
      ...noticeData,
      authorName: currentUser.name,
      authorRole: currentUser.role,
      createdAt: new Date().toISOString(),
    };

    try {
      const response = await fetch(`/api/notices/${noticeId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        fetchNotices(); // <-- ADD THIS LINE HERE to refresh the notice list instantly
        setSelectedNoticeId(null);
      }
    } catch (error) {
      console.error('Failed to update notice:', error);
    }
  };

  // Ticket-relevant API calls

  // Handle status updates
  const handleUpdateStatus = async (
    ticketId: string,
    status: TicketStatus,
    actionMessage: string,
    quotation?: number
  ) => {
    if (!token || !currentUser) return;

    const confirmMessage = ['Update ticket ', ticketId, ' status to ', STATUS_LABELS[status], '?'].join('');

    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      const res = await fetch(`/api/tickets/${ticketId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status, actionMessage, quotation }),
      });

      if (!res.ok) throw new Error('Failed to update status');
      const result = await res.json();

      // Add a system comment in the activity thread locally
      const newComment = {
        id: `c-sys-${Date.now()}`,
        authorId: 'system',
        authorName: 'System Log',
        authorRole: 'it' as UserRole,
        avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=100&h=100&q=80',
        content: `Workflow updated to status: ${STATUS_LABELS[status]}.${quotation !== undefined ? ` Quotation added: Rs ${quotation}` : ''}`,
        createdAt: new Date().toISOString(),
      };

      setTickets((prevTickets) =>
        prevTickets.map((t) => {
          if (t.id !== ticketId) return t;
          return {
            ...t,
            status: result.status,
            updatedAt: result.updatedAt,
            quotation: result.quotation !== undefined ? result.quotation : t.quotation,
            comments: [...t.comments, newComment],
            activityLogs: [...t.activityLogs, result.newLog],
          };
        })
      );
    } catch (err) {
      console.error(err);
      alert('Error updating status. Please try again.');
    }
  };

  // Handle ticket assignment
  const handleAssignTicket = async (ticketId: string, assigneeId: string, assigneeName: string) => {
    if (!token || !currentUser) return;
    try {
      const res = await fetch(`/api/tickets/${ticketId}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ assigneeId, assigneeName }),
      });

      if (!res.ok) throw new Error('Failed to assign ticket');
      const result = await res.json();

      setTickets((prevTickets) =>
        prevTickets.map((t) => {
          if (t.id !== ticketId) return t;
          return {
            ...t,
            assigneeId: result.assigneeId,
            assigneeName: result.assigneeName,
            status: result.status,
            updatedAt: result.updatedAt,
            activityLogs: [...t.activityLogs, result.newLog],
          };
        })
      );
    } catch (err) {
      console.error(err);
      alert('Error assigning ticket. Please try again.');
    }
  };

  // Handle edit ticket
  const handleEditTicket = async (
    ticketId: string,
    data: { description: string; type: TicketType; justification: string }
  ) => {
    if (!token || !currentUser) return;
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error('Failed to edit ticket');
      const result = await res.json();

      setTickets((prevTickets) =>
        prevTickets.map((t) => {
          if (t.id !== ticketId) return t;
          return {
            ...t,
            description: data.description,
            type: data.type,
            justification: data.justification,
            updatedAt: result.updatedAt,
            activityLogs: [...t.activityLogs, result.newLog],
          };
        })
      );
    } catch (err) {
      console.error(err);
      alert('Error editing ticket. Please try again.');
    }
  };

  // Handle delete ticket
  const handleDeleteTicket = async (ticketId: string) => {
    if (!token || !currentUser) return;
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error('Failed to delete ticket');

      setTickets((prevTickets) => prevTickets.filter((t) => t.id !== ticketId));
      navigateBackToList();
    } catch (err) {
      console.error(err);
      alert('Error deleting ticket. Please try again.');
    }
  };

  // Handle adding comments
  const handleAddComment = async (ticketId: string, content: string) => {
    if (!token || !currentUser) return;
    try {
      const res = await fetch(`/api/tickets/${ticketId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content }),
      });

      if (!res.ok) throw new Error('Failed to add comment');
      const newComment = await res.json();

      const newLog = {
        id: `log-${Date.now()}`,
        action: 'Comment added',
        timestamp: new Date().toISOString(),
        performedByName: currentUser.name,
        performedByRole: currentUser.role,
      };

      setTickets((prevTickets) =>
        prevTickets.map((t) => {
          if (t.id !== ticketId) return t;
          return {
            ...t,
            comments: [...t.comments, newComment],
            updatedAt: newComment.createdAt,
            activityLogs: [...t.activityLogs, newLog],
          };
        })
      );
    } catch (err) {
      console.error(err);
      alert('Error posting comment. Please try again.');
    }
  };

  const handleCreateTicket = async (data: { description: string; justification: string; type: TicketType }) => {
    if (!token || !currentUser) return;
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error('Failed to raise ticket');
      const newTicket = await res.json();

      setTickets((prevTickets) => [newTicket, ...prevTickets]);
      navigateToTicket('tickets', newTicket.id);
      setIsCreateModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('Error raising issue ticket. Please try again.');
    }
  };

  // Admin Ticket handlers

  const handleUpdateAdminTicketStatus = async (
    ticketId: string,
    status: AdminTicketStatus,
    actionMessage: string,
    executiveId?: string,
    executiveName?: string
  ) => {
    if (!token || !currentUser) return;

    const confirmMessage = ['Update ticket ', ticketId, ' status to ', ADMIN_TICKET_STATUS_LABELS[status], '?'].join(
      ''
    );

    if (!window.confirm(confirmMessage)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin-tickets/${ticketId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status,
          actionMessage,
          executiveId,
          executiveName,
        }),
      });

      if (!res.ok) throw new Error('Failed to update admin ticket status');
      const result = await res.json();

      setAdminTickets((prev) =>
        prev.map((t) => {
          if (t.id !== ticketId) return t;
          return {
            ...t,
            status: result.status,
            previousStatus: result.previousStatus,
            updatedAt: result.updatedAt,
            executiveId: result.executiveId || t.executiveId,
            executiveName: result.executiveName || t.executiveName,
            activityLogs: [...t.activityLogs, result.newLog],
          };
        })
      );
    } catch (err) {
      console.error(err);
      alert('Error updating admin ticket status. Please try again.');
    }
  };

  const handleRevertAdminTicketStatus = async (ticketId: string) => {
    if (!token || !currentUser) return;

    const ticket = adminTickets.find((t) => t.id === ticketId);
    if (!ticket || ticket.status === 'awaiting_admin_manager') return;

    const revertTarget = ticket.previousStatus
      ? ADMIN_TICKET_STATUS_LABELS[ticket.previousStatus as AdminTicketStatus]
      : 'Open';

    const confirmMessage = ['Revert ticket ', ticketId, ' status back to ', revertTarget, '?'].join('');

    if (!window.confirm(confirmMessage)) return;

    try {
      const res = await fetch(`/api/admin-tickets/${ticketId}/revert-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to revert admin ticket status');
      }
      const result = await res.json();

      setAdminTickets((prev) =>
        prev.map((t) => {
          if (t.id !== ticketId) return t;
          return {
            ...t,
            status: result.status,
            previousStatus: result.previousStatus,
            updatedAt: result.updatedAt,
            activityLogs: [...t.activityLogs, result.newLog],
          };
        })
      );
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Error reverting admin ticket status. Please try again.');
    }
  };

  const handleAddAdminComment = async (ticketId: string, content: string) => {
    if (!token || !currentUser) return;
    try {
      const res = await fetch(`/api/admin-tickets/${ticketId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content }),
      });

      if (!res.ok) throw new Error('Failed to add comment');
      const newComment = await res.json();

      const newLog = {
        id: `log-${Date.now()}`,
        action: 'Comment added',
        timestamp: new Date().toISOString(),
        performedByName: currentUser.name,
        performedByRole: currentUser.role,
      };

      setAdminTickets((prev) =>
        prev.map((t) => {
          if (t.id !== ticketId) return t;
          return {
            ...t,
            comments: [...t.comments, newComment],
            updatedAt: newComment.createdAt,
            activityLogs: [...t.activityLogs, newLog],
          };
        })
      );
    } catch (err) {
      console.error(err);
      alert('Error posting comment. Please try again.');
    }
  };

  const handleCreateAdminTicket = async (data: { description: string; category: AdminTicketCategory }) => {
    if (!token || !currentUser) return;
    try {
      const res = await fetch('/api/admin-tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error('Failed to raise admin ticket');
      const newTicket = await res.json();

      setAdminTickets((prev) => [newTicket, ...prev]);
      navigateToTicket('admin_tickets', newTicket.id);
      setIsCreateAdminModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('Error raising admin ticket. Please try again.');
    }
  };

  const handleEditAdminTicket = async (
    ticketId: string,
    data: { description: string; category: AdminTicketCategory }
  ) => {
    if (!token || !currentUser) return;
    try {
      const res = await fetch(`/api/admin-tickets/${ticketId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error('Failed to edit admin ticket');
      const result = await res.json();

      setAdminTickets((prev) =>
        prev.map((t) => {
          if (t.id !== ticketId) return t;
          return {
            ...t,
            description: data.description,
            category: data.category,
            updatedAt: result.updatedAt,
            activityLogs: [...t.activityLogs, result.newLog],
          };
        })
      );
    } catch (err) {
      console.error(err);
      alert('Error editing admin ticket. Please try again.');
    }
  };

  const handleDeleteAdminTicket = async (ticketId: string) => {
    if (!token || !currentUser) return;
    try {
      const res = await fetch(`/api/admin-tickets/${ticketId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error('Failed to delete admin ticket');

      setAdminTickets((prev) => prev.filter((t) => t.id !== ticketId));
      navigateBackToList();
    } catch (err) {
      console.error(err);
      alert('Error deleting admin ticket. Please try again.');
    }
  };

  // User-relevant API calls

  const handleAddUser = async (data: {
    name: string;
    email: string;
    username: string;
    role: UserRole;
    password?: string;
    avatar?: string;
    department?: string;
    designation?: string;
    isDepartmentHead?: boolean;
    loginEnabled?: boolean;
  }) => {
    if (!token || !currentUser) return;
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to add user');
      }

      const newUser = await res.json();
      setUsers((prevUsers) => [...prevUsers, newUser]);
    } catch (err) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : 'Error creating user. Please try again.';
      alert(errMsg);
    }
  };

  // Handle deleting users (IT only)
  const handleDeleteUser = async (userId: string) => {
    if (!token || !currentUser) return;
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to delete user');
      }

      setUsers((prevUsers) => prevUsers.filter((u) => u.id !== userId));
    } catch (err) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : 'Error deleting user. Please try again.';
      alert(errMsg);
    }
  };

  // Handle offboarding users (IT only)
  const handleOffboardUser = async (userId: string, reason: string, offboardDate: string) => {
    if (!token || !currentUser) return;
    try {
      const res = await fetch(`/api/users/${userId}/offboard`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason, offboarded_at: offboardDate }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to offboard user');
      }

      setUsers((prevUsers) =>
        prevUsers.map((u) =>
          u.id === userId
            ? {
                ...u,
                is_active: 0,
                offboarded_at: offboardDate,
                offboarded_by: currentUser.id,
                offboard_reason: reason,
              }
            : u
        )
      );
    } catch (err) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : 'Error offboarding user. Please try again.';
      alert(errMsg);
    }
  };

  // Handle updating users (IT only)
  const handleUpdateUser = async (
    userId: string,
    data: {
      name: string;
      email: string | null;
      department?: string | null;
      designation?: string | null;
      avatar?: string | null;
      isDepartmentHead?: boolean;
      loginEnabled?: boolean;
    }
  ) => {
    if (!token || !currentUser) return;
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to update user');
      }

      const updatedUser = await res.json();
      setUsers((prevUsers) =>
        prevUsers.map((u) =>
          u.id === userId
            ? {
                ...u,
                name: updatedUser.name,
                email: updatedUser.email,
                department: updatedUser.department,
                designation: updatedUser.designation,
                avatar: updatedUser.avatar,
                isDepartmentHead: updatedUser.isDepartmentHead,
                loginEnabled: updatedUser.loginEnabled,
              }
            : u
        )
      );
    } catch (err) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : 'Error updating user. Please try again.';
      alert(errMsg);
    }
  };

  // Factory User-relevant API calls

  const handleAddFactoryUser = async (data: {
    name: string;
    email: string;
    username: string;
    role: UserRole;
    password?: string;
    avatar?: string;
    department?: string;
    designation?: string;
    isDepartmentHead?: boolean;
    loginEnabled?: boolean;
    defaultShift?: string;
  }) => {
    if (!token || !currentUser) return;
    try {
      const res = await fetch('/api/factory/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to add factory user');
      }

      const newUser = await res.json();
      setFactoryUsers((prevUsers) => [...prevUsers, newUser]);
    } catch (err) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : 'Error creating factory user. Please try again.';
      alert(errMsg);
    }
  };

  const handleDeleteFactoryUser = async (userId: string) => {
    if (!token || !currentUser) return;
    try {
      const res = await fetch(`/api/factory/users/${userId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to delete factory user');
      }

      setFactoryUsers((prevUsers) => prevUsers.filter((u) => u.id !== userId));
    } catch (err) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : 'Error deleting factory user. Please try again.';
      alert(errMsg);
    }
  };

  const handleOffboardFactoryUser = async (userId: string, reason: string, offboardDate: string) => {
    if (!token || !currentUser) return;
    try {
      const res = await fetch(`/api/factory/users/${userId}/offboard`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason, offboarded_at: offboardDate }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to offboard factory user');
      }

      setFactoryUsers((prevUsers) =>
        prevUsers.map((u) =>
          u.id === userId
            ? {
                ...u,
                is_active: 0,
                offboarded_at: offboardDate,
                offboarded_by: currentUser.id,
                offboard_reason: reason,
              }
            : u
        )
      );
    } catch (err) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : 'Error offboarding factory user. Please try again.';
      alert(errMsg);
    }
  };

  const handleUpdateFactoryUser = async (
    userId: string,
    data: {
      name: string;
      email: string | null;
      department?: string | null;
      designation?: string | null;
      avatar?: string | null;
      isDepartmentHead?: boolean;
      loginEnabled?: boolean;
      defaultShift?: string;
    }
  ) => {
    if (!token || !currentUser) return;
    try {
      const res = await fetch(`/api/factory/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to update factory user');
      }

      const updatedUser = await res.json();
      setFactoryUsers((prevUsers) =>
        prevUsers.map((u) =>
          u.id === userId
            ? {
                ...u,
                name: updatedUser.name,
                email: updatedUser.email,
                department: updatedUser.department,
                designation: updatedUser.designation,
                avatar: updatedUser.avatar,
                isDepartmentHead: updatedUser.isDepartmentHead,
                loginEnabled: updatedUser.loginEnabled,
                defaultShift: updatedUser.defaultShift,
              }
            : u
        )
      );
    } catch (err) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : 'Error updating factory user. Please try again.';
      alert(errMsg);
    }
  };

  // Loading state skeleton screen
  if (loading) {
    return (
      <div className="login-page" style={{ flexDirection: 'column', gap: '1.0625rem' }}>
        <div
          style={{
            width: '2.125rem',
            height: '2.125rem',
            border: '0.1594rem solid var(--border-color)',
            borderTopColor: 'var(--color-primary)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        ></div>
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Initializing support desk session...</span>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!currentUser || !token) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  if (currentUser.needsPasswordReset === 1) {
    return <PasswordReset token={token} currentUser={currentUser} onResetSuccess={handlePasswordResetSuccess} />;
  }

  return (
    <div className="app-container">
      {/* Header navigation */}
      <Header
        currentUser={currentUser}
        activeTab={activeTab}
        setActiveTab={navigateToTab}
        onLogout={handleLogout}
        onChangePasswordClick={() => setIsPasswordModalOpen(true)}
      />

      {/* Main Section */}
      <main className="main-content">
        {/* Dynamic page container */}
        <section className="page-body">
          {currentTicket ? (
            <TicketDetails
              ticket={currentTicket}
              currentUser={currentUser}
              itUsers={itUsers}
              onBack={navigateBackToList}
              onUpdateStatus={handleUpdateStatus}
              onAssignTicket={handleAssignTicket}
              onAddComment={handleAddComment}
              onEditTicket={handleEditTicket}
              onDeleteTicket={handleDeleteTicket}
            />
          ) : activeTab === 'noticeboard' ? (
            <NoticeBoard
              notices={notices}
              currentUser={currentUser}
              onCreateNoticeClick={() => setIsCreateNoticeOpen(true)}
              onEditNoticeClick={(noticeId) => setSelectedNoticeId(noticeId)}
              loading={loading}
            />
          ) : activeTab === 'tickets' ? (
            <TicketList
              tickets={tickets}
              users={users}
              currentUser={currentUser}
              onSelectTicket={(id) => navigateToTicket('tickets', id)}
              onCreateTicketClick={() => setIsCreateModalOpen(true)}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              loading={loading}
            />
          ) : activeTab === 'users' && currentUser.role === 'it' ? (
            <UserManagement
              users={users}
              currentUser={currentUser}
              token={token}
              onAddUser={handleAddUser}
              onDeleteUser={handleDeleteUser}
              onOffboardUser={handleOffboardUser}
              onUpdateUser={handleUpdateUser}
              loading={loading}
            />
          ) : activeTab === 'factory_users' && (currentUser.role === 'factory_it' || currentUser.role === 'it') ? (
            <FactoryUserManagement
              users={factoryUsers}
              currentUser={currentUser}
              token={token}
              onAddUser={handleAddFactoryUser}
              onDeleteUser={handleDeleteFactoryUser}
              onOffboardUser={handleOffboardFactoryUser}
              onUpdateUser={handleUpdateFactoryUser}
              loading={loading}
            />
          ) : activeTab === 'attendance' ? (
            <Attendance
              currentUser={currentUser}
              allUsers={users}
              mode="hq"
              viewMode={attendanceViewMode}
              selectedUserId={attendanceSelectedUserId}
              onViewModeChange={handleAttendanceViewModeChange}
              onSelectedUserIdChange={handleAttendanceSelectedUserIdChange}
            />
          ) : activeTab === 'factory_attendance' ? (
            <Attendance
              currentUser={currentUser}
              allUsers={factoryUsers}
              mode="factory"
              viewMode={attendanceViewMode}
              selectedUserId={attendanceSelectedUserId}
              onViewModeChange={handleAttendanceViewModeChange}
              onSelectedUserIdChange={handleAttendanceSelectedUserIdChange}
            />
          ) : activeTab === 'leaves' ? (
            <LeaveManagement currentUser={currentUser} token={token!} />
          ) : activeTab === 'site_duties' ? (
            <SiteDutyManagement currentUser={currentUser} token={token!} />
          ) : activeTab === 'admin_tickets' ? (
            currentAdminTicket ? (
              <AdminTicketDetails
                ticket={currentAdminTicket}
                currentUser={currentUser}
                allUsers={users}
                onBack={navigateBackToList}
                onUpdateStatus={handleUpdateAdminTicketStatus}
                onRevertStatus={handleRevertAdminTicketStatus}
                onAddComment={handleAddAdminComment}
                onEditTicket={handleEditAdminTicket}
                onDeleteTicket={handleDeleteAdminTicket}
              />
            ) : (
              <AdminTicketList
                tickets={adminTickets}
                currentUser={currentUser}
                onSelectTicket={(id) => navigateToTicket('admin_tickets', id)}
                onCreateTicketClick={() => setIsCreateAdminModalOpen(true)}
                searchQuery={adminSearchQuery}
                setSearchQuery={setAdminSearchQuery}
                loading={loading}
              />
            )
          ) : (
            <ActivityLog
              tickets={tickets}
              currentUser={currentUser}
              onSelectTicket={(id) => navigateToTicket('tickets', id)}
              loading={loading}
            />
          )}
        </section>
      </main>

      {/* Noticeboard Modal Layers */}
      {isCreateNoticeOpen && (
        <CreateNoticeModal
          isOpen={isCreateNoticeOpen}
          onClose={() => setIsCreateNoticeOpen(false)}
          onSubmit={handleCreateNotice}
        />
      )}

      {selectedNoticeId && (
        <EditNoticeModal
          noticeId={selectedNoticeId}
          notice={notices.find((n) => n.id === selectedNoticeId)}
          onClose={() => setSelectedNoticeId(null)}
          onUpdate={handleEditNotice}
        />
      )}

      {/* Creation Modal dialog */}
      <NewTicketModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateTicket}
      />

      {/* Admin Ticket Creation Modal dialog */}
      <NewAdminTicketModal
        isOpen={isCreateAdminModalOpen}
        onClose={() => setIsCreateAdminModalOpen(false)}
        onSubmit={handleCreateAdminTicket}
      />

      {/* Change Password Modal */}
      {token && (
        <ChangePasswordModal isOpen={isPasswordModalOpen} onClose={() => setIsPasswordModalOpen(false)} token={token} />
      )}
    </div>
  );
}

export default App;
