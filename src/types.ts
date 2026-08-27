import type { LucideIcon } from 'lucide-react';

// User Types
export type UserRole =
  'it' | 'employee' | 'manager' | 'executive' | 'factory_employee' | 'factory_it' | 'factory_manager';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  username?: string;
  role: UserRole;
  needsPasswordReset?: number;
  department?: string | null;
  designation?: string | null;
  avatar?: string | null;
  isDepartmentHead?: number;
  loginEnabled?: number;
  casualLeaves?: number;
  annualLeaves?: number;
  medicalLeaves?: number;
  defaultShift?: string;
  is_active?: number;
  offboarded_at?: string;
  offboarded_by?: string;
  offboard_reason?: string;
}

// Ticket Types
export type TicketType = 'hardware' | 'software' | 'maintenance' | 'upgrade' | 'installation' | 'email' | 'others';

export type TicketStatus =
  'open' | 'awaiting_it_approval' | 'awaiting_manager_approval' | 'awaiting_handover' | 'closed';

export interface TicketComment {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  content: string;
  createdAt: string;
}

export interface Ticket {
  id: string;
  title: string;
  description: string;
  type: TicketType;
  status: TicketStatus;
  justification: string;
  createdAt: string;
  updatedAt: string;
  reporterId: string; // matches AppUser.id
  reporterName: string;
  reporterEmail: string;
  assigneeId?: string; // matches AppUser.id
  assigneeName?: string;
  quotation?: number;
  comments: TicketComment[];
  activityLogs: {
    id: string;
    action: string;
    timestamp: string;
    performedByName: string;
    performedByRole: UserRole;
  }[];
}

export interface AggregatedLog {
  id: string;
  action: string;
  timestamp: string;
  performedByName: string;
  performedByRole: UserRole;
  ticketId: string;
  ticketTitle: string;
}

// Admin Ticket Types
export type AdminTicketCategory =
  | 'staff_issue'
  | 'security'
  | 'maintenance'
  | 'cleaning_decoration'
  | 'mess_canteen'
  | 'travelling'
  | 'stationery_courier';

export type AdminTicketStatus =
  | 'awaiting_admin_manager'
  | 'awaiting_materials'
  | 'awaiting_technician'
  | 'awaiting_executive'
  | 'resolved'
  | 'rejected';

export interface AdminTicketComment {
  id: string;
  ticketId: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  content: string;
  createdAt: string;
}

export interface AdminTicket {
  id: string;
  description: string;
  category: AdminTicketCategory;
  status: AdminTicketStatus;
  previousStatus?: string | null;
  createdAt: string;
  updatedAt: string;
  reporterId: string;
  reporterName: string;
  reporterEmail: string;
  executiveId?: string;
  executiveName?: string;
  comments: AdminTicketComment[];
  activityLogs: {
    id: string;
    action: string;
    timestamp: string;
    performedByName: string;
    performedByRole: UserRole;
  }[];
}

// Sidebar Types
export type ActiveTab =
  | 'noticeboard'
  | 'tickets'
  | 'admin_tickets'
  | 'users'
  | 'factory_users'
  | 'activity_log'
  | 'attendance'
  | 'factory_attendance'
  | 'leaves'
  | 'site_duties';

export interface MenuItems {
  id: ActiveTab;
  label: string;
  icon: LucideIcon;
  roles: UserRole[];
  notAllowedDepartments?: string[];
}

// Attendance Types
export interface AttendanceLog {
  id: number;
  userId: string;
  name: string;
  ioTime: string;
  method: string;
  status: string;
  timestamp?: string;
}

// Leave Types
export type LeaveCategory = 'annual' | 'casual' | 'medical';
export type LeaveStatus = 'pending' | 'approved' | 'rejected';

export interface LeaveApplication {
  id: string;
  userId: string;
  userCode?: string;
  userName: string;
  category: LeaveCategory;
  startDate: string;
  endDate: string;
  reason: string;
  status: LeaveStatus;
  appliedAt: string;
}

// Site Duty Types
export interface SiteDutyApplication {
  id: string;
  userId: string;
  userCode?: string;
  userName: string;
  siteName: string;
  reason: string;
  startDate: string;
  endDate: string;
  status: LeaveStatus; // Reusing LeaveStatus as it has pending, approved, rejected
  appliedAt: string;
}

// Notice Types
export type NoticeType = 'outage' | 'maintenance' | 'policy' | 'general';

// Notice Interface with explicit language block payloads
export interface Notice {
  id: string;
  type: NoticeType;
  authorName: string;
  authorRole: string;
  authorAvatar?: string;
  authorDepartment?: string;
  authorDesignation?: string;
  createdAt: string;
  expiresAt?: string;
  en: {
    title: string;
    content: string;
  };
  ur: {
    title: string;
    content: string;
  };
}
