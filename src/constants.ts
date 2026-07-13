import type { TicketStatus, TicketType, UserRole, AppUser } from './types';

// Brand Configuration
export const PRIMARY_COLOR = '#0e529b';
export const APP_TITLE = 'Haris & Co Ticketing System';
export const EMPLOYEE_ID_PREFIX = 'HC-';

export const ROLE_LABELS: Record<UserRole, string> = {
  it: 'IT Administrator',
  employee: 'Employee',
  manager: 'Manager',
  executive: 'Executive',
};

export const TICKET_TYPE_LABELS: Record<TicketType, string> = {
  hardware: 'Hardware Issue',
  software: 'Software Issue',
  maintenance: 'Maintenance (Installation)',
  upgrade: 'System Upgrade',
};

export const TICKET_TYPE_OPTIONS = [
  { value: 'hardware' as TicketType, label: 'Hardware Issue' },
  { value: 'software' as TicketType, label: 'Software Issue' },
  { value: 'maintenance' as TicketType, label: 'Maintenance (Installation)' },
  { value: 'upgrade' as TicketType, label: 'System Upgrade' },
];

export const STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'Open / Unassigned',
  awaiting_it_approval: 'Awaiting IT Approval',
  awaiting_manager_approval: 'Awaiting Manager Approval',
  awaiting_handover: 'Awaiting Handover',
  closed: 'Closed',
};

export const STATUS_OPTIONS = [
  { value: 'open' as TicketStatus, label: 'Open', color: '#0e529b', bg: 'rgba(14, 82, 155, 0.12)' },
  { value: 'awaiting_it_approval' as TicketStatus, label: 'Awaiting IT Approval', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)' },
  { value: 'awaiting_manager_approval' as TicketStatus, label: 'Awaiting Manager Approval', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.12)' },
  { value: 'awaiting_handover' as TicketStatus, label: 'Awaiting Handover', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.12)' },
  { value: 'closed' as TicketStatus, label: 'Closed', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)' },
];

export const INITIAL_USERS: AppUser[] = [
  {
    id: 'usr-1',
    name: 'Sarah Connor',
    email: 'sarah.c@harisco.com',
    role: 'it',
  },
  {
    id: 'usr-2',
    name: 'David Kim',
    email: 'david.k@harisco.com',
    role: 'it',
  },
  {
    id: 'usr-3',
    name: 'Robert Vance',
    email: 'robert.v@harisco.com',
    role: 'manager',
  },
  {
    id: 'usr-4',
    name: 'Elena Rostova',
    email: 'elena.r@harisco.com',
    role: 'manager',
  },
  {
    id: 'usr-5',
    name: 'John Miller',
    email: 'john.m@harisco.com',
    role: 'employee',
  },
  {
    id: 'usr-6',
    name: 'Diana Prince',
    email: 'diana.p@harisco.com',
    role: 'employee',
  },
  {
    id: 'usr-7',
    name: 'James Harrison',
    email: 'james.h@harisco.com',
    role: 'employee',
  },
];
