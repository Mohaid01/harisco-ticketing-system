export type UserRole = 'it' | 'employee' | 'manager';

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
}

export type TicketType = 'hardware' | 'software' | 'maintenance' | 'upgrade';

export type TicketStatus = 
  | 'open'
  | 'awaiting_it_approval' 
  | 'awaiting_manager_approval' 
  | 'awaiting_handover' 
  | 'closed';

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

export type ActiveTab = 'dashboard' | 'tickets' | 'users' | 'activity_log' | 'attendance' | 'leaves';

export interface AttendanceLog {
  id: number;
  userId: string;
  name: string;
  ioTime: string;
  method: string;
  status: string;
  timestamp?: string;
}

export type LeaveCategory = 'annual' | 'casual' | 'medical';
export type LeaveStatus = 'pending' | 'approved' | 'rejected';

export interface LeaveApplication {
  id: string;
  userId: string;
  userName: string;
  category: LeaveCategory;
  startDate: string;
  endDate: string;
  reason: string;
  status: LeaveStatus;
  appliedAt: string;
}

