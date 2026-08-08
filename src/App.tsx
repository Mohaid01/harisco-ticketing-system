import { useEffect, useState } from 'react';

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
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { CreateNoticeModal } from './components/CreateNoticeModal';
import { EditNoticeModal } from './components/EditNoticeModal';
import { FactoryUserManagement } from './components/FactoryUserManagement';
import { LeaveManagement } from './components/LeaveManagement';
import { Login } from './components/Login';
import { NewAdminTicketModal } from './components/NewAdminTicketModal';
import { NewTicketModal } from './components/NewTicketModal';
import { NoticeBoard } from './components/NoticeBoard';
import { PasswordReset } from './components/PasswordReset';
import { Sidebar } from './components/Sidebar';
import { SiteDutyManagement } from './components/SiteDutyManagement';
import { TicketDetails } from './components/TicketDetails';
import { TicketList } from './components/TicketList';
import { UserManagement } from './components/UserManagement';
import { ADMIN_TICKET_STATUS_LABELS, APP_TITLE, STATUS_LABELS } from './constants';
import { ActivityLog } from './tabs/ActivityLogs';

function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('harisco_token'));
  const [notices, setNotices] = useState<Notice[]>([]);
  const [isCreateNoticeOpen, setIsCreateNoticeOpen] = useState(false);
  const [selectedNoticeId, setSelectedNoticeId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [factoryUsers, setFactoryUsers] = useState<AppUser[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('noticeboard');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [adminTickets, setAdminTickets] = useState<AdminTicket[]>([]);
  const [adminSearchQuery, setAdminSearchQuery] = useState<string>('');
  const [selectedAdminTicketId, setSelectedAdminTicketId] = useState<string | null>(null);
  const [isCreateAdminModalOpen, setIsCreateAdminModalOpen] = useState<boolean>(false);

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
    document.title = `${tabName} | ${APP_TITLE}`;
  }, [activeTab, selectedTicketId, selectedAdminTicketId, tickets, adminTickets]);

  // Find active ticket if viewing details
  const currentTicket = selectedTicketId ? tickets.find((t) => t.id === selectedTicketId) || null : null;

  const currentAdminTicket = selectedAdminTicketId
    ? adminTickets.find((t) => t.id === selectedAdminTicketId) || null
    : null;

  // Filter IT users for assignees dropdown
  const itUsers = users.filter((u) => u.role === 'it');

  const handleLoginSuccess = (newToken: string, user: AppUser) => {
    localStorage.setItem('harisco_token', newToken);
    setToken(newToken);
    setCurrentUser(user);
    setActiveTab('noticeboard');
  };

  const handlePasswordResetSuccess = (newToken: string, updatedUser: AppUser) => {
    localStorage.setItem('harisco_token', newToken);
    setToken(newToken);
    setCurrentUser(updatedUser);
    setActiveTab('noticeboard');
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
    setActiveTab('noticeboard');
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

    if (!window.confirm(`Update ticket ${ticketId} status to ${STATUS_LABELS[status]}?`)) {
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
      setSelectedTicketId(null);
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
      setActiveTab('tickets');
      setSelectedTicketId(newTicket.id);
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

    if (!window.confirm(`Update ticket ${ticketId} status to ${ADMIN_TICKET_STATUS_LABELS[status]}?`)) {
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
      setActiveTab('admin_tickets');
      setSelectedAdminTicketId(newTicket.id);
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
      setSelectedAdminTicketId(null);
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
      <div className="login-page" style={{ flexDirection: 'column', gap: '20px' }}>
        <div
          style={{
            width: '40px',
            height: '40px',
            border: '3px solid var(--border-color)',
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
      {/* Sidebar navigation */}
      <Sidebar
        currentUser={currentUser}
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setSelectedTicketId(null);
          setSelectedAdminTicketId(null);
        }}
        onLogout={handleLogout}
        onChangePasswordClick={() => setIsPasswordModalOpen(true)}
      />

      {/* Main Section */}
      <main className="main-content">
        {/* Global header bar */}
        <header className="app-header" style={{ justifyContent: 'space-between' }}>
          {/* Header title or context */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span
              style={{
                fontSize: '0.9rem',
                color: 'var(--text-muted)',
                fontWeight: 500,
              }}
            >
              Harisco IT Support
            </span>
          </div>
        </header>

        {/* Dynamic page container */}
        <section className="page-body">
          {currentTicket ? (
            <TicketDetails
              ticket={currentTicket}
              currentUser={currentUser}
              itUsers={itUsers}
              onBack={() => setSelectedTicketId(null)}
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
              currentUser={currentUser}
              onSelectTicket={(id) => setSelectedTicketId(id)}
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
              onUpdateUser={handleUpdateFactoryUser}
              loading={loading}
            />
          ) : activeTab === 'attendance' ? (
            <Attendance currentUser={currentUser} allUsers={users} mode="hq" />
          ) : activeTab === 'factory_attendance' ? (
            <Attendance currentUser={currentUser} allUsers={factoryUsers} mode="factory" />
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
                onBack={() => setSelectedAdminTicketId(null)}
                onUpdateStatus={handleUpdateAdminTicketStatus}
                onAddComment={handleAddAdminComment}
                onEditTicket={handleEditAdminTicket}
                onDeleteTicket={handleDeleteAdminTicket}
              />
            ) : (
              <AdminTicketList
                tickets={adminTickets}
                currentUser={currentUser}
                onSelectTicket={(id) => setSelectedAdminTicketId(id)}
                onCreateTicketClick={() => setIsCreateAdminModalOpen(true)}
                searchQuery={adminSearchQuery}
                setSearchQuery={setAdminSearchQuery}
                loading={loading}
              />
            )
          ) : (
            <ActivityLog tickets={tickets} currentUser={currentUser} onSelectTicket={(id) => setSelectedTicketId(id)} loading={loading} />
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
