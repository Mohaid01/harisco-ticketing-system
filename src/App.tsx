import { useState, useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { Dashboard } from "./components/Dashboard";
import { TicketList } from "./components/TicketList";
import { TicketDetails } from "./components/TicketDetails";
import { NewTicketModal } from "./components/NewTicketModal";
import { UserManagement } from "./components/UserManagement";
import { ActivityLog } from "./components/ActivityLog";
import { Attendance } from "./components/Attendance";
import { Login } from "./components/Login";
import { PasswordReset } from "./components/PasswordReset";
import { ChangePasswordModal } from "./components/ChangePasswordModal";
import { APP_TITLE, STATUS_LABELS } from "./constants";
import type {
  Ticket,
  AppUser,
  TicketStatus,
  TicketType,
  ActiveTab,
  UserRole,
} from "./types";

function App() {
  const [token, setToken] = useState<string | null>(
    localStorage.getItem("harisco_token"),
  );
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>("dashboard");
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] =
    useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // Load session and data
  useEffect(() => {
    const fetchSessionAndData = async () => {
      if (!token) {
        setCurrentUser(null);
        setTickets([]);
        setUsers([]);
        setLoading(false);
        return;
      }

      try {
        const authRes = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!authRes.ok) {
          throw new Error("Session expired");
        }

        const authData = await authRes.json();
        const user: AppUser = authData.user;
        setCurrentUser(user);

        if (user.needsPasswordReset === 1) {
          setLoading(false);
          return;
        }

        // Fetch tickets
        const ticketsRes = await fetch("/api/tickets", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (ticketsRes.ok) {
          const ticketsData = await ticketsRes.json();
          setTickets(ticketsData);
        }

        // Fetch users
        const usersRes = await fetch("/api/users", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (usersRes.ok) {
          const usersData = await usersRes.json();
          setUsers(usersData);
        }
      } catch (err) {
        console.error("Session verification failed:", err);
        localStorage.removeItem("harisco_token");
        setToken(null);
        setCurrentUser(null);
      } finally {
        setLoading(false);
      }
    };

    fetchSessionAndData();
  }, [token]);

  // Polling mechanism for real-time updates
  useEffect(() => {
    if (!token) return;

    const pollInterval = setInterval(async () => {
      try {
        const ticketsRes = await fetch("/api/tickets", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (ticketsRes.ok) {
          const ticketsData = await ticketsRes.json();
          // Update state only if data actually changed to prevent unnecessary re-renders
          setTickets((prevTickets) => {
            if (JSON.stringify(prevTickets) !== JSON.stringify(ticketsData)) {
              return ticketsData;
            }
            return prevTickets;
          });
        }

        // Optionally poll users if needed, though users change less frequently
        const usersRes = await fetch("/api/users", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (usersRes.ok) {
          const usersData = await usersRes.json();
          setUsers((prevUsers) => {
            if (JSON.stringify(prevUsers) !== JSON.stringify(usersData)) {
              return usersData;
            }
            return prevUsers;
          });
        }
      } catch {
        // Silent catch for background polling
      }
    }, 5000); // 5 seconds

    return () => clearInterval(pollInterval);
  }, [token]);

  // Synchronize document title for SEO
  useEffect(() => {
    if (selectedTicketId) {
      const ticket = tickets.find((t) => t.id === selectedTicketId);
      if (ticket) {
        document.title = `${ticket.id} | ${APP_TITLE}`;
        return;
      }
    }

    const tabName = activeTab
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
    document.title = `${tabName} | ${APP_TITLE}`;
  }, [activeTab, selectedTicketId, tickets]);

  // Find active ticket if viewing details
  const currentTicket = selectedTicketId
    ? tickets.find((t) => t.id === selectedTicketId) || null
    : null;

  // Filter IT users for assignees dropdown
  const itUsers = users.filter((u) => u.role === "it");

  const handleLoginSuccess = (newToken: string, user: AppUser) => {
    localStorage.setItem("harisco_token", newToken);
    setToken(newToken);
    setCurrentUser(user);
    setActiveTab("dashboard");
  };

  const handlePasswordResetSuccess = (
    newToken: string,
    updatedUser: AppUser,
  ) => {
    localStorage.setItem("harisco_token", newToken);
    setToken(newToken);
    setCurrentUser(updatedUser);
    setActiveTab("dashboard");
  };

  // Handle Logout
  const handleLogout = () => {
    localStorage.removeItem("harisco_token");
    setToken(null);
    setCurrentUser(null);
    setTickets([]);
    setUsers([]);
    setSelectedTicketId(null);
    setActiveTab("dashboard");
  };

  // Handle status updates
  const handleUpdateStatus = async (
    ticketId: string,
    status: TicketStatus,
    actionMessage: string,
    quotation?: number,
  ) => {
    if (!token || !currentUser) return;
    try {
      const res = await fetch(`/api/tickets/${ticketId}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status, actionMessage, quotation }),
      });

      if (!res.ok) throw new Error("Failed to update status");
      const result = await res.json();

      // Add a system comment in the activity thread locally
      const newComment = {
        id: `c-sys-${Date.now()}`,
        authorId: "system",
        authorName: "System Log",
        authorRole: "it" as UserRole,
        avatar:
          "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=100&h=100&q=80",
        content: `Workflow updated to status: ${STATUS_LABELS[status]}.${quotation !== undefined ? ` Quotation added: Rs ${quotation}` : ""}`,
        createdAt: new Date().toISOString(),
      };

      setTickets((prevTickets) =>
        prevTickets.map((t) => {
          if (t.id !== ticketId) return t;
          return {
            ...t,
            status: result.status,
            updatedAt: result.updatedAt,
            quotation:
              result.quotation !== undefined ? result.quotation : t.quotation,
            comments: [...t.comments, newComment],
            activityLogs: [...t.activityLogs, result.newLog],
          };
        }),
      );
    } catch (err) {
      console.error(err);
      alert("Error updating status. Please try again.");
    }
  };

  // Handle ticket assignment
  const handleAssignTicket = async (
    ticketId: string,
    assigneeId: string,
    assigneeName: string,
  ) => {
    if (!token || !currentUser) return;
    try {
      const res = await fetch(`/api/tickets/${ticketId}/assign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ assigneeId, assigneeName }),
      });

      if (!res.ok) throw new Error("Failed to assign ticket");
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
        }),
      );
    } catch (err) {
      console.error(err);
      alert("Error assigning ticket. Please try again.");
    }
  };

  // Handle edit ticket
  const handleEditTicket = async (
    ticketId: string,
    data: { description: string; type: TicketType; justification: string },
  ) => {
    if (!token || !currentUser) return;
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error("Failed to edit ticket");
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
        }),
      );
    } catch (err) {
      console.error(err);
      alert("Error editing ticket. Please try again.");
    }
  };

  // Handle delete ticket
  const handleDeleteTicket = async (ticketId: string) => {
    if (!token || !currentUser) return;
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error("Failed to delete ticket");

      setTickets((prevTickets) => prevTickets.filter((t) => t.id !== ticketId));
      setSelectedTicketId(null);
    } catch (err) {
      console.error(err);
      alert("Error deleting ticket. Please try again.");
    }
  };

  // Handle adding comments
  const handleAddComment = async (ticketId: string, content: string) => {
    if (!token || !currentUser) return;
    try {
      const res = await fetch(`/api/tickets/${ticketId}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content }),
      });

      if (!res.ok) throw new Error("Failed to add comment");
      const newComment = await res.json();

      const newLog = {
        id: `log-${Date.now()}`,
        action: "Comment added",
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
        }),
      );
    } catch (err) {
      console.error(err);
      alert("Error posting comment. Please try again.");
    }
  };

  const handleCreateTicket = async (data: {
    description: string;
    justification: string;
    type: TicketType;
  }) => {
    if (!token || !currentUser) return;
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error("Failed to raise ticket");
      const newTicket = await res.json();

      setTickets((prevTickets) => [newTicket, ...prevTickets]);
      setActiveTab("tickets");
      setSelectedTicketId(newTicket.id);
      setIsCreateModalOpen(false);
    } catch (err) {
      console.error(err);
      alert("Error raising issue ticket. Please try again.");
    }
  };

  // Handle adding users (IT only)
  const handleAddUser = async (data: {
    name: string;
    email: string;
    username: string;
    role: UserRole;
    password?: string;
  }) => {
    if (!token || !currentUser) return;
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to add user");
      }

      const newUser = await res.json();
      setUsers((prevUsers) => [...prevUsers, newUser]);
    } catch (err) {
      console.error(err);
      const errMsg =
        err instanceof Error
          ? err.message
          : "Error creating user. Please try again.";
      alert(errMsg);
    }
  };

  // Handle deleting users (IT only)
  const handleDeleteUser = async (userId: string) => {
    if (!token || !currentUser) return;
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to delete user");
      }

      setUsers((prevUsers) => prevUsers.filter((u) => u.id !== userId));
    } catch (err) {
      console.error(err);
      const errMsg =
        err instanceof Error
          ? err.message
          : "Error deleting user. Please try again.";
      alert(errMsg);
    }
  };

  // Handle updating users (IT only)
  const handleUpdateUser = async (
    userId: string,
    data: { name: string; email: string | null; department?: string | null; designation?: string | null },
  ) => {
    if (!token || !currentUser) return;
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to update user");
      }

      const updatedUser = await res.json();
      setUsers((prevUsers) =>
        prevUsers.map((u) =>
          u.id === userId
            ? { ...u, name: updatedUser.name, email: updatedUser.email, department: updatedUser.department, designation: updatedUser.designation }
            : u,
        ),
      );
    } catch (err) {
      console.error(err);
      const errMsg =
        err instanceof Error
          ? err.message
          : "Error updating user. Please try again.";
      alert(errMsg);
    }
  };

  // Loading state skeleton screen
  if (loading) {
    return (
      <div
        className="login-page"
        style={{ flexDirection: "column", gap: "20px" }}
      >
        <div
          style={{
            width: "40px",
            height: "40px",
            border: "3px solid var(--border-color)",
            borderTopColor: "var(--color-primary)",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
          }}
        ></div>
        <span style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
          Initializing support desk session...
        </span>
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
    return (
      <PasswordReset
        token={token}
        currentUser={currentUser}
        onResetSuccess={handlePasswordResetSuccess}
      />
    );
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
        }}
        onLogout={handleLogout}
        onChangePasswordClick={() => setIsPasswordModalOpen(true)}
      />

      {/* Main Section */}
      <main className="main-content">
        {/* Global header bar */}
        <header
          className="app-header"
          style={{ justifyContent: "space-between" }}
        >
          {/* Header title or context */}
          <div style={{ display: "flex", alignItems: "center" }}>
            <span
              style={{
                fontSize: "0.9rem",
                color: "var(--text-muted)",
                fontWeight: 500,
              }}
            >
              Harisco IT Support
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span
              style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}
            >
              Connected to SQLite Database
            </span>
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: "var(--status-closed)",
              }}
            ></span>
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
          ) : activeTab === "dashboard" ? (
            <Dashboard
              tickets={tickets}
              currentUser={currentUser}
              onSelectTicket={(id) => setSelectedTicketId(id)}
              onCreateTicketClick={() => setIsCreateModalOpen(true)}
              onViewAllTickets={() => setActiveTab("tickets")}
            />
          ) : activeTab === "tickets" ? (
            <TicketList
              tickets={tickets}
              currentUser={currentUser}
              onSelectTicket={(id) => setSelectedTicketId(id)}
              onCreateTicketClick={() => setIsCreateModalOpen(true)}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
            />
          ) : activeTab === "users" ? (
            <UserManagement
              users={users}
              currentUser={currentUser}
              token={token}
              onAddUser={handleAddUser}
              onDeleteUser={handleDeleteUser}
              onUpdateUser={handleUpdateUser}
            />
          ) : activeTab === "attendance" ? (
            <Attendance currentUser={currentUser} allUsers={users} />
          ) : (
            <ActivityLog
              tickets={tickets}
              currentUser={currentUser}
              onSelectTicket={(id) => setSelectedTicketId(id)}
            />
          )}
        </section>
      </main>

      {/* Creation Modal dialog */}
      <NewTicketModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateTicket}
      />

      {/* Change Password Modal */}
      {token && (
        <ChangePasswordModal
          isOpen={isPasswordModalOpen}
          onClose={() => setIsPasswordModalOpen(false)}
          token={token}
        />
      )}
    </div>
  );
}

export default App;
